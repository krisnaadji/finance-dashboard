import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid } from '@/lib/financial-validation';
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

  // Always last 12 months
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);

  const admin = createAdminClient();
  const { data: txns, error } = await admin
    .from('transactions')
    .select('amount, type, date')
    .eq('account_id', accountId)
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0]);
  if (error) return apiError(503, 'dependency_unavailable');

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
  } catch {
    return apiError(500, 'internal_error');
  }
}
