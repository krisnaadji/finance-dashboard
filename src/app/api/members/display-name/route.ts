import { createAdminClient } from '@/lib/supabase-server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { isRecord, isUuid } from '@/lib/financial-validation';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, true);
    if (check) return check;
    const body = await req.json().catch(() => null);
    if (!isRecord(body) || Object.keys(body).some(k => !['accountId', 'displayName'].includes(k)) ||
        !isUuid(body.accountId) || typeof body.displayName !== 'string' || !body.displayName.trim())
      return apiError(400, 'invalid_request');
    const access = await requireAccountMember(body.accountId, auth.user);
    if (!access.ok) return access.response;
    const saved = await createAdminClient().from('members').update({ display_name: body.displayName.trim() })
      .eq('account_id', body.accountId).eq('user_id', auth.user.id).select('id').maybeSingle();
    if (saved.error) return apiError(503, 'dependency_unavailable');
    if (!saved.data) return apiError(404, 'not_found');
    return NextResponse.json({ ok: true });
  } catch {
    return apiError(500, 'internal_error');
  }
}
