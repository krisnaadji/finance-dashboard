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
