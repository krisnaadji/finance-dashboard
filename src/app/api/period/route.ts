import {
  resolveReportingPeriod,
  type ReportingPeriodClient,
  type ReportingPeriodMode,
} from '@/lib/reporting-period';
import { createAdminClient } from '@/lib/supabase-server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function parseOptionalInteger(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

function isReportingPeriodMode(value: string | null): value is ReportingPeriodMode {
  return value === 'this_month' || value === 'salary_cycle';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  const period = searchParams.get('period');
  const salaryMonth = parseOptionalInteger(searchParams.get('salary_month'));
  const salaryYear = parseOptionalInteger(searchParams.get('salary_year'));

  if (!accountId) return NextResponse.json({ error: 'Missing account_id' }, { status: 400 });
  if (!isReportingPeriodMode(period))
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 });

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('members')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .single();

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const periodClient = admin as unknown as ReportingPeriodClient;
  const resolved = await resolveReportingPeriod(periodClient, accountId, period, {
    salaryMonth,
    salaryYear,
  });

  if (!resolved.ok) {
    return NextResponse.json(resolved, {
      status: resolved.reason === 'query_failed' ? 500 : 400,
    });
  }

  return NextResponse.json(resolved);
}
