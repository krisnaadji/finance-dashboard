import { createAdminClient } from '@/lib/supabase-server';
import { requireUser, requireAccountOwner } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { NextResponse } from 'next/server';

function generateCode(accountName: string): string {
  const prefix = accountName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return prefix + '-' + suffix;
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
    const db = createAdminClient();
    const account = await db.from('accounts').select('name')
      .eq('id', id).eq('owner_id', auth.user.id).eq('is_active', true).maybeSingle();
    if (account.error) return apiError(503, 'dependency_unavailable');
    if (!account.data) return apiError(404, 'not_found');
    const retired = await db.from('link_codes').update({ used: true }).eq('account_id', id).eq('used', false);
    if (retired.error) return apiError(503, 'dependency_unavailable');
    const code = generateCode(account.data.name);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const saved = await db.from('link_codes').insert({ account_id: id, code, expires_at: expiresAt })
      .select('id,code,expires_at').single();
    if (saved.error) return apiError(503, 'dependency_unavailable');
    if (!saved.data) return apiError(404, 'not_found');
    return NextResponse.json({ code: saved.data.code, expiresAt: saved.data.expires_at });
  } catch {
    return apiError(500, 'internal_error');
  }
}
