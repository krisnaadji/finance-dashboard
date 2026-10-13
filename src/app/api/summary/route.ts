import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid, isBusinessDate } from '@/lib/financial-validation';
import { apiError } from '@/lib/api-response';

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
  if (!isBusinessDate(from) || !isBusinessDate(to) || from > to)
    return apiError(400, 'invalid_request');

  const admin = createAdminClient();
  const { data: txns, error } = await admin
    .from('transactions')
    .select('id, amount, type, description, date, category_id, categories(name)')
    .eq('account_id', accountId)
    .gte('date', from)
    .lte('date', to);
  if (error) return apiError(503, 'dependency_unavailable');

  const rows = txns ?? [];
  const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = rows
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const byCategory: Record<string, number> = {};
  const spendingByCategoryId: Record<string, number> = {};

  for (const txn of rows.filter((t) => t.type === 'expense')) {
    const name = (txn.categories as any)?.name ?? 'Other';
    const catId = (txn as any).category_id;
    byCategory[name] = (byCategory[name] ?? 0) + Number(txn.amount);
    if (catId)
      spendingByCategoryId[catId] = (spendingByCategoryId[catId] ?? 0) + Number(txn.amount);
  }

  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const txn of rows) {
    const month = (txn as any).date?.slice(0, 7) ?? '';
    if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
    byMonth[month][txn.type as 'income' | 'expense'] += Number(txn.amount);
  }

  const topExpenses = rows
    .filter((t) => t.type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      date: (t as any).date,
      category: (t.categories as any)?.name ?? '—',
    }));

  const topIncomes = rows
    .filter((t) => t.type === 'income')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      date: (t as any).date,
      category: (t.categories as any)?.name ?? '—',
    }));

  return NextResponse.json({
    income,
    expense,
    net: income - expense,
    byCategory,
    spendingByCategoryId,
    byMonth,
    topExpenses,
    topIncomes,
  });
  } catch {
    return apiError(500, 'internal_error');
  }
}
