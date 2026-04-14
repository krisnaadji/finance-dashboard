import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  // Verify requester is owner
  const { data: account } = await admin
    .from('accounts')
    .select('name')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single();
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Invalidate old unused tokens for this account
  await admin.from('invite_tokens').update({ used: true }).eq('account_id', id).eq('used', false);

  // Create new token
  const { data: token } = await admin
    .from('invite_tokens')
    .insert({ account_id: id })
    .select()
    .single();

  const inviteUrl = process.env.NEXT_PUBLIC_APP_URL + '/invite/' + token.token;
  return NextResponse.json({ url: inviteUrl, expiresAt: token.expires_at });
}
