'use client';
import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocale, useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { compareMoney } from '@/lib/money';
import { categoryLabel, type Category, type CategoryLocale } from '@/lib/categories';
import type { CategoryTotal, CategoryDetail } from '@/lib/reporting-contract';

const COLORS = ['#10b981', '#0ea5e9', '#a78bfa', '#fbbf24', '#f87171', '#06b6d4', '#f97316', '#84cc16'];
interface Props { categories: CategoryTotal[]; details: CategoryDetail[]; catalog: Category[] }

export function CategoryPieChart({ categories, details, catalog }: Props) {
  const t = useTranslations('hierarchy'); const locale = useLocale() as CategoryLocale;
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRoot = categories.find(c => c.id === selected);
  const roots = categories.map(c => ({ ...c, name: c.id === null ? t('uncategorized') : categoryLabel(c, locale) }));
  const entries = selected && selectedRoot ? details.filter(d => d.parentId === selected).map(d => {
    const category = catalog.find(c => c.id === d.categoryId);
    return { id: d.categoryId, name: d.categoryId === selected || d.categoryId === null ? t('direct') : category ? categoryLabel(category, locale) : t('uncategorized'), amount: d.amount };
  }) : roots;
  const data = entries.filter(c => compareMoney(c.amount, '0.00') > 0).sort((a, b) => compareMoney(b.amount, a.amount)).map(c => ({ ...c, value: Number(c.amount) }));
  return <GlassCard className="p-5 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium text-white/80">{selected && selectedRoot ? roots.find(c => c.id === selected)?.name : t('expenseByCategory')}</h3>{selected && selectedRoot && <GlassButton onClick={() => setSelected(null)}>{t('back')}</GlassButton>}</div>
    <p className="mt-2 text-xs text-white/70">{t('chartScope')}</p>
    {!data.length ? <p className="py-8 text-white/70">{t('emptyExpenses')}</p> : <>
      <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={false} labelLine={false} onClick={(_entry, index) => { const id = data[index]?.id; if (!selected && id) setSelected(id); }}>{data.map((c, i) => <Cell key={c.id ?? 'uncategorized'} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(_value, name, item) => [formatIDR(item.payload.amount), name]} contentStyle={{ background: '#080c10', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#f1f5f9' }} /></PieChart></ResponsiveContainer>
      <ul className="space-y-1 text-sm text-white/80">{data.map((c, i) => <li key={c.id ?? 'uncategorized'}>{!selected && c.id ? <button type="button" className="flex min-h-11 w-full flex-wrap items-center justify-between gap-3 rounded px-2 text-left hover:bg-white/10 focus-visible:outline-emerald-400" onClick={() => setSelected(c.id)}><span className="min-w-0 break-words">{c.name}</span><span className="shrink-0 tabular-nums">{formatIDR(c.amount)}</span></button> : <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-2"><span className="min-w-0 break-words">{c.name}</span><span className="shrink-0 tabular-nums">{formatIDR(c.amount)}</span></div>}<span className="sr-only">{i + 1}</span></li>)}</ul>
    </>}
  </GlassCard>;
}
