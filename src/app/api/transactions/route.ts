import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid, parseFinancialJson } from '@/lib/financial-validation';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { decodeFinanceBudgetSpending } from '@/lib/reporting-contract';
import { budgetPercent, compareMoney } from '@/lib/money';
import { currentMonthRange } from '@/lib/business-date';
import { parseTransactionInput, validateTransactionCategory } from '@/lib/transaction-validation';
import { parseTransactionFilters } from '@/lib/transaction-filters';


export async function GET(req: Request) {
  try {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!isUuid(accountId)) return apiError(400, 'invalid_request');
  const access = await requireAccountMember(accountId, auth.user);
  if (!access.ok) return access.response;
  const filters = parseTransactionFilters(searchParams);
  if (!filters) return apiError(400, 'invalid_request');
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('page_size') ?? '20');
  if (!Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 99999 ||
      !Number.isSafeInteger((page - 1) * pageSize)) return apiError(400, 'invalid_request');

  const admin = createAdminClient();
  const from_ = (page - 1) * pageSize;
  const to_ = from_ + pageSize - 1;

  let query = admin
    .from('transactions')
    .select('*, amount_text:amount::text, categories(name)', { count: 'exact' })
    .eq('account_id', filters.accountId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from_, to_);

  if (filters.from) query = query.gte('date', filters.from);
  if (filters.to) query = query.lte('date', filters.to);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.search) query = query.ilike('description', `%${filters.search}%`);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);

  const { data, count, error } = await query;
  if (error) return apiError(503, 'dependency_unavailable');
  if ((data ?? []).some(row => typeof row.amount_text !== 'string')) return apiError(503, 'dependency_unavailable');
  return NextResponse.json({
    data: (data ?? []).map(({ amount_text, ...row }) => ({ ...row, amount: amount_text })),
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  });
  } catch {
    return apiError(500, 'internal_error');
  }
}

// POST: create a transaction from the dashboard
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const requestError = checkMutationRequest(req, true);
    if (requestError) return requestError;
    const input = parseTransactionInput(await req.text().then(parseFinancialJson).catch(() => null), true);
    if (!input) return apiError(400, 'invalid_request');
    const access = await requireAccountMember(input.account_id!, auth.user);
    if (!access.ok) return access.response;
    const admin = createAdminClient();
    const categoryError = await validateTransactionCategory(admin, input.account_id!, input.type!, input.category_id ?? null, false);
    if (categoryError) return categoryError;
    const { data: txn, error } = await admin.from('transactions').insert({
      account_id: input.account_id!, amount: input.amount!, type: input.type!, date: input.date!,
      description: input.description ?? '', category_id: input.category_id ?? null,
      raw_message: null, wa_user_message_id: null,
      recorded_by_name: access.access.displayName, recorded_by_phone: null,
    }).select('*, amount_text:amount::text, categories(name)').single();
    if (error) return apiError(503, 'dependency_unavailable');
    if (!txn) return apiError(404, 'not_found');
    if (typeof txn.amount_text !== 'string') return apiError(503, 'dependency_unavailable');
    const { amount_text, ...transaction } = txn;
    const exactTransaction = { ...transaction, amount: amount_text };
    const type = input.type!;
    const category_id = input.category_id ?? null;
    const account_id = input.account_id!;
    let budgetWarning: { category_name: string; spent: string; limit: string; pct: number; over: boolean } | null = null;
    let budgetWarningError: string | undefined;
    if (type === 'expense' && category_id) {
      const budget = await admin.from('budgets').select('amount_text:amount::text').eq('account_id', account_id)
        .eq('category_id', category_id).maybeSingle();
      if (budget.error) budgetWarningError = 'dependency_unavailable';
      else if (budget.data) {
        try {
          const { from, to } = currentMonthRange();
        const spend = await admin.rpc('finance_budget_spending', {
          p_account_id: account_id, p_from: from, p_to: to,
        });
        if (spend.error) budgetWarningError = 'dependency_unavailable';
        else {
          try {
            const report = decodeFinanceBudgetSpending(spend.data);
            const spent = report.spendingByCategoryId[category_id] ?? '0.00';
            const limit = budget.data.amount_text;
            const pct = Math.round(budgetPercent(spent, limit));
            const over = compareMoney(spent, limit) > 0;
            if (over || pct >= 80) budgetWarning = {
              category_name: (txn.categories as { name?: string } | null)?.name ?? '',
              spent, limit, pct, over,
            };
          } catch {
            budgetWarningError = 'dependency_unavailable';
          }
        }
        } catch {
          budgetWarningError = 'dependency_unavailable';
        }
      }
    }
    return NextResponse.json({
      transaction: exactTransaction, budgetWarning, ...(budgetWarningError ? { budgetWarningError } : {}),
    });
  } catch {
    return apiError(500, 'internal_error');
  }
}
