'use client';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils';

interface Props {
  income: number;
  expense: number;
  net: number;
  topExpenseCategory?: string;
  topExpenseAmount?: number;
}

export function SummaryCards({
  income,
  expense,
  net,
  topExpenseCategory,
  topExpenseAmount,
}: Props) {
  const t = useTranslations('summary');

  const cards = [
    { label: t('income'), value: formatIDR(income), color: 'text-green-600', bg: 'bg-green-50' },
    { label: t('expense'), value: formatIDR(expense), color: 'text-red-600', bg: 'bg-red-50' },
    {
      label: t('balance'),
      value: formatIDR(net),
      color: net >= 0 ? 'text-blue-600' : 'text-red-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className={'rounded-xl border border-gray-100 p-5 ' + card.bg}>
          <p className="text-sm text-gray-500 mb-1">{card.label}</p>
          <p className={'text-2xl font-semibold ' + card.color}>{card.value}</p>
        </div>
      ))}
      {topExpenseCategory && (
        <div className="md:col-span-3 rounded-xl border border-gray-100 p-4 bg-amber-50">
          <p className="text-sm text-gray-500">{t('topExpense')}</p>
          <p className="font-medium text-amber-700">
            {topExpenseCategory} — {formatIDR(topExpenseAmount ?? 0)}
          </p>
        </div>
      )}
    </div>
  );
}
