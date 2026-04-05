'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TransactionTable } from '@/components/TransactionTable';
import { startOfMonth, today } from '@/lib/utils';

export default function TransactionsPage() {
  const t = useTranslations('transactions');
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account_id') ?? '';
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [txns, setTxns] = useState<any[]>([]);

  function load() {
    if (!accountId) return;
    fetch('/api/transactions?account_id=' + accountId + '&from=' + from + '&to=' + to)
      .then((r) => r.json())
      .then(setTxns);
  }

  useEffect(() => {
    load();
  }, [accountId, from, to]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
        />
        <span className="text-gray-400">—</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
        />
      </div>
      <TransactionTable
        transactions={txns}
        onDelete={(id) => setTxns((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
