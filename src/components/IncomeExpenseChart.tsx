'use client';
import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatIDR } from '@/lib/utils';

interface Props {
  byMonth: Record<string, { income: number; expense: number }>;
}

export function IncomeExpenseChart({ byMonth }: Props) {
  const t = useTranslations('summary');

  const data = Object.entries(byMonth)
    .sort()
    .map(([month, vals]) => ({
      month,
      [t('income')]: vals.income,
      [t('expense')]: vals.expense,
    }));

  return (
    <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03] overflow-hidden">
      <h3 className="text-sm font-medium text-white/60 mb-4">
        {t('income')} vs {t('expense')}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis
            tickFormatter={(v) => 'Rp' + v / 1000 + 'k'}
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
            stroke="rgba(255,255,255,0.1)"
            width={70}
          />
          <Tooltip formatter={(value) => [formatIDR(Number(value)), '']} />
          <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
          <Bar dataKey={t('income')} fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey={t('expense')} fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
