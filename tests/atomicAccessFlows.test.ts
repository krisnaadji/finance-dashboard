import { beforeEach, expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { POST as createAccount } from '../src/app/api/accounts/route';
import { POST as linkCode } from '../src/app/api/accounts/[id]/link-code/route';
import { POST as redeemInvite } from '../src/app/api/invite/[token]/route';

const accountContext = { params: Promise.resolve({ id: ids.a }) };
const tokenContext = { params: Promise.resolve({ token: 'fixture-token' }) };
const json = (path: string, body: unknown) => new Request(`https://app.example${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => resetSecurityState(ids.owner));

it('returns the database-accepted account only after atomic creation succeeds', async () => {
  const db = resetSecurityState(ids.owner);
  const account = { id: ids.b, name: 'Household', type: 'group', owner_id: ids.owner, is_active: true };
  db.rpcOverride = async name => name === 'create_finance_account'
    ? { data: { code: 'accepted', account }, error: null }
    : { data: null, error: { code: 'unexpected_rpc' } };

  const response = await createAccount(json('/api/accounts', {
    name: 'Household', type: 'group', operation_id: '70000000-0000-4000-8000-000000000001',
  }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(account);
});

it('reports an operation-key payload conflict without returning an account', async () => {
  const db = resetSecurityState(ids.owner);
  db.rpcOverride = async () => ({ data: { code: 'conflict' }, error: null });

  const response = await createAccount(json('/api/accounts', {
    name: 'Different household', type: 'group', operation_id: '70000000-0000-4000-8000-000000000001',
  }));

  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'conflict' });
});

it('retries a link-code uniqueness collision before returning the replacement', async () => {
  const db = resetSecurityState(ids.owner);
  let calls = 0;
  db.rpcOverride = async name => {
    expect(name).toBe('replace_finance_link_code');
    calls++;

    return calls === 1
      ? { data: { code: 'collision' }, error: null }
      : { data: { code: 'accepted', linkCode: { code: 'HOUSEHOLD-0123456789ABCDEF', expiresAt: '2026-10-13T12:15:00.000Z' } }, error: null };
  };

  const response = await linkCode(new Request('https://app.example/api/link-code', { method: 'POST' }), accountContext);

  expect(response.status).toBe(200);
  expect(calls).toBe(2);
  expect(await response.json()).toEqual({ code: 'HOUSEHOLD-0123456789ABCDEF', expiresAt: '2026-10-13T12:15:00.000Z' });
});

it('returns unavailable when the atomic account procedure fails', async () => {
  const db = resetSecurityState(ids.owner);
  db.rpcOverride = async () => ({ data: null, error: { code: '08006' } });

  const response = await createAccount(json('/api/accounts', {
    name: 'Household', type: 'group', operation_id: '70000000-0000-4000-8000-000000000001',
  }));

  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: 'dependency_unavailable' });
});
it('maps expired invite redemption to an invalid invite response', async () => {
  const db = resetSecurityState(ids.outsider);
  db.rpcOverride = async name => name === 'redeem_finance_invite'
    ? { data: { code: 'expired' }, error: null }
    : { data: null, error: { code: 'unexpected_rpc' } };

  const response = await redeemInvite(new Request('https://app.example/api/invite/fixture-token', { method: 'POST' }), tokenContext);

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: 'invalid_request' });
});
