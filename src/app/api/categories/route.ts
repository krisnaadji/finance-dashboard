import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!accountId) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('categories')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('type')
    .order('sort_order');
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const admin = createAdminClient();
  const { account_id, name, type } = await req.json();
  const { data, error } = await admin
    .from('categories')
    .insert({ account_id, name, type, is_custom: true, is_active: true })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH: edit custom category name
export async function PATCH(req: Request) {
  const { id, name } = await req.json();
  if (!id || !name?.trim())
    return NextResponse.json({ error: 'Missing id or name' }, { status: 400 });

  const admin = createAdminClient();

  // Only allow editing custom categories
  const { data: cat } = await admin.from('categories').select('is_custom').eq('id', id).single();
  if (!cat?.is_custom)
    return NextResponse.json({ error: 'Cannot edit default category' }, { status: 403 });

  const { data, error } = await admin
    .from('categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: deactivate custom category (soft delete)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const admin = createAdminClient();

  const { data: cat } = await admin.from('categories').select('is_custom').eq('id', id).single();
  if (!cat?.is_custom)
    return NextResponse.json({ error: 'Cannot delete default category' }, { status: 403 });

  const { error } = await admin.from('categories').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
