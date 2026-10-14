import { createAdminClient } from '@/lib/supabase-server';
import { requireUser, requireAccountOwner } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { isRecord } from '@/lib/financial-validation';
import { NextResponse } from 'next/server';

function generateCode(accountName: string): string {
  const prefix = accountName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${prefix}-${suffix}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, false);
    if (check) return check;
    const { id } = await params;
    const access = await requireAccountOwner(id, auth.user);
    if (!access.ok) return access.response;
    const account = await createAdminClient().from('accounts').select('name')
      .eq('id', id).eq('owner_id', auth.user.id).eq('is_active', true).maybeSingle();
    if (account.error) return apiError(503, 'dependency_unavailable');
    if (!account.data) return apiError(404, 'not_found');
    const db = createAdminClient();
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await db.rpc('replace_finance_link_code', {
        p_user_id: auth.user.id, p_account_id: id, p_code: generateCode(account.data.name),
      });
      if (result.error) return apiError(503, 'dependency_unavailable');
      if (!isRecord(result.data)) return apiError(503, 'dependency_unavailable');
      if (result.data.code === 'collision') continue;
      if (result.data.code === 'invalid') return apiError(400, 'invalid_request');
      if (result.data.code === 'forbidden') return apiError(403, 'forbidden');
      if (result.data.code === 'not_found') return apiError(404, 'not_found');
      if (result.data.code === 'conflict') return apiError(409, 'conflict');
      if (result.data.code !== 'accepted' || !isRecord(result.data.linkCode) ||
          typeof result.data.linkCode.code !== 'string' || typeof result.data.linkCode.expiresAt !== 'string')
        return apiError(503, 'dependency_unavailable');
      return NextResponse.json({
        code: result.data.linkCode.code,
        expiresAt: result.data.linkCode.expiresAt,
      });
    }
    return apiError(409, 'conflict');
  } catch {
    return apiError(500, 'internal_error');
  }
}
