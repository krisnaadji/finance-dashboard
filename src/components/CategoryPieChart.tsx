'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils';

const COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
];

interface Props {
  byCategory: Record<string, number>;
}

export function CategoryPieChart({ byCategory }: Props) {
  const t = useTranslations('transactions');
  const data = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.03]">
      <h3 className="text-sm font-medium text-white/60 mb-4">{t('expense')} by Category</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) => name + ' ' + ((percent ?? 0) * 100).toFixed(0) + '%'}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [formatIDR(Number(value)), '']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
