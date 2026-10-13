import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetSecurityState, state, userFor } from './helpers/securityState';
import { ids, type DashboardDb, type Failure } from './helpers/dashboardDb';
import * as accounts from '../src/app/api/accounts/route';
import * as transactions from '../src/app/api/transactions/route';
import * as transaction from '../src/app/api/transactions/[id]/route';
import * as categories from '../src/app/api/categories/route';
import * as budgets from '../src/app/api/budgets/route';
import { GET as summary } from '../src/app/api/summary/route';
import { GET as trend } from '../src/app/api/summary/trend/route';
import { GET as period } from '../src/app/api/period/route';
import { GET as members } from '../src/app/api/accounts/[id]/members/route';
import { GET as me } from '../src/app/api/me/route';
import { PATCH as displayName } from '../src/app/api/members/display-name/route';
import { POST as linkCode } from '../src/app/api/accounts/[id]/link-code/route';
import { POST as issueInvite } from '../src/app/api/accounts/[id]/invite/route';
import { POST as redeem } from '../src/app/api/invite/[token]/route';
import { GET as callback } from '../src/app/api/auth/callback/route';
import { requireUser, requireAccountMember } from '../src/lib/server-auth';

type Boundary = {
  name: string;
  path: string;
  method: string;
  handler: (request: Request) => Promise<Response>;
  body?: Record<string, unknown>;
  ownerOnly?: boolean;
};
const accountContext = { params: Promise.resolve({ id: ids.a }) };
const transactionContext = { params: Promise.resolve({ id: ids.transaction }) };
const tokenContext = { params: Promise.resolve({ token: 'fixture-token' }) };
const scoped: Boundary[] = [
  { name: 'transaction list', path: `/api/transactions?account_id=${ids.a}`, method: 'GET', handler: transactions.GET },
  { name: 'category list', path: `/api/categories?account_id=${ids.a}`, method: 'GET', handler: categories.GET },
  { name: 'budget list', path: `/api/budgets?account_id=${ids.a}`, method: 'GET', handler: budgets.GET },
  { name: 'summary', path: `/api/summary?account_id=${ids.a}&from=2026-10-01&to=2026-10-12`, method: 'GET', handler: summary },
  { name: 'trend', path: `/api/summary/trend?account_id=${ids.a}`, method: 'GET', handler: trend },
  { name: 'reporting period', path: `/api/period?account_id=${ids.a}&period=this_month`, method: 'GET', handler: period },
  { name: 'member list', path: '/api/members', method: 'GET', handler: request => members(request, accountContext) },
  { name: 'create transaction', path: '/api/transactions', method: 'POST', handler: transactions.POST,
    body: { account_id: ids.a, amount: '10.50', type: 'expense', date: '2026-10-12', category_id: ids.expense } },
  { name: 'edit transaction', path: '/api/transactions', method: 'PATCH', handler: request => transaction.PATCH(request, transactionContext), body: { amount: '40.25' } },
  { name: 'delete transaction', path: '/api/transactions', method: 'DELETE', handler: request => transaction.DELETE(request, transactionContext), ownerOnly: true },
  { name: 'create category', path: '/api/categories', method: 'POST', handler: categories.POST,
    body: { account_id: ids.a, name: 'Travel', type: 'expense' }, ownerOnly: true },
  { name: 'edit category', path: '/api/categories', method: 'PATCH', handler: categories.PATCH, body: { id: ids.expense, name: 'Dining' }, ownerOnly: true },
  { name: 'deactivate category', path: `/api/categories?id=${ids.expense}`, method: 'DELETE', handler: categories.DELETE, ownerOnly: true },
  { name: 'save budget', path: '/api/budgets', method: 'POST', handler: budgets.POST,
    body: { account_id: ids.a, category_id: ids.expense, amount: '120.50' }, ownerOnly: true },
  { name: 'delete budget', path: `/api/budgets?id=${ids.budget}`, method: 'DELETE', handler: budgets.DELETE, ownerOnly: true },
  { name: 'edit account', path: '/api/accounts', method: 'PATCH', handler: accounts.PATCH, body: { id: ids.a, name: 'Edited' }, ownerOnly: true },
  { name: 'deactivate account', path: `/api/accounts?id=${ids.a}`, method: 'DELETE', handler: accounts.DELETE, ownerOnly: true },
  { name: 'profile name', path: '/api/members/display-name', method: 'PATCH', handler: displayName, body: { accountId: ids.a, displayName: 'Edited' } },
  { name: 'link issuance', path: '/api/link', method: 'POST', handler: request => linkCode(request, accountContext), ownerOnly: true },
  { name: 'invite issuance', path: '/api/invite', method: 'POST', handler: request => issueInvite(request, accountContext), ownerOnly: true },
];
const extra: Boundary[] = [
  { name: 'account list', path: '/api/accounts', method: 'GET', handler: accounts.GET },
  { name: 'self profile', path: '/api/me', method: 'GET', handler: me },
  { name: 'account creation', path: '/api/accounts', method: 'POST', handler: accounts.POST, body: { name: 'New account', type: 'personal' } },
  { name: 'invite redemption', path: '/api/invite/fixture-token', method: 'POST', handler: request => redeem(request, tokenContext) },
];
function requestFor(boundary: Boundary, headers: Record<string, string> = {}): Request {
  return new Request(`https://app.example${boundary.path}`, {
    method: boundary.method, headers: { ...(boundary.body ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(boundary.body ? { body: JSON.stringify(boundary.body) } : {}),
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

it.each([...scoped, ...extra])('$name requires request-time authentication', async boundary => {
  const db = resetSecurityState(null); seedInvite(db);
  const before = structuredClone(db.tables);
  const response = await boundary.handler(requestFor(boundary));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'unauthorized' });
  expect(db.tables).toEqual(before);
  state.user = userFor(ids.owner); state.authError = { status: 503 };
  expect((await boundary.handler(requestFor(boundary))).status).toBe(503);
  expect(db.tables).toEqual(before);
});
it.each(scoped)('$name denies foreign and inactive accounts without side effects', async boundary => {
  let db = resetSecurityState(ids.outsider);
  let before = structuredClone(db.tables);
  expect((await boundary.handler(requestFor(boundary))).status).toBe(403);
  expect(db.tables).toEqual(before);
  db = resetSecurityState(ids.owner); db.tables.accounts[0].is_active = false;
  before = structuredClone(db.tables);
  expect((await boundary.handler(requestFor(boundary))).status).toBe(403);
  expect(db.tables).toEqual(before);
});
it.each(scoped.filter(boundary => boundary.ownerOnly))('$name cannot trust a forged member role', async boundary => {
  const db = resetSecurityState(ids.member);
  db.tables.members.find(row => row.user_id === ids.member)!.role = 'owner';
  const before = structuredClone(db.tables);
  expect((await boundary.handler(requestFor(boundary))).status).toBe(403);
  expect(db.tables).toEqual(before);
});
it.each(scoped.filter(boundary => boundary.name !== 'profile name'))('$name permits owner without redundant membership', async boundary => {
  const db = resetSecurityState(ids.owner);
  db.tables.members = db.tables.members.filter(row => row.user_id !== ids.owner);
  expect((await boundary.handler(requestFor(boundary))).status).toBe(200);
});
it.each(scoped.filter(boundary => !boundary.ownerOnly))('$name permits active ordinary members', async boundary => {
  resetSecurityState(ids.member);
  expect((await boundary.handler(requestFor(boundary))).status).toBe(200);
});
it.each([...scoped, ...extra].filter(boundary => boundary.method !== 'GET'))('$name rejects foreign origins before writes', async boundary => {
  const db = resetSecurityState(ids.owner); seedInvite(db);
  const before = structuredClone(db.tables);
  expect((await boundary.handler(requestFor(boundary, { origin: 'https://attacker.example' }))).status).toBe(403);
  expect(db.tables).toEqual(before);
});
it.each([...scoped, ...extra].filter(boundary => boundary.body))('$name rejects invalid JSON, media type, and mass assignment', async boundary => {
  const db = resetSecurityState(ids.owner);
  const before = structuredClone(db.tables);
  expect((await boundary.handler(requestFor(boundary, { 'content-type': 'text/plain' }))).status).toBe(400);
  const invalidJson = new Request(`https://app.example${boundary.path}`, {
    method: boundary.method, headers: { 'content-type': 'application/json' }, body: '{',
  });
  expect((await boundary.handler(invalidJson)).status).toBe(400);
  expect((await boundary.handler(requestFor({ ...boundary, body: { ...boundary.body, user_id: ids.outsider } }))).status).toBe(400);
  expect(db.tables).toEqual(before);
});
it('account list excludes inactive and foreign accounts and derives roles from ownership', async () => {
  const db = resetSecurityState(ids.member);
  db.tables.members.find(row => row.user_id === ids.member)!.role = 'owner';
  const response = await accounts.GET();
  expect(await response.json()).toEqual([expect.objectContaining({ id: ids.a, role: 'member' })]);
  db.tables.accounts[0].is_active = false;
  expect(await (await accounts.GET()).json()).toEqual([]);
  resetSecurityState(ids.owner).tables.members = [];
  expect(await (await accounts.GET()).json()).toEqual([expect.objectContaining({ id: ids.a, role: 'owner' })]);
});
it.each<Failure>([
  { table: 'accounts', mode: 'read' }, { table: 'members', mode: 'read' },
  { table: 'accounts', mode: 'read', skip: 1 },
])('account list checks each lookup ($table, skip=$skip)', async failure => {
  state.db.failures.push({ ...failure });
  const response = await accounts.GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Service temporarily unavailable', code: 'dependency_unavailable' });
});
it.each([
  { boundary: scoped[0], table: 'transactions' }, { boundary: scoped[1], table: 'categories' },
  { boundary: scoped[2], table: 'budgets' }, { boundary: scoped[3], table: 'transactions' },
  { boundary: scoped[4], table: 'transactions' }, { boundary: scoped[6], table: 'members', skip: 1 },
])('$boundary.name dependency failures are not empty data and exceptions are generic', async ({ boundary, table, skip }) => {
  state.db.failures.push({ table, mode: 'read', skip });
  expect((await boundary.handler(requestFor(boundary))).status).toBe(503);
  state.db.failures.push({ table, mode: 'read', skip, throws: true });
  const response = await boundary.handler(requestFor(boundary));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Operation failed', code: 'internal_error' });
});
it('member auth-admin failure is checked; profile lookup is self-only and checked', async () => {
  const db = resetSecurityState(ids.member);
  db.tables.members.find(row => row.user_id === ids.owner)!.display_name = null;
  db.authAdminError = true;
  expect((await members(new Request('https://app.example/api/members'), accountContext)).status).toBe(503);
  expect(await (await me()).json()).toEqual({ name: 'Member', email: 'fixture@example.invalid' });
  db.failures.push({ table: 'members', mode: 'read' });
  expect((await me()).status).toBe(503);
  db.tables.members = [];
  expect(await (await me()).json()).toEqual({ name: 'Fixture', email: 'fixture@example.invalid' });
  expect((await displayName(requestFor(scoped[17]))).status).toBe(403);
});
it('salary period keeps its discriminated query-failure and calendar contracts', async () => {
  state.db.failures.push({ table: 'categories', mode: 'read' });
  const unavailable = await period(new Request(`https://app.example/api/period?account_id=${ids.a}&period=salary_cycle`));
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toEqual({ ok: false, reason: 'query_failed' });
  const calendar = await period(requestFor(scoped[5]));
  expect(await calendar.json()).toMatchObject({ ok: true, label: 'calendar', from: '2026-10-01', to: '2026-10-12' });
  expect((await period(new Request(`https://app.example/api/period?account_id=${ids.a}&period=salary_cycle&salary_month=13&salary_year=2026`))).status).toBe(400);
});
it.each([
  'from=2026-02-30', 'to=2026-02-30', 'from=2026-10-12&to=2026-10-01', 'type=other',
  'category_id=not-a-uuid', 'page_size=100000', 'page_size=Infinity', 'page_size=1.5',
  'page=9007199254740991&page_size=99999',
])('transaction query rejects %s', async filter => {
  expect((await transactions.GET(new Request(`https://app.example/api/transactions?account_id=${ids.a}&${filter}`))).status).toBe(400);
});
it.each(['from=2026-02-30&to=2026-03-01', 'from=2026-10-12&to=2026-10-01', 'from=2026-10-01'])('summary rejects %s', async filter => {
  expect((await summary(new Request(`https://app.example/api/summary?account_id=${ids.a}&${filter}`))).status).toBe(400);
});
it('transaction list preserves search/category/date/type filters and exact pagination', async () => {
  const db = state.db;
  db.tables.transactions.push({ id: db.id(), account_id: ids.a, category_id: ids.expense, amount: '20.00', type: 'expense', description: 'Lunch later', date: '2026-10-11' });
  db.tables.transactions.push({ id: db.id(), account_id: ids.b, category_id: ids.foreign, amount: '999.00', type: 'expense', description: 'Lunch foreign', date: '2026-10-12' });
  const response = await transactions.GET(new Request(`https://app.example/api/transactions?account_id=${ids.a}&from=2026-10-01&to=2026-10-12&type=expense&search=lunch&category_id=${ids.expense}&page=2&page_size=1`));
  expect(await response.json()).toMatchObject({ data: [expect.objectContaining({ description: 'Lunch later' })], total: 2, page: 2, pageSize: 1, totalPages: 2 });
});
it.each([
  { code: 'bad_jwt' }, { code: 'refresh_token_already_used' }, { status: 401 }, { name: 'AuthSessionMissingError' },
])('auth invalid session $code $name $status returns 401', async error => {
  state.authError = error;
  const result = await requireUser();
  expect(!result.ok && result.response.status).toBe(401);
});
it.each([{ status: 429 }, { status: 500 }, { code: 'unexpected_failure' }])('auth outage remains retryable ($status $code)', async error => {
  state.authError = error;
  const result = await requireUser();
  expect(!result.ok && result.response.status).toBe(503);
});
it('auth is uncached, refreshes writable cookies, and suppresses provider exception details', async () => {
  state.refreshCookies = true;
  expect((await requireUser()).ok).toBe(true);
  expect(state.cookieWrites).toEqual([{ name: 'session', value: 'refreshed' }]);
  state.user = null;
  const missing = await requireUser();
  expect(!missing.ok && missing.response.status).toBe(401);
  state.authThrows = true;
  const unavailable = await requireUser();
  expect(!unavailable.ok && unavailable.response.status).toBe(503);
});
it('owner attribution falls back to metadata or email without granting foreign access', async () => {
  state.db.tables.members = [];
  const user = userFor(ids.owner);
  let result = await requireAccountMember(ids.a, user);
  expect(result.ok && result.access.displayName).toBe('Fixture');
  user.user_metadata = {};
  result = await requireAccountMember(ids.a, user);
  expect(result.ok && result.access.displayName).toBe('fixture@example.invalid');
  const malformed = await requireAccountMember('bad-id', user);
  expect(!malformed.ok && malformed.response.status).toBe(400);
});
it('callback missing/failed code respects both locale defaults; unexpected cookie defect is generic', async () => {
  const path = 'https://app.example/api/auth/callback';
  expect((await callback(new Request(path))).headers.get('location')).toBe('https://app.example/en/login?error=auth');
  expect((await callback(new Request(`${path}?code=fixture`))).headers.get('location')).toBe('https://app.example/en/dashboard');
  state.locale = 'id';
  expect((await callback(new Request(`${path}?code=fixture`))).headers.get('location')).toBe('https://app.example/dashboard');
  state.exchangeThrows = true;
  expect((await callback(new Request(`${path}?code=fixture`))).headers.get('location')).toBe('https://app.example/login?error=auth');
  state.cookieThrows = true;
  const defect = await callback(new Request(path));
  expect(defect.status).toBe(500);
  expect(await defect.json()).toEqual({ error: 'Operation failed', code: 'internal_error' });
});
