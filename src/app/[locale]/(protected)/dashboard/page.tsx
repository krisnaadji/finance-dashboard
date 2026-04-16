'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountId } from '@/components/AccountSwitcher';
import { SummaryCards } from '@/components/SummaryCards';
import { IncomeExpenseChart } from '@/components/IncomeExpenseChart';
import { CategoryPieChart } from '@/components/CategoryPieChart';
import { startOfMonth, today, formatIDR, formatDate } from '@/lib/utils';

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
  const t = useTranslations('summary');
  const accountId = useAccountId();

  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trend, setTrend] = useState<Record<string, { income: number; expense: number }> | null>(
    null,
  );
  const [showTrend, setShowTrend] = useState(false);
  const [loadingTrend, setLoadingTrend] = useState(false);

  async function handleShowTrend() {
    setShowTrend(true);
    if (trend) return;
    setLoadingTrend(true);
    const res = await fetch(`/api/summary/trend?account_id=${accountId}`);
    const d = await res.json();
    setTrend(d);
    setLoadingTrend(false);
  }

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setLoading(true);
    setTrend(null);
    setShowTrend(false);

    Promise.all([
      fetch(`/api/summary?account_id=${accountId}&from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/budgets?account_id=${accountId}`).then((r) => r.json()),
      fetch(`/api/categories?account_id=${accountId}`).then((r) => r.json()),
    ]).then(([summaryData, budgetsData, catsData]) => {
      if (!cancelled) {
        setSummary(summaryData);
        setBudgets(Array.isArray(budgetsData) ? budgetsData : []);
        setCategories(Array.isArray(catsData) ? catsData : []);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accountId, from, to]);

  const topEntry = summary
    ? Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0]
    : null;

  // Build budget overview — only expense categories with a budget set
  const budgetOverview = budgets
    .map((b) => {
      const cat = categories.find((c) => c.id === b.category_id);
      if (!cat || cat.type !== 'expense') return null;
      const spent = summary?.spendingByCategoryId?.[b.category_id] ?? 0;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-1">
        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
        <p className="text-xs text-white/40">{now}</p>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/40">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm [color-scheme:dark]"
          />
        </div>
        <span className="text-white/20">—</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/40">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm [color-scheme:dark]"
          />
        </div>
      </div>

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
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 mt-6">
              <h2 className="text-sm font-medium text-white/60 mb-4">📊 Budget Overview</h2>
              <div className="space-y-3">
                {budgetOverview.map(
                  (b) =>
                    b && (
                      <div key={b.id}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/80">{b.name}</span>
                            {b.over && (
                              <span className="text-[10px] bg-red-500/10 text-red-400 rounded px-1.5 py-0.5">
                                Over budget
                              </span>
                            )}
                            {!b.over && b.pct >= 80 && (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 rounded px-1.5 py-0.5">
                                Near limit
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-xs font-medium ${
                                b.over
                                  ? 'text-red-400'
                                  : b.pct >= 80
                                    ? 'text-amber-400'
                                    : 'text-white/60'
                              }`}
                            >
                              Rp{formatIDR(b.spent)}
                            </span>
                            <span className="text-xs text-white/30"> / Rp{formatIDR(b.limit)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              b.over
                                ? 'bg-red-500'
                                : b.pct >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(b.pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[10px] text-white/20">
                            Rp{formatIDR(Math.max(b.limit - b.spent, 0))} remaining
                          </span>
                          <span
                            className={`text-[10px] ${
                              b.over
                                ? 'text-red-400'
                                : b.pct >= 80
                                  ? 'text-amber-400'
                                  : 'text-white/20'
                            }`}
                          >
                            {Math.round(b.pct)}%
                          </span>
                        </div>
                      </div>
                    ),
                )}
              </div>
            </div>
          )}

          {/* Top transactions */}
          {(summary.topExpenses.length > 0 || summary.topIncomes.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {summary.topExpenses.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <h2 className="text-sm font-medium text-white/60 mb-3">🔺 Top Expenses</h2>
                  <div className="space-y-2">
                    {summary.topExpenses.map((txn, i) => (
                      <div key={txn.id} className="flex items-center gap-3">
                        <span className="text-xs text-white/20 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate">{txn.description}</p>
                          <p className="text-xs text-white/30">
                            {txn.category} · {formatDate(txn.date)}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-red-400 whitespace-nowrap">
                          -{formatIDR(txn.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {summary.topIncomes.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <h2 className="text-sm font-medium text-white/60 mb-3">💰 Top Incomes</h2>
                  <div className="space-y-2">
                    {summary.topIncomes.map((txn, i) => (
                      <div key={txn.id} className="flex items-center gap-3">
                        <span className="text-xs text-white/20 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate">{txn.description}</p>
                          <p className="text-xs text-white/30">
                            {txn.category} · {formatDate(txn.date)}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-emerald-400 whitespace-nowrap">
                          +{formatIDR(txn.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
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
