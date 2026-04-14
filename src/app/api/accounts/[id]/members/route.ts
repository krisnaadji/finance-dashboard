import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const { data } = await admin
    .from('members')
    .select('id, display_name, wa_phone, role, user_id')
    .eq('account_id', id)
    .order('role', { ascending: false });

  // Enrich with Google name for members without display_name or wa_phone
  const enriched = await Promise.all(
    (data ?? []).map(async (m) => {
      if (m.display_name || m.wa_phone) return m;
      if (m.user_id) {
        const { data: userData } = await admin.auth.admin.getUserById(m.user_id);
        return { ...m, display_name: userData?.user?.user_metadata?.full_name ?? null };
      }
      return m;
    }),
  );

  return NextResponse.json(enriched);
}
