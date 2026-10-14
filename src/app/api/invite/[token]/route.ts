import { createAdminClient } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { isRecord, isUuid } from '@/lib/financial-validation';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, false);
    if (check) return check;
    const { token } = await params;
    if (!token || token.length > 256) return apiError(400, 'invalid_request');
    const db = createAdminClient();
    const metadataName = isRecord(auth.user.user_metadata) && typeof auth.user.user_metadata.full_name === 'string'
      ? auth.user.user_metadata.full_name : null;
    const result = await db.rpc('redeem_finance_invite', {
      p_user_id: auth.user.id,
      p_token: token,
      p_display_name: metadataName ?? auth.user.email ?? null,
    });
    if (result.error) return apiError(503, 'dependency_unavailable');
    if (!isRecord(result.data)) return apiError(503, 'dependency_unavailable');
    if (result.data.code === 'invalid' || result.data.code === 'expired')
      return apiError(400, 'invalid_request');
    if (result.data.code === 'forbidden') return apiError(403, 'forbidden');
    if (result.data.code === 'conflict') return apiError(409, 'conflict');
    if (result.data.code !== 'accepted' || !isUuid(result.data.accountId) ||
        typeof result.data.accountName !== 'string')
      return apiError(503, 'dependency_unavailable');
    return NextResponse.json({ accountId: result.data.accountId, accountName: result.data.accountName });
  } catch {
    return apiError(500, 'internal_error');
  }
}
