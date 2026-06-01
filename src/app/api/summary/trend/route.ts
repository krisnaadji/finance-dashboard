import { createAdminClient } from '@/lib/supabase-server';
import { getAuthUser, requireAccountMember, type AccountAuthClient } from '@/lib/server-auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!accountId) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Always last 12 months
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);

  const admin = createAdminClient();
  const auth = await requireAccountMember(admin as unknown as AccountAuthClient, accountId, user);
  if (!auth.ok) return auth.response;

  const { data: txns } = await admin
    .from('transactions')
    .select('amount, type, date')
    .eq('account_id', accountId)
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0]);

  const byMonth: Record<string, { income: number; expense: number }> = {};

  // Pre-fill all 12 months with 0 so empty months still show on chart
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - 11 + i);
    const key = d.toISOString().slice(0, 7);
    byMonth[key] = { income: 0, expense: 0 };
  }

  for (const txn of txns ?? []) {
    const month = txn.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
    byMonth[month][txn.type as 'income' | 'expense'] += Number(txn.amount);
  }

  return NextResponse.json(byMonth);
}
