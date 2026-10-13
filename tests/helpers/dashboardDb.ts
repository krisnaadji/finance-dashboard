export type Row = Record<string, unknown>;
export type Mode = 'read' | 'insert' | 'update' | 'delete' | 'upsert';
export type Result = { data: Row | Row[] | null; error: { code: string } | null; count: number | null };
export type Failure = { table: string; mode: Mode; zero?: boolean; skip?: number; throws?: boolean; code?: string };

function numericKey(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parts = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(value).trim());
  if (!parts) return null;
  const fraction = parts[3] ?? '';
  const digits = (parts[2] + fraction).replace(/^0+/, '');
  if (!digits) return '0';
  const significant = digits.replace(/0+$/, '');
  const exponent = BigInt(parts[4] ?? '0') - BigInt(fraction.length) + BigInt(digits.length - significant.length);
  return `${parts[1] === '-' ? '-' : ''}${significant}e${exponent}`;
}

export class DashboardDb {
  tables: Record<string, Row[]> = { accounts: [], members: [], categories: [], transactions: [], budgets: [], link_codes: [], invite_tokens: [] };
  failures: Failure[] = [];
  sequence = 10;
  users: Record<string, Row> = {};
  authAdminError = false;
  auth = { admin: { getUserById: async (id: string) => ({
    data: { user: this.users[id] ?? null }, error: this.authAdminError ? { code: '08006' } : null,
  }) } };
  from(table: string) { return new Query(this, table); }
  async rpc(name: string, args: Row) {
    if (name !== 'seed_categories') throw new Error('Unexpected fixture RPC');
    const failure = this.failures.findIndex(f => f.table === 'seed_categories');
    if (failure >= 0) { this.failures.splice(failure, 1); return { data: null, error: { code: '08006' } }; }
    this.tables.categories.push({ id: this.id(), account_id: args.p_account_id, name: 'Fixture expense', type: 'expense', is_active: true });
    return { data: null, error: null };
  }
  id() { return `80000000-0000-4000-8000-${String(this.sequence++).padStart(12, '0')}`; }
}
class Query implements PromiseLike<Result> {
  private mode: Mode = 'read'; private filters: ((r: Row) => boolean)[] = [];
  private values: Row = {}; private one = false; private conflicts: string[] = [];
  private limitValue: number | null = null; private bounds: [number,number] | null = null;
  private result: Promise<Result> | null = null;
  private ordering: { key: string; ascending: boolean }[] = [];
  constructor(private db: DashboardDb, private table: string) {}
  select(_columns?: string, _options?: { count?: string }) { return this; }
  eq(key: string, value: unknown) {
    const numeric = key === 'amount' && (this.table === 'transactions' || this.table === 'budgets');
    const expected = numeric ? numericKey(value) : null;
    this.filters.push(r => value !== null && r[key] !== null && (numeric
      ? expected !== null && numericKey(r[key]) === expected
      : r[key] === value));
    return this;
  }
  is(key: string, value: null | boolean) { this.filters.push(r => r[key] === value); return this; }
  in(key: string, values: unknown[]) { this.filters.push(r => values.includes(r[key])); return this; }
  not(key: string, op: string, value: unknown) { if (op !== 'is') throw new Error('Unsupported fixture filter'); this.filters.push(r => r[key] !== value); return this; }
  gt(key: string, value: string) { this.filters.push(r => String(r[key]) > value); return this; }
  gte(key: string, value: string) { this.filters.push(r => String(r[key]) >= value); return this; }
  lte(key: string, value: string) { this.filters.push(r => String(r[key]) <= value); return this; }
  ilike(key: string, value: string) { const needle = value.replace(/^%|%$/g, '').toLowerCase(); this.filters.push(r => String(r[key]).toLowerCase().includes(needle)); return this; }
  order(key: string, options?: { ascending?: boolean }) {
    this.ordering.push({ key, ascending: options?.ascending !== false });
    return this;
  }
  range(from: number, to: number) { this.bounds = [from,to]; return this; }
  limit(count: number) { this.limitValue = count; return this; }
  insert(values: Row) { this.mode = 'insert'; this.values = values; return this; }
  update(values: Row) { this.mode = 'update'; this.values = values; return this; }
  delete() { this.mode = 'delete'; return this; }
  upsert(values: Row, options: { onConflict: string }) { this.mode = 'upsert'; this.values = values; this.conflicts = options.onConflict.split(','); return this; }
  single() { this.one = true; return this.execute(); }
  maybeSingle() { this.one = true; return this.execute(); }
  then<T1 = Result, T2 = never>(yes?: ((v: Result) => T1 | PromiseLike<T1>) | null,
    no?: ((reason: unknown) => T2 | PromiseLike<T2>) | null): Promise<T1|T2> {
    return this.execute().then(yes,no);
  }
  private execute() { if (!this.result) this.result = Promise.resolve(this.resolve()); return this.result; }
  private resolve(): Result {
    const failure = this.db.failures.findIndex(f => f.table === this.table && f.mode === this.mode);
    if (failure >= 0) {
      const f = this.db.failures[failure];
      if (f.skip) f.skip--;
      else {
        this.db.failures.splice(failure, 1);
        if (f.throws) throw new Error('Private provider detail must never escape');
        return { data: f.zero ? (this.one ? null : []) : null,
          error: f.zero ? null : { code: f.code ?? '08006' }, count: 0 };
      }
    }
    const rows = this.db.tables[this.table]; if (!rows) throw new Error('Unknown fixture table');
    let selected = rows.filter(r => this.filters.every(f => f(r)));
    if (this.mode === 'insert' || this.mode === 'upsert') {
      const old = this.mode === 'upsert' ? rows.find(r => this.conflicts.every(k => r[k] === this.values[k])) : undefined;
      if (old) { Object.assign(old,this.values); selected = [old]; }
      else {
        const defaults = this.table === 'accounts' || this.table === 'categories' ? { is_active: true }
          : this.table === 'invite_tokens' ? {
            token: this.db.id(), used: false, expires_at: new Date(Date.now() + 86400000).toISOString(),
          } : this.table === 'link_codes' ? { used: false } : {};
        const row = { id: this.db.id(), ...defaults, ...this.values }; rows.push(row); selected = [row];
      }
    } else if (this.mode === 'update') selected.forEach(r => Object.assign(r,this.values));
    else if (this.mode === 'delete') this.db.tables[this.table] = rows.filter(r => !selected.includes(r));
    const count = selected.length;
    selected.sort((a, b) => {
      for (const { key, ascending } of this.ordering) {
        const left = String(a[key] ?? ''), right = String(b[key] ?? '');
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        if (comparison) return ascending ? comparison : -comparison;
      }
      return 0;
    });
    if (this.bounds) selected = selected.slice(this.bounds[0],this.bounds[1]+1);
    if (this.limitValue !== null) selected = selected.slice(0,this.limitValue);
    const enriched = selected.map(r => ({ ...r,
      ...(this.table === 'transactions' ? { categories: this.db.tables.categories.find(c => c.id === r.category_id) ?? null } : {}),
      ...(this.table === 'invite_tokens' ? { accounts: this.db.tables.accounts.find(a => a.id === r.account_id) ?? null } : {}),
    }));
    if (this.one && enriched.length > 1) return { data: null, error: { code: 'PGRST116' }, count };
    return { data: this.one ? enriched[0] ?? null : enriched, error: null, count };
  }
}
export const ids = {
  a: '10000000-0000-4000-8000-000000000001', b: '10000000-0000-4000-8000-000000000002',
  owner: '90000000-0000-4000-8000-000000000001', member: '90000000-0000-4000-8000-000000000002', outsider: '90000000-0000-4000-8000-000000000003',
  expense: '20000000-0000-4000-8000-000000000001', income: '20000000-0000-4000-8000-000000000002', inactive: '20000000-0000-4000-8000-000000000003', foreign: '20000000-0000-4000-8000-000000000004',
  transaction: '30000000-0000-4000-8000-000000000001', budget: '40000000-0000-4000-8000-000000000001',
};
export function seedDashboardDb() {
  const db = new DashboardDb();
  db.tables.accounts = [
    { id: ids.a, name: 'A', type: 'group', owner_id: ids.owner, is_active: true },
    { id: ids.b, name: 'B', type: 'group', owner_id: ids.outsider, is_active: true },
  ];
  db.tables.members = [
    { id: db.id(), account_id: ids.a, user_id: ids.owner, display_name: 'Owner', role: 'owner' },
    { id: db.id(), account_id: ids.a, user_id: ids.member, display_name: 'Member', role: 'member' },
    { id: db.id(), account_id: ids.b, user_id: ids.outsider, display_name: 'Other', role: 'owner' },
  ];
  db.tables.categories = [
    { id: ids.expense, account_id: ids.a, name: 'Food', type: 'expense', is_custom: true, is_active: true },
    { id: ids.income, account_id: ids.a, name: 'Salary', type: 'income', is_custom: false, is_active: true },
    { id: ids.inactive, account_id: ids.a, name: 'Old Food', type: 'expense', is_custom: true, is_active: false },
    { id: ids.foreign, account_id: ids.b, name: 'Foreign', type: 'expense', is_custom: true, is_active: true },
  ];
  db.tables.transactions = [{ id: ids.transaction, account_id: ids.a, category_id: ids.expense, amount: '35.50', type: 'expense', description: 'Lunch', date: '2026-10-12' }];
  db.tables.budgets = [{ id: ids.budget, account_id: ids.a, category_id: ids.expense, amount: '100.00' }];
  return db;
}
