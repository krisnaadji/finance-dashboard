import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid, isRecord } from '@/lib/financial-validation';
import { apiError } from '@/lib/api-response';
import { currentMonthRange, calendarMonth } from '@/lib/business-date';
import { decodeFinanceSummary } from '@/lib/reporting-contract';

export async function GET(req: Request) {
  try {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!isUuid(accountId)) return apiError(400, 'invalid_request');
  const access = await requireAccountMember(accountId, auth.user);
  if (!access.ok) return access.response;

  const to = currentMonthRange().to;
  const [year, month] = to.slice(0, 7).split('-').map(Number);
  const from = calendarMonth(year, month - 11).from;
  const { data, error } = await createAdminClient().rpc('finance_summary', {
    p_account_id: accountId,
    p_from: from,
    p_to: to,
  });
  if (error) return apiError(503, 'dependency_unavailable');
  if (isRecord(data) && data.code === 'forbidden') return apiError(403, 'forbidden');
  if (isRecord(data) && data.code === 'invalid') return apiError(400, 'invalid_request');
  try {
    return NextResponse.json(decodeFinanceSummary(data).byMonth);
  } catch {
    return apiError(503, 'dependency_unavailable');
  }
  } catch {
    return apiError(500, 'internal_error');
  }
}
