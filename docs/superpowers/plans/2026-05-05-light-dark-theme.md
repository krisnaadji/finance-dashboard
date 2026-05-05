# Light / Dark Theme System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a warm minimal light theme switchable via a sun/moon toggle, persisted in `localStorage`, with `data-theme="light"` on `<html>` driving CSS custom-property overrides — leaving the dark theme pixel-identical.

**Architecture:** All colour tokens move to CSS custom properties in `globals.css`; a `[data-theme="light"]` block overrides them. A `ThemeToggle` client component reads/writes `localStorage` and sets `document.documentElement.dataset.theme`. Recharts components (which cannot consume CSS vars in SVG attributes) resolve colours via a `useTheme` hook that watches the `data-theme` attribute with a `MutationObserver`.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, React 19, Recharts, `next-intl`

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/app/globals.css` |
| Create | `src/components/ThemeToggle.tsx` |
| Create | `src/hooks/useTheme.ts` |
| Modify | `src/app/[locale]/(protected)/layout.tsx` |
| Modify | `src/components/ui/GlassCard.tsx` |
| Modify | `src/components/ui/GlassButton.tsx` |
| Modify | `src/components/SummaryCards.tsx` |
| Modify | `src/components/IncomeExpenseChart.tsx` |
| Modify | `src/components/CategoryPieChart.tsx` |
| Modify | `src/components/AddTransactionModal.tsx` |
| Modify | `src/components/TransactionTable.tsx` |
| Modify | `src/app/[locale]/(protected)/dashboard/page.tsx` |
| Modify | `src/app/[locale]/(protected)/transactions/page.tsx` |
| Modify | `src/app/[locale]/login/page.tsx` |
| Modify | `src/app/[locale]/(protected)/accounts/page.tsx` |
| Modify | `src/app/[locale]/(protected)/categories/page.tsx` |

---

### Task 1: Extend CSS tokens and add light theme overrides in `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add semantic tokens and light overrides**

Replace the existing `:root` block and add the light theme block. Open `src/app/globals.css` and replace from line 1 through the closing `}` of the `:root` block (ends at line 40) with:

```css
/* src/app/globals.css */
@import 'tailwindcss';

:root {
  /* ── Dark theme (default) ─────────────────────────────── */
  --bg-base: #080c10;
  --bg-surface: rgba(255, 255, 255, 0.035);
  --bg-surface-2: rgba(255, 255, 255, 0.06);
  --bg-elevated: rgba(255, 255, 255, 0.055);
  --bg-surface-hover: rgba(255, 255, 255, 0.06);
  --border: rgba(255, 255, 255, 0.07);
  --border-strong: rgba(255, 255, 255, 0.12);
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-medium: rgba(255, 255, 255, 0.12);
  --text-primary: #f1f5f9;
  --text-secondary: rgba(241, 245, 249, 0.55);
  --text-tertiary: rgba(241, 245, 249, 0.3);
  --accent: #10b981;
  --accent-2: #0ea5e9;
  --income: #34d399;
  --expense: #f87171;
  --font-display: inherit;
  --font-number: inherit;

  --emerald: #10b981;
  --emerald-light: #34d399;
  --emerald-glow: rgba(16, 185, 129, 0.18);
  --emerald-border: rgba(16, 185, 129, 0.25);

  --sky: #0ea5e9;
  --sky-light: #38bdf8;
  --sky-glow: rgba(14, 165, 233, 0.15);
  --sky-border: rgba(14, 165, 233, 0.22);

  --red: #f87171;
  --red-glow: rgba(248, 113, 113, 0.12);
  --red-border: rgba(248, 113, 113, 0.22);

  --amber: #fbbf24;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  --background: #080c10;
  --foreground: #f1f5f9;
}

/* ── Light theme overrides ─────────────────────────────── */
[data-theme="light"] {
  --bg-base: #f7f4f0;
  --bg-surface: #ffffff;
  --bg-surface-2: #ede9e3;
  --bg-elevated: #ffffff;
  --bg-surface-hover: #ede9e3;
  --border: rgba(0, 0, 0, 0.06);
  --border-strong: rgba(0, 0, 0, 0.10);
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-medium: rgba(0, 0, 0, 0.10);
  --text-primary: #1c1815;
  --text-secondary: #a89880;
  --text-tertiary: #c4b8a8;
  --accent: #4a4e8a;
  --accent-2: #6b70b8;
  --income: #2d7a4a;
  --expense: #c0392b;
  --font-display: 'Palatino Linotype', Palatino, Georgia, serif;
  --font-number: 'Palatino Linotype', Palatino, Georgia, serif;

  --background: #f7f4f0;
  --foreground: #1c1815;
}
```

