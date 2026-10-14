import { beforeEach, expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { GET as summary } from '../src/app/api/summary/route';
import { decodeFinanceSummary, decodeFinanceBudgetSpending } from '../src/lib/reporting-contract';
import { GET as trend } from '../src/app/api/summary/trend/route';
import { calendarMonth, currentMonthRange } from '../src/lib/business-date';

const report = {
  income: '10000000000000.01', expense: '0.30', net: '9999999999999.71',
  categories: [
    { id: ids.expense, name: 'Food', amount: '0.10' },
    { id: ids.income, name: 'Food', amount: '0.20' },
  ],
  spendingByCategoryId: { [ids.expense]: '0.10', [ids.income]: '0.20' },
  byMonth: { '2026-10': { income: '10000000000000.01', expense: '0.30' } },
  topExpenses: [{ id: ids.transaction, date: '2026-10-14', description: 'Snack', amount: '0.20', category: 'Food' }],
  topIncomes: [],
};

beforeEach(() => resetSecurityState(ids.owner));

it('decodes exact totals and preserves distinct category identities with matching labels', () => {
  expect(decodeFinanceSummary(report)).toEqual(report);
});

it('rejects numeric aggregate amounts and malformed budget maps', () => {
  expect(() => decodeFinanceSummary({ ...report, income: 1 })).toThrow();
  expect(() => decodeFinanceBudgetSpending({ spendingByCategoryId: { [ids.expense]: 1 } })).toThrow();
});

it('serves the authenticated exact summary API contract', async () => {
  const db = resetSecurityState(ids.owner);
  db.rpcOverride = async name => name === 'finance_summary'
    ? { data: report, error: null }
    : { data: null, error: { code: 'unexpected_rpc' } };

  const response = await summary(new Request(
    `https://app.example/api/summary?account_id=${ids.a}&from=2026-10-01&to=2026-10-31`,
  ));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(report);
});
it('uses the Jakarta current-month boundary for the twelve-month trend', async () => {
  const db = resetSecurityState(ids.owner);
  let args: Record<string, unknown> | null = null;
  db.rpcOverride = async (name, input) => {
    if (name !== 'finance_summary') return { data: null, error: { code: 'unexpected_rpc' } };
    args = input;
    return { data: report, error: null };
  };
  const response = await trend(new Request(`https://app.example/api/summary/trend?account_id=${ids.a}`));
  const to = currentMonthRange().to;
  const [year, month] = to.slice(0, 7).split('-').map(Number);
  expect(args).toEqual({
    p_account_id: ids.a,
    p_from: calendarMonth(year, month - 11).from,
    p_to: to,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(report.byMonth);
});

it('returns unavailable when the aggregate response is malformed', async () => {
  const db = resetSecurityState(ids.owner);
  db.rpcOverride = async () => ({ data: { ...report, expense: 0.1 }, error: null });

  const response = await summary(new Request(
    `https://app.example/api/summary?account_id=${ids.a}&from=2026-10-01&to=2026-10-31`,
  ));

  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: 'dependency_unavailable' });
});
