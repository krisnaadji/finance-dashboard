import { expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { GET } from '../src/app/api/transactions/route';
import { GET as exportRows } from '../src/app/api/transactions/export/route';
import { parseTransactionFilters } from '../src/lib/transaction-filters';
const base=`https://app.example/api/transactions?account_id=${ids.a}`;
it.each(['subcategory_id='+ids.inactive,'category_scope=direct&category_id='+ids.expense+'&subcategory_id='+ids.inactive,'category_id=bad','locale=fr','category_scope=children'])('rejects malformed hierarchy filters %s',async(query)=>{resetSecurityState(ids.member);expect(parseTransactionFilters(new URL(base+'&'+query).searchParams)).toBeNull();expect((await GET(new Request(base+'&'+query))).status).toBe(400);});
it('normalizes hierarchy, requested locale and wildcard search without changing their meaning', () => {
  const filters=parseTransactionFilters(new URLSearchParams({
    account_id:ids.a,category_id:ids.expense,subcategory_id:ids.inactive,locale:'en',search:'food%_',
  }));
  expect(filters).toEqual({
    accountId:ids.a,categoryId:ids.expense,subcategoryId:ids.inactive,categoryScope:'all',
    locale:'en',search:'food%_',type:null,from:null,to:null,
  });
});
it('rejects foreign roots and incompatible child relationships before either RPC',async()=>{const db=resetSecurityState(ids.member);const rpc:unknown[]=[];db.rpcOverride=async(name)=>{rpc.push(name);return {data:null,error:null};};for(const query of [`category_id=${ids.foreign}`,`category_id=${ids.expense}&subcategory_id=${ids.inactive}`,`category_id=${ids.expense}&type=income`]) {expect((await GET(new Request(base+'&'+query))).status).toBe(400);expect((await exportRows(new Request(base.replace('/transactions?','/transactions/export?')+'&'+query))).status).toBe(400);}expect(rpc).toEqual([]);});
it('preserves exact-child saved links without allowing them as explicit parent filters',async()=>{const db=resetSecurityState(ids.member);const child=db.id();db.tables.categories.push({...db.tables.categories[0],id:child,parent_id:ids.expense});db.tables.transactions[0].category_id=child;expect((await GET(new Request(base+'&category_id='+child))).status).toBe(200);expect((await GET(new Request(base+'&category_id='+child+'&category_scope=all'))).status).toBe(400);});
it('reconciles parent, child, direct-only and inactive-history views over the complete matching set', async () => {
  const db = resetSecurityState(ids.member);
  const child = db.id(), sibling = db.id(), otherRoot = db.id();
  db.tables.categories.push(
    {...db.tables.categories[0],id:child,parent_id:ids.expense,is_active:false},
    {...db.tables.categories[0],id:sibling,parent_id:ids.expense},
    {...db.tables.categories[0],id:otherRoot},
  );
  const template = db.tables.transactions[0];
  db.tables.transactions = [
    {...template,amount:'100.00'},
    {...template,id:db.id(),category_id:child,amount:'200.00'},
    {...template,id:db.id(),category_id:sibling,amount:'300.00'},
    {...template,id:db.id(),category_id:otherRoot,amount:'400.00'},
    {...template,id:db.id(),category_id:ids.income,type:'income',amount:'1500.00'},
  ];
  const cases = [
    [`category_id=${ids.expense}`,3,'600.00'],
    [`category_id=${ids.expense}&subcategory_id=${child}`,1,'200.00'],
    [`category_id=${ids.expense}&category_scope=direct`,1,'100.00'],
    [`category_id=${child}`,1,'200.00'],
  ] as const;
  for (const [query,total,expense] of cases) {
    const response = await GET(new Request(base+'&'+query+'&page_size=1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({total,summary:{income:'0.00',expense,net:'-'+expense},data:[{account_id:ids.a}]});
  }
  db.tables.transactions = Array.from({length:1501},(_,index)=>({
    ...template,id:db.id(),category_id:child,amount:index===0?'9999999999999.99':'0.01',
  }));
  const response = await GET(new Request(base+`&category_id=${ids.expense}&page=2&page_size=20`));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    total:1501,totalPages:76,page:2,summary:{income:'0.00',expense:'10000000000014.99',net:'-10000000000014.99'},
    data:Array.from({length:20},()=>expect.objectContaining({category_id:child,parent:expect.objectContaining({id:ids.expense})})),
  });
});
it.each(['from=','to=','type=','category_id=','category_scope=direct','category_id='+ids.expense+'&category_id='+ids.income])('rejects ambiguous or empty filter %s', async query => {
  resetSecurityState(ids.member);
  expect((await GET(new Request(base+'&'+query))).status).toBe(400);
});
it('reports malformed dependency data as unavailable rather than a zero-valued page', async () => {
  const db = resetSecurityState(ids.member);
  db.rpcOverride = async () => ({data:{rows:[],total:0,summary:{income:0,expense:'0.00',net:'0.00'}},error:null});
  const response = await GET(new Request(base));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({code:'dependency_unavailable'});
});
it.each(['page=2147483648','page=9007199254740991','page_size=100000','page=0'])('rejects pagination outside the RPC range %s', async query => {
  const db=resetSecurityState(ids.member);
  const calls:unknown[]=[];
  db.rpcOverride=async(name)=>{calls.push(name);return {data:null,error:null};};
  expect((await GET(new Request(base+'&'+query))).status).toBe(400);
  expect(calls).toEqual([]);
});
