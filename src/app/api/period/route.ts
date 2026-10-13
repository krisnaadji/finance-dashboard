import {
  resolveReportingPeriod,
  type ReportingPeriodClient,
  type ReportingPeriodMode,
} from '@/lib/reporting-period';
import { createAdminClient } from '@/lib/supabase-server';
import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { isUuid } from '@/lib/financial-validation';
import { apiError } from '@/lib/api-response';
import { NextResponse } from 'next/server';


function parseOptionalInteger(value: string | null): number | undefined {
  if (value === null) return undefined;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

function isReportingPeriodMode(value: string | null): value is ReportingPeriodMode {
  return value === 'this_month' || value === 'salary_cycle';
}

export async function GET(req: Request) {
  try {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('account_id');
  if (!isUuid(accountId)) return apiError(400, 'invalid_request');
  const access = await requireAccountMember(accountId, auth.user);
  if (!access.ok) return access.response;
  const period = searchParams.get('period');
  const salaryMonth = parseOptionalInteger(searchParams.get('salary_month'));
  const salaryYear = parseOptionalInteger(searchParams.get('salary_year'));

  if (!isReportingPeriodMode(period))
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 });


  const admin = createAdminClient();

  const periodClient = admin as unknown as ReportingPeriodClient;
  const resolved = await resolveReportingPeriod(periodClient, accountId, period, {
    salaryMonth,
    salaryYear,
  });

  if (!resolved.ok) {
    return NextResponse.json(resolved, {
      status: resolved.reason === 'query_failed' ? 503 : 400,
    });
  }

  return NextResponse.json(resolved);
  } catch {
    return apiError(500, 'internal_error');
  }
}

