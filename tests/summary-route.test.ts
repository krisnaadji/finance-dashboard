import { beforeEach, describe, expect, test, vi } from 'vitest';

const getUser = vi.fn();
const createServerClient = vi.fn(() => ({
  auth: {
    getUser,
  },
}));

const createAdminClient = vi.fn(() => ({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data: [] }),
  })),
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

describe('GET /api/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  test('returns 401 when no user is authenticated', async () => {
    const { GET } = await import('../src/app/api/summary/route');
    const response = await GET(
      new Request('http://localhost/api/summary?account_id=account-1&from=2026-06-01&to=2026-06-30'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
