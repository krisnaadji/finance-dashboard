import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid, isBusinessDate, parseFinancialJson } from '@/lib/financial-validation';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { parseTransactionInput, validateTransactionCategory } from '@/lib/transaction-validation';


export async function GET(req: Request) {
  try {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!isUuid(accountId)) return apiError(400, 'invalid_request');
  const access = await requireAccountMember(accountId, auth.user);
  if (!access.ok) return access.response;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const type = searchParams.get('type');
  const search = searchParams.get('search');
  const categoryId = searchParams.get('category_id');
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('page_size') ?? '20');
  if ((from && !isBusinessDate(from)) || (to && !isBusinessDate(to)) ||
      (from && to && from > to) || (type && type !== 'income' && type !== 'expense') ||
      (categoryId && !isUuid(categoryId)) || !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 99999 ||
      !Number.isSafeInteger((page - 1) * pageSize)) return apiError(400, 'invalid_request');

  const admin = createAdminClient();
  const from_ = (page - 1) * pageSize;
  const to_ = from_ + pageSize - 1;

  let query = admin
    .from('transactions')
    .select('*, categories(name)', { count: 'exact' })
    .eq('account_id', accountId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from_, to_);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (type) query = query.eq('type', type);
  if (search) query = query.ilike('description', `%${search}%`);
  if (categoryId) query = query.eq('category_id', categoryId);

  const { data, count, error } = await query;
  if (error) return apiError(503, 'dependency_unavailable');
  return NextResponse.json({
    data: data ?? [],
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
    }).select('*,categories(name)').single();
    if (error) return apiError(503, 'dependency_unavailable');
    if (!txn) return apiError(404, 'not_found');
    const type = input.type!;
    const category_id = input.category_id ?? null;
    const account_id = input.account_id!;
    let budgetWarning: { category_name: string; spent: number; limit: number; pct: number; over: boolean } | null = null;
    let budgetWarningError: string | undefined;
    if (type === 'expense' && category_id) {
      const budget = await admin.from('budgets').select('amount').eq('account_id', account_id)
        .eq('category_id', category_id).maybeSingle();
      if (budget.error) budgetWarningError = 'dependency_unavailable';
      else if (budget.data) {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const to = now.toISOString().split('T')[0];
        const spend = await admin.from('transactions').select('amount').eq('account_id', account_id)
          .eq('category_id', category_id).eq('type', 'expense').gte('date', from).lte('date', to);
        const limit = Number(budget.data.amount);
        const totalSpent = (spend.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
        if (spend.error || !Number.isFinite(limit) || limit <= 0 || !Number.isFinite(totalSpent)) {
          budgetWarningError = 'dependency_unavailable';
        } else {
          const pct = Math.round(totalSpent / limit * 100);
          const over = totalSpent > limit;
          if (over || pct >= 80) budgetWarning = {
            category_name: (txn.categories as { name?: string } | null)?.name ?? '',
            spent: totalSpent, limit, pct, over,
          };
        }
      }
    }
    return NextResponse.json({ transaction: txn, budgetWarning, ...(budgetWarningError ? { budgetWarningError } : {}) });
  } catch {
    return apiError(500, 'internal_error');
  }
}
