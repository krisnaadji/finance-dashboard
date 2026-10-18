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
it('description-only edit and unchanged selection retain inactive history',async()=>{
  const db=resetSecurityState(ids.member); db.tables.transactions[0].category_id=ids.inactive;
  expect((await PATCH(request('PATCH',{description:'Corrected'}),context())).status).toBe(200);
  expect(db.tables.transactions[0]).toMatchObject({description:'Corrected',category_id:ids.inactive});
  expect((await PATCH(request('PATCH',{category_id:ids.inactive}),context())).status).toBe(200);
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
it.each([false,true])('committed creation remains truthful when its warning lookup fails (throws=%s)',async(throws)=>{
  const db=resetSecurityState(ids.member); db.failures.push({table:'budgets',mode:'read',throws});
  const response=await POST(request('POST',{account_id:ids.a,amount:'10.50',type:'expense',date:'2026-10-12',category_id:ids.expense}));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({transaction:{account_id:ids.a,amount:'10.50'},budgetWarning:null,budgetWarningError:'dependency_unavailable'});
  expect(db.tables.transactions).toHaveLength(2);
});
it('reports a child expense warning against the root budget with bilingual root metadata', async () => {
  const db = resetSecurityState(ids.member);
  const child = db.id();
  db.tables.categories.push({...db.tables.categories[0],id:child,parent_id:ids.expense,name_en:'Dining'});
  db.rpcOverride = async name => name === 'finance_budget_spending'
    ? {data:{spendingByCategoryId:{[ids.expense]:'90.00',[child]:'10.00'}},error:null}
    : {data:null,error:{code:'unexpected_rpc'}};
  const response = await POST(request('POST',{account_id:ids.a,amount:'10.00',type:'expense',date:'2026-10-12',category_id:child}));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    transaction:{category_id:child,categories:{id:child},parent:{id:ids.expense}},
    budgetWarning:{category:{id:ids.expense,name_id:'Makanan',name_en:'Food'},spent:'90.00',limit:'100.00',pct:90,over:false},
  });
});
it('does not disguise a committed-write category dependency outage as uncategorized history', async () => {
  const db = resetSecurityState(ids.member);
  db.failures.push({table:'categories',mode:'read',skip:1});
  db.failures.push({table:'budgets',mode:'read'});
  const created = await POST(request('POST',{account_id:ids.a,amount:'0.01',type:'expense',date:'2026-10-12',category_id:ids.expense}));
  expect(created.status).toBe(200);
  expect(await created.json()).toMatchObject({
    transaction:{amount:'0.01',category_id:ids.expense,categories:null,parent:null},
    categoryProjectionError:'dependency_unavailable',budgetWarningError:'dependency_unavailable',budgetWarning:null,
  });
  expect(db.tables.transactions).toHaveLength(2);
  expect(db.failures).toContainEqual({table:'budgets',mode:'read'});
  db.failures.push({table:'categories',mode:'read'});
  const edited = await PATCH(request('PATCH',{description:'Saved correction'}),context());
  expect(edited.status).toBe(200);
  expect(await edited.json()).toMatchObject({description:'Saved correction',category_id:ids.expense,categoryProjectionError:'dependency_unavailable'});
  expect(db.tables.transactions[0].description).toBe('Saved correction');
});
it('edits a legacy null-description transaction without rewriting its history', async () => {
  const db = resetSecurityState(ids.member);
  db.tables.transactions[0].description=null;
  db.tables.transactions[0].category_id=ids.inactive;
  const response=await PATCH(request('PATCH',{amount:'40.00'}),context());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({amount:'40.00',description:'',category_id:ids.inactive});
  expect(db.tables.transactions[0]).toMatchObject({amount:'40.00',description:null,category_id:ids.inactive});
});
