import { businessDate, calendarMonth, currentMonthRange, shiftCivilDay } from './business-date';

export { currentMonthRange } from './business-date';

type QueryResponse<Row> = {
  data: Row[] | null;
  error: { message: string } | null;
};

type QueryResult<Row> = PromiseLike<QueryResponse<Row>>;

type QueryBuilder<Row> = {
  eq: (column: string, value: string) => QueryBuilder<Row>;
  gte: (column: string, value: string) => QueryBuilder<Row>;
  in: (column: string, values: string[]) => QueryBuilder<Row>;
  lte: (column: string, value: string) => QueryBuilder<Row>;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder<Row>;
  limit: (count: number) => QueryResult<Row>;
};

type CategoryQueryBuilder<Row> = {
  eq: (column: string, value: string) => CategoryQueryBuilder<Row>;
  limit: (count: number) => QueryResult<Row>;
};

export type ReportingPeriodClient = {
  from(table: 'transactions'): { select: (columns: string) => QueryBuilder<SalaryRow> };
  from(table: 'categories'): { select: (columns: string) => CategoryQueryBuilder<CategoryRow> };
};

interface SalaryRow {
  date: string;
  categories: { name?: string } | null;
}

interface CategoryRow {
  id: string;
  name: string;
}

export type ReportingPeriodMode = 'this_month' | 'salary_cycle';

export type ResolvedReportingPeriod =
  | {
      ok: true;
      from: string;
      to: string;
      label: 'calendar' | 'salary_cycle';
      salaryMonth?: number;
      salaryYear?: number;
    }
  | {
      ok: false;
      reason: 'salary_not_found' | 'invalid_period' | 'query_failed';
    };

export function todayISO(now = new Date()): string {
  return businessDate(now);
}


export function monthRange(month: number, year: number): { from: string; to: string } {
  return calendarMonth(year, month);
}

export function nextMonth(month: number, year: number): { month: number; year: number } {
  const [nextYear, nextMonth] = calendarMonth(year, month + 1).from.split('-').map(Number);
  return { month: nextMonth, year: nextYear };
}

export function previousDayISO(dateISO: string): string {
  return shiftCivilDay(dateISO, -1);
}

export function isValidSalaryTarget(month?: number, year?: number): boolean {
  if (month === undefined && year === undefined) return true;
  if (month === undefined || year === undefined) return false;

  return (
    Number.isInteger(month) &&
    Number.isInteger(year) &&
    month >= 1 &&
    month <= 12 &&
    year >= 2000 &&
    year <= 2100
  );
}

export async function resolveReportingPeriod(
  admin: ReportingPeriodClient,
  accountId: string,
  period: ReportingPeriodMode,
  target: { salaryMonth?: number; salaryYear?: number } = {},
  now = new Date(),
): Promise<ResolvedReportingPeriod> {
  if (period === 'this_month') {
    return { ok: true, ...currentMonthRange(now), label: 'calendar' };
  }

  if (!isValidSalaryTarget(target.salaryMonth, target.salaryYear)) {
    return { ok: false, reason: 'invalid_period' };
  }

  return resolveSalaryCycle(admin, accountId, target, now);
}

async function resolveSalaryCycle(
  admin: ReportingPeriodClient,
  accountId: string,
  target: { salaryMonth?: number; salaryYear?: number },
  now: Date,
): Promise<ResolvedReportingPeriod> {
  let salaryMonth = target.salaryMonth;
  let salaryYear = target.salaryYear;
  const salaryCategoryIdsResult = await querySalaryCategoryIds(admin, accountId);
  if (salaryCategoryIdsResult.error) return { ok: false, reason: 'query_failed' };

  const salaryCategoryIds = salaryCategoryIdsResult.ids;
  if (!salaryCategoryIds.length) return { ok: false, reason: 'salary_not_found' };

  if (!salaryMonth || !salaryYear) {
    const latestRows = await queryIncomeRows(
      admin,
      accountId,
      salaryCategoryIds,
      undefined,
      undefined,
      false,
    );
    if (latestRows.error) return { ok: false, reason: 'query_failed' };

    const latestSalary = latestRows.data?.[0];
    if (!latestSalary) return { ok: false, reason: 'salary_not_found' };

    const [year, month] = latestSalary.date.split('-').map(Number);
    salaryMonth = month;
    salaryYear = year;
  }

  const selectedRows = await queryIncomeRows(
    admin,
    accountId,
    salaryCategoryIds,
    salaryMonth,
    salaryYear,
    true,
  );
  if (selectedRows.error) return { ok: false, reason: 'query_failed' };

  const selectedSalaryDates = (selectedRows.data ?? []).map((row) => row.date).sort();

  const from = selectedSalaryDates[0];
  if (!from) return { ok: false, reason: 'salary_not_found' };

  const following = nextMonth(salaryMonth, salaryYear);
  const followingRows = await queryIncomeRows(
    admin,
    accountId,
    salaryCategoryIds,
    following.month,
    following.year,
    false,
  );
  if (followingRows.error) return { ok: false, reason: 'query_failed' };

  const nextSalary = (followingRows.data ?? [])
    .map((row) => row.date)
    .sort()
    .at(-1);

  return {
    ok: true,
    from,
    to: nextSalary ? previousDayISO(nextSalary) : todayISO(now),
    label: 'salary_cycle',
    salaryMonth,
    salaryYear,
  };
}

async function querySalaryCategoryIds(
  admin: ReportingPeriodClient,
  accountId: string,
): Promise<{ ids: string[]; error: { message: string } | null }> {
  const { data, error } = await admin
    .from('categories')
    .select('id, name')
    .eq('account_id', accountId)
    .limit(1000);

  return {
    ids: (data ?? [])
      .filter((row) => row.name.trim().toLowerCase() === 'gaji')
      .map((row) => row.id),
    error,
  };
}

async function queryIncomeRows(
  admin: ReportingPeriodClient,
  accountId: string,
  salaryCategoryIds: string[],
  month: number | undefined,
  year: number | undefined,
  ascending: boolean,
): Promise<QueryResponse<SalaryRow>> {
  let query = admin
    .from('transactions')
    .select('date, categories(name)')
    .eq('account_id', accountId)
    .eq('type', 'income')
    .in('category_id', salaryCategoryIds)
    .order('date', { ascending });

  if (month !== undefined && year !== undefined) {
    const range = monthRange(month, year);
    query = query.gte('date', range.from).lte('date', range.to);
  }

  return await query.limit(1000);
}