- [ ] **Step 2: Add light-theme utility overrides at the bottom of `globals.css`**

Append after the last line of the file (after the `.grain` block):

```css
/* ── Light theme utility overrides ─────────────────────── */

/* Hide film grain in light mode */
[data-theme="light"] .grain {
  display: none;
}

/* Hide ambient body glows in light mode */
[data-theme="light"] body::before,
[data-theme="light"] body::after {
  display: none;
}

/* Remove backdrop-blur on glass cards in light mode */
[data-theme="light"] .backdrop-blur-md {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* Light mode body background */
[data-theme="light"] body {
  background: var(--bg-base);
  color: var(--text-primary);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): add CSS token layer and light theme overrides in globals.css"
```

---

### Task 2: Create `ThemeToggle` component

**Files:**
- Create: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ThemeToggle.tsx` with this content:

```tsx
'use client';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'dark';
    setTheme(initial);
    document.documentElement.dataset.theme = initial === 'light' ? 'light' : '';
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.dataset.theme = next === 'light' ? 'light' : '';
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface-2)',
        color: 'var(--text-secondary)',
        fontSize: '15px',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ThemeToggle.tsx
git commit -m "feat(theme): add ThemeToggle component with localStorage persistence"
```

---

### Task 3: Create `useTheme` hook

Recharts SVG `fill` / `stroke` props do not support CSS variables. This hook resolves the current theme's colour tokens as plain strings and re-renders chart components when the theme toggles.

**Files:**
- Create: `src/hooks/useTheme.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useTheme.ts`:

```ts
'use client';
import { useEffect, useState } from 'react';

type ThemeTokens = {
  income: string;
  expense: string;
  border: string;
  textSecondary: string;
  textTertiary: string;
  bgSurface: string;
  textPrimary: string;
};

const DARK: ThemeTokens = {
  income: '#34d399',
  expense: '#f87171',
  border: 'rgba(255,255,255,0.06)',
  textSecondary: 'rgba(241,245,249,0.45)',
  textTertiary: 'rgba(241,245,249,0.3)',
  bgSurface: 'rgba(8,12,16,0.95)',
  textPrimary: '#f1f5f9',
};

const LIGHT: ThemeTokens = {
  income: '#2d7a4a',
  expense: '#c0392b',
  border: 'rgba(0,0,0,0.08)',
  textSecondary: '#a89880',
  textTertiary: '#c4b8a8',
  bgSurface: '#ffffff',
  textPrimary: '#1c1815',
};

