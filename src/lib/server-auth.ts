import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface AuthUser {
  id: string;
  email?: string | null;
}

interface QueryBuilder<T> {
  eq(column: string, value: unknown): QueryBuilder<T>;
  single(): Promise<{ data: T | null }>;
}

interface TableQuery<T> {
  select(columns?: string): QueryBuilder<T>;
}

interface Account {
  id: string;
  owner_id: string;
}

interface MembershipRow {
  id: string;
  role: 'owner' | 'member';
  display_name?: string | null;
}

export interface AccountAuthClient {
  from(table: 'accounts'): TableQuery<Account>;
  from(table: 'members'): TableQuery<MembershipRow>;
  from(table: string): TableQuery<unknown>;
}

type AuthFailure = {
  ok: false;
  response: NextResponse;
};

export type MemberAuthResult =
  | AuthFailure
  | {
      ok: true;
      user: AuthUser;
      membership: MembershipRow;
    };

export type OwnerAuthResult =
  | AuthFailure
  | {
      ok: true;
      user: AuthUser;
      account: Account;
    };

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { id: user.id, email: user.email ?? null } : null;
}

function authError(message: 'Unauthorized' | 'Forbidden', status: 401 | 403): AuthFailure {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status }),
  };
}

export async function requireAccountMember(
  admin: AccountAuthClient,
  accountId: string,
  user: AuthUser | null,
): Promise<MemberAuthResult> {
  if (!user) return authError('Unauthorized', 401);

  const { data } = await admin
    .from('members')
    .select('id, role, display_name')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  if (!data) return authError('Forbidden', 403);

  return {
    ok: true,
    user,
    membership: {
      id: data.id,
      role: data.role,
      display_name: data.display_name ?? null,
    },
  };
}

export async function requireAccountOwner(
  admin: AccountAuthClient,
  accountId: string,
  user: AuthUser | null,
): Promise<OwnerAuthResult> {
  if (!user) return authError('Unauthorized', 401);

  const { data } = await admin
    .from('accounts')
    .select('id, owner_id')
    .eq('id', accountId)
    .single();

  if (!data || data.owner_id !== user.id) return authError('Forbidden', 403);

  return {
    ok: true,
    user,
    account: data,
  };
}
