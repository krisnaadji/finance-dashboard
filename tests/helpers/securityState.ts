import { vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { seedDashboardDb } from './dashboardDb';
import type { DashboardDb } from './dashboardDb';
export type SecurityState = {
  db: DashboardDb;
  user: User | null;
  authError: { name?: string; code?: string; status?: number } | null;
  exchangeError: { status: number } | null;
  authThrows: boolean;
  exchangeThrows: boolean;
  cookieThrows: boolean;
  locale: string;
  cookieWrites: { name: string; value: string }[];
  refreshCookies: boolean;
};
const state = vi.hoisted<SecurityState>(() => ({
  db: null as unknown as DashboardDb, user: null, authError: null, exchangeError: null,
  authThrows: false, exchangeThrows: false, cookieThrows: false, locale: 'en',
  cookieWrites: [], refreshCookies: false,
}));
export { state };
vi.mock('next/headers', () => ({ cookies: async () => {
  if (state.cookieThrows) throw new Error('Private cookie failure');
  return {
    getAll: () => [{ name: 'NEXT_LOCALE', value: state.locale }],
    set: (name: string, value: string) => { state.cookieWrites.push({ name, value }); },
  };
} }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: {
    cookies: { setAll: (values: { name: string; value: string; options: object }[]) => void };
  }) => ({ auth: {
    getUser: async () => {
      if (state.authThrows) throw new Error('Private auth failure');
      if (state.refreshCookies) options.cookies.setAll([{ name: 'session', value: 'refreshed', options: {} }]);
      return { data: { user: state.user }, error: state.authError };
    },
    exchangeCodeForSession: async () => {
      if (state.exchangeThrows) throw new Error('Private exchange failure');
      return { data: {}, error: state.exchangeError };
    },
  } }),
}));
vi.mock('../../src/lib/supabase-server', () => ({ createAdminClient: () => state.db }));
export function userFor(id: string): User {
  return { id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid',
    app_metadata: {}, user_metadata: { full_name: 'Fixture' }, created_at: '2026-10-12T00:00:00Z' };
}
export function resetSecurityState(userId: string | null) {
  const db = seedDashboardDb(); state.db = db; state.user = userId ? userFor(userId) : null;
  state.authError = null; state.exchangeError = null; state.locale = 'en';
  state.authThrows = false; state.exchangeThrows = false; state.cookieThrows = false;
  state.cookieWrites = []; state.refreshCookies = false; return db;
}
