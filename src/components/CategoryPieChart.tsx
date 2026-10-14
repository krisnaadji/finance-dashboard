'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';
import { compareMoney } from '@/lib/money';

const COLORS = ['#10b981', '#0ea5e9', '#a78bfa', '#fbbf24', '#f87171', '#06b6d4', '#f97316', '#84cc16'];

interface CategoryTotal { id: string | null; name: string; amount: string }

interface Props {
  categories: CategoryTotal[];
}

export function CategoryPieChart({ categories }: Props) {
  const t = useTranslations('transactions');
  const data = [...categories]
    .sort((a, b) => compareMoney(b.amount, a.amount))
    .map((category) => ({ ...category, value: Number(category.amount) }));

  if (!data.length) return null;

  return (
    <GlassCard className="p-5 overflow-hidden">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'rgba(241,245,249,0.55)' }}>
        {t('expense')} by Category
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={80}
            label={false}
            labelLine={false}
          >
            {data.map((category, i) => (
              <Cell key={category.id ?? 'uncategorized'} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, item) => [formatIDR(item.payload.amount), name]}
            contentStyle={{
              background: 'rgba(8,12,16,0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color: '#f1f5f9',
              backdropFilter: 'blur(12px)',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'rgba(241,245,249,0.45)', paddingTop: 8 }}
            formatter={(value, entry: any) => {
              const total = data.reduce((s, d) => s + d.value, 0);
              const pct = total ? ((entry.payload.value / total) * 100).toFixed(0) : 0;
              return `${value} ${pct}%`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
