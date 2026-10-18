import {beforeEach,expect,it} from 'vitest';
import {resetSecurityState} from './helpers/securityState';
import {ids} from './helpers/dashboardDb';
import {POST as createAccount,PATCH as editAccount} from '../src/app/api/accounts/route';
import {DELETE as deactivate} from '../src/app/api/accounts/route';
import {POST as categoryPost,PATCH as categoryPatch,DELETE as categoryDelete} from '../src/app/api/categories/route';
import {POST as budgetPost,DELETE as budgetDelete} from '../src/app/api/budgets/route';
const json=(path:string,method:string,body:unknown)=>new Request(`https://app.example${path}`,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>resetSecurityState(ids.member));
it('foreign deactivation cannot remove any memberships',async()=>{
  const db=resetSecurityState(ids.member); const memberships=db.tables.members.map(r=>({...r}));
  expect((await deactivate(new Request(`https://app.example/api/accounts?id=${ids.b}`,{method:'DELETE'}))).status).toBe(403);
  expect(db.tables.members).toEqual(memberships); expect(db.tables.accounts[1].is_active).toBe(true);
});
it('owner deactivation preserves financial and membership history',async()=>{
  const db=resetSecurityState(ids.owner); const members=db.tables.members.map(r=>({...r})); const txns=db.tables.transactions.map(r=>({...r}));
  expect((await deactivate(new Request(`https://app.example/api/accounts?id=${ids.a}`,{method:'DELETE'}))).status).toBe(200);
  expect(db.tables.accounts[0].is_active).toBe(false); expect(db.tables.members).toEqual(members); expect(db.tables.transactions).toEqual(txns);
});
it('category writes require login and owner',async()=>{
  const body={account_id:ids.a,name_en:'Travel',type:'expense'};
  resetSecurityState(null); expect((await categoryPost(json('/api/categories','POST',body))).status).toBe(401);
  resetSecurityState(ids.member); expect((await categoryPost(json('/api/categories','POST',body))).status).toBe(403);
  const db=resetSecurityState(ids.owner); expect((await categoryPost(json('/api/categories','POST',body))).status).toBe(200);
  expect(db.tables.categories.find(r=>r.name_en==='Travel')).toMatchObject({account_id:ids.a,is_custom:true,name_id:null,parent_id:null});
});
it('default category remains protected, foreign category is inaccessible',async()=>{
  resetSecurityState(ids.owner);
  expect((await categoryPatch(json('/api/categories','PATCH',{id:ids.income,name_en:'Renamed'}))).status).toBe(403);
  expect((await categoryDelete(new Request(`https://app.example/api/categories?id=${ids.foreign}`,{method:'DELETE'}))).status).toBe(403);
});
it('budget cannot point at another account or income category',async()=>{
  const db=resetSecurityState(ids.owner);
  for(const category_id of [ids.foreign,ids.income,ids.inactive]) {
    expect((await budgetPost(json('/api/budgets','POST',{account_id:ids.a,category_id,amount:100}))).status).toBe(400);
  }
  expect(db.tables.budgets).toHaveLength(1);
});
it('budget delete failure is not success',async()=>{
  const db=resetSecurityState(ids.owner); db.failures.push({table:'budgets',mode:'delete'});
  expect((await budgetDelete(new Request(`https://app.example/api/budgets?id=${ids.budget}`,{method:'DELETE'}))).status).toBe(503);
  expect(db.tables.budgets).toHaveLength(1);
});
it('account creation rejects requests without an idempotency key before any write',async()=>{
  const db=resetSecurityState(ids.owner); const before=structuredClone(db.tables);
  const response=await createAccount(json('/api/accounts','POST',{name:'New fixture',type:'personal'}));
  expect(response.status).toBe(400);
  expect(db.tables).toEqual(before);
});
it.each([{owner_id:ids.outsider},{wa_chat_id:'foreign-chat'},{type:'invalid'}])('account update rejects protected/invalid fields %j',async(extra)=>{
  const db=resetSecurityState(ids.owner); const before={...db.tables.accounts[0]};
  expect((await editAccount(json('/api/accounts','PATCH',{id:ids.a,name:'Changed',...extra}))).status).toBe(400);
  expect(db.tables.accounts[0]).toEqual(before);
});
