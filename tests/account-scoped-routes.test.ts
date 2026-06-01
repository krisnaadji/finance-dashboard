import { beforeEach, describe, expect, test, vi } from 'vitest';

const getUser = vi.fn();
const createServerClient = vi.fn(() => ({
  auth: {
    getUser,
  },
}));

function createQueryBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data: [] }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

const createAdminClient = vi.fn(() => ({
  from: vi.fn(() => createQueryBuilder()),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient,
}));

vi.mock('@/lib/supabase-server', () => ({
  createAdminClient,
}));

describe('account-scoped API route authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  test('GET /api/transactions returns 401 when no user is authenticated', async () => {
    const { GET } = await import('../src/app/api/transactions/route');
    const response = await GET(
      new Request('http://localhost/api/transactions?account_id=account-1'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('GET /api/categories returns 401 when no user is authenticated', async () => {
    const { GET } = await import('../src/app/api/categories/route');
    const response = await GET(new Request('http://localhost/api/categories?account_id=account-1'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('POST /api/categories returns 401 when no user is authenticated', async () => {
    const { POST } = await import('../src/app/api/categories/route');
    const response = await POST(
      new Request('http://localhost/api/categories', {
        method: 'POST',
        body: JSON.stringify({ account_id: 'account-1', name: 'Coffee', type: 'expense' }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('PATCH /api/categories returns 401 when no user is authenticated', async () => {
    const { PATCH } = await import('../src/app/api/categories/route');
    const response = await PATCH(
      new Request('http://localhost/api/categories', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'category-1', name: 'Coffee' }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('DELETE /api/categories returns 401 when no user is authenticated', async () => {
    const { DELETE } = await import('../src/app/api/categories/route');
    const response = await DELETE(
      new Request('http://localhost/api/categories?id=category-1', { method: 'DELETE' }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('GET /api/budgets returns 401 when no user is authenticated', async () => {
    const { GET } = await import('../src/app/api/budgets/route');
    const response = await GET(new Request('http://localhost/api/budgets?account_id=account-1'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('GET /api/summary/trend returns 401 when no user is authenticated', async () => {
    const { GET } = await import('../src/app/api/summary/trend/route');
    const response = await GET(new Request('http://localhost/api/summary/trend?account_id=account-1'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  test('GET /api/accounts/[id]/members returns 403 when user is not an account member', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } } });

    const { GET } = await import('../src/app/api/accounts/[id]/members/route');
    const response = await GET(new Request('http://localhost/api/accounts/account-1/members'), {
      params: Promise.resolve({ id: 'account-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
  });
});
