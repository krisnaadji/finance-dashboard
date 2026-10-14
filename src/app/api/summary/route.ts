import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid, isBusinessDate, isRecord } from '@/lib/financial-validation';
import { apiError } from '@/lib/api-response';
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
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!isBusinessDate(from) || !isBusinessDate(to) || from > to)
    return apiError(400, 'invalid_request');

  const { data, error } = await createAdminClient().rpc('finance_summary', {
    p_account_id: accountId,
    p_from: from,
    p_to: to,
  });
  if (error) return apiError(503, 'dependency_unavailable');
  if (isRecord(data) && data.code === 'forbidden') return apiError(403, 'forbidden');
  if (isRecord(data) && data.code === 'invalid') return apiError(400, 'invalid_request');
  try {
    return NextResponse.json(decodeFinanceSummary(data));
  } catch {
    return apiError(503, 'dependency_unavailable');
  }
  } catch {
    return apiError(500, 'internal_error');
  }
}
