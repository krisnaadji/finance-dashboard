'use client';
import { useTranslations } from 'next-intl';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';

interface Props {
  byMonth: Record<string, { income: string; expense: string }>;
  title?: string;
}

export function IncomeExpenseChart({ byMonth, title }: Props) {
  const t = useTranslations('summary');

  const data = Object.entries(byMonth)
    .sort()
    .map(([key, vals]) => ({
      month: new Date(key + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      [t('income')]: Number(vals.income),
      [t('expense')]: Number(vals.expense),
      exactIncome: vals.income,
      exactExpense: vals.expense,
    }));

  return (
    <GlassCard className="p-5 overflow-hidden">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'rgba(241,245,249,0.55)' }}>
        {title ?? `${t('income')} vs ${t('expense')}`}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'rgba(241,245,249,0.3)' }}
            stroke="rgba(255,255,255,0.06)"
          />
          <YAxis
            tickFormatter={(v) => 'Rp' + v / 1000 + 'k'}
            tick={{ fontSize: 10, fill: 'rgba(241,245,249,0.3)' }}
            stroke="rgba(255,255,255,0.06)"
            width={70}
          />
          <Tooltip
            formatter={(value, name, item) => [
              formatIDR(name === t('income') ? item.payload.exactIncome : item.payload.exactExpense),
              '',
            ]}
            contentStyle={{
              background: 'rgba(8,12,16,0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color: '#f1f5f9',
              backdropFilter: 'blur(12px)',
            }}
          />
          <Legend wrapperStyle={{ color: 'rgba(241,245,249,0.45)', fontSize: 12 }} />
          <Bar dataKey={t('income')}  fill="url(#incomeGrad)"  radius={[4, 4, 0, 0]} />
          <Bar dataKey={t('expense')} fill="url(#expenseGrad)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