export function useTheme(): ThemeTokens {
  const [tokens, setTokens] = useState<ThemeTokens>(DARK);

  useEffect(() => {
    function sync() {
      const isLight = document.documentElement.dataset.theme === 'light';
      setTokens(isLight ? LIGHT : DARK);
    }

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return tokens;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTheme.ts
git commit -m "feat(theme): add useTheme hook for resolving chart colour tokens"
```

---

### Task 4: Wire `ThemeToggle` into the layout

**Files:**
- Modify: `src/app/[locale]/(protected)/layout.tsx`

- [ ] **Step 1: Import ThemeToggle**

Add the import after the existing imports in `layout.tsx`:

```tsx
import { ThemeToggle } from '@/components/ThemeToggle';
```

- [ ] **Step 2: Add ThemeToggle to mobile top bar**

Find:
```tsx
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <SignOutButton />
          </div>
```

Replace with:
```tsx
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <SignOutButton />
          </div>
```

- [ ] **Step 3: Add ThemeToggle to desktop sidebar footer**

Find:
```tsx
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <LanguageSwitcher />
          <SignOutButton />
        </div>
```

Replace with:
```tsx
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 px-1 py-1">
            <ThemeToggle />
          </div>
          <LanguageSwitcher />
          <SignOutButton />
        </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/\(protected\)/layout.tsx
git commit -m "feat(theme): wire ThemeToggle into mobile top bar and desktop sidebar footer"
```

---

### Task 5: Update `GlassCard` to use CSS tokens

**Files:**
- Modify: `src/components/ui/GlassCard.tsx`

- [ ] **Step 1: Replace hardcoded values in the `none` tint and update component**

Replace the entire file content:

```tsx
import { ReactNode, CSSProperties } from 'react';

type Tint = 'emerald' | 'sky' | 'red' | 'amber' | 'none';

const tintMap: Record<Tint, { background: string; borderColor: string }> = {
  emerald: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.09), rgba(16,185,129,0.04))',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  sky: {
    background: 'linear-gradient(135deg, rgba(14,165,233,0.09), rgba(14,165,233,0.04))',
    borderColor: 'rgba(14,165,233,0.22)',
  },
  red: {
    background: 'linear-gradient(135deg, rgba(248,113,113,0.09), rgba(248,113,113,0.03))',
    borderColor: 'rgba(248,113,113,0.22)',
  },
  amber: {
    background: 'linear-gradient(135deg, rgba(251,191,36,0.09), rgba(251,191,36,0.03))',
    borderColor: 'rgba(251,191,36,0.22)',
  },
  none: { background: 'var(--bg-surface)', borderColor: 'var(--border)' },
};

interface Props {
  children: ReactNode;
  tint?: Tint;
  className?: string;
  style?: CSSProperties;
}

