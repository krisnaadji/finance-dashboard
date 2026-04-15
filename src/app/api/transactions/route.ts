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
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(99999, Math.max(1, Number(searchParams.get('page_size') ?? '20')));

  if (!accountId) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });

  const admin = createAdminClient();
  const from_ = (page - 1) * pageSize;
  const to_ = from_ + pageSize - 1;

  let query = admin
    .from('transactions')
    .select('*, categories(name)', { count: 'exact' })
    .eq('account_id', accountId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from_, to_);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (type) query = query.eq('type', type);
  if (search) query = query.ilike('description', `%${search}%`);
  if (categoryId) query = query.eq('category_id', categoryId);

  const { data, count } = await query;
  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  });
}
