import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { createAdminClient } from './supabase-server';
import { apiError } from './api-response';
import { isRecord, isUuid } from './financial-validation';

export type ApiFailure = { ok: false; response: NextResponse };
export type AuthSuccess = { ok: true; user: User };
export type AccountAccess = {
  accountId: string; userId: string; role: 'owner' | 'member'; displayName: string | null;
};
export type AccessSuccess = { ok: true; access: AccountAccess };

export async function createRequestClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => { for (const value of values) store.set(value.name, value.value, value.options); },
    } },
  );
}

export async function requireUser(): Promise<AuthSuccess | ApiFailure> {
  try {
    const client = await createRequestClient();
    const result = await client.auth.getUser();
    if (result.error) {
      const error = result.error;
      const invalid = error.name === 'AuthSessionMissingError' ||
        error.code === 'session_not_found' || error.code === 'session_expired' ||
        error.code === 'bad_jwt' || error.code === 'refresh_token_not_found' ||
        error.code === 'refresh_token_already_used' ||
        (error.status !== undefined && [400, 401, 403].includes(error.status));
      return { ok: false, response: apiError(invalid ? 401 : 503,
        invalid ? 'unauthorized' : 'dependency_unavailable') };
    }
    if (!result.data.user) return { ok: false, response: apiError(401, 'unauthorized') };
    return { ok: true, user: result.data.user };
  } catch { return { ok: false, response: apiError(503, 'dependency_unavailable') }; }
}

export async function requireAccountMember(accountId: string, user: User): Promise<AccessSuccess | ApiFailure> {
  if (!isUuid(accountId)) return { ok: false, response: apiError(400, 'invalid_request') };
  try {
    const db = createAdminClient();
    const account = await db.from('accounts').select('id,owner_id,is_active')
      .eq('id', accountId).maybeSingle();
    if (account.error) return { ok: false, response: apiError(503, 'dependency_unavailable') };
    if (!account.data || account.data.is_active !== true) {
      return { ok: false, response: apiError(403, 'forbidden') };
    }
    const owner = account.data.owner_id === user.id;
    const member = await db.from('members').select('id,display_name')
      .eq('account_id', accountId).eq('user_id', user.id).maybeSingle();
    if (member.error) return { ok: false, response: apiError(503, 'dependency_unavailable') };
    if (!owner && !member.data) return { ok: false, response: apiError(403, 'forbidden') };
    const metadataName = isRecord(user.user_metadata) && typeof user.user_metadata.full_name === 'string'
      ? user.user_metadata.full_name : null;
    const displayName = typeof member.data?.display_name === 'string'
      ? member.data.display_name : metadataName ?? user.email ?? null;
    return { ok: true, access: { accountId, userId: user.id,
      role: owner ? 'owner' : 'member', displayName } };
  } catch { return { ok: false, response: apiError(503, 'dependency_unavailable') }; }
}

export async function requireAccountOwner(accountId: string, user: User): Promise<AccessSuccess | ApiFailure> {
  const result = await requireAccountMember(accountId, user);
  if (!result.ok) return result;
  if (result.access.role !== 'owner') return { ok: false, response: apiError(403, 'forbidden') };
  return result;
}
