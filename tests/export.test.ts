import { expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { GET as exportTransactions } from '../src/app/api/transactions/export/route';
import { csvCell } from '../src/lib/csv';
import { parseTransactionFilters } from '../src/lib/transaction-filters';

it.each([
  '=SUM(A1:A2)',
  ' +1',
  '\t@SUM(A1:A2)',
  '\r-1',
  '\u00a0=SUM(A1:A2)',
  '\u0001@SUM(A1:A2)',
])('makes formula-like user text inert: %s', (value) => {
  expect(csvCell(value, true)).toBe('"\'' + value.replace(/"/g, '""') + '"');
});

it('quotes CSV delimiters and preserves exact numeric text', () => {
  expect(csvCell('food, "coffee"\nmeal', true)).toBe('"food, ""coffee""\nmeal"');
  expect(csvCell('9999999999999.99', false)).toBe('"9999999999999.99"');
  expect(csvCell('', true)).toBe('""');
});

const valid = new URLSearchParams({
  account_id: '10000000-0000-4000-8000-000000000001',
  from: '2026-10-01', to: '2026-10-31', type: 'expense',
  category_id: '20000000-0000-4000-8000-000000000001', search: 'food%_lunch',
});

it('parses the same validated filters used by table and export', () => {
  expect(parseTransactionFilters(valid)).toEqual({
    accountId: '10000000-0000-4000-8000-000000000001',
    from: '2026-10-01', to: '2026-10-31', type: 'expense',
    categoryId: '20000000-0000-4000-8000-000000000001', search: 'food%_lunch',
  });
});

it.each([
  ['account_id', 'bad'],
  ['from', '2026-02-30'],
  ['to', '2026-09-31'],
  ['type', 'transfer'],
  ['category_id', 'bad'],
])('rejects invalid %s without changing valid filters', (key, value) => {
  const params = new URLSearchParams(valid);
  params.set(key, value);
  expect(parseTransactionFilters(params)).toBeNull();
});

it('accepts omitted optional filters as null', () => {
  expect(parseTransactionFilters(new URLSearchParams({ account_id: '10000000-0000-4000-8000-000000000001' }))).toEqual({
    accountId: '10000000-0000-4000-8000-000000000001',
    from: null, to: null, type: null, categoryId: null, search: null,
  });
});

const exportPath = `/api/transactions/export?account_id=${ids.a}&from=2026-10-01&to=2026-10-31`;
const exportId = '60000000-0000-4000-8000-000000000001';

it('returns a complete exact CSV and releases the immutable snapshot', async () => {
  const db = resetSecurityState(ids.member);
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  db.rpcOverride = async (name, args) => {
    calls.push({ name, args });
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 1, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    if (name === 'read_finance_export') return { data: { rows: [{
      ordinal: 1, transactionId: ids.transaction, date: '2026-10-12',
      description: '=SUM(A1:A2)', category: 'Food', type: 'expense', amount: '9999999999999.99',
    }] }, error: null };
    if (name === 'release_finance_export') return { data: true, error: null };
    throw new Error('Unexpected export RPC');
  };

  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/csv');
  expect(await response.text()).toBe(`"Date","Description","Category","Type","Amount"\r\n"2026-10-12","'=SUM(A1:A2)","Food","expense","9999999999999.99"\r\n`);
  expect(calls.map(call => call.name)).toEqual([
    'start_finance_export', 'read_finance_export', 'release_finance_export',
  ]);
  expect(calls[0].args).toMatchObject({
    p_user_id: ids.member,
    p_filters: {
      accountId: ids.a, from: '2026-10-01', to: '2026-10-31',
      type: null, categoryId: null, search: null,
    },
  });
});

it('returns header-only CSV when no rows match', async () => {
  const db = resetSecurityState(ids.owner);
  db.rpcOverride = async name => name === 'start_finance_export'
    ? { data: { id: exportId, count: 0, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500 }, error: null }
    : { data: true, error: null };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('"Date","Description","Category","Type","Amount"\r\n');
});

it('rejects incomplete pages and releases the snapshot without returning a file', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 1, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    if (name === 'read_finance_export') return { data: { rows: [] }, error: null };
    return { data: true, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(503);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(await response.json()).toMatchObject({ code: 'dependency_unavailable' });
  expect(calls).toEqual(['start_finance_export', 'read_finance_export', 'release_finance_export']);
});

it('rejects nonpositive snapshot amounts without returning a file', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 1, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    if (name === 'read_finance_export') return { data: { rows: [{
      ordinal: 1, transactionId: ids.transaction, date: '2026-10-12',
      description: 'invalid amount', category: 'Food', type: 'expense', amount: '0.00',
    }] }, error: null };
    return { data: true, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(503);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(calls).toEqual(['start_finance_export', 'read_finance_export', 'release_finance_export']);
});

it('rejects an export above the verified row cap before fetching pages', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 100_000, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    return { data: true, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(413);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(await response.json()).toMatchObject({ code: 'export_limit_exceeded' });
  expect(calls).toEqual(['start_finance_export', 'release_finance_export']);
});

it('returns a limit response when the database declines an oversized snapshot', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    return { data: { code: 'limit' }, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ code: 'export_limit_exceeded' });
  expect(calls).toEqual(['start_finance_export']);
});

it('denies a nonmember before creating a snapshot', async () => {
  const db = resetSecurityState(ids.outsider);
  let rpcCalled = false;
  db.rpcOverride = async () => { rpcCalled = true; return { data: null, error: null }; };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(403);
  expect(rpcCalled).toBe(false);
});
