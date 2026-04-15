import { createAdminClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const type = searchParams.get('type');
  const search = searchParams.get('search');
  const categoryId = searchParams.get('category_id');
  if (!accountId) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });

  const admin = createAdminClient();
  let query = admin
    .from('transactions')
    .select('*, categories(name)')
    .eq('account_id', accountId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (type) query = query.eq('type', type);
  if (search) query = query.ilike('description', `%${search}%`);
  if (categoryId) query = query.eq('category_id', categoryId);

  const { data } = await query;
  return NextResponse.json(data ?? []);
}
