import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// GET: list accounts for the signed-in user
// NOTE: Supabase JS client does not support raw SQL subqueries in .or()
// Split into two queries and merge instead.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // 1. Accounts owned by user
  const { data: owned } = await admin.from('accounts').select('*').eq('owner_id', user.id);

  // 2. Accounts user is a member of (via members table)
  const { data: memberships } = await admin
    .from('members')
    .select('account_id')
    .eq('user_id', user.id);

  const memberIds = (memberships ?? []).map((m) => m.account_id);
  let memberAccounts: Record<string, unknown>[] = [];
  if (memberIds.length > 0) {
    const { data } = await admin.from('accounts').select('*').in('id', memberIds);
    memberAccounts = data ?? [];
  }

  // Merge and deduplicate by id
  const all = [...(owned ?? []), ...memberAccounts];
  const unique = all.filter((a, i) => all.findIndex((b) => b.id === a.id) === i);

  return NextResponse.json(unique);
}

// POST: create a new account and seed default categories
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, type } = await req.json();
  const admin = createAdminClient();

  const { data: account, error } = await admin
    .from('accounts')
    .insert({ name, type, owner_id: user.id, language: 'id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed default categories via the SQL function we created in Phase 1
  await admin.rpc('seed_categories', { p_account_id: account.id });

  // Add creator as owner member
  await admin.from('members').insert({
    account_id: account.id,
    user_id: user.id,
    role: 'owner',
  });

  return NextResponse.json(account);
}
