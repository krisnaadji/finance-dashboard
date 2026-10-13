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
    const invite = await db.from('invite_tokens').select('id,account_id,accounts(id,name,is_active)')
      .eq('token', token).eq('used', false).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (invite.error) return apiError(503, 'dependency_unavailable');
    if (!invite.data || !isUuid(invite.data.account_id)) return apiError(400, 'invalid_request');
    const account: unknown = invite.data.accounts;
    if (!isRecord(account) || account.is_active !== true || typeof account.name !== 'string')
      return apiError(403, 'forbidden');
    const member = await db.from('members').select('id')
      .eq('account_id', invite.data.account_id).eq('user_id', auth.user.id).maybeSingle();
    if (member.error) return apiError(503, 'dependency_unavailable');
    if (!member.data) {
      const inserted = await db.from('members').insert({
        account_id: invite.data.account_id, user_id: auth.user.id, role: 'member',
        display_name: typeof auth.user.user_metadata.full_name === 'string'
          ? auth.user.user_metadata.full_name : auth.user.email ?? null,
      }).select('id').single();
      if (inserted.error) return apiError(503, 'dependency_unavailable');
      if (!inserted.data) return apiError(404, 'not_found');
    }
    const consumed = await db.from('invite_tokens').update({ used: true })
      .eq('id', invite.data.id).eq('used', false).gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
    if (consumed.error) return apiError(503, 'dependency_unavailable');
    if (!consumed.data) return apiError(409, 'conflict');
    return NextResponse.json({ accountId: invite.data.account_id, accountName: account.name });
  } catch {
    return apiError(500, 'internal_error');
  }
}
