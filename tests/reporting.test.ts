import { beforeEach, expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { GET as summary } from '../src/app/api/summary/route';
import { decodeFinanceSummary, decodeFinanceBudgetSpending, decodeTransactionView } from '../src/lib/reporting-contract';
import { GET as trend } from '../src/app/api/summary/trend/route';
import { calendarMonth, currentMonthRange } from '../src/lib/business-date';

const report = {
  income: '10000000000000.01', expense: '0.30', net: '9999999999999.71',
  categories: [
    { id: ids.expense, name_id: 'Makanan', name_en: 'Food', amount: '0.10' },
    { id: ids.income, name_id: 'Makanan', name_en: 'Food', amount: '0.20' },
  ],
  spendingByCategoryId: { [ids.expense]: '0.10', [ids.income]: '0.20' },
  categoryDetails: [{parentId:ids.expense,categoryId:ids.expense,amount:'0.10'}],
  byMonth: { '2026-10': { income: '10000000000000.01', expense: '0.30' } },
  topExpenses: [{ id: ids.transaction, date: '2026-10-14', description: 'Snack', amount: '0.20', categories: null, parent: null }],
  topIncomes: [],
};
const decodedReport = {...report,topExpenses:report.topExpenses.map(({categories,...row})=>({...row,category:categories}))};

beforeEach(() => resetSecurityState(ids.owner));

it('decodes exact totals and preserves distinct category identities with matching labels', () => {
  expect(decodeFinanceSummary(report)).toEqual(decodedReport);
  expect(decodeFinanceSummary({...report,categories:report.categories.map(c=>({...c,name:'Legacy label'})),
    topExpenses:report.topExpenses.map(t=>({...t,category:'Legacy label'}))})).toEqual(decodedReport);
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
  expect(await response.json()).toEqual(decodedReport);
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
it('validates stored child and root metadata instead of accepting foreign labels', () => {
  const db = resetSecurityState(ids.owner);
  const parent = db.tables.categories[0];
  const child = {...parent,id:db.id(),parent_id:parent.id};
  const row = {...db.tables.transactions[0],category_id:child.id,categories:child,parent};
  const view = {rows:[row],total:1,summary:{income:'0.00',expense:'35.50',net:'-35.50'}};
  expect(decodeTransactionView(view).rows[0]).toMatchObject({categories:{id:child.id},parent:{id:parent.id}});
  for (const invalid of [
    {...row,categories:{...child,account_id:ids.b}},
    {...row,categories:{...child,type:'income'}},
    {...row,categories:{...child,id:ids.foreign}},
    {...row,parent:{...parent,account_id:ids.b}},
    {...row,parent:null},
    {...row,parent:{...parent,parent_id:child.id}},
  ]) expect(() => decodeTransactionView({...view,rows:[invalid]})).toThrow();
  expect(() => decodeTransactionView({...view,total:0})).toThrow();
  expect(decodeTransactionView({...view,rows:[{...row,categories:null,parent:null}]}).rows[0].categories).toBeNull();
});
it('rejects top-transaction metadata with an unrelated parent', () => {
  const db = resetSecurityState(ids.owner);
  const parent = db.tables.categories[0];
  const child = {...parent,id:db.id(),parent_id:parent.id};
  const top = {...report.topExpenses[0],categories:child,parent};
  expect(decodeFinanceSummary({...report,topExpenses:[top]}).topExpenses[0]).toMatchObject({category:{id:child.id}});
  expect(() => decodeFinanceSummary({...report,topExpenses:[{...top,parent:{...parent,id:ids.foreign}}]})).toThrow();
});
it('rejects unavailable bilingual aggregate metadata instead of showing empty chart labels', () => {
  expect(() => decodeFinanceSummary({...report,categories:[{id:ids.expense,name_id:null,name_en:null,amount:'0.10'}]})).toThrow();
  expect(() => decodeFinanceSummary({...report,categoryDetails:[{parentId:null,categoryId:ids.expense,amount:'0.10'}]})).toThrow();
  const db = resetSecurityState(ids.owner);
  expect(() => decodeFinanceSummary({...report,topExpenses:[{...report.topExpenses[0],categories:db.tables.categories[1],parent:null}]})).toThrow();
});
it('retains historical null-description transactions in exact filtered results', () => {
  const db = resetSecurityState(ids.owner);
  const view=decodeTransactionView({
    rows:[{...db.tables.transactions[0],description:null,categories:db.tables.categories[0],parent:null}],
    total:1,summary:{income:'0.00',expense:'35.50',net:'-35.50'},
  });
  expect(view.rows[0]).toMatchObject({id:ids.transaction,description:'',amount:'35.50'});
  expect(view.summary.expense).toBe('35.50');
});
