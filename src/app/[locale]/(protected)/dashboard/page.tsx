export const dynamic = 'force-dynamic'; // always re-fetch, never serve stale cache

('use client');
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account_id') ?? '';

  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch('/api/summary?account_id=' + accountId + '&from=' + from + '&to=' + to)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d);
        setLoading(false);
      });
  }, [accountId, from, to]);

  const topEntry = summary
    ? Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading...</p>}

      {summary && (
        <>
          <SummaryCards
            income={summary.income}
            expense={summary.expense}
            net={summary.net}
            topExpenseCategory={topEntry?.[0]}
            topExpenseAmount={topEntry?.[1]}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <IncomeExpenseChart byMonth={summary.byMonth} />
            <CategoryPieChart byCategory={summary.byCategory} />
          </div>
        </>
      )}

      {summary && summary.income === 0 && summary.expense === 0 && (
        <p className="text-center text-gray-400 mt-12">{t('noData')}</p>
      )}
    </div>
  );
}
