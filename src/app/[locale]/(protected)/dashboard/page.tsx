'use client';
import { useEffect, useState } from 'react';
import { useAccountId } from '@/components/AccountSwitcher';
import { SummaryCards } from '@/components/SummaryCards';
import { IncomeExpenseChart } from '@/components/IncomeExpenseChart';
import { CategoryPieChart } from '@/components/CategoryPieChart';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import {
  PeriodControl,
  createInitialPeriodValue,
  type PeriodValue,
} from '@/components/PeriodControl';
import { formatIDR, formatDate } from '@/lib/utils';
import { currentMonthRange } from '@/lib/reporting-period';
import { GlowBadge } from '@/components/ui/GlowBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';

interface TopTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

interface Budget {
  id: string;
  category_id: string;
  amount: number;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Summary {
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, number>;
  spendingByCategoryId: Record<string, number>;
  byMonth: Record<string, { income: number; expense: number }>;
  topExpenses: TopTransaction[];
  topIncomes: TopTransaction[];
}

export default function DashboardPage() {
  const accountId = useAccountId();

  const [period, setPeriod] = useState<PeriodValue>(() => createInitialPeriodValue());
  const from = period.from;
  const to = period.to;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budgetSpending, setBudgetSpending] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trend, setTrend] = useState<Record<string, { income: number; expense: number }> | null>(
    null,
  );
  const [showTrend, setShowTrend] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  async function handleShowTrend() {
    setShowTrend(true);
    if (trend) return;
    setLoadingTrend(true);
    try {
      const res = await fetch(`/api/summary/trend?account_id=${accountId}`);
      const d = await res.json();
      setTrend(d);
    } finally {
      setLoadingTrend(false);
    }
  }

  useEffect(() => {
    if (!accountId || !period.valid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTrend(null);
    setShowTrend(false);
    const monthlyRange = currentMonthRange();
    const selectedIsMonthly = from === monthlyRange.from && to === monthlyRange.to;

    Promise.all([
      fetch(`/api/summary?account_id=${accountId}&from=${from}&to=${to}`).then((r) => r.json()),
      selectedIsMonthly
        ? Promise.resolve(null)
        : fetch(
            `/api/summary?account_id=${accountId}&from=${monthlyRange.from}&to=${monthlyRange.to}`,
          ).then((r) => r.json()),
      fetch(`/api/budgets?account_id=${accountId}`).then((r) => r.json()),
      fetch(`/api/categories?account_id=${accountId}`).then((r) => r.json()),
    ])
      .then(([summaryData, budgetSummaryData, budgetsData, catsData]) => {
        if (!cancelled) {
          setSummary(summaryData);
          setBudgetSpending(
            (selectedIsMonthly ? summaryData : budgetSummaryData)?.spendingByCategoryId ?? {},
          );
          setBudgets(Array.isArray(budgetsData) ? budgetsData : []);
          setCategories(Array.isArray(catsData) ? catsData : []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, from, to, period.valid, reloadTick]);

  const topEntry = summary
    ? Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0]
    : null;

  // Build budget overview — only expense categories with a budget set
  const budgetOverview = budgets
    .map((b) => {
      const cat = categories.find((c) => c.id === b.category_id);
      if (!cat || cat.type !== 'expense') return null;
      const spent = budgetSpending[b.category_id] ?? 0;
      const pct = (spent / b.amount) * 100;
      const over = spent > b.amount;
      return { id: b.id, name: cat.name, spent, limit: b.amount, pct, over };
    })
    .filter(Boolean)
    .sort((a, b) => b!.pct - a!.pct); // sort by % used descending

  const now = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!accountId)
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">Loading account...</p>
      </div>
    );

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: '#f1f5f9' }}>
            Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(241,245,249,0.3)' }}>{now}</p>
        </div>
        <GlassButton variant="primary" onClick={() => setAddOpen(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          <span className="hidden sm:inline">Add Transaction</span>
          <span className="sm:hidden">Add</span>
        </GlassButton>
      </div>

      <AddTransactionModal
        accountId={accountId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => setReloadTick((n) => n + 1)}
      />

      <PeriodControl accountId={accountId} value={period} onChange={setPeriod} className="mb-6" />

      {loading && <p className="text-white/30 text-sm animate-pulse">Loading...</p>}

      {summary && (
        <>
          <SummaryCards
            income={summary.income}
            expense={summary.expense}
            net={summary.net}
            topExpenseCategory={topEntry?.[0]}
            topExpenseAmount={topEntry?.[1]}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <IncomeExpenseChart byMonth={summary.byMonth} />
            <CategoryPieChart byCategory={summary.byCategory} />
          </div>

          {/* Budget Overview */}
          {budgetOverview.length > 0 && (
            <GlassCard className="p-4 mt-6">
              <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(241,245,249,0.55)' }}>
                Budget Overview
              </h2>
              <div className="space-y-3">
                {budgetOverview.map(
                  (b) =>
                    b && (
                      <div key={b.id}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm" style={{ color: 'rgba(241,245,249,0.8)' }}>{b.name}</span>
                            {b.over && (
                              <GlowBadge color="red">Over budget</GlowBadge>
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
                            {formatIDR(Math.max(b.limit - b.spent, 0))} remaining
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: b.over ? '#f87171' : b.pct >= 80 ? '#fbbf24' : 'rgba(241,245,249,0.2)' }}
                          >
                            {Math.round(b.pct)}%
                          </span>
                        </div>
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
                    Top Expenses
                  </h2>
                  <div className="space-y-2">
                    {summary.topExpenses.map((txn, i) => (
                      <div key={txn.id} className="flex items-center gap-3">
                        <span className="text-xs w-4" style={{ color: 'rgba(241,245,249,0.2)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'rgba(241,245,249,0.8)' }}>{txn.description}</p>
                          <p className="text-xs" style={{ color: 'rgba(241,245,249,0.3)' }}>
                            {txn.category} · {formatDate(txn.date)}
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
                    Top Incomes
                  </h2>
                  <div className="space-y-2">
                    {summary.topIncomes.map((txn, i) => (
                      <div key={txn.id} className="flex items-center gap-3">
                        <span className="text-xs w-4" style={{ color: 'rgba(241,245,249,0.2)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={{ color: 'rgba(241,245,249,0.8)' }}>{txn.description}</p>
                          <p className="text-xs" style={{ color: 'rgba(241,245,249,0.3)' }}>
                            {txn.category} · {formatDate(txn.date)}
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

      {!loading && summary && summary.income === 0 && summary.expense === 0 && (
        <p className="text-center text-white/30 mt-12 text-sm">No transactions this period</p>
      )}

      {/* 12-month trend toggle */}
      <div className="mt-6">
        {!showTrend ? (
          <button
            onClick={handleShowTrend}
            className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
          >
            Show 12-month trend ↓
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
