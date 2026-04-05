import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET: list accounts for the signed-in user
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('accounts')
    .select('*')
    .or(
      'owner_id.eq.' +
        user.id +
        ',id.in.(select account_id from members where user_id=' +
        user.id +
        ')',
    );

  return NextResponse.json(data ?? []);
}

// POST: create a new account and seed default categories
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
