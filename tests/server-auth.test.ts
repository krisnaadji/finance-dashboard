import { describe, expect, test } from 'vitest';
import {
  requireAccountMember,
  requireAccountOwner,
  type AuthUser,
} from '../src/lib/server-auth';

type TableName = 'accounts' | 'members';

class QueryBuilder {
  private readonly filters: Record<string, unknown> = {};

  constructor(
    private readonly rowsByTable: Record<string, unknown[]>,
    private readonly table: TableName,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  async single() {
    const rows = this.rowsByTable[this.table] ?? [];
    const data =
      rows.find((row) =>
        Object.entries(this.filters).every(
          ([column, value]) => (row as Record<string, unknown>)[column] === value,
        ),
      ) ?? null;

    return { data };
  }
}

function createAdmin(rowsByTable: Record<string, unknown[]>) {
  return {
    from(table: TableName) {
      return new QueryBuilder(rowsByTable, table);
    },
  };
}

const user: AuthUser = { id: 'user-1', email: 'user@example.com' };

describe('server auth helpers', () => {
  test('requireAccountMember returns 401 when no user is authenticated', async () => {
    const result = await requireAccountMember(createAdmin({}), 'account-1', null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({ error: 'Unauthorized' });
    }
  });

  test('requireAccountMember returns 403 when user is not an account member', async () => {
    const result = await requireAccountMember(createAdmin({ members: [] }), 'account-1', user);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({ error: 'Forbidden' });
    }
  });

  test('requireAccountMember returns membership when user belongs to account', async () => {
    const result = await requireAccountMember(
      createAdmin({
        members: [{ id: 'member-1', account_id: 'account-1', user_id: 'user-1', role: 'member' }],
      }),
      'account-1',
      user,
    );

    expect(result).toEqual({
      ok: true,
      user,
      membership: { id: 'member-1', role: 'member', display_name: null },
    });
  });

  test('requireAccountMember preserves display name for attribution', async () => {
    const result = await requireAccountMember(
      createAdmin({
        members: [
          {
            id: 'member-1',
            account_id: 'account-1',
            user_id: 'user-1',
            role: 'member',
            display_name: 'Krisna',
          },
        ],
      }),
      'account-1',
      user,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.membership.display_name).toBe('Krisna');
    }
  });

  test('requireAccountOwner returns 403 when user does not own account', async () => {
    const result = await requireAccountOwner(
      createAdmin({ accounts: [{ id: 'account-1', owner_id: 'other-user' }] }),
      'account-1',
      user,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({ error: 'Forbidden' });
    }
  });

  test('requireAccountOwner returns account when user owns account', async () => {
    const result = await requireAccountOwner(
      createAdmin({ accounts: [{ id: 'account-1', owner_id: 'user-1' }] }),
      'account-1',
      user,
    );

    expect(result).toEqual({
      ok: true,
      user,
      account: { id: 'account-1', owner_id: 'user-1' },
    });
  });
});
