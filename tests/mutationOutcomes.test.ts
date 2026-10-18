import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetSecurityState, state } from './helpers/securityState';
import { ids, type DashboardDb, type Failure } from './helpers/dashboardDb';
import * as accounts from '../src/app/api/accounts/route';
import * as transactions from '../src/app/api/transactions/route';
import * as transaction from '../src/app/api/transactions/[id]/route';
import * as categories from '../src/app/api/categories/route';
import * as budgets from '../src/app/api/budgets/route';
import { PATCH as displayName } from '../src/app/api/members/display-name/route';
import { POST as linkCode } from '../src/app/api/accounts/[id]/link-code/route';
import { POST as issueInvite } from '../src/app/api/accounts/[id]/invite/route';
import { POST as redeem } from '../src/app/api/invite/[token]/route';

type OutcomeCase = {
  name: string;
  path: string;
  method: string;
  handler: (request: Request) => Promise<Response>;
  body?: Record<string, unknown>;
  table: string;
  mode: Failure['mode'];
};
const accountContext = { params: Promise.resolve({ id: ids.a }) };
const transactionContext = { params: Promise.resolve({ id: ids.transaction }) };
const tokenContext = { params: Promise.resolve({ token: 'fixture-token' }) };
const outcomes: OutcomeCase[] = [
  { name: 'transaction insert', path: '/api/transactions', method: 'POST', handler: transactions.POST,
    body: { account_id: ids.a, amount: '10.50', type: 'expense', date: '2026-10-12' }, table: 'transactions', mode: 'insert' },
  { name: 'transaction update', path: '/api/transactions', method: 'PATCH', handler: request => transaction.PATCH(request, transactionContext), body: { amount: '40.25' }, table: 'transactions', mode: 'update' },
  { name: 'transaction delete', path: '/api/transactions', method: 'DELETE', handler: request => transaction.DELETE(request, transactionContext), table: 'transactions', mode: 'delete' },
  { name: 'category insert', path: '/api/categories', method: 'POST', handler: categories.POST,
    body: { account_id: ids.a, name_en: 'Travel', type: 'expense' }, table: 'categories', mode: 'insert' },
  { name: 'category update', path: '/api/categories', method: 'PATCH', handler: categories.PATCH,
    body: { id: ids.expense, name_en: 'Dining' }, table: 'categories', mode: 'update' },
  { name: 'category deactivate', path: `/api/categories?id=${ids.expense}`, method: 'DELETE', handler: categories.DELETE, table: 'categories', mode: 'update' },
  { name: 'budget upsert', path: '/api/budgets', method: 'POST', handler: budgets.POST,
    body: { account_id: ids.a, category_id: ids.expense, amount: '120.50' }, table: 'budgets', mode: 'upsert' },
  { name: 'budget delete', path: `/api/budgets?id=${ids.budget}`, method: 'DELETE', handler: budgets.DELETE, table: 'budgets', mode: 'delete' },
  { name: 'account update', path: '/api/accounts', method: 'PATCH', handler: accounts.PATCH,
    body: { id: ids.a, name: 'Edited' }, table: 'accounts', mode: 'update' },
  { name: 'account deactivate', path: `/api/accounts?id=${ids.a}`, method: 'DELETE', handler: accounts.DELETE, table: 'accounts', mode: 'update' },
  { name: 'display name update', path: '/api/members/display-name', method: 'PATCH', handler: displayName,
    body: { accountId: ids.a, displayName: 'Edited' }, table: 'members', mode: 'update' },
  { name: 'invite insert', path: '/api/invite', method: 'POST', handler: request => issueInvite(request, accountContext), table: 'invite_tokens', mode: 'insert' },
];
function requestFor(entry: OutcomeCase): Request {
  return new Request(`https://app.example${entry.path}`, { method: entry.method,
    headers: entry.body ? { 'content-type': 'application/json' } : {},
    ...(entry.body ? { body: JSON.stringify(entry.body) } : {}),
  });
}
function seedInvite(db: DashboardDb) {
  db.tables.invite_tokens.push({ id: db.id(), account_id: ids.a, token: 'fixture-token', used: false,
    expires_at: new Date(Date.now() + 60000).toISOString() });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T12:00:00Z')); resetSecurityState(ids.owner);
});
afterEach(() => vi.useRealTimers());
it.each(outcomes)('$name checks errors, missing rows, and thrown defects', async entry => {
  for (const failure of [{ zero: false }, { zero: true }, { throws: true }]) {
    const db = resetSecurityState(ids.owner);
    const before = structuredClone(db.tables);
    db.failures.push({ table: entry.table, mode: entry.mode, ...failure });
    const response = await entry.handler(requestFor(entry));
    const conflict = failure.zero && entry.name === 'transaction update';
    expect(response.status).toBe('throws' in failure ? 500 : conflict ? 409 : failure.zero ? 404 : 503);
    expect(await response.json()).toMatchObject({ code: 'throws' in failure ? 'internal_error' : conflict ? 'conflict' : failure.zero ? 'not_found' : 'dependency_unavailable' });
    expect(db.tables).toEqual(before);
  }
});
it.each(outcomes.filter(entry => entry.mode === 'update' || entry.mode === 'delete'))('$name never changes foreign records', async entry => {
  const db = state.db;
  for (const table of ['transactions', 'categories', 'budgets', 'members']) {
    const original = db.tables[table].find(row => row.account_id === ids.a);
    if (original) db.tables[table].push({ ...original, id: db.id(), account_id: ids.b, user_id: ids.owner });
  }
  const before = structuredClone(db.tables);
  expect((await entry.handler(requestFor(entry))).status).toBe(200);
  for (const table of Object.keys(db.tables)) {
    const foreignBefore = before[table].filter(row => row.account_id === ids.b || row.id === ids.b);
    expect(db.tables[table].filter(row => row.account_id === ids.b || row.id === ids.b)).toEqual(foreignBefore);
  }
});
it('invite invalidation failure prevents issuing a new credential', async () => {
  const db = state.db;
  db.tables.invite_tokens.push({ id: db.id(), account_id: ids.a, used: false, token: 'old' });
  db.tables.invite_tokens.push({ id: db.id(), account_id: ids.b, used: false, token: 'foreign' });
  const before = structuredClone(db.tables);
  db.failures.push({ table: 'invite_tokens', mode: 'update' });
  expect((await issueInvite(new Request('https://app.example/api/issue', { method: 'POST' }), accountContext)).status).toBe(503);
  expect(db.tables).toEqual(before);
});
it('invite issuance retires only the target account and preserves the response', async () => {
  const db = state.db;
  db.tables.invite_tokens.push({ id: db.id(), account_id: ids.a, used: false });
  db.tables.invite_tokens.push({ id: db.id(), account_id: ids.b, used: false });
  const response = await issueInvite(new Request('https://app.example/api/issue', { method: 'POST' }), accountContext);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.expiresAt).toEqual(expect.any(String));
  expect(body.url).toContain('/invite/');
  expect(db.tables.invite_tokens[0].used).toBe(true);
  expect(db.tables.invite_tokens[1].used).toBe(false);
  expect(db.tables.invite_tokens).toHaveLength(3);
});
it('category constraint errors become conflicts without changing rows', async () => {
  const entry = outcomes.find(row => row.name === 'category insert')!;
  state.db.failures.push({ table: 'categories', mode: 'insert', code: '23505' });
  expect((await categories.POST(requestFor(entry))).status).toBe(409);
  const edit = outcomes.find(row => row.name === 'category update')!;
  state.db.failures.push({ table: 'categories', mode: 'update', code: '23505' });
  expect((await categories.PATCH(requestFor(edit))).status).toBe(409);
  expect(state.db.tables.categories).toHaveLength(4);
  expect(state.db.tables.categories[0].name_en).toBe('Food');
});
it('category deactivation preserves transaction and budget joins/history', async () => {
  const beforeTransactions = structuredClone(state.db.tables.transactions);
  const beforeBudgets = structuredClone(state.db.tables.budgets);
  expect((await categories.DELETE(new Request(`https://app.example/api/categories?id=${ids.expense}`, { method: 'DELETE' }))).status).toBe(200);
  expect(state.db.tables.categories.find(row => row.id === ids.expense)!.is_active).toBe(false);
  expect(state.db.tables.transactions).toEqual(beforeTransactions);
  expect(state.db.tables.budgets).toEqual(beforeBudgets);
  const response = await transactions.GET(new Request(`https://app.example/api/transactions?account_id=${ids.a}`));
  expect((await response.json()).data[0].categories.name_en).toBe('Food');
});
it.each([0, -1, true, null, '', '0.001', '10000000000000.00'])('invalid budget amount %s makes no write', async amount => {
  const entry = outcomes.find(row => row.name === 'budget upsert')!;
  const before = structuredClone(state.db.tables.budgets);
  expect((await budgets.POST(requestFor({ ...entry, body: { ...entry.body, amount } }))).status).toBe(400);
  expect(state.db.tables.budgets).toEqual(before);
});
it('merged transaction rejects invalid amount but preserves unchanged historical references', async () => {
  const entry = outcomes.find(row => row.name === 'transaction update')!;
  state.db.tables.transactions[0].amount = '0.001';
  expect((await transaction.PATCH(requestFor({ ...entry, body: { description: 'Corrected' } }), transactionContext)).status).toBe(400);
  state.db.tables.transactions[0].amount = '35.50';
  state.db.tables.transactions[0].category_id = ids.income;
  expect((await transaction.PATCH(requestFor({ ...entry, body: { description: 'Corrected' } }), transactionContext)).status).toBe(200);
  state.db.tables.transactions[0].category_id = ids.inactive;
  expect((await transaction.PATCH(requestFor({ ...entry, body: { amount: '50.00', date: '2026-10-11' } }), transactionContext)).status).toBe(200);
  expect((await transaction.PATCH(requestFor({ ...entry, body: { type: 'expense' } }), transactionContext)).status).toBe(200);
});
it('member can change transaction type together with its category, or remove category explicitly', async () => {
  resetSecurityState(ids.member);
  const entry = outcomes.find(row => row.name === 'transaction update')!;
  let response = await transaction.PATCH(requestFor({ ...entry, body: { type: 'income', category_id: ids.income } }), transactionContext);
  expect(response.status).toBe(200);
  expect(state.db.tables.transactions[0]).toMatchObject({ type: 'income', category_id: ids.income, edited_by_name: 'Member', amount: '35.50' });
  response = await transaction.PATCH(requestFor({ ...entry, body: { type: 'expense', category_id: null } }), transactionContext);
  expect(response.status).toBe(200);
  expect(state.db.tables.transactions[0]).toMatchObject({ type: 'expense', category_id: null });
});
it('committed transaction is returned when warning spend lookup fails', async () => {
  const entry = outcomes.find(row => row.name === 'transaction insert')!;
  state.db.tables.budgets.push({ id: ids.budget, account_id: ids.a, category_id: ids.expense, amount: '100.00' });
  state.db.rpcOverride = async () => ({ data: null, error: { code: '08006' } });
  const response = await transactions.POST(requestFor({ ...entry, body: { ...entry.body, category_id: ids.expense } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ transaction: { amount: '10.50' }, budgetWarning: null, budgetWarningError: 'dependency_unavailable' });
  expect(state.db.tables.transactions).toHaveLength(2);
});
