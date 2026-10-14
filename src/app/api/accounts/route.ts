import { createAdminClient } from '@/lib/supabase-server';
import { requireUser, requireAccountOwner } from '@/lib/server-auth';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { isRecord, isUuid } from '@/lib/financial-validation';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const db = createAdminClient();
    const owned = await db.from('accounts').select('*').eq('owner_id', auth.user.id).eq('is_active', true);
    if (owned.error) return apiError(503, 'dependency_unavailable');
    const memberships = await db.from('members').select('account_id').eq('user_id', auth.user.id);
    if (memberships.error) return apiError(503, 'dependency_unavailable');
    const memberIds = (memberships.data ?? []).map(m => m.account_id);
    const memberAccounts = memberIds.length
      ? await db.from('accounts').select('*').in('id', memberIds).eq('is_active', true)
      : { data: [], error: null };
    if (memberAccounts.error) return apiError(503, 'dependency_unavailable');
    const unique = new Map<string, Record<string, unknown>>();
    for (const account of [...owned.data ?? [], ...memberAccounts.data ?? []]) {
      unique.set(account.id, { ...account, role: account.owner_id === auth.user.id ? 'owner' : 'member' });
    }
    return NextResponse.json([...unique.values()]);
  } catch {
    return apiError(500, 'internal_error');
  }
}

// POST: create a new account and seed default categories
export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, true);
    if (check) return check;
    const body = await req.json().catch(() => null);
    if (!isRecord(body) || Object.keys(body).some(k => !['name', 'type', 'operation_id'].includes(k)) ||
        typeof body.name !== 'string' || !body.name.trim() ||
        (body.type !== 'personal' && body.type !== 'group') || !isUuid(body.operation_id))
      return apiError(400, 'invalid_request');
    const db = createAdminClient();
    const profile = await db.from('members').select('display_name').eq('user_id', auth.user.id)
      .not('display_name', 'is', null).limit(1).maybeSingle();
    if (profile.error) return apiError(503, 'dependency_unavailable');
    const metadataName = isRecord(auth.user.user_metadata) && typeof auth.user.user_metadata.full_name === 'string'
      ? auth.user.user_metadata.full_name : null;
    const created = await db.rpc('create_finance_account', {
      p_user_id: auth.user.id,
      p_operation_id: body.operation_id,
      p_name: body.name.trim(),
      p_type: body.type,
      p_display_name: profile.data?.display_name ?? metadataName,
    });
    if (created.error) return apiError(503, 'dependency_unavailable');
    if (!isRecord(created.data)) return apiError(503, 'dependency_unavailable');
    if (created.data.code === 'invalid') return apiError(400, 'invalid_request');
    if (created.data.code === 'forbidden') return apiError(403, 'forbidden');
    if (created.data.code === 'conflict') return apiError(409, 'conflict');
    if (created.data.code !== 'accepted' || !isRecord(created.data.account))
      return apiError(503, 'dependency_unavailable');
    return NextResponse.json(created.data.account);
  } catch {
    return apiError(500, 'internal_error');
  }
}

// PATCH: edit account name and type
export async function PATCH(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, true);
    if (check) return check;
    const body = await req.json().catch(() => null);
    if (!isRecord(body) || Object.keys(body).some(k => !['id', 'name', 'type'].includes(k)) ||
        !isUuid(body.id) || typeof body.name !== 'string' || !body.name.trim() ||
        (body.type !== undefined && body.type !== 'personal' && body.type !== 'group'))
      return apiError(400, 'invalid_request');
    const access = await requireAccountOwner(body.id, auth.user);
    if (!access.ok) return access.response;
    const fields: { name: string; type?: 'personal' | 'group' } = { name: body.name.trim() };
    if (body.type !== undefined) fields.type = body.type;
    const saved = await createAdminClient().from('accounts').update(fields)
      .eq('id', body.id).eq('owner_id', auth.user.id).eq('is_active', true).select('*').maybeSingle();
    if (saved.error) return apiError(503, 'dependency_unavailable');
    if (!saved.data) return apiError(404, 'not_found');
    return NextResponse.json(saved.data);
  } catch {
    return apiError(500, 'internal_error');
  }
}

// DELETE: soft delete account
export async function DELETE(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, false);
    if (check) return check;
    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return apiError(400, 'invalid_request');
    const access = await requireAccountOwner(id, auth.user);
    if (!access.ok) return access.response;
    const deactivated = await createAdminClient().from('accounts').update({ is_active: false })
      .eq('id', id).eq('owner_id', auth.user.id).eq('is_active', true).select('id').maybeSingle();
    if (deactivated.error) return apiError(503, 'dependency_unavailable');
    if (!deactivated.data) return apiError(404, 'not_found');
    return NextResponse.json({ ok: true });
  } catch {
    return apiError(500, 'internal_error');
  }
}