export function GlassCard({ children, tint = 'none', className = '', style }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-md ${className}`}
      style={{ ...tintMap[tint], ...style }}
    >
      {/* Shimmer highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)' }}
      />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/GlassCard.tsx
git commit -m "feat(theme): GlassCard none tint uses CSS vars for bg and border"
```

---

### Task 6: Update `GlassButton` to use CSS tokens

**Files:**
- Modify: `src/components/ui/GlassButton.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const base =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

export function GlassButton({ variant = 'ghost', children, className = '', style, ...rest }: Props) {
  if (variant === 'primary') {
    return (
      <button
        className={`${base} text-white ${className}`}
        style={{
          background: 'var(--accent)',
          boxShadow: '0 0 18px rgba(16,185,129,0.28)',
          ...style,
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }

  if (variant === 'danger') {
    return (
      <button
        className={`${base} ${className}`}
        style={{
          color: 'var(--expense)',
          background: 'transparent',
          ...style,
        }}
        {...rest}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      className={`${base} ${className}`}
      style={{
        border: '1px solid var(--border-strong)',
        background: 'var(--bg-surface-2)',
        color: 'var(--text-secondary)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/GlassButton.tsx
git commit -m "feat(theme): GlassButton uses CSS vars for accent and surface colors"
```

---

### Task 7: Update `SummaryCards` to use semantic tokens

The tinted (emerald/sky/red/amber) `GlassCard` variants keep their hardcoded gradient tints since those are intentional accents on dark. In light mode, the `backdrop-blur-md` is suppressed by `globals.css` already. The text colours and label colour need to be token-driven.

**Files:**
- Modify: `src/components/SummaryCards.tsx`

- [ ] **Step 1: Replace the file**

```tsx
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
      <Card label={t('income')}  value={formatIDR(income)}  accent="emerald" index={0} />
      <Card label={t('expense')} value={formatIDR(expense)} accent="red"     index={1} />
      <Card label={t('balance')} value={formatIDR(net)}     accent="sky"     index={2} />
      {topExpenseCategory && (
        <Card
          label={t('topExpense')}
          value={topExpenseCategory}
          sub={formatIDR(topExpenseAmount ?? 0)}
          accent="amber"
          index={3}
        />
      )}
    </div>
  );
}

type Accent = 'emerald' | 'sky' | 'red' | 'amber';

const accentTokens: Record<Accent, { text: string; dot: string; shadow: string }> = {
  emerald: { text: 'var(--income)',  dot: '#34d399', shadow: '#10b981' },
  sky:     { text: 'var(--accent-2)', dot: '#38bdf8', shadow: '#0ea5e9' },
  red:     { text: 'var(--expense)', dot: '#f87171', shadow: 'rgba(248,113,113,0.6)' },
  amber:   { text: '#fbbf24',        dot: '#fbbf24', shadow: 'rgba(251,191,36,0.5)' },
};

function Card({
  label,
  value,
  sub,
  accent,
  index = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: Accent;
  index?: number;
}) {
  const { text, dot, shadow } = accentTokens[accent];
  return (
    <GlassCard
      tint={accent}
      className="p-4 md:p-5 animate-fade-up"
      style={{ animationDelay: `${index * 75}ms` }}
    >
      {/* Accent top-line */}
      <div
        aria-hidden
        className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${dot}, transparent)`, opacity: 0.5 }}
      />
      <p
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: dot, boxShadow: `0 0 5px ${shadow}` }}
        />
        {label}
      </p>
      <p
        className="text-xl md:text-2xl font-semibold tracking-tight leading-none"
        style={{ color: text, fontFamily: 'var(--font-number)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </p>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SummaryCards.tsx
git commit -m "feat(theme): SummaryCards uses CSS token vars for text and label colours"
```

---

### Task 8: Update `IncomeExpenseChart` with `useTheme`

**Files:**
- Modify: `src/components/IncomeExpenseChart.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';
import { useTranslations } from 'next-intl';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  byMonth: Record<string, { income: number; expense: number }>;
  title?: string;
}

export function IncomeExpenseChart({ byMonth, title }: Props) {
  const t = useTranslations('summary');
  const theme = useTheme();

  const data = Object.entries(byMonth)
    .sort()
    .map(([month, vals]) => ({
      month: new Date(month + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      [t('income')]: vals.income,
      [t('expense')]: vals.expense,
    }));

  return (
    <GlassCard className="p-5 overflow-hidden">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
        {title ?? `${t('income')} vs ${t('expense')}`}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.income} stopOpacity={0.9} />
              <stop offset="100%" stopColor={theme.income} stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.expense} stopOpacity={0.8} />
              <stop offset="100%" stopColor={theme.expense} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: theme.textTertiary }}
            stroke={theme.border}
          />
          <YAxis
            tickFormatter={(v) => 'Rp' + v / 1000 + 'k'}
            tick={{ fontSize: 10, fill: theme.textTertiary }}
            stroke={theme.border}
            width={70}
          />
          <Tooltip
            formatter={(value) => [formatIDR(Number(value)), '']}
            contentStyle={{
              background: theme.bgSurface,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              color: theme.textPrimary,
              backdropFilter: 'blur(12px)',
            }}
          />
          <Legend wrapperStyle={{ color: theme.textSecondary, fontSize: 12 }} />
          <Bar dataKey={t('income')}  fill="url(#incomeGrad)"  radius={[4, 4, 0, 0]} />
          <Bar dataKey={t('expense')} fill="url(#expenseGrad)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/IncomeExpenseChart.tsx
git commit -m "feat(theme): IncomeExpenseChart resolves chart colours via useTheme hook"
```

---

### Task 9: Update `CategoryPieChart` with `useTheme`

**Files:**
- Modify: `src/components/CategoryPieChart.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';

const COLORS = ['#10b981', '#0ea5e9', '#a78bfa', '#fbbf24', '#f87171', '#06b6d4', '#f97316', '#84cc16'];

interface Props {
  byCategory: Record<string, number>;
}

