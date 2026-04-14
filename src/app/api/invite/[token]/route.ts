import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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

  // Validate token
  const { data: invite } = await admin
    .from('invite_tokens')
    .select('*, accounts(name)')
    .eq('token', token)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .single();

  if (!invite) return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 400 });

  // Check not already a member
  const { data: existing } = await admin
    .from('members')
    .select('id')
    .eq('account_id', invite.account_id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    await admin.from('members').insert({
      account_id: invite.account_id,
      user_id: user.id,
      role: 'member',
      display_name: user.user_metadata?.full_name ?? user.email,
    });
  }

  // Mark token as used
  await admin.from('invite_tokens').update({ used: true }).eq('id', invite.id);

  return NextResponse.json({
    accountId: invite.account_id,
    accountName: (invite.accounts as any).name,
  });
}
