import { expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { POST as createTransaction } from '../src/app/api/transactions/route';
import { PATCH as editTransaction } from '../src/app/api/transactions/[id]/route';
import { POST as writeBudget } from '../src/app/api/budgets/route';

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