export function CategoryPieChart({ byCategory }: Props) {
  const t = useTranslations('transactions');
  const theme = useTheme();

  const data = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  if (!data.length) return null;

  return (
    <GlassCard className="p-5 overflow-hidden">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
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
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatIDR(Number(value)), name]}
            contentStyle={{
              background: theme.bgSurface,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              color: theme.textPrimary,
              backdropFilter: 'blur(12px)',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: theme.textSecondary, paddingTop: 8 }}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CategoryPieChart.tsx
git commit -m "feat(theme): CategoryPieChart uses useTheme for tooltip and legend colours"
```

---

### Task 10: Update `AddTransactionModal` to use CSS tokens

**Files:**
- Modify: `src/components/AddTransactionModal.tsx`

- [ ] **Step 1: Replace hardcoded colours with CSS vars**

The modal uses hardcoded `rgba(8,12,16,0.97)`, `rgba(255,255,255,0.12)`, `rgba(255,255,255,0.1)`, `rgba(255,255,255,0.06)`, and `text-white/40` classes. Replace the JSX return with:

Find:
```tsx
      <div
        className="w-full p-5 shadow-2xl rounded-2xl border"
        style={{ background: 'rgba(8,12,16,0.97)', borderColor: 'rgba(255,255,255,0.12)' }}
      >
```

Replace with:
```tsx
      <div
        className="w-full p-5 shadow-2xl rounded-2xl border"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
      >
```

Find:
```tsx
          <h2 className="text-lg font-semibold text-white">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-xl leading-none"
```

Replace with:
```tsx
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none"
            style={{ color: 'var(--text-tertiary)' }}
```

Find:
```tsx
              <label className="block text-xs text-white/40 mb-1">{t('type')}</label>
```

Replace with:
```tsx
              <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('type')}</label>
```

Find (the non-active type button classes):
```tsx
                    : 'border-white/[0.1] bg-white/[0.04] text-white/60 hover:bg-white/[0.08]'
```

Replace with:
```tsx
                    : 'hover:opacity-80'
```

And add a `style` prop to those same inactive buttons. Find both non-active type buttons — the expense one and the income one — and add `style` conditionally. Replace the entire type toggle block:

```tsx
            {/* Type toggle */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('type')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className="rounded-lg border px-3 py-2 text-sm transition-colors"
                  style={
                    type === 'expense'
                      ? { borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)', color: '#f87171' }
                      : { borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }
                  }
                >
                  − {t('expense')}
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className="rounded-lg border px-3 py-2 text-sm transition-colors"
                  style={
                    type === 'income'
                      ? { borderColor: 'rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#34d399' }
                      : { borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }
                  }
                >
                  + {t('income')}
                </button>
              </div>
            </div>
```

Find each label that still has `text-white/40`:
```tsx
              <label className="block text-xs text-white/40 mb-1">{t('date')}</label>
```
Replace with:
```tsx
              <label className="block text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('date')}</label>
```

Do the same for amount, category, description labels — replace `text-white/40` with `style={{ color: 'var(--text-tertiary)' }}`.

Find the date input:
```tsx
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm [color-scheme:dark] appearance-none"
```
Replace with:
```tsx
                className="w-full rounded-lg border px-3 py-2 text-sm [color-scheme:dark] appearance-none"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
```

Find the amount input:
```tsx
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm [appearance:textfield]"
```
Replace with:
```tsx
                className="w-full rounded-lg border px-3 py-2 text-sm [appearance:textfield]"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
```

Find the select:
```tsx
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white px-3 py-2 text-sm"
```
Replace with:
```tsx
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
```

Find the description input:
```tsx
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.06] text-white placeholder:text-white/20 px-3 py-2 text-sm"
```
Replace with:
```tsx
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AddTransactionModal.tsx
git commit -m "feat(theme): AddTransactionModal uses CSS token vars for all colours"
```

---

### Task 11: Update `TransactionTable` to use CSS tokens

**Files:**
- Modify: `src/components/TransactionTable.tsx`

- [ ] **Step 1: Find and replace hardcoded colour values**

The TransactionTable has many inline `rgba(241,245,249,...)` and `#34d399` / `#f87171` colour references. Replace them as follows.

