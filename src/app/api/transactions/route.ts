import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid, parseFinancialJson } from '@/lib/financial-validation';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { decodeFinanceBudgetSpending, decodeTransactionView } from '@/lib/reporting-contract';
import { categoryLabel, type Category } from '@/lib/categories';
import { budgetPercent, compareMoney } from '@/lib/money';
import { currentMonthRange } from '@/lib/business-date';
import { parseTransactionInput, validateTransactionCategory, transactionCategoryProjection, validateTransactionFilters } from '@/lib/transaction-validation';
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
  if (!Number.isSafeInteger(page) || page < 1 || page > 2_147_483_647 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 99999 ||
      !Number.isSafeInteger((page - 1) * pageSize)) return apiError(400, 'invalid_request');

  const admin = createAdminClient();
  const filterError = await validateTransactionFilters(admin, filters, searchParams);
  if (filterError) return filterError;
  const result = await admin.rpc('finance_transaction_view', {
    p_account_id: accountId, p_filters: filters, p_page: page, p_page_size: pageSize,
  });
  if (result.error) return apiError(result.error.code === '22023' ? 400 : 503,
    result.error.code === '22023' ? 'invalid_request' : 'dependency_unavailable');
  if (result.data?.code === 'invalid') return apiError(400, 'invalid_request');
  if (result.data?.code === 'forbidden') return apiError(403, 'forbidden');
  try {
    const view = decodeTransactionView(result.data);
    if (view.rows.length > pageSize || view.rows.some(row => row.account_id !== accountId)) return apiError(503,'dependency_unavailable');
    return NextResponse.json({data:view.rows,total:view.total,summary:view.summary,page,pageSize,totalPages:Math.ceil(view.total/pageSize)});
  } catch { return apiError(503,'dependency_unavailable'); }
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
    }).select('*, amount_text:amount::text').single();
    if (error) return apiError(503, 'dependency_unavailable');
    if (!txn) return apiError(404, 'not_found');
    if (typeof txn.amount_text !== 'string') return apiError(503, 'dependency_unavailable');
    const { amount_text, ...transaction } = txn;
    const {categoryProjectionError,...projection} = await transactionCategoryProjection(admin,input.account_id!,input.type!,input.category_id??null);
    const exactTransaction = { ...transaction, amount: amount_text, ...projection };
    const type = input.type!;
    const category_id = projection.parent?.id ?? input.category_id ?? null;
    const root = projection.parent ?? projection.categories;
    const warningLabel = root ? categoryLabel(root,'id') : '';
    const account_id = input.account_id!;
    let budgetWarning: { category_name: string; category: Category; spent: string; limit: string; pct: number; over: boolean } | null = null;
    let budgetWarningError: string | undefined = categoryProjectionError;
    if (!categoryProjectionError && type === 'expense' && category_id) {
      try {
        const budget = await admin.from('budgets').select('amount_text:amount::text').eq('account_id', account_id)
          .eq('category_id', category_id).maybeSingle();
        if (budget.error) budgetWarningError = 'dependency_unavailable';
        else if (budget.data) {
          const { from, to } = currentMonthRange();
          const spend = await admin.rpc('finance_budget_spending', {
            p_account_id: account_id, p_from: from, p_to: to,
          });
          if (spend.error) budgetWarningError = 'dependency_unavailable';
          else {
            const report = decodeFinanceBudgetSpending(spend.data);
            const spent = report.spendingByCategoryId[category_id] ?? '0.00';
            const limit = budget.data.amount_text;
            const pct = Math.round(budgetPercent(spent, limit));
            const over = compareMoney(spent, limit) > 0;
            if (root && (over || pct >= 80)) budgetWarning = {
              category_name: warningLabel, category: root,
              spent, limit, pct, over,
            };
          }
        }
      } catch {
        budgetWarningError = 'dependency_unavailable';
      }
    }
    return NextResponse.json({
      transaction: exactTransaction, budgetWarning, ...(categoryProjectionError ? { categoryProjectionError } : {}),
      ...(budgetWarningError ? { budgetWarningError } : {}),
    });
  } catch {
    return apiError(500, 'internal_error');
  }
}
