import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { GET as summary } from '../src/app/api/summary/route';
import { GET as trend } from '../src/app/api/summary/trend/route';
import { GET as transactions } from '../src/app/api/transactions/route';
import { GET as categories } from '../src/app/api/categories/route';
import { GET as budgets } from '../src/app/api/budgets/route';
import { GET as members } from '../src/app/api/accounts/[id]/members/route';
import { GET as period } from '../src/app/api/period/route';
const entries = [
  ['summary', summary, '/api/summary?from=2026-10-12&to=2026-10-12'],
  ['trend', trend, '/api/summary/trend'], ['transactions', transactions, '/api/transactions'],
  ['categories', categories, '/api/categories'], ['budgets', budgets, '/api/budgets'],
] as const;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T12:00:00Z')); resetSecurityState(null); });
afterEach(() => vi.useRealTimers());
it.each(entries)('%s denies anonymous and foreign reads but permits members', async (_name, handler, path) => {
  const request = new Request(`https://app.example${path}${path.includes('?')?'&':'?'}account_id=${ids.a}`);
  expect((await handler(request)).status).toBe(401);
  resetSecurityState(ids.outsider); expect((await handler(request)).status).toBe(403);
  const db = resetSecurityState(ids.member);
  db.tables.transactions.push({id:db.id(),account_id:ids.b,amount:'9999999.00',type:'expense',date:'2026-10-12',description:'Foreign financial record',category_id:ids.foreign});
  if (_name === 'summary' || _name === 'trend') db.rpcOverride = async () => ({ data: {
    income: '0.00', expense: '35.50', net: '-35.50',
    categories: [{ id: ids.expense, name_id:'Makanan',name_en:'Food', amount: '35.50' }],
    spendingByCategoryId: { [ids.expense]: '35.50' },
    categoryDetails:[{parentId:ids.expense,categoryId:ids.expense,amount:'35.50'}],
    byMonth: { '2026-10': { income: '0.00', expense: '35.50' } },
    topExpenses: [{ id: ids.transaction, date: '2026-10-12', description: 'Local expense', amount: '35.50', categories: null,parent:null }],
    topIncomes: [],
  }, error: null });
  const response=await handler(request); expect(response.status).toBe(200);
  const body=await response.json(); const serialized=JSON.stringify(body);
  expect(serialized).not.toContain(ids.foreign); expect(serialized).not.toContain('Foreign financial record');
  if(_name==='summary') expect(body.expense).toBe('35.50');
  if(_name==='trend') expect(body['2026-10'].expense).toBe('35.50');
});
it('member list and salary resolver have the same account boundary', async () => {
  const request = new Request('https://app.example/api/members');
  const context = { params: Promise.resolve({ id: ids.a }) };
  expect((await members(request,context)).status).toBe(401);
  resetSecurityState(ids.outsider); expect((await members(request,context)).status).toBe(403);
  resetSecurityState(ids.member); expect((await members(request,context)).status).toBe(200);
  const periodRequest = new Request(`https://app.example/api/period?account_id=${ids.a}&period=this_month`);
  expect((await period(periodRequest)).status).toBe(200);
});
it('summary outage cannot masquerade as zero income', async () => {
  const db = resetSecurityState(ids.member);
  db.rpcOverride = async () => ({ data: null, error: { code: '08006' } });
  const response = await summary(new Request(`https://app.example/api/summary?account_id=${ids.a}&from=2026-10-12&to=2026-10-12`));
  expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ code: 'dependency_unavailable' });
});
it.each(['NaN','Infinity','0','-1','1.5'])('invalid pagination %s is rejected',async(page)=>{
  resetSecurityState(ids.member);
  expect((await transactions(new Request(`https://app.example/api/transactions?account_id=${ids.a}&page=${page}`))).status).toBe(400);
});
