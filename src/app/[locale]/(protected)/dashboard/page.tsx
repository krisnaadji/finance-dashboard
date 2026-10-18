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
import { GlowBadge } from '@/components/ui/GlowBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import { compareMoney, budgetPercent, subtractMoney } from '@/lib/money';
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
  const budgetOverview = budgets.flatMap(b => {
    const cat = categories.find(c => c.id === b.category_id);
    if (!cat || cat.parent_id || cat.type !== 'expense') return [];
    const spent = monthlySummary?.spendingByCategoryId[cat.id] ?? '0.00';
    return [{ id: b.id, categoryId: cat.id, name: categoryLabel(cat, locale), spent, limit: b.amount, pct: budgetPercent(spent, b.amount), over: compareMoney(spent, b.amount) > 0 }];
  }).sort((a, b) => b.pct - a.pct);
  const now = new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (!accountId)
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">{t('loading')}</p>
      </div>
    );

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: '#f1f5f9' }}>
            {s('title')}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(241,245,249,0.3)' }}>{now}</p>
        </div>
        <GlassButton variant="primary" onClick={() => setAddOpen(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          <span className="hidden sm:inline">{t('addTransaction')}</span>
          <span className="sm:hidden">Add</span>
        </GlassButton>
      </div>

      <AddTransactionModal
        accountId={accountId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => setTick((n) => n + 1)}
      />

      <PeriodControl accountId={accountId} value={period} onChange={setPeriod} className="mb-6" />

      {loading && <p role="status" className="text-white/30 text-sm animate-pulse">{t('loading')}</p>}
      {error && <div role="alert" className="mb-4 text-sm text-red-300">{error} <GlassButton onClick={() => setTick(n => n + 1)}>{t('retry')}</GlassButton></div>}

      {summary && (
        <>
          <SummaryCards
            income={summary.income}
            expense={summary.expense}
            net={summary.net}
            topExpenseCategory={topLabel}
            topExpenseAmount={top?.amount}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <IncomeExpenseChart byMonth={summary.byMonth} />
            <CategoryPieChart key={`${accountId}|${period.from}|${period.to}`} categories={summary.categories} details={summary.categoryDetails} catalog={categories} />
          </div>

          {/* Budget Overview */}
          {budgetOverview.length > 0 && (
            <GlassCard className="p-4 mt-6">
              <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(241,245,249,0.55)' }}>
                {t('monthlyBudgets')}
              </h2>
              <div className="space-y-3">
                {budgetOverview.map(
                  (b) =>
                    b && (
                      <div key={b.id}>
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm" style={{ color: 'rgba(241,245,249,0.8)' }}>{b.name}</span>
                            {b.over && (
                              <GlowBadge color="red">{t('overBudget')}</GlowBadge>
                            )}
                            {!b.over && b.pct >= 80 && (
                              <GlowBadge color="amber">Near limit</GlowBadge>
                            )}
                          </div>
                          <div className="text-right">
                            <span
                              className="text-xs font-medium"
                              style={{ color: b.over ? '#f87171' : b.pct >= 80 ? '#fbbf24' : 'rgba(241,245,249,0.55)' }}
                            >
                              {formatIDR(b.spent)}
                            </span>
                            <span className="text-xs" style={{ color: 'rgba(241,245,249,0.25)' }}>
                              {' '}/ {formatIDR(b.limit)}
                            </span>
                          </div>
                        </div>
                        {/* Gradient progress bar */}
                        <div
                          role="progressbar" aria-label={b.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(b.pct, 100)}
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(b.pct, 100)}%`,
                              background: b.over
                                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                                : b.pct >= 80
                                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                : 'linear-gradient(90deg, #10b981, #34d399)',
                              boxShadow: b.over
                                ? '0 0 6px rgba(239,68,68,0.5)'
                                : b.pct >= 80
                                ? '0 0 6px rgba(245,158,11,0.5)'
                                : '0 0 6px rgba(16,185,129,0.5)',
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[10px]" style={{ color: 'rgba(241,245,249,0.2)' }}>
                            {formatIDR(compareMoney(b.limit, b.spent) > 0 ? subtractMoney(b.limit, b.spent) : '0.00')} remaining
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: b.over ? '#f87171' : b.pct >= 80 ? '#fbbf24' : 'rgba(241,245,249,0.2)' }}
                          >
                            {Math.round(b.pct)}%
                          </span>
                        </div>
                        <details className="mt-1 text-xs text-white/40"><summary className="cursor-pointer">{t('breakdown')}</summary><ul className="mt-1 space-y-1">{monthlySummary?.categoryDetails.filter(d => d.parentId === b.categoryId).map(d => <li key={d.categoryId ?? 'direct'}>{d.categoryId === b.categoryId || d.categoryId === null ? t('direct') : categoryLabel(categories.find(c => c.id === d.categoryId) ?? { name_id: null, name_en: null }, locale)}: {formatIDR(d.amount)}</li>)}</ul></details>
                      </div>
                    ),
                )}
              </div>
            </GlassCard>
          )}

          {/* Top transactions */}
          {(summary.topExpenses.length > 0 || summary.topIncomes.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {summary.topExpenses.length > 0 && (
                <GlassCard className="p-4">
                  <h2 className="text-sm font-medium mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>
                    {t('topExpenses')}
                  </h2>
                  <div className="space-y-2">
                    {summary.topExpenses.map((txn, i) => (
                      <div key={txn.id} className="flex items-center gap-3">
                        <span className="text-xs w-4" style={{ color: 'rgba(241,245,249,0.2)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'rgba(241,245,249,0.8)' }}>{txn.description}</p>
                          <p className="text-xs" style={{ color: 'rgba(241,245,249,0.3)' }}>
                            {txn.category ? categoryPath(txn.category, txn.parent ? [txn.parent, txn.category] : [txn.category], locale) : t('uncategorized')} · {formatDate(txn.date, locale)}
                          </p>
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#f87171' }}>
                          -{formatIDR(txn.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
              {summary.topIncomes.length > 0 && (
                <GlassCard className="p-4">
                  <h2 className="text-sm font-medium mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>
                    {t('topIncomes')}
                  </h2>
                  <div className="space-y-2">
                    {summary.topIncomes.map((txn, i) => (
                      <div key={txn.id} className="flex items-center gap-3">
                        <span className="text-xs w-4" style={{ color: 'rgba(241,245,249,0.2)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'rgba(241,245,249,0.8)' }}>{txn.description}</p>
                          <p className="text-xs" style={{ color: 'rgba(241,245,249,0.3)' }}>
                            {txn.category ? categoryPath(txn.category, txn.parent ? [txn.parent, txn.category] : [txn.category], locale) : t('uncategorized')} · {formatDate(txn.date, locale)}
                          </p>
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#34d399' }}>
                          +{formatIDR(txn.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          )}
        </>
      )}

      {!loading && summary && summary.income === '0.00' && summary.expense === '0.00' && (
        <p className="text-center text-white/30 mt-12 text-sm">No transactions this period</p>
      )}

      {/* 12-month trend toggle */}
      <div className="mt-6">
        {!showTrend ? (
          <button
            onClick={showHistory}
            disabled={loadingTrend}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
          >
            {t('showHistory')} ↓
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/30">Last 12 months</span>
              <button
                onClick={() => setShowTrend(false)}
                className="text-xs text-white/30 hover:text-white/60"
              >
                Hide ↑
              </button>
            </div>
            {trendError && <p role="alert" className="mb-3 text-sm text-red-300">{trendError} <GlassButton onClick={showHistory}>{t('retry')}</GlassButton></p>}
            {loadingTrend ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/30 animate-pulse">
                Loading trend...
              </div>
            ) : (
              trend && <IncomeExpenseChart byMonth={trend} title="12-Month Trend" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
