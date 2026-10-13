import { createAdminClient } from '@/lib/supabase-server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const access = await requireAccountMember(id, auth.user);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const members = await db.from('members')
      .select('id,display_name,wa_phone,role,user_id').eq('account_id', id).order('role', { ascending: false });
    if (members.error) return apiError(503, 'dependency_unavailable');
    let lookupFailed = false;
    const enriched = await Promise.all((members.data ?? []).map(async member => {
      if (member.display_name || member.wa_phone || !member.user_id) return member;
      const profile = await db.auth.admin.getUserById(member.user_id);
      if (profile.error) { lookupFailed = true; return member; }
      return { ...member, display_name: profile.data.user?.user_metadata?.full_name ?? null };
    }));
    if (lookupFailed) return apiError(503, 'dependency_unavailable');
    return NextResponse.json(enriched);
  } catch {
    return apiError(500, 'internal_error');
  }
}
