'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccountId } from '@/components/AccountSwitcher';
import { SummaryCards } from '@/components/SummaryCards';
import { IncomeExpenseChart } from '@/components/IncomeExpenseChart';
import { CategoryPieChart } from '@/components/CategoryPieChart';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { PeriodControl, createInitialPeriodValue, type PeriodValue } from '@/components/PeriodControl';
import { formatIDR, formatDate } from '@/lib/utils';
import { currentMonthRange } from '@/lib/reporting-period';
import { GlassCard } from '@/components/ui/GlassCard';
import { compareMoney, budgetPercent } from '@/lib/money';
import type { Summary } from '@/lib/reporting-contract';
import { categoryLabel, categoryPath, type Category, type CategoryLocale } from '@/lib/categories';
import { GlassButton } from '@/components/ui/GlassButton';

interface Budget { id: string; category_id: string; amount: string }
export default function DashboardPage() {
  const accountId = useAccountId(); const locale = useLocale() as CategoryLocale;
  const t = useTranslations('hierarchy'); const s = useTranslations('summary');
  const [period, setPeriod] = useState<PeriodValue>(() => createInitialPeriodValue(new Date(), true));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<Summary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [trend, setTrend] = useState<Summary['byMonth'] | null>(null); const [trendError, setTrendError] = useState('');
  const [loadingTrend, setLoadingTrend] = useState(false); const [showTrend, setShowTrend] = useState(false);
  const [addOpen, setAddOpen] = useState(false); const [tick, setTick] = useState(0);
  useEffect(() => { setAddOpen(false); }, [accountId]);
  const periodReady = period.valid && (period.mode !== 'salary_cycle' || period.resolvedAccountId === accountId);
  const scope = `${accountId}|${period.from}|${period.to}|${periodReady}|${locale}|${tick}`;
  const currentScope = useRef(scope); currentScope.current = scope;
  const trendRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    setSummary(null); setMonthlySummary(null); setBudgets([]); setCategories([]); setTrend(null); setShowTrend(false); setTrendError(''); setLoadingTrend(false);
    trendRequest.current?.abort();
    if (!accountId || !periodReady) { setLoading(false); return; }
    const controller = new AbortController(); const requested = scope; setLoading(true); setError('');
    const monthly = currentMonthRange();
    const load = async (url: string) => { const r = await fetch(url, { signal: controller.signal }); if (!r.ok) throw new Error(); return r.json(); };
    Promise.all([
      load(`/api/summary?account_id=${accountId}&from=${period.from}&to=${period.to}`),
      load(`/api/summary?account_id=${accountId}&from=${monthly.from}&to=${monthly.to}`),
      load(`/api/budgets?account_id=${accountId}`),
      load(`/api/categories?account_id=${accountId}&include_inactive=true`),
    ]).then(([report, monthlyReport, limits, catalog]) => {
      if (!controller.signal.aborted && currentScope.current === requested) { setSummary(report); setMonthlySummary(monthlyReport); setBudgets(limits); setCategories(catalog); }
    }).catch(() => { if (!controller.signal.aborted && currentScope.current === requested) setError(t('loadFailed')); })
      .finally(() => { if (!controller.signal.aborted && currentScope.current === requested) setLoading(false); });
    return () => { controller.abort(); trendRequest.current?.abort(); };
  }, [accountId, period.from, period.to, periodReady, scope, t]);
  async function showHistory() {
    setShowTrend(true); if (trend || loadingTrend) return;
    const requested = scope; const controller = new AbortController(); trendRequest.current = controller;
    setLoadingTrend(true); setTrendError('');
    try {
      const r = await fetch(`/api/summary/trend?account_id=${accountId}`, { signal: controller.signal }); if (!r.ok) throw new Error(); const data = await r.json();
      if (!controller.signal.aborted && currentScope.current === requested) setTrend(data);
    } catch { if (!controller.signal.aborted && currentScope.current === requested) setTrendError(t('loadFailed')); }
    finally { if (!controller.signal.aborted && currentScope.current === requested) setLoadingTrend(false); }
  }
  const top = summary?.categories.reduce<Summary['categories'][number] | null>((best, c) => !best || compareMoney(c.amount, best.amount) > 0 ? c : best, null);
  const topLabel = top ? top.id === null ? t('uncategorized') : categoryLabel(top, locale) : undefined;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold text-white">{s('title')}</h1><p className="text-xs text-white/70">{new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div><GlassButton variant="primary" onClick={() => setAddOpen(true)} disabled={!accountId}>{t('addTransaction')}</GlassButton></div>
    <AddTransactionModal accountId={accountId} open={addOpen} onClose={() => setAddOpen(false)} onCreated={() => setTick(n => n + 1)} />
    <PeriodControl accountId={accountId} value={period} onChange={setPeriod} />
    {loading && <p role="status" className="text-white/70">{t('loading')}</p>}
    {error && <div role="alert" className="text-red-300">{error} <GlassButton onClick={() => setTick(n => n + 1)}>{t('retry')}</GlassButton></div>}
    {summary && <>
      <SummaryCards income={summary.income} expense={summary.expense} net={summary.net} topExpenseCategory={topLabel} topExpenseAmount={top?.amount} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><IncomeExpenseChart byMonth={summary.byMonth} /><CategoryPieChart key={`${accountId}|${period.from}|${period.to}`} categories={summary.categories} details={summary.categoryDetails} catalog={categories} /></div>
      {budgets.length > 0 && <GlassCard className="p-4"><h2 className="mb-2 font-medium text-white">{t('monthlyBudgets')}</h2><p className="mb-4 text-sm text-white/70">{t('budgetScope')}</p><div className="space-y-4">{budgets.map(b => {
        const c = categories.find(c => c.id === b.category_id); if (!c || c.parent_id || c.type !== 'expense') return null;
        const spent = monthlySummary?.spendingByCategoryId[c.id] ?? '0.00'; const percent = budgetPercent(spent, b.amount); const over = compareMoney(spent, b.amount) > 0;
        return <div key={b.id}><div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/90"><span>{categoryLabel(c, locale)}{over ? ` (${t('overBudget')})` : ''}</span><span>{formatIDR(spent)} / {formatIDR(b.amount)}</span></div><div role="progressbar" aria-label={categoryLabel(c, locale)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(percent, 100)} className="my-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={over ? 'h-full bg-red-400' : 'h-full bg-emerald-400'} style={{ width: `${Math.min(percent, 100)}%` }} /></div><ul className="text-xs text-white/70">{monthlySummary?.categoryDetails.filter(d => d.parentId === c.id).map(d => <li key={d.categoryId ?? 'direct'}>{d.categoryId === c.id || d.categoryId === null ? t('direct') : categoryLabel(categories.find(child => child.id === d.categoryId) ?? c, locale)}: {formatIDR(d.amount)}</li>)}</ul></div>;
      })}</div></GlassCard>}
      <div className="grid gap-4 md:grid-cols-2">{(['topExpenses', 'topIncomes'] as const).map(kind => <GlassCard key={kind} className="p-4"><h2 className="mb-3 font-medium text-white">{t(kind)}</h2>{!summary[kind].length && <p className="text-sm text-white/70">{s('noData')}</p>}<ol className="space-y-3">{summary[kind].map(txn => <li key={txn.id} className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm text-white/90">{txn.description}</p><p className="text-xs text-white/70">{txn.category ? categoryPath(txn.category, txn.parent ? [txn.parent, txn.category] : [txn.category], locale) : t('uncategorized')} · {formatDate(txn.date, locale)}</p></div><span className="shrink-0 text-sm text-white">{formatIDR(txn.amount)}</span></li>)}</ol></GlassCard>)}</div>
    </>}
    <div><GlassButton onClick={showHistory} disabled={!accountId || loadingTrend}>{t('showHistory')}</GlassButton>{showTrend && <div className="mt-3">{loadingTrend && <p role="status" className="text-white/70">{t('loading')}</p>}{trendError && <p role="alert" className="text-red-300">{trendError} <GlassButton onClick={showHistory}>{t('retry')}</GlassButton></p>}{trend && <IncomeExpenseChart byMonth={trend} />}</div>}</div>
  </div>;
}
