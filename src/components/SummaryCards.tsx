'use client';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';

interface Props {
  income: number;
  expense: number;
  net: number;
  topExpenseCategory?: string;
  topExpenseAmount?: number;
}

export function SummaryCards({ income, expense, net, topExpenseCategory, topExpenseAmount }: Props) {
  const t = useTranslations('summary');
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      <Card label={t('income')}     value={formatIDR(income)}  accent="emerald" />
      <Card label={t('expense')}    value={formatIDR(expense)} accent="red" />
      <Card label={t('balance')}    value={formatIDR(net)}     accent="sky" />
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

type Accent = 'emerald' | 'sky' | 'red' | 'amber';

const accentTokens: Record<Accent, { text: string; dot: string; shadow: string }> = {
  emerald: { text: '#34d399', dot: '#34d399', shadow: '#10b981' },
  sky:     { text: '#38bdf8', dot: '#38bdf8', shadow: '#0ea5e9' },
  red:     { text: '#f87171', dot: '#f87171', shadow: 'rgba(248,113,113,0.6)' },
  amber:   { text: '#fbbf24', dot: '#fbbf24', shadow: 'rgba(251,191,36,0.5)' },
};

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: Accent;
}) {
  const { text, dot, shadow } = accentTokens[accent];
  return (
    <GlassCard tint={accent} className="p-4 md:p-5">
      <p
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'rgba(241,245,249,0.3)' }}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: dot, boxShadow: `0 0 5px ${shadow}` }}
        />
        {label}
      </p>
      <p className="text-lg md:text-xl font-semibold tracking-tight" style={{ color: text }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: 'rgba(241,245,249,0.3)' }}>{sub}</p>}
    </GlassCard>
  );
}
