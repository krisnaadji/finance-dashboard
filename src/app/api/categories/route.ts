import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser, requireAccountMember, requireAccountOwner } from '@/lib/server-auth';
import { isUuid, isRecord } from '@/lib/financial-validation';
import { apiError, checkMutationRequest } from '@/lib/api-response';
import { requireResource } from '@/lib/resource-access';

export async function GET(req: Request) {
  try {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!isUuid(accountId)) return apiError(400, 'invalid_request');
  const access = await requireAccountMember(accountId, auth.user);
  if (!access.ok) return access.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('categories')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('type')
    .order('sort_order');
  if (error) return apiError(503, 'dependency_unavailable');
  return NextResponse.json(data ?? []);
  } catch {
    return apiError(500, 'internal_error');
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, true);
    if (check) return check;
    const body = await req.json().catch(() => null);
    if (!isRecord(body) || Object.keys(body).some(k => !['account_id', 'name', 'type'].includes(k)) ||
        !isUuid(body.account_id) || typeof body.name !== 'string' || !body.name.trim() ||
        (body.type !== 'income' && body.type !== 'expense')) return apiError(400, 'invalid_request');
    const name = body.name.trim();
    const access = await requireAccountOwner(body.account_id, auth.user);
    if (!access.ok) return access.response;
    const admin = createAdminClient();
    const existing = await admin.from('categories').select('name').eq('account_id', body.account_id);
    if (existing.error) return apiError(503, 'dependency_unavailable');
    if ((existing.data ?? []).some(c => c.name.trim().toLowerCase() === name.toLowerCase()))
      return apiError(409, 'conflict');
    const inserted = await admin.from('categories')
      .insert({ account_id: body.account_id, name, type: body.type, is_custom: true, is_active: true }).select('*').single();
    if (inserted.error) return apiError(inserted.error.code === '23505' ? 409 : 503,
      inserted.error.code === '23505' ? 'conflict' : 'dependency_unavailable');
    if (!inserted.data) return apiError(404, 'not_found');
    return NextResponse.json(inserted.data);
  } catch {
    return apiError(500, 'internal_error');
  }
}

async function mutateCategory(id: string, user: User, name: string | null) {
  const resource = await requireResource('categories', id, user, true);
  if (!resource.ok) return resource.response;
  if (resource.row.is_custom !== true) return apiError(403, 'forbidden');
  const db = createAdminClient();
  if (name !== null) {
    const existing = await db.from('categories').select('id,name').eq('account_id', resource.access.accountId);
    if (existing.error) return apiError(503, 'dependency_unavailable');
    if ((existing.data ?? []).some(c => c.id !== id && c.name.trim().toLowerCase() === name.toLowerCase()))
      return apiError(409, 'conflict');
  }
  const updated = await db.from('categories').update(name === null ? { is_active: false } : { name })
    .eq('id', id).eq('account_id', resource.access.accountId).eq('is_custom', true).select('*').maybeSingle();
  if (updated.error) return apiError(503, 'dependency_unavailable');
  if (!updated.data) return apiError(404, 'not_found');
  return NextResponse.json(name === null ? { ok: true } : updated.data);
}

// PATCH: edit custom category name
export async function PATCH(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, true);
    if (check) return check;
    const body = await req.json().catch(() => null);
    if (!isRecord(body) || Object.keys(body).some(k => !['id', 'name'].includes(k)) ||
        !isUuid(body.id) || typeof body.name !== 'string' || !body.name.trim()) return apiError(400, 'invalid_request');
    return await mutateCategory(body.id, auth.user, body.name.trim());
  } catch {
    return apiError(500, 'internal_error');
  }
}

// DELETE: deactivate custom category (soft delete)
export async function DELETE(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const check = checkMutationRequest(req, false);
    if (check) return check;
    const id = new URL(req.url).searchParams.get('id');
    if (!isUuid(id)) return apiError(400, 'invalid_request');
    return await mutateCategory(id, auth.user, null);
  } catch {
    return apiError(500, 'internal_error');
  }
}
