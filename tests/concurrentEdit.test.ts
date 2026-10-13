import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import type { DashboardDb, Row } from './helpers/dashboardDb';
import { PATCH } from '../src/app/api/transactions/[id]/route';

function patch(body: Row) {
  return PATCH(new Request('https://app.example/api/transactions/' + ids.transaction, {
    method: 'PATCH', headers: { origin: 'https://app.example', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id: ids.transaction }) });
}

type UpdateGate = { entered: Promise<void>; release: () => void };
function pauseFirstUpdate(db: DashboardDb): UpdateGate {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const originalFrom = db.from.bind(db);
  let paused = false;
  vi.spyOn(db, 'from').mockImplementation((table) => {
    const query = originalFrom(table);
    if (table === 'transactions') {
      const update = query.update.bind(query);
      query.update = (values) => {
        const updated = update(values);
        if (!paused) {
          paused = true;
          const maybeSingle = updated.maybeSingle.bind(updated);
          updated.maybeSingle = async () => {
            entered.resolve();
            await released.promise;
            return maybeSingle();
          };
        }
        return updated;
      };
    }
    return query;
  });
  return { entered: entered.promise, release: () => released.resolve() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-12T12:00:00Z'));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('a concurrent correction cannot be overwritten by a description-only patch', async () => {
  const db = resetSecurityState(ids.member);
  const originalFrom = db.from.bind(db);
  let interleaved = false;
  vi.spyOn(db, 'from').mockImplementation((table) => {
    const query = originalFrom(table);
    if (table === 'transactions') {
      const update = query.update.bind(query);
      query.update = (values) => {
        if (!interleaved) {
          interleaved = true;
          db.tables.transactions[0].amount = '40.25';
        }
        return update(values);
      };
    }
    return query;
  });
  const response = await patch({ description: 'Changed' });
  expect(response.status).toBe(409);
  expect(db.tables.transactions[0].amount).toBe('40.25');
  expect(db.tables.transactions[0].description).toBe('Lunch');
  expect(await response.json()).toMatchObject({ code: 'conflict' });
  expect((await patch({ description: 'Changed' })).status).toBe(200);
  expect(db.tables.transactions[0]).toMatchObject({ amount: '40.25', description: 'Changed' });
});

it.each<Row>([
  { amount: '40.25' },
  { type: 'income' },
  { date: '2026-10-11' },
  { description: 'Independent correction' },
  { category_id: ids.expense },
])('checks every financial snapshot field against a persisted correction %j', async correction => {
  const db = resetSecurityState(ids.member);
  db.tables.transactions[0].category_id = null;
  const originalFrom = db.from.bind(db);
  let interleaved = false;
  vi.spyOn(db, 'from').mockImplementation(table => {
    const query = originalFrom(table);
    if (table === 'transactions') {
      const update = query.update.bind(query);
      query.update = values => {
        if (!interleaved) {
          interleaved = true;
          Object.assign(db.tables.transactions[0], correction);
        }
        return update(values);
      };
    }
    return query;
  });
  const response = await patch({ description: 'Changed' });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'conflict' });
  expect(db.tables.transactions[0]).toMatchObject(correction);
  expect(db.tables.transactions[0].description).toBe(correction.description ?? 'Lunch');
});

it('two actual PATCH requests reject stale edits and allow a fresh retry at the same timestamp', async () => {
  const db = resetSecurityState(ids.member);
  db.tables.transactions[0].updated_at = '2026-10-12T12:00:00.000Z';
  const gate = pauseFirstUpdate(db);
  const stale = patch({ description: 'Changed' });
  await gate.entered;
  try {
    const correction = await patch({ amount: '40.25' });
    expect(correction.status).toBe(200);
    expect(db.tables.transactions[0]).toMatchObject({
      amount: '40.25', description: 'Lunch', updated_at: '2026-10-12T12:00:00.000Z',
    });
  } finally {
    gate.release();
  }
  const response = await stale;
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'conflict' });
  expect(db.tables.transactions[0]).toMatchObject({ amount: '40.25', description: 'Lunch' });
  const retried = await patch({ description: 'Changed' });
  expect(retried.status).toBe(200);
  expect(await retried.json()).toMatchObject({ amount: '40.25', description: 'Changed', edited_by_name: 'Member' });
  expect(db.tables.transactions[0]).toMatchObject({ amount: '40.25', description: 'Changed' });
});

