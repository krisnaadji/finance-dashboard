import { createAdminClient } from '@/lib/supabase-server';
import {
  getAuthUser,
  requireAccountMember,
  requireAccountOwner,
  type AccountAuthClient,
} from '@/lib/server-auth';
import { NextResponse } from 'next/server';

// GET: list all budgets for an account
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!accountId) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const auth = await requireAccountMember(admin as unknown as AccountAuthClient, accountId, user);
  if (!auth.ok) return auth.response;

  const { data } = await admin.from('budgets').select('*').eq('account_id', accountId);

  return NextResponse.json(data ?? []);
}

// POST: upsert budget for a category
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { account_id, category_id, amount } = await req.json();
  if (!account_id || !category_id || amount === undefined)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const admin = createAdminClient();

  // Verify owner
  const auth = await requireAccountOwner(admin as unknown as AccountAuthClient, account_id, user);
  if (!auth.ok) return auth.response;

  const { data, error } = await admin
    .from('budgets')
    .upsert(
      { account_id, category_id, amount, updated_at: new Date().toISOString() },
      { onConflict: 'account_id,category_id' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: remove budget
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = createAdminClient();

  // Verify owner via budget → account
  const { data: budget } = await admin.from('budgets').select('account_id').eq('id', id).single();
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: account } = await admin
    .from('accounts')
    .select('owner_id')
    .eq('id', budget.account_id)
    .single();
  if (account?.owner_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await admin.from('budgets').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
