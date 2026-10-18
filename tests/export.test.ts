import { expect, it } from 'vitest';
import { resetSecurityState } from './helpers/securityState';
import { ids } from './helpers/dashboardDb';
import { GET as exportTransactions } from '../src/app/api/transactions/export/route';
import { csvCell } from '../src/lib/csv';
import { parseTransactionFilters } from '../src/lib/transaction-filters';

it.each([
  '=SUM(A1:A2)',
  ' +1',
  '\t@SUM(A1:A2)',
  '\r-1',
  '\u00a0=SUM(A1:A2)',
  '\u0001@SUM(A1:A2)',
])('makes formula-like user text inert: %s', (value) => {
  expect(csvCell(value, true)).toBe('"\'' + value.replace(/"/g, '""') + '"');
});

it('quotes CSV delimiters and preserves exact numeric text', () => {
  expect(csvCell('food, "coffee"\nmeal', true)).toBe('"food, ""coffee""\nmeal"');
  expect(csvCell('9999999999999.99', false)).toBe('"9999999999999.99"');
  expect(csvCell('', true)).toBe('""');
});

const valid = new URLSearchParams({
  account_id: '10000000-0000-4000-8000-000000000001',
  from: '2026-10-01', to: '2026-10-31', type: 'expense',
  category_id: '20000000-0000-4000-8000-000000000001', search: 'food%_lunch',
});

it('parses the same validated filters used by table and export', () => {
  expect(parseTransactionFilters(valid)).toEqual({
    accountId: '10000000-0000-4000-8000-000000000001',
    from: '2026-10-01', to: '2026-10-31', type: 'expense',
    categoryId: '20000000-0000-4000-8000-000000000001', subcategoryId:null,categoryScope:'all',locale:'id', search: 'food%_lunch',
  });
});

it.each([
  ['account_id', 'bad'],
  ['from', '2026-02-30'],
  ['to', '2026-09-31'],
  ['type', 'transfer'],
  ['category_id', 'bad'],
])('rejects invalid %s without changing valid filters', (key, value) => {
  const params = new URLSearchParams(valid);
  params.set(key, value);
  expect(parseTransactionFilters(params)).toBeNull();
});

it('accepts omitted optional filters as null', () => {
  expect(parseTransactionFilters(new URLSearchParams({ account_id: '10000000-0000-4000-8000-000000000001' }))).toEqual({
    accountId: '10000000-0000-4000-8000-000000000001',
    from: null, to: null, type: null, categoryId: null, subcategoryId:null,categoryScope:'all',locale:'id', search: null,
  });
});

const exportPath = `/api/transactions/export?account_id=${ids.a}&from=2026-10-01&to=2026-10-31`;
const exportId = '60000000-0000-4000-8000-000000000001';

it('returns a complete exact CSV and releases the immutable snapshot', async () => {
  const db = resetSecurityState(ids.member);
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  db.rpcOverride = async (name, args) => {
    calls.push({ name, args });
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 1, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    if (name === 'read_finance_export') return { data: { rows: [{
      ordinal: 1, transactionId: ids.transaction, date: '2026-10-12',
      description: '=SUM(A1:A2)', category: 'Food', type: 'expense', amount: '9999999999999.99',
    }] }, error: null };
    if (name === 'release_finance_export') return { data: true, error: null };
    throw new Error('Unexpected export RPC');
  };

  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/csv');
  expect(await response.text()).toBe(`"Date","Description","Category","Subcategory","Type","Amount"\r\n"2026-10-12","'=SUM(A1:A2)","Food","","expense","9999999999999.99"\r\n`);
  expect(calls.map(call => call.name)).toEqual([
    'start_finance_export', 'read_finance_export', 'release_finance_export',
  ]);
  expect(calls[0].args).toMatchObject({
    p_user_id: ids.member,
    p_filters: {
      accountId: ids.a, from: '2026-10-01', to: '2026-10-31',
      type: null, categoryId: null, search: null,
    },
  });
});

it('returns header-only CSV when no rows match', async () => {
  const db = resetSecurityState(ids.owner);
  db.rpcOverride = async name => name === 'start_finance_export'
    ? { data: { id: exportId, count: 0, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500 }, error: null }
    : { data: true, error: null };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('"Date","Description","Category","Subcategory","Type","Amount"\r\n');
});

it('rejects incomplete pages and releases the snapshot without returning a file', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 1, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    if (name === 'read_finance_export') return { data: { rows: [] }, error: null };
    return { data: true, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(503);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(await response.json()).toMatchObject({ code: 'dependency_unavailable' });
  expect(calls).toEqual(['start_finance_export', 'read_finance_export', 'release_finance_export']);
});

it('rejects nonpositive snapshot amounts without returning a file', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 1, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    if (name === 'read_finance_export') return { data: { rows: [{
      ordinal: 1, transactionId: ids.transaction, date: '2026-10-12',
      description: 'invalid amount', category: 'Food', type: 'expense', amount: '0.00',
    }] }, error: null };
    return { data: true, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(503);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(calls).toEqual(['start_finance_export', 'read_finance_export', 'release_finance_export']);
});

it('rejects an export above the verified row cap before fetching pages', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    if (name === 'start_finance_export') return { data: {
      id: exportId, count: 100_000, expiresAt: '2099-10-12T12:15:00.000Z', pageSize: 500,
    }, error: null };
    return { data: true, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(413);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(await response.json()).toMatchObject({ code: 'export_limit_exceeded' });
  expect(calls).toEqual(['start_finance_export', 'release_finance_export']);
});

it('returns a limit response when the database declines an oversized snapshot', async () => {
  const db = resetSecurityState(ids.owner);
  const calls: string[] = [];
  db.rpcOverride = async name => {
    calls.push(name);
    return { data: { code: 'limit' }, error: null };
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ code: 'export_limit_exceeded' });
  expect(calls).toEqual(['start_finance_export']);
});

it('denies a nonmember before creating a snapshot', async () => {
  const db = resetSecurityState(ids.outsider);
  let rpcCalled = false;
  db.rpcOverride = async () => { rpcCalled = true; return { data: null, error: null }; };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(403);
  expect(rpcCalled).toBe(false);
});
it('escapes both frozen hierarchy labels and preserves UTF-8, quotes and newlines', async () => {
  const db = resetSecurityState(ids.owner);
  const row = {ordinal:1,transactionId:ids.transaction,date:'2026-10-12',
    description:'makan, "enak"\nbersama',category:'=Kucing 🐈',subcategory:' +Cat, "Care"',
    type:'expense',amount:'0.01'};
  db.rpcOverride = async name => ({
    data:name==='start_finance_export'
      ? {id:exportId,count:1,expiresAt:'2099-10-12T12:15:00.000Z',pageSize:500}
      : name==='read_finance_export' ? {rows:[row]} : true,
    error:null,
  });
  const response = await exportTransactions(new Request(`https://app.example${exportPath}&locale=en`));
  expect(response.status).toBe(200);
  const text = await response.text();
  const expected = `"Date","Description","Category","Subcategory","Type","Amount"\r\n` +
    `"2026-10-12","makan, ""enak""\nbersama","'=Kucing 🐈","' +Cat, ""Care""","expense","0.01"\r\n`;
  expect(text).toBe(expected);
  expect(new TextEncoder().encode(text).byteLength).toBe(new TextEncoder().encode(expected).byteLength);
});
it('pages beyond 500 frozen rows without reinterpreting category labels', async () => {
  const db = resetSecurityState(ids.member);
  const afterValues:unknown[]=[];
  const frozen = Array.from({length:501},(_,index)=>({
    ordinal:index+1,transactionId:db.id(),date:'2026-10-12',description:`Meal ${index+1}`,
    category:'Original root',subcategory:index%2?'Original child':'',type:'expense',amount:'0.01',
  }));
  db.rpcOverride = async (name,args) => {
    if(name==='start_finance_export') return {data:{id:exportId,count:501,expiresAt:'2099-10-12T12:15:00.000Z',pageSize:500},error:null};
    if(name==='read_finance_export') {
      afterValues.push(args.p_after);
      db.tables.categories[0].name_en='Renamed live root';
      db.tables.transactions.push({...db.tables.transactions[0],id:db.id()});
      return {data:{rows:frozen.slice(Number(args.p_after),Number(args.p_after)+Number(args.p_limit))},error:null};
    }
    return {data:true,error:null};
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(afterValues).toEqual([0,500]);
  expect(text.split('\r\n')).toHaveLength(503);
  expect(text).toContain('\"Meal 501\",\"Original root\",\"\",\"expense\",\"0.01\"');
  expect(text).not.toContain('Renamed live root');
});
it('rejects the actual UTF-8 byte cap with no partial attachment and releases the snapshot', async () => {
  const db = resetSecurityState(ids.owner); const calls:string[]=[];
  db.rpcOverride = async name => {
    calls.push(name);
    if(name==='start_finance_export') return {data:{id:exportId,count:1,expiresAt:'2099-10-12T12:15:00.000Z',pageSize:500},error:null};
    if(name==='read_finance_export') return {data:{rows:[{
      ordinal:1,transactionId:ids.transaction,date:'2026-10-12',description:'🐈'.repeat(8_388_608),
      category:'Food',subcategory:'Dining',type:'expense',amount:'0.01',
    }]},error:null};
    return {data:true,error:null};
  };
  const response = await exportTransactions(new Request(`https://app.example${exportPath}`));
  expect(response.status).toBe(413);
  expect(response.headers.get('content-disposition')).toBeNull();
  expect(await response.json()).toMatchObject({code:'export_limit_exceeded'});
  expect(calls.at(-1)).toBe('release_finance_export');
});