For any `color: 'rgba(241,245,249,0.45)'` or `color: 'rgba(241,245,249,0.55)'` → use `'var(--text-secondary)'`

For any `color: 'rgba(241,245,249,0.3)'` or `color: 'rgba(241,245,249,0.25)'` → use `'var(--text-tertiary)'`

For any `color: '#f1f5f9'` or `color: 'rgba(241,245,249,1)'` → use `'var(--text-primary)'`

For income amounts (positive, `#34d399`, `#10b981`) → use `'var(--income)'`

For expense amounts (negative, `#f87171`, `#ef4444`) → use `'var(--expense)'`

For row hover backgrounds `rgba(255,255,255,0.04)` or `rgba(255,255,255,0.06)` → use `'var(--bg-surface-2)'`

For input fields in the edit form, replace:
```tsx
style={{ colorScheme: 'dark', maxWidth: '100%', appearance: 'none', WebkitAppearance: 'none' }}
```
With:
```tsx
style={{ colorScheme: 'dark', maxWidth: '100%', appearance: 'none', WebkitAppearance: 'none', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
```

For border colours `rgba(255,255,255,0.07)` → use `'var(--border)'`
For border colours `rgba(255,255,255,0.12)` → use `'var(--border-strong)'`

- [ ] **Step 2: Commit**

```bash
git add src/components/TransactionTable.tsx
git commit -m "feat(theme): TransactionTable uses CSS token vars for text and income/expense colours"
```

---

### Task 12: Update `dashboard/page.tsx`

**Files:**
- Modify: `src/app/[locale]/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Replace hardcoded rgba text colours**

In `dashboard/page.tsx`, replace all occurrences:

- `color: 'rgba(241,245,249,0.3)'` → `color: 'var(--text-tertiary)'`
- `color: 'rgba(241,245,249,0.45)'` or `color: 'rgba(241,245,249,0.55)'` → `color: 'var(--text-secondary)'`
- `color: '#f1f5f9'` → `color: 'var(--text-primary)'`
- `color: '#34d399'` or `color: '#10b981'` → `color: 'var(--income)'`
- `color: '#f87171'` → `color: 'var(--expense)'`
- `borderColor: 'rgba(255,255,255,0.07)'` → `borderColor: 'var(--border)'`
- `borderColor: 'rgba(255,255,255,0.12)'` → `borderColor: 'var(--border-strong)'`
- `background: 'rgba(255,255,255,0.035)'` → `background: 'var(--bg-surface)'`
- `background: 'rgba(255,255,255,0.06)'` → `background: 'var(--bg-surface-2)'`

For date inputs that have `[color-scheme:dark]`, keep that class — it still sets the native picker to dark chrome which is fine; on light theme the browser's native light calendar will show automatically since `color-scheme` is advisory, not forced. Actually, to ensure the native picker matches the theme, replace `[color-scheme:dark]` with an inline style that adapts:

Find date inputs with `className="... [color-scheme:dark] ..."` and add:
```tsx
style={{ colorScheme: 'dark' }}
```
But since in light mode we want a light picker, we need to leave `color-scheme` as the browser default. Simply remove the `[color-scheme:dark]` Tailwind class from all date inputs in this file and do not replace it — the browser will pick the right scheme.

- [ ] **Step 2: Commit**

```bash
git add "src/app/[locale]/(protected)/dashboard/page.tsx"
git commit -m "feat(theme): dashboard page uses CSS token vars for all hardcoded colours"
```

---

### Task 13: Update `transactions/page.tsx`

**Files:**
- Modify: `src/app/[locale]/(protected)/transactions/page.tsx`

- [ ] **Step 1: Replace hardcoded colour values**

Apply the same token replacements as Task 12:

- `rgba(241,245,249,0.3/0.25)` → `var(--text-tertiary)`
- `rgba(241,245,249,0.45/0.55)` → `var(--text-secondary)`
- `#f1f5f9` → `var(--text-primary)`
- `rgba(255,255,255,0.07)` → `var(--border)`
- `rgba(255,255,255,0.12)` → `var(--border-strong)`
- `rgba(255,255,255,0.035)` → `var(--bg-surface)`
- `rgba(255,255,255,0.06)` → `var(--bg-surface-2)`

