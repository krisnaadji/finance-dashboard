import {beforeEach,expect,it} from 'vitest';
import {resetSecurityState} from './helpers/securityState';
import {ids} from './helpers/dashboardDb';
import {POST} from '../src/app/api/transactions/route';
import {PATCH,DELETE} from '../src/app/api/transactions/[id]/route';
function request(method:string,body:unknown,origin='https://app.example') {
  return new Request(`https://app.example/api/transactions/${ids.transaction}`,{method,
    headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
}
const context=()=>({params:Promise.resolve({id:ids.transaction})});
beforeEach(()=>resetSecurityState(ids.member));
it.each(['account_id','id','recorded_by_name','wa_user_message_id','updated_at'])('rejects immutable field %s without update',async(field)=>{
  const db=resetSecurityState(ids.member); const before={...db.tables.transactions[0]};
  const response=await PATCH(request('PATCH',{[field]:ids.b,amount:99}),context());
  expect(response.status).toBe(400); expect(db.tables.transactions[0]).toEqual(before);
});
it('type-only edit cannot retain wrong category',async()=>{
  const db=resetSecurityState(ids.member); const response=await PATCH(request('PATCH',{type:'income'}),context());
  expect(response.status).toBe(400); expect(db.tables.transactions[0].type).toBe('expense');
});
it('description-only edit retains inactive history but selecting it again fails',async()=>{
  const db=resetSecurityState(ids.member); db.tables.transactions[0].category_id=ids.inactive;
  expect((await PATCH(request('PATCH',{description:'Corrected'}),context())).status).toBe(200);
  expect(db.tables.transactions[0]).toMatchObject({description:'Corrected',category_id:ids.inactive});
  expect((await PATCH(request('PATCH',{category_id:ids.inactive}),context())).status).toBe(400);
});
it.each([ids.foreign,ids.income,ids.inactive])('creation rejects category %s',async(category_id)=>{
  const db=resetSecurityState(ids.member);
  const response=await POST(request('POST',{account_id:ids.a,amount:'10.50',type:'expense',date:'2026-10-12',category_id}));
  expect(response.status).toBe(400); expect(db.tables.transactions).toHaveLength(1);
});
it.each([{amount:0},{amount:'0.001'},{date:'2026-02-30'}])('invalid creation %j makes no write',async(override)=>{
  const db=resetSecurityState(ids.member);
  const response=await POST(request('POST',{account_id:ids.a,amount:10,type:'expense',date:'2026-10-12',...override}));
  expect(response.status).toBe(400); expect(db.tables.transactions).toHaveLength(1);
});
it('member may edit but not delete; owner may delete',async()=>{
  const db=resetSecurityState(ids.member);
  expect((await PATCH(request('PATCH',{amount:'40.25'}),context())).status).toBe(200);
  expect(db.tables.transactions[0].amount).toBe('40.25');
  expect((await DELETE(new Request('https://app.example/api/transactions'),context())).status).toBe(403);
  resetSecurityState(ids.owner);
  expect((await DELETE(new Request('https://app.example/api/transactions',{method:'DELETE'}),context())).status).toBe(200);
});
it.each([false,true])('failed/zero-row update never reports success (zero=%s)',async(zero)=>{
  const db=resetSecurityState(ids.member); db.failures.push({table:'transactions',mode:'update',zero});
  const response=await PATCH(request('PATCH',{amount:99}),context()); expect(response.status).toBe(zero?409:503);
  expect(db.tables.transactions[0].amount).toBe('35.50');
});
it('foreign-origin cookie mutation is denied',async()=>{
  const db=resetSecurityState(ids.member);
  expect((await PATCH(request('PATCH',{amount:99},'https://outsider.example'),context())).status).toBe(403);
  expect(db.tables.transactions[0].amount).toBe('35.50');
});
it('committed creation remains truthful when its warning lookup fails',async()=>{
  const db=resetSecurityState(ids.member); db.failures.push({table:'budgets',mode:'read'});
  const response=await POST(request('POST',{account_id:ids.a,amount:'10.50',type:'expense',date:'2026-10-12',category_id:ids.expense}));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({transaction:{account_id:ids.a,amount:'10.50'},budgetWarning:null,budgetWarningError:'dependency_unavailable'});
  expect(db.tables.transactions).toHaveLength(2);
});
