import { createAdminClient } from '@/lib/supabase-server';
import { requireUser, requireAccountOwner } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, false);
    if (check) return check;
    const { id } = await params;
    const access = await requireAccountOwner(id, auth.user);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const retired = await db.from('invite_tokens').update({ used: true }).eq('account_id', id).eq('used', false);
    if (retired.error) return apiError(503, 'dependency_unavailable');
    const saved = await db.from('invite_tokens').insert({ account_id: id }).select('id,token,expires_at').single();
    if (saved.error) return apiError(503, 'dependency_unavailable');
    if (!saved.data || typeof saved.data.token !== 'string' || typeof saved.data.expires_at !== 'string')
      return apiError(404, 'not_found');
    return NextResponse.json({
      url: process.env.NEXT_PUBLIC_APP_URL + '/invite/' + saved.data.token, expiresAt: saved.data.expires_at,
    });
  } catch {
    return apiError(500, 'internal_error');
  }
}
