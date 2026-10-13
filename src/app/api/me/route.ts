import { createAdminClient } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const member = await createAdminClient().from('members').select('display_name')
      .eq('user_id', auth.user.id).not('display_name', 'is', null).limit(1).maybeSingle();
    if (member.error) return apiError(503, 'dependency_unavailable');
    return NextResponse.json({
      name: member.data?.display_name ??
        (typeof auth.user.user_metadata.full_name === 'string' ? auth.user.user_metadata.full_name : ''),
      email: auth.user.email ?? '',
    });
  } catch {
    return apiError(500, 'internal_error');
  }
}
