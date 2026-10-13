import { beforeEach, expect, it } from 'vitest';
import { resetSecurityState, state, userFor } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { requireUser, requireAccountMember, requireAccountOwner } from '../src/lib/server-auth';
beforeEach(() => resetSecurityState(null));
it('distinguishes invalid login from an unavailable auth service', async () => {
  const missing = await requireUser(); expect(!missing.ok && missing.response.status).toBe(401);
  state.authError = { status: 503 }; const outage = await requireUser();
  expect(!outage.ok && outage.response.status).toBe(503);
  state.authError = { name: 'AuthSessionMissingError' }; const invalid = await requireUser();
  expect(!invalid.ok && invalid.response.status).toBe(401);
});
it('owner remains owner without redundant membership; forged role grants nothing', async () => {
  const db = resetSecurityState(ids.owner); db.tables.members = db.tables.members.filter(r => r.user_id !== ids.owner);
  const owner = await requireAccountOwner(ids.a,userFor(ids.owner)); expect(owner.ok && owner.access.role).toBe('owner');
  db.tables.members.find(r => r.user_id === ids.member)!.role = 'owner';
  const member = await requireAccountOwner(ids.a,userFor(ids.member)); expect(!member.ok && member.response.status).toBe(403);
});
it('nonmember/inactive account denied; dependency failure is not denial or empty data', async () => {
  const db = resetSecurityState(ids.member);
  const foreign = await requireAccountMember(ids.b,userFor(ids.member)); expect(!foreign.ok && foreign.response.status).toBe(403);
  db.tables.accounts[0].is_active = false;
  const inactive = await requireAccountMember(ids.a,userFor(ids.member)); expect(!inactive.ok && inactive.response.status).toBe(403);
  db.failures.push({ table: 'accounts', mode: 'read' });
  const unavailable = await requireAccountMember(ids.a,userFor(ids.member)); expect(!unavailable.ok && unavailable.response.status).toBe(503);
});
