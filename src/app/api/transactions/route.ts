import { createAdminClient } from '@/lib/supabase-server';
import { getAuthUser, requireAccountMember, type AccountAuthClient } from '@/lib/server-auth';
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

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const auth = await requireAccountMember(admin as unknown as AccountAuthClient, accountId, user);
  if (!auth.ok) return auth.response;

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

// POST: create a transaction from the dashboard
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const {
    account_id,
    description,
    amount,
    type,
    date,
    category_id,
  }: {
    account_id?: string;
    description?: string;
    amount?: number | string;
    type?: string;
    date?: string;
    category_id?: string | null;
  } = body;

  // Validation
  if (!account_id) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
  if (!type || (type !== 'expense' && type !== 'income'))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  const amt = typeof amount === 'string' ? Number(amount) : amount;
  if (amt === undefined || amt === null || isNaN(Number(amt)) || Number(amt) <= 0)
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  const admin = createAdminClient();

  // Verify caller is a member of the account
  const auth = await requireAccountMember(admin as unknown as AccountAuthClient, account_id, user);
  if (!auth.ok) return auth.response;

  // Insert the transaction
  const { data: txn, error } = await admin
    .from('transactions')
    .insert({
      account_id,
      category_id: category_id || null,
      amount: Number(amt),
      type,
      description: description ?? '',
      date,
      raw_message: null,
      wa_user_message_id: null,
      recorded_by_name: auth.membership.display_name ?? user.email ?? null,
      recorded_by_phone: null,
    })
    .select('*, categories(name)')
    .single();

  if (error || !txn) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create transaction' },
      { status: 500 },
    );
  }

  // Compute budget warning (same logic as bot's createTxn)
  let budgetWarning: {
    category_name: string;
    spent: number;
    limit: number;
    pct: number;
    over: boolean;
  } | null = null;

  if (type === 'expense' && category_id) {
    const { data: budget } = await admin
      .from('budgets')
      .select('amount')
      .eq('account_id', account_id)
      .eq('category_id', category_id)
      .single();

    if (budget) {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const to = now.toISOString().split('T')[0];

      const { data: spendRows } = await admin
        .from('transactions')
        .select('amount')
        .eq('account_id', account_id)
        .eq('category_id', category_id)
        .eq('type', 'expense')
        .gte('date', from)
        .lte('date', to);

      const totalSpent = (spendRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const pct = Math.round((totalSpent / Number(budget.amount)) * 100);
      const over = totalSpent > Number(budget.amount);

      if (over || pct >= 80) {
        budgetWarning = {
          category_name: (txn.categories as { name?: string } | null)?.name ?? '',
          spent: totalSpent,
          limit: Number(budget.amount),
          pct,
          over,
        };
      }
    }
  }

  return NextResponse.json({ transaction: txn, budgetWarning });
}
