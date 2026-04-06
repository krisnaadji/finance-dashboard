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
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      <Card label={t('income')} value={formatIDR(income)} accent="emerald" />
      <Card label={t('expense')} value={formatIDR(expense)} accent="red" />
      <Card label={t('balance')} value={formatIDR(net)} accent={net >= 0 ? 'emerald' : 'red'} />
      {topExpenseCategory && (
        <Card
          label={t('topExpense')}
          value={topExpenseCategory}
          sub={formatIDR(topExpenseAmount ?? 0)}
          accent="amber"
        />
      )}
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
  };
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-colors">
      <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-xl font-semibold ${colors[accent] ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}
