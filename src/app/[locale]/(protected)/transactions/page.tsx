'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAccountId } from '@/components/AccountSwitcher';
import { TransactionTable } from '@/components/TransactionTable';
import { startOfMonth, today } from '@/lib/utils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categories: { name: string } | null;
}

export default function TransactionsPage() {
  const t = useTranslations('transactions');
  const accountId = useAccountId(); // ← reacts when AccountSwitcher sets account

  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/transactions?account_id=${accountId}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTxns(data);
          setLoading(false);
        }
      });
  }, [accountId, from, to]);

  if (!accountId)
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-4xl mb-3">◎</p>
        <p className="text-sm">Loading account...</p>
      </div>
    );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm [color-scheme:dark]"
          />
          <span className="text-white/20 self-center">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-1.5 text-sm [color-scheme:dark]"
          />
        </div>
      </div>

      {loading && <p className="text-white/30 text-sm animate-pulse">Loading...</p>}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <TransactionTable
          transactions={txns}
          onDelete={(id) => setTxns((prev) => prev.filter((t) => t.id !== id))}
          onUpdate={(updated) =>
            setTxns((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          }
        />
      </div>
    </div>
  );
}
