import { expect, it } from 'vitest';
import { seedDashboardDb, ids, type DashboardDb } from './helpers/dashboardDb';
import { resolveReportingPeriod, type ReportingPeriodClient } from '../src/lib/reporting-period';
function resolve(db:DashboardDb,month?:number,year?:number) {return resolveReportingPeriod(db as unknown as ReportingPeriodClient,ids.a,'salary_cycle',{salaryMonth:month,salaryYear:year},new Date('2026-05-20T18:00:00Z'));}
function salary(db:DashboardDb,date:string,categoryId=ids.income,accountId=ids.a) {db.tables.transactions.push({id:db.id(),account_id:accountId,category_id:categoryId,date,type:'income',amount:'1000.00',description:'Salary marker'});}
it('uses stable salary code despite translated label changes and excludes bonus and foreign markers',async()=>{const db=seedDashboardDb();db.tables.categories[1].name_id='Penghasilan tetap';db.tables.categories[1].name_en='Monthly pay';const bonus=db.id();db.tables.categories.push({...db.tables.categories[1],id:bonus,code:'income.bonus'});salary(db,'2026-03-10');salary(db,'2026-03-01');salary(db,'2026-04-05');salary(db,'2026-04-10');salary(db,'2026-04-30',bonus);salary(db,'2026-04-29',ids.income,ids.b);expect(await resolve(db,3,2026)).toEqual({ok:true,from:'2026-03-01',to:'2026-04-09',label:'salary_cycle',salaryMonth:3,salaryYear:2026});});
it('does not bridge a skipped following month and selects latest salary month implicitly',async()=>{const db=seedDashboardDb();salary(db,'2026-03-01');salary(db,'2026-05-03');expect(await resolve(db,3,2026)).toMatchObject({ok:true,from:'2026-03-01',to:'2026-05-21'});expect(await resolve(db)).toMatchObject({ok:true,from:'2026-05-03',salaryMonth:5,salaryYear:2026});});
it('reports missing salary distinctly from category and transaction outages',async()=>{const db=seedDashboardDb();expect(await resolve(db,3,2026)).toEqual({ok:false,reason:'salary_not_found'});db.failures.push({table:'categories',mode:'read'});expect(await resolve(db,3,2026)).toEqual({ok:false,reason:'query_failed'});db.failures.push({table:'transactions',mode:'read'});expect(await resolve(db,3,2026)).toEqual({ok:false,reason:'query_failed'});});
it('preserves leap-day and year rollover boundaries',async()=>{const db=seedDashboardDb();salary(db,'2024-02-29');salary(db,'2024-03-01');expect(await resolve(db,2,2024)).toMatchObject({ok:true,from:'2024-02-29',to:'2024-02-29'});salary(db,'2025-12-31');salary(db,'2026-01-02');expect(await resolve(db,12,2025)).toMatchObject({ok:true,from:'2025-12-31',to:'2026-01-01'});});
it('keeps the April salary boundary independent of labels, activity, catalog size and bonus markers', async () => {
  const db = seedDashboardDb();
  const stableSalary = {...db.tables.categories[1],name_id:'Bonus',name_en:null,is_active:false};
  const bonusId=db.id(),foreignSalaryId=db.id();
  db.tables.categories = [
    ...Array.from({length:1501},()=>({...db.tables.categories[0],id:db.id(),name_en:'Salary'})),
    {...stableSalary,id:bonusId,code:'income.bonus',is_active:true,name_id:'Gaji',name_en:'Salary'},
    {...stableSalary,id:foreignSalaryId,account_id:ids.b},
    stableSalary,
  ];
  salary(db,'2026-03-27');
  salary(db,'2026-04-02',bonusId);
  salary(db,'2026-04-14',foreignSalaryId);
  salary(db,'2026-04-06');
  const now=new Date('2026-04-15T03:00:00Z');
  const client=db as unknown as ReportingPeriodClient;
  expect(await resolveReportingPeriod(client,ids.a,'salary_cycle',{salaryMonth:3,salaryYear:2026},now))
    .toMatchObject({ok:true,from:'2026-03-27',to:'2026-04-05'});
  salary(db,'2026-04-10');
  expect(await resolveReportingPeriod(client,ids.a,'salary_cycle',{salaryMonth:3,salaryYear:2026},now))
    .toMatchObject({ok:true,from:'2026-03-27',to:'2026-04-09'});
  db.tables.transactions=db.tables.transactions.filter(t=>!(t.category_id===ids.income && String(t.date).startsWith('2026-04')));
  salary(db,'2026-05-06');
  expect(await resolveReportingPeriod(client,ids.a,'salary_cycle',{salaryMonth:3,salaryYear:2026},now))
    .toMatchObject({ok:true,from:'2026-03-27',to:'2026-04-15'});
});
