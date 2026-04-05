import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!accountId || !from || !to)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const admin = createAdminClient();
  const { data: txns } = await admin
    .from('transactions')
    .select('amount, type, categories(name)')
    .eq('account_id', accountId)
    .gte('date', from)
    .lte('date', to);

  const rows = txns ?? [];
  const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = rows
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const txn of rows.filter((t) => t.type === 'expense')) {
    const name = (txn.categories as any)?.name ?? 'Other';
    byCategory[name] = (byCategory[name] ?? 0) + Number(txn.amount);
  }

  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const txn of rows) {
    const month = (txn as any).date?.slice(0, 7) ?? '';
    if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
    byMonth[month][txn.type as 'income' | 'expense'] += Number(txn.amount);
  }

  return NextResponse.json({ income, expense, net: income - expense, byCategory, byMonth });
}
