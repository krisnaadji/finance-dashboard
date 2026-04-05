'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatIDR, formatDate } from '@/lib/utils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categories: { name: string } | null;
}

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

export function TransactionTable({ transactions, onDelete }: Props) {
  const t = useTranslations('transactions');
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    setDeleting(id);
    await fetch('/api/transactions/' + id, { method: 'DELETE' });
    setDeleting(null);
    onDelete(id);
  }

  if (!transactions.length) return <p className="text-center text-gray-400 py-12">{t('empty')}</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            {[t('date'), t('description'), t('category'), t('type'), t('amount'), ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {transactions.map((txn) => (
            <tr key={txn.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">{formatDate(txn.date)}</td>
              <td className="px-4 py-3 font-medium">{txn.description}</td>
              <td className="px-4 py-3 text-gray-600">{txn.categories?.name ?? '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    'rounded-full px-2 py-0.5 text-xs font-medium ' +
                    (txn.type === 'income'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700')
                  }
                >
                  {txn.type === 'income' ? t('income') : t('expense')}
                </span>
              </td>
              <td
                className={
                  'px-4 py-3 font-medium ' +
                  (txn.type === 'income' ? 'text-green-600' : 'text-red-600')
                }
              >
                {txn.type === 'income' ? '+' : '-'}
                {formatIDR(txn.amount)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => handleDelete(txn.id)}
                  disabled={deleting === txn.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                >
                  {deleting === txn.id ? '...' : t('delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
