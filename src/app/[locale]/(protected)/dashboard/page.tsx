'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountId } from '@/components/AccountSwitcher';
import { SummaryCards } from '@/components/SummaryCards';
import { IncomeExpenseChart } from '@/components/IncomeExpenseChart';
import { CategoryPieChart } from '@/components/CategoryPieChart';
import { startOfMonth, today } from '@/lib/utils';

interface Summary {
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, number>;
  byMonth: Record<string, { income: number; expense: number }>;
}

export default function DashboardPage() {
  const t = useTranslations('summary');
  const accountId = useAccountId(); // ← reacts when AccountSwitcher sets account

  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return; // wait until AccountSwitcher sets account
    let cancelled = false;
    setLoading(true);
    fetch(`/api/summary?account_id=${accountId}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setSummary(d);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, from, to]); // re-runs when accountId changes

  const topEntry = summary
    ? Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0]
    : null;
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <IncomeExpenseChart byMonth={summary.byMonth} />
            <CategoryPieChart byCategory={summary.byCategory} />
          </div>
        </>
      )}

      {!loading && summary && summary.income === 0 && summary.expense === 0 && (
        <p className="text-center text-white/30 mt-12 text-sm">No transactions this period</p>
      )}
    </div>
  );
}