The `<div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">` wrapping the TransactionTable should become:

```tsx
<div
  className="rounded-xl overflow-hidden"
  style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
>
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/[locale]/(protected)/transactions/page.tsx"
git commit -m "feat(theme): transactions page uses CSS token vars"
```

---

### Task 14: Update `login/page.tsx`

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`

- [ ] **Step 1: Replace hardcoded colours and hide glows in light mode**

In the login page, the ambient glow divs need to be hidden in light mode. Wrap the glow container div with a class that is suppressed:

Find:
```tsx
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
```

Replace with:
```tsx
      {/* Ambient glows — hidden in light mode via globals.css */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden login-glows">
```

Then add to `globals.css` (append after the last line):

```css
[data-theme="light"] .login-glows {
  display: none;
}
```

Replace all text colour hardcodes in the login page:
- `color: 'rgba(241,245,249,0.45)'` → `color: 'var(--text-secondary)'`
- `color: 'rgba(241,245,249,0.3)'` → `color: 'var(--text-tertiary)'`
- `color: '#f1f5f9'` or `className="text-white"` on non-button elements → use `style={{ color: 'var(--text-primary)' }}`
- `borderColor: 'rgba(255,255,255,0.07)'` → `borderColor: 'var(--border)'`
- `borderColor: 'rgba(255,255,255,0.12)'` → `borderColor: 'var(--border-strong)'`

The sign-in button uses `GlassButton variant="primary"` — it will automatically pick up `var(--accent)` after Task 6.

The `GlassCard` wrapper on login picks up `var(--bg-surface)` / `var(--border)` after Task 5.

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css "src/app/[locale]/login/page.tsx"
git commit -m "feat(theme): login page uses CSS tokens, hides ambient glows in light mode"
```

---

### Task 15: Update `accounts/page.tsx` and `categories/page.tsx`

**Files:**
- Modify: `src/app/[locale]/(protected)/accounts/page.tsx`
- Modify: `src/app/[locale]/(protected)/categories/page.tsx`

- [ ] **Step 1: Apply token replacements to accounts page**

Apply the same substitutions as Tasks 12–13:
- All `rgba(241,245,249,...)` text → `var(--text-tertiary)` / `var(--text-secondary)` / `var(--text-primary)`
- All `rgba(255,255,255,0.07/0.12)` borders → `var(--border)` / `var(--border-strong)`
- All `rgba(255,255,255,0.035/0.06)` backgrounds → `var(--bg-surface)` / `var(--bg-surface-2)`
- Income/expense colours → `var(--income)` / `var(--expense)`

- [ ] **Step 2: Apply token replacements to categories page**

Same substitutions as Step 1.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(protected)/accounts/page.tsx" "src/app/[locale]/(protected)/categories/page.tsx"
git commit -m "feat(theme): accounts and categories pages use CSS token vars"
```

---

### Task 16: Smoke-test both themes

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify dark theme (default)**

Open `http://localhost:3000/dashboard`. Confirm:
- Background is `#080c10` dark
- Film grain visible
- Ambient emerald/sky glows visible
- Charts render with emerald/red bars

- [ ] **Step 3: Toggle to light theme**

Click the ☀ button in the top bar / sidebar. Confirm:
- Background changes to `#f7f4f0` cream
- Film grain disappears
- Ambient glows disappear
- Cards are white with subtle shadow
- Text is dark `#1c1815`
- Charts re-render with forest green / deep red colours
- Toggle icon changes to ☾

- [ ] **Step 4: Verify persistence**

Reload the page with light theme active. Confirm the light theme is still applied (no flash to dark on load).

- [ ] **Step 5: Toggle back to dark**

Confirm dark theme is fully restored.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(theme): light/dark theme system complete — smoke test passed"
```
