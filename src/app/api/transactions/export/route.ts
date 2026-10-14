import { requireUser, requireAccountMember } from '@/lib/server-auth';
import { apiError } from '@/lib/api-response';
import { isBusinessDate, isRecord, isUuid } from '@/lib/financial-validation';
import { cents } from '@/lib/money';
import { csvCell } from '@/lib/csv';
import { parseTransactionFilters } from '@/lib/transaction-filters';
import { createAdminClient } from '@/lib/supabase-server';

const PAGE_LIMIT = 500;
const MAX_EXPORT_ROWS = 99_999;
const MAX_CSV_BYTES = 32 * 1024 * 1024;
const HEADERS = ['Date', 'Description', 'Category', 'Type', 'Amount'];
const textEncoder = new TextEncoder();

type ExportRow = {
  ordinal: number;
  transactionId: string;
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: string;
};
type Snapshot = { id: string; count: number; expiresAt: string; pageSize: number };

function decodeSnapshot(value: unknown): Snapshot | { code: string } | null {
  if (!isRecord(value)) return null;
  if (typeof value.code === 'string') return { code: value.code };
  if (!isUuid(value.id) || !Number.isSafeInteger(value.count) || (value.count as number) < 0 ||
      !Number.isSafeInteger(value.pageSize) || (value.pageSize as number) < 1 || (value.pageSize as number) > PAGE_LIMIT ||
      typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) return null;
  return { id: value.id, count: value.count as number, expiresAt: value.expiresAt, pageSize: value.pageSize as number };
}

function decodePage(value: unknown, after: number, limit: number): ExportRow[] | { code: string } | null {
  if (!isRecord(value)) return null;
  if (typeof value.code === 'string') return { code: value.code };
  if (!Array.isArray(value.rows) || value.rows.length > limit) return null;
  const rows: ExportRow[] = [];
  for (let index = 0; index < value.rows.length; index++) {
    const row = value.rows[index];
    if (!isRecord(row) || !Number.isSafeInteger(row.ordinal) || row.ordinal !== after + index + 1 ||
        !isUuid(row.transactionId) || !isBusinessDate(row.date) ||
        typeof row.description !== 'string' || typeof row.category !== 'string' ||
        (row.type !== 'income' && row.type !== 'expense') || typeof row.amount !== 'string') return null;
    try { if (cents(row.amount) <= 0n) return null; } catch { return null; }
    rows.push({ ordinal: row.ordinal as number, transactionId: row.transactionId,
      date: row.date, description: row.description, category: row.category,
      type: row.type, amount: row.amount });
  }
  return rows;
}

function exportError(code: string): Response {
  if (code === 'forbidden') return apiError(403, 'forbidden');
  if (code === 'invalid') return apiError(400, 'invalid_request');
  if (code === 'limit') return apiError(413, 'export_limit_exceeded');
  return apiError(503, 'dependency_unavailable');
}

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('account_id');
    if (!isUuid(accountId)) return apiError(400, 'invalid_request');
    const access = await requireAccountMember(accountId, auth.user);
    if (!access.ok) return access.response;
    const filters = parseTransactionFilters(searchParams);
    if (!filters) return apiError(400, 'invalid_request');

    const admin = createAdminClient();
    const started = await admin.rpc('start_finance_export', {
      p_user_id: auth.user.id, p_filters: filters,
    });
    if (started.error) return apiError(503, 'dependency_unavailable');
    const snapshot = decodeSnapshot(started.data);
    if (!snapshot) return apiError(503, 'dependency_unavailable');
    if ('code' in snapshot) return exportError(snapshot.code);

    try {
      if (snapshot.count > MAX_EXPORT_ROWS) return apiError(413, 'export_limit_exceeded');
      const rows: ExportRow[] = [];
      let after = 0;
      while (rows.length < snapshot.count) {
        const limit = Math.min(PAGE_LIMIT, snapshot.pageSize, snapshot.count - rows.length);
        const result = await admin.rpc('read_finance_export', {
          p_user_id: auth.user.id, p_export_id: snapshot.id, p_after: after, p_limit: limit,
        });
        if (result.error) return apiError(503, 'dependency_unavailable');
        const page = decodePage(result.data, after, limit);
        if (!page) return apiError(503, 'dependency_unavailable');
        if ('code' in page) return exportError(page.code);
        if (page.length === 0) return apiError(503, 'dependency_unavailable');
        rows.push(...page);
        after = rows[rows.length - 1].ordinal;
      }
      if (rows.length !== snapshot.count || after !== snapshot.count) return apiError(503, 'dependency_unavailable');

      const lines = [HEADERS.map(value => csvCell(value, false)).join(',')];
      let bytes = textEncoder.encode(lines[0]).byteLength + 2;
      for (const row of rows) {
        const line = [
          csvCell(row.date, false), csvCell(row.description, true), csvCell(row.category, true),
          csvCell(row.type, false), csvCell(row.amount, false),
        ].join(',');
        bytes += textEncoder.encode(line).byteLength + 2;
        if (bytes > MAX_CSV_BYTES) return apiError(413, 'export_limit_exceeded');
        lines.push(line);
      }
      const csv = lines.join('\r\n') + '\r\n';
      const from = filters.from ?? 'all';
      const to = filters.to ?? 'all';
      return new Response(csv, { status: 200, headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="transactions-${from}-${to}.csv"`,
        'cache-control': 'private, no-store',
      } });
    } finally {
      try {
        await admin.rpc('release_finance_export', { p_user_id: auth.user.id, p_export_id: snapshot.id });
      } catch { /* Expiry cleanup handles interrupted or unavailable releases. */ }
    }
  } catch {
    return apiError(503, 'dependency_unavailable');
  }
}
