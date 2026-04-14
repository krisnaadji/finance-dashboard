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

async function isAccountOwner(
  admin: ReturnType<typeof createAdminClient>,
  transactionId: string,
  userId: string,
) {
  const { data: txn } = await admin
    .from('transactions')
    .select('account_id')
    .eq('id', transactionId)
    .single();
  if (!txn) return false;
  const { data: account } = await admin
    .from('accounts')
    .select('owner_id')
    .eq('id', txn.account_id)
    .single();
  return account?.owner_id === userId;
}

async function getDisplayName(
  admin: ReturnType<typeof createAdminClient>,
  transactionId: string,
  userId: string,
) {
  // Get account_id from transaction
  const { data: txn } = await admin
    .from('transactions')
    .select('account_id')
    .eq('id', transactionId)
    .single();
  if (!txn) return null;
  // Look up display_name from members
  const { data: member } = await admin
    .from('members')
    .select('display_name')
    .eq('account_id', txn.account_id)
    .eq('user_id', userId)
    .single();
  return member?.display_name ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Check user is at least a member of this account
  const { data: txn } = await admin.from('transactions').select('account_id').eq('id', id).single();
  if (!txn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await admin
    .from('members')
    .select('id')
    .eq('account_id', txn.account_id)
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Get editor's display name
  const { data: member } = await admin
    .from('members')
    .select('display_name')
    .eq('account_id', txn.account_id)
    .eq('user_id', user.id)
    .single();

  const body = await req.json();
  const { data, error } = await admin
    .from('transactions')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
      edited_by_name: member?.display_name ?? user.email ?? null,
    })
    .eq('id', id)
    .select('*, categories(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const owner = await isAccountOwner(admin, id, user.id);
  if (!owner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await admin.from('transactions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
