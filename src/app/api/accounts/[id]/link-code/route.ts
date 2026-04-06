import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function generateCode(accountName: string): string {
  const prefix = accountName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return prefix + '-' + suffix;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 15+: params is a Promise
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Verify user owns this account
  const { data: account } = await admin
    .from('accounts')
    .select('name')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Invalidate old unused codes for this account
  await admin.from('link_codes').update({ used: true }).eq('account_id', id).eq('used', false);

  const code = generateCode(account.name);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await admin.from('link_codes').insert({
    account_id: id,
    code,
    expires_at: expiresAt,
  });

  return NextResponse.json({ code, expiresAt });
}
