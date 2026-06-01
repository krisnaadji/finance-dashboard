import { createAdminClient } from '@/lib/supabase-server';
import { getAuthUser, requireAccountMember, type AccountAuthClient } from '@/lib/server-auth';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const auth = await requireAccountMember(admin as unknown as AccountAuthClient, id, user);
  if (!auth.ok) return auth.response;

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
