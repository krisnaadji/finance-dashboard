import { expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { GET as listTransactions, POST as createTransaction } from '../src/app/api/transactions/route';
import { PATCH as editTransaction } from '../src/app/api/transactions/[id]/route';
import { GET as readBudgets, POST as writeBudget } from '../src/app/api/budgets/route';

function rawRequest(path: string, method: string, body: string) {
  return new Request('https://app.example' + path, { method,
    headers: { origin: 'https://app.example', 'content-type': 'application/json' }, body });
}
it.each(['9999999999999.991', '35.500000000000000001', '1e3'])('rejects original amount token %s across write boundaries', async (token) => {
  const db = resetSecurityState(ids.owner);
  const before = structuredClone({ transactions: db.tables.transactions, budgets: db.tables.budgets });
  const create = await createTransaction(rawRequest('/api/transactions', 'POST',
    `{"account_id":"${ids.a}","amount":${token},"type":"expense","date":"2026-10-12"}`));
  const edit = await editTransaction(rawRequest('/api/transactions/' + ids.transaction, 'PATCH', `{"amount":${token}}`),
    { params: Promise.resolve({ id: ids.transaction }) });
  const budget = await writeBudget(rawRequest('/api/budgets', 'POST',
    `{"account_id":"${ids.a}","category_id":"${ids.expense}","amount":${token}}`));
  expect([create.status, edit.status, budget.status]).toEqual([400, 400, 400]);
  expect({ transactions: db.tables.transactions, budgets: db.tables.budgets }).toEqual(before);
});
it('a valid raw decimal remains accepted without float conversion', async () => {
  const db = resetSecurityState(ids.owner);
  const response = await writeBudget(rawRequest('/api/budgets', 'POST',
    `{"account_id":"${ids.a}","category_id":"${ids.expense}","amount":35.50}`));
  expect(response.status).toBe(200);
  expect(db.tables.budgets.find(row => row.account_id === ids.a && row.category_id === ids.expense)?.amount).toBe('35.50');
});
it('transaction list, transaction creation, and budget list serialize exact decimal strings', async () => {
  const db = resetSecurityState(ids.owner);
  const exact = '9999999999999.99';
  db.tables.transactions[0].amount = exact;
  db.tables.budgets[0].amount = exact;

  const listed = await listTransactions(new Request(`https://app.example/api/transactions?account_id=${ids.a}`));
  expect(listed.status).toBe(200);
  expect((await listed.json()).data[0].amount).toBe(exact);

  const created = await createTransaction(rawRequest('/api/transactions', 'POST',
    `{"account_id":"${ids.a}","amount":"${exact}","type":"income","date":"2026-10-12"}`));
  expect(created.status).toBe(200);
  expect((await created.json()).transaction.amount).toBe(exact);

  const budgets = await readBudgets(new Request(`https://app.example/api/budgets?account_id=${ids.a}`));
  expect(budgets.status).toBe(200);
  expect((await budgets.json())[0].amount).toBe(exact);
});
it('orders table results by date, creation time, then transaction UUID', async () => {
  const db = resetSecurityState(ids.owner);
  const createdAt = '2026-10-12T10:00:00.000Z';
  db.tables.transactions[0].created_at = createdAt;
  db.tables.transactions.push(
    { id: '30000000-0000-4000-8000-000000000002', account_id: ids.a, amount: '2.00', type: 'expense', date: '2026-10-12', description: 'later creation', created_at: '2026-10-12T10:01:00.000Z' },
    { id: '30000000-0000-4000-8000-000000000003', account_id: ids.a, amount: '3.00', type: 'expense', date: '2026-10-12', description: 'higher ID', created_at: createdAt },
    { id: '30000000-0000-4000-8000-000000000004', account_id: ids.a, amount: '4.00', type: 'expense', date: '2026-10-11', description: 'older date', created_at: '2026-10-12T10:02:00.000Z' },
  );
  const response = await listTransactions(new Request(`https://app.example/api/transactions?account_id=${ids.a}&page_size=20`));
  expect(response.status).toBe(200);
  expect((await response.json()).data.map((row: { id: string }) => row.id)).toEqual([
    '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    ids.transaction,
    '30000000-0000-4000-8000-000000000004',
  ]);
});
