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
  const { data: owned } = await admin
    .from('accounts')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_active', true);

  // 2. Accounts user is a member of (via members table)
  const { data: memberships } = await admin
    .from('members')
    .select('account_id, role')
    .eq('user_id', user.id);

  const memberIds = (memberships ?? []).map((m) => m.account_id);
  let memberAccounts: Record<string, unknown>[] = [];
  if (memberIds.length > 0) {
    const { data } = await admin
      .from('accounts')
      .select('*')
      .in('id', memberIds)
      .eq('is_active', true);
    memberAccounts = data ?? [];
  }

  // Merge with roles, deduplicate by id
  const ownedWithRole = (owned ?? []).map((a) => ({ ...a, role: 'owner' }));
  const memberWithRole = memberAccounts.map((a) => {
    const membership = memberships?.find((m) => m.account_id === a.id);
    return { ...a, role: membership?.role ?? 'member' };
  });

  const all = [...ownedWithRole, ...memberWithRole];
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

  const { data: existingMember } = await admin
    .from('members')
    .select('display_name')
    .eq('user_id', user.id)
    .not('display_name', 'is', null)
    .limit(1)
    .single();

  // Add creator as owner member
  await admin.from('members').insert({
    account_id: account.id,
    user_id: user.id,
    role: 'owner',
    display_name: existingMember?.display_name ?? user.user_metadata?.full_name ?? null,
  });

  return NextResponse.json(account);
}

// PATCH: edit account name and type
export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, name, type } = await req.json();
  if (!id || !name?.trim())
    return NextResponse.json({ error: 'Missing id or name' }, { status: 400 });

  const admin = createAdminClient();

  // Only owner can edit
  const { data, error } = await admin
    .from('accounts')
    .update({ name: name.trim(), type })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: soft delete account
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = createAdminClient();

  const { error } = await admin
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('members').delete().eq('account_id', id);

  return NextResponse.json({ ok: true });
}