it.each([
  { stale: { type: 'income' }, correction: { category_id: ids.expense }, stored: { type: 'expense', category_id: ids.expense } },
  { stale: { category_id: ids.expense }, correction: { type: 'income' }, stored: { type: 'income', category_id: null } },
])('concurrent type/category changes cannot evade merged validation: $stale', async ({ stale: input, correction, stored }) => {
  const db = resetSecurityState(ids.member);
  db.tables.transactions[0].category_id = null;
  const gate = pauseFirstUpdate(db);
  const stale = patch(input);
  await gate.entered;
  try {
    expect((await patch(correction)).status).toBe(200);
  } finally {
    gate.release();
  }
  expect((await stale).status).toBe(409);
  expect(db.tables.transactions[0]).toMatchObject(stored);
  expect((await patch(input)).status).toBe(400);
  expect(db.tables.transactions[0]).toMatchObject(stored);
});

it.each([null, ids.expense])('protects nullable category snapshots starting at %s', async categoryId => {
  const db = resetSecurityState(ids.member);
  db.tables.transactions[0].category_id = categoryId;
  const gate = pauseFirstUpdate(db);
  const stale = patch({ description: 'Changed' });
  await gate.entered;
  const correctedCategory = categoryId === null ? ids.expense : null;
  try {
    expect((await patch({ category_id: correctedCategory })).status).toBe(200);
  } finally {
    gate.release();
  }
  expect((await stale).status).toBe(409);
  expect(db.tables.transactions[0]).toMatchObject({ category_id: correctedCategory, description: 'Lunch' });
  expect((await patch({ description: 'Changed' })).status).toBe(200);
  expect(db.tables.transactions[0]).toMatchObject({ category_id: correctedCategory, description: 'Changed' });
});


it.each(['{"amount":', '{"amount":0.0100000000000000001}', '{"amount":9999999999999.9901}'])(
  'malformed or over-precision raw financial JSON is rejected without writing: %s', async body => {
    const db = resetSecurityState(ids.member);
    const before = structuredClone(db.tables.transactions);
    const response = await PATCH(new Request('https://app.example/api/transactions/' + ids.transaction, {
      method: 'PATCH', headers: { origin: 'https://app.example', 'content-type': 'application/json' }, body,
    }), { params: Promise.resolve({ id: ids.transaction }) });
    expect(response.status).toBe(400);
    expect(db.tables.transactions).toEqual(before);
  },
);

it('a supplied description repairs nullable history without overwriting a concurrent repair', async () => {
  const db = resetSecurityState(ids.member);
  db.tables.transactions[0].description = null;
  const gate = pauseFirstUpdate(db);
  const stale = patch({ description: 'Stale repair' });
  await gate.entered;
  try {
    expect((await patch({ description: 'Persisted repair' })).status).toBe(200);
  } finally {
    gate.release();
  }
  expect((await stale).status).toBe(409);
  expect(db.tables.transactions[0].description).toBe('Persisted repair');
  expect((await patch({ description: 'Fresh repair' })).status).toBe(200);
  expect(db.tables.transactions[0].description).toBe('Fresh repair');
});

it('SQL numeric comparison does not round distinct persisted amounts into equality', async () => {
  const db = resetSecurityState(ids.member);
  db.tables.transactions[0].amount = '9999999999999.99';
  const originalFrom = db.from.bind(db);
  vi.spyOn(db, 'from').mockImplementation(table => {
    const query = originalFrom(table);
    if (table === 'transactions') {
      const update = query.update.bind(query);
      query.update = values => {
        db.tables.transactions[0].amount = '9999999999999.9901';
        return update(values);
      };
    }
    return query;
  });
  expect((await patch({ description: 'Changed' })).status).toBe(409);
  expect(db.tables.transactions[0]).toMatchObject({ amount: '9999999999999.9901', description: 'Lunch' });
});
