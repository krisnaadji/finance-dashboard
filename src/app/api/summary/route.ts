import { createAdminClient } from '@/lib/supabase-server';
import { getAuthUser, requireAccountMember, type AccountAuthClient } from '@/lib/server-auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!accountId || !from || !to)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const auth = await requireAccountMember(admin as unknown as AccountAuthClient, accountId, user);
  if (!auth.ok) return auth.response;

  const { data: txns } = await admin
    .from('transactions')
    .select('id, amount, type, description, date, category_id, categories(name)')
    .eq('account_id', accountId)
    .gte('date', from)
    .lte('date', to);

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
}
