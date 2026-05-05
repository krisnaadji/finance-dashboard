# Elevated Glass UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing basic glass aesthetic with a cinematic "Elevated Glass" design system — CSS tokens, four reusable UI components, Geist font, and ambient glows applied across all five pages.

**Architecture:** Add CSS custom properties to `globals.css`, create `src/components/ui/` with `GlassCard`, `GlowBadge`, and `GlassButton`, then update `NavLink` and each page/component to consume them. No layout structure changes — visual layer only.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, `next/font/google` (Geist), inline styles for dynamic token values, Recharts 3 (SVG gradient defs for bar fills).

---

## File Map

**Create:**
- `src/components/ui/GlassCard.tsx` — tinted glass card wrapper
- `src/components/ui/GlowBadge.tsx` — pill badge with glow border
- `src/components/ui/GlassButton.tsx` — primary + ghost + danger button variants

**Modify:**
- `src/app/globals.css` — CSS design tokens, Geist font var, ambient body glows
- `src/app/layout.tsx` — load Geist via `next/font/google`
- `src/components/NavLink.tsx` — new active/hover token styles
- `src/app/[locale]/(protected)/layout.tsx` — sidebar + mobile nav restyle
- `src/components/SummaryCards.tsx` — use GlassCard with tint + dot glow
- `src/components/IncomeExpenseChart.tsx` — gradient bar fills + updated axis tokens
- `src/components/CategoryPieChart.tsx` — updated color palette + GlassCard wrapper
- `src/app/[locale]/(protected)/dashboard/page.tsx` — GlowBadge, gradient budget bars, GlassCard top-transaction panels
- `src/components/AddTransactionModal.tsx` — GlassCard modal surface, GlassButton actions
- `src/app/[locale]/(protected)/transactions/page.tsx` — GlassCard filter bar, GlowBadge chips
- `src/app/[locale]/(protected)/categories/page.tsx` — GlassCard items, GlassButton edit/delete
- `src/app/[locale]/(protected)/accounts/page.tsx` — GlassCard with sky/emerald tints
- `src/app/[locale]/login/page.tsx` — GlassCard elevated, gradient logo glow

---

## Task 1: CSS Design Tokens + Geist Font + Ambient Glows

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `globals.css` with design tokens, font wiring, and ambient glows**

```css
/* src/app/globals.css */
@import 'tailwindcss';

:root {
  /* Elevated Glass Design Tokens */
  --bg-base: #080c10;
  --bg-surface: rgba(255, 255, 255, 0.035);
  --bg-surface-hover: rgba(255, 255, 255, 0.06);
  --bg-elevated: rgba(255, 255, 255, 0.055);
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-medium: rgba(255, 255, 255, 0.12);
  --text-primary: #f1f5f9;
  --text-secondary: rgba(241, 245, 249, 0.55);
  --text-tertiary: rgba(241, 245, 249, 0.3);

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

  /* Legacy compat — kept so any remaining bg-background references still work */
  --background: #080c10;
  --foreground: #f1f5f9;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
  position: relative;
}

/* Ambient background glows — sit behind all page content via z-index 0 */
body::before {
  content: '';
  position: fixed;
  top: -200px;
  left: -100px;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 65%);
  pointer-events: none;
  z-index: 0;
}

body::after {
  content: '';
  position: fixed;
  top: 80px;
  right: -150px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.05) 0%, transparent 65%);
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 2: Load Geist via next/font/google in root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Finance Bot Dashboard',
  description: 'Personal finance tracking via WhatsApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build passes**

```bash
cd D:/Private/Projects/finance-dashboard
npm run build
```

Expected: build completes with no type errors. If `Geist` is not found in `next/font/google`, install the standalone package instead: `npm install geist` then import from `'geist/font'` — but try `next/font/google` first.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(design): add elevated glass CSS tokens, Geist font, ambient glows"
```

---

## Task 2: GlassCard Component

**Files:**
- Create: `src/components/ui/GlassCard.tsx`

- [ ] **Step 1: Create `src/components/ui/` directory and write GlassCard**

```tsx
// src/components/ui/GlassCard.tsx
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
  none: { background: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.07)' },
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

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/GlassCard.tsx
git commit -m "feat(design): add GlassCard component"
```

---

## Task 3: GlowBadge Component

**Files:**
- Create: `src/components/ui/GlowBadge.tsx`

- [ ] **Step 1: Write GlowBadge**

```tsx
// src/components/ui/GlowBadge.tsx
import { ReactNode } from 'react';

type Color = 'emerald' | 'sky' | 'red' | 'amber';

const colorMap: Record<Color, { bg: string; border: string; text: string; dot: string }> = {
  emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', text: '#34d399', dot: '#10b981' },
  sky:     { bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.28)', text: '#38bdf8', dot: '#0ea5e9' },
  red:     { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)', text: '#f87171', dot: '#ef4444' },
  amber:   { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.28)', text: '#fbbf24', dot: '#f59e0b' },
};

interface Props {
  color: Color;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function GlowBadge({ color, children, dot = false, className = '' }: Props) {
  const c = colorMap[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {dot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: c.dot, boxShadow: `0 0 5px ${c.dot}` }}
        />
      )}
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/GlowBadge.tsx
git commit -m "feat(design): add GlowBadge component"
```

---

## Task 4: GlassButton Component

**Files:**
- Create: `src/components/ui/GlassButton.tsx`

- [ ] **Step 1: Write GlassButton**

```tsx
// src/components/ui/GlassButton.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const base =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

const ghostClass =
  'border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-[rgba(241,245,249,0.7)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f1f5f9]';

const dangerClass =
  'text-[rgba(248,113,113,0.6)] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)]';

export function GlassButton({ variant = 'ghost', children, className = '', style, ...rest }: Props) {
  if (variant === 'primary') {
    return (
      <button
        className={`${base} text-white ${className}`}
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
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
      <button className={`${base} ${dangerClass} ${className}`} style={style} {...rest}>
        {children}
      </button>
    );
  }

  return (
    <button className={`${base} ${ghostClass} ${className}`} style={style} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/GlassButton.tsx
git commit -m "feat(design): add GlassButton component"
```

---

## Task 5: Update NavLink

**Files:**
- Modify: `src/components/NavLink.tsx`

- [ ] **Step 1: Replace NavLink with new active/hover token styles**

```tsx
// src/components/NavLink.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  href: string;
  icon: string;
  label: string;
}

export function NavLink({ href, icon, label }: Props) {
  const pathname = usePathname();
  const strippedPath = pathname.replace(new RegExp('^/(en|id)(/|$)'), '$2') || '/';
  const isActive = strippedPath.startsWith(href);

  return (
    <Link
      href={href}
      className="flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-2.5 flex-1 md:flex-none
        px-2 md:px-3 py-2 rounded-none md:rounded-lg text-xs md:text-sm transition-all duration-150
        justify-center md:justify-start border border-transparent"
      style={
        isActive
          ? {
              background: 'rgba(16,185,129,0.12)',
              borderColor: 'rgba(16,185,129,0.28)',
              color: '#34d399',
            }
          : { color: 'rgba(241,245,249,0.45)' }
      }
      onMouseEnter={
        !isActive
          ? (e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(241,245,249,0.85)';
            }
          : undefined
      }
      onMouseLeave={
        !isActive
          ? (e) => {
              (e.currentTarget as HTMLElement).style.background = '';
              (e.currentTarget as HTMLElement).style.color = 'rgba(241,245,249,0.45)';
            }
          : undefined
      }
    >
      <span className="text-sm md:text-xs opacity-80">{icon}</span>
      <span className="text-[10px] md:text-sm">{label}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Verify build and check nav visually**

```bash
npm run build
npm run dev
```

Open http://localhost:3000 in browser. Active nav item should show emerald tint with emerald border. Inactive items should be muted; hover should brighten slightly.

- [ ] **Step 3: Commit**

```bash
git add src/components/NavLink.tsx
git commit -m "feat(design): update NavLink to elevated glass active/hover tokens"
```

---

## Task 6: Update Protected Layout (Sidebar + Mobile Nav)

**Files:**
- Modify: `src/app/[locale]/(protected)/layout.tsx`

- [ ] **Step 1: Replace layout with updated sidebar and mobile nav styles**

```tsx
// src/app/[locale]/(protected)/layout.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SignOutButton } from '@/components/SignOutButton';
import { NavLink } from '@/components/NavLink';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="relative z-[1] min-h-screen text-[#f1f5f9] flex" style={{ background: 'var(--bg-base)' }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-56 shrink-0 flex-col"
        style={{
          borderRight: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(8,12,16,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                boxShadow: '0 0 14px rgba(16,185,129,0.35)',
              }}
            >
              F
            </div>
            <span
              className="font-semibold text-sm tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #f1f5f9, #34d399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              FinanceBot
            </span>
          </div>
        </div>

        {/* Account Switcher */}
        <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <AccountSwitcher />
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          <NavLink href="/dashboard" icon="▦" label="Dashboard" />
          <NavLink href="/transactions" icon="↕" label="Transactions" />
          <NavLink href="/accounts" icon="◎" label="Accounts" />
          <NavLink href="/categories" icon="⊞" label="Categories" />
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <LanguageSwitcher />
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-col flex-1 min-w-0">
        <header
          className="md:hidden flex items-center justify-between px-4 py-3 relative z-10"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
                boxShadow: '0 0 10px rgba(16,185,129,0.3)',
              }}
            >
              F
            </div>
            <span className="font-semibold text-sm">FinanceBot</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <SignOutButton />
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
          style={{
            background: 'rgba(8,12,16,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <NavLink href="/dashboard" icon="▦" label="Dashboard" />
          <NavLink href="/transactions" icon="↕" label="Txn" />
          <NavLink href="/accounts" icon="◎" label="Accounts" />
          <NavLink href="/categories" icon="⊞" label="Categories" />
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 md:p-8 pb-20 md:pb-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and visually check sidebar**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/dashboard. Sidebar should have dark glass background with slight blur, emerald-to-sky gradient logo, and a glowing logo icon. On mobile (< 768px) the bottom nav should have the same blurred glass background.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/(protected)/layout.tsx
git commit -m "feat(design): update sidebar and mobile nav to elevated glass"
```

---

## Task 7: Update SummaryCards

**Files:**
- Modify: `src/components/SummaryCards.tsx`

- [ ] **Step 1: Replace SummaryCards to use GlassCard with tint + glowing dot labels**

```tsx
// src/components/SummaryCards.tsx
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
```

- [ ] **Step 2: Verify build and check cards**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/dashboard. Each summary card should show a distinct tinted glass background — emerald for income, red for expenses, sky for balance, amber for top expense. Each should have a glowing colored dot before its label.

- [ ] **Step 3: Commit**

```bash
git add src/components/SummaryCards.tsx
git commit -m "feat(design): update SummaryCards with GlassCard tints and glow dots"
```

---

## Task 8: Update Charts

**Files:**
- Modify: `src/components/IncomeExpenseChart.tsx`
- Modify: `src/components/CategoryPieChart.tsx`

- [ ] **Step 1: Update IncomeExpenseChart — gradient bar fills and GlassCard wrapper**

```tsx
// src/components/IncomeExpenseChart.tsx
'use client';
import { useTranslations } from 'next-intl';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';

interface Props {
  byMonth: Record<string, { income: number; expense: number }>;
  title?: string;
}

export function IncomeExpenseChart({ byMonth, title }: Props) {
  const t = useTranslations('summary');

  const data = Object.entries(byMonth)
    .sort()
    .map(([month, vals]) => ({
      month: new Date(month + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      [t('income')]: vals.income,
      [t('expense')]: vals.expense,
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
            formatter={(value) => [formatIDR(Number(value)), '']}
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
```

- [ ] **Step 2: Update CategoryPieChart — new color palette and GlassCard wrapper**

```tsx
// src/components/CategoryPieChart.tsx
'use client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { formatIDR } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';

// Aligned with the Elevated Glass palette
const COLORS = ['#10b981', '#0ea5e9', '#a78bfa', '#fbbf24', '#f87171', '#06b6d4', '#f97316', '#84cc16'];

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
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatIDR(Number(value)), name]}
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
```

- [ ] **Step 3: Verify build and check charts**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/dashboard. Bar chart should show gradient bars (emerald fading down for income, red fading down for expense). Pie chart slices should use the new palette. Both chart cards should have the glass card background.

- [ ] **Step 4: Commit**

```bash
git add src/components/IncomeExpenseChart.tsx src/components/CategoryPieChart.tsx
git commit -m "feat(design): update charts with gradient fills and GlassCard wrapper"
```

---

## Task 9: Update Dashboard Page

**Files:**
- Modify: `src/app/[locale]/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Update the dashboard JSX — add GlowBadge, upgrade budget bars, GlassCard panels**

The dashboard page is long. Make these four targeted changes in the JSX return block:

**Change A — Add GlowBadge import at the top of the file:**

```tsx
import { GlowBadge } from '@/components/ui/GlowBadge';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
```

**Change B — Replace the page header block** (find the section with "Add Transaction" button and date display):

```tsx
{/* Page header */}
<div className="flex items-start justify-between mb-6">
  <div>
    <h1 className="text-xl md:text-2xl font-semibold tracking-tight" style={{ color: '#f1f5f9' }}>
      Dashboard
    </h1>
    <p className="text-xs mt-0.5" style={{ color: 'rgba(241,245,249,0.3)' }}>{now}</p>
  </div>
  <GlassButton variant="primary" onClick={() => setAddOpen(true)}>
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 1v10M1 6h10" />
    </svg>
    <span className="hidden sm:inline">Add Transaction</span>
    <span className="sm:hidden">Add</span>
  </GlassButton>
</div>
```

**Change C — Replace the Budget Overview section** (the `budgetOverview.length > 0` block):

```tsx
{budgetOverview.length > 0 && (
  <GlassCard className="p-4 mt-6">
    <h2 className="text-sm font-medium mb-4" style={{ color: 'rgba(241,245,249,0.55)' }}>
      Budget Overview
    </h2>
    <div className="space-y-3">
      {budgetOverview.map(
        (b) =>
          b && (
            <div key={b.id}>
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'rgba(241,245,249,0.8)' }}>{b.name}</span>
                  {b.over && (
                    <GlowBadge color="red">Over budget</GlowBadge>
                  )}
                  {!b.over && b.pct >= 80 && (
                    <GlowBadge color="amber">Near limit</GlowBadge>
                  )}
                </div>
                <div className="text-right">
                  <span
                    className="text-xs font-medium"
                    style={{ color: b.over ? '#f87171' : b.pct >= 80 ? '#fbbf24' : 'rgba(241,245,249,0.55)' }}
                  >
                    {formatIDR(b.spent)}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(241,245,249,0.25)' }}>
                    {' '}/ {formatIDR(b.limit)}
                  </span>
                </div>
              </div>
              {/* Gradient progress bar */}
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(b.pct, 100)}%`,
                    background: b.over
                      ? 'linear-gradient(90deg, #ef4444, #f87171)'
                      : b.pct >= 80
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(90deg, #10b981, #34d399)',
                    boxShadow: b.over
                      ? '0 0 6px rgba(239,68,68,0.5)'
                      : b.pct >= 80
                      ? '0 0 6px rgba(245,158,11,0.5)'
                      : '0 0 6px rgba(16,185,129,0.5)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px]" style={{ color: 'rgba(241,245,249,0.2)' }}>
                  {formatIDR(Math.max(b.limit - b.spent, 0))} remaining
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: b.over ? '#f87171' : b.pct >= 80 ? '#fbbf24' : 'rgba(241,245,249,0.2)' }}
                >
                  {Math.round(b.pct)}%
                </span>
              </div>
            </div>
          ),
      )}
    </div>
  </GlassCard>
)}
```

**Change D — Replace Top Expenses and Top Incomes panels** (the `topExpenses`/`topIncomes` block):

```tsx
{(summary.topExpenses.length > 0 || summary.topIncomes.length > 0) && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
    {summary.topExpenses.length > 0 && (
      <GlassCard className="p-4">
        <h2 className="text-sm font-medium mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>
          Top Expenses
        </h2>
        <div className="space-y-2">
          {summary.topExpenses.map((txn, i) => (
            <div key={txn.id} className="flex items-center gap-3">
              <span className="text-xs w-4" style={{ color: 'rgba(241,245,249,0.2)' }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'rgba(241,245,249,0.8)' }}>{txn.description}</p>
                <p className="text-xs" style={{ color: 'rgba(241,245,249,0.3)' }}>
                  {txn.category} · {formatDate(txn.date)}
                </p>
              </div>
              <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#f87171' }}>
                -{formatIDR(txn.amount)}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    )}
    {summary.topIncomes.length > 0 && (
      <GlassCard className="p-4">
        <h2 className="text-sm font-medium mb-3" style={{ color: 'rgba(241,245,249,0.55)' }}>
          Top Incomes
        </h2>
        <div className="space-y-2">
          {summary.topIncomes.map((txn, i) => (
            <div key={txn.id} className="flex items-center gap-3">
              <span className="text-xs w-4" style={{ color: 'rgba(241,245,249,0.2)' }}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'rgba(241,245,249,0.8)' }}>{txn.description}</p>
                <p className="text-xs" style={{ color: 'rgba(241,245,249,0.3)' }}>
                  {txn.category} · {formatDate(txn.date)}
                </p>
              </div>
              <span className="text-sm font-medium whitespace-nowrap" style={{ color: '#34d399' }}>
                +{formatIDR(txn.amount)}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    )}
  </div>
)}
```

- [ ] **Step 2: Verify build and check dashboard**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/dashboard. Budget bars should glow (green/amber/red with box-shadow). "Over budget" and "Near limit" should show GlowBadge pills. Top Expenses/Incomes should sit in glass cards. The Add Transaction button should have the emerald gradient style.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/(protected)/dashboard/page.tsx
git commit -m "feat(design): update dashboard with GlowBadge, gradient budget bars, GlassCard panels"
```

---

## Task 10: Update AddTransactionModal

**Files:**
- Modify: `src/components/AddTransactionModal.tsx`

- [ ] **Step 1: Add GlassCard and GlassButton imports and update modal surface + action buttons**

Add imports at the top (alongside existing ones):

```tsx
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
```

Replace the modal container `<div>` (the one with `bg-[#1a1a1f]`):

```tsx
{/* was: <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1a1a1f] p-5 shadow-xl"> */}
<GlassCard
  className="w-full max-w-md p-5 shadow-2xl"
  style={{ background: 'rgba(8,12,16,0.95)', borderColor: 'rgba(255,255,255,0.12)' }}
  onClick={(e) => e.stopPropagation()}
>
```

Close the GlassCard with `</GlassCard>` in place of the outer `</div>`.

Replace the form action buttons at the bottom of the form:

```tsx
{/* was the two buttons at the end of the form */}
<div className="flex justify-end gap-2 pt-2">
  <GlassButton type="button" variant="ghost" onClick={onClose}>
    {t('cancel')}
  </GlassButton>
  <GlassButton type="submit" variant="primary" disabled={saving} className="px-4 py-2">
    {saving ? t('saving') : t('save')}
  </GlassButton>
</div>
```

Replace the "OK" button in the budget warning banner:

```tsx
{/* was: <button className="rounded-lg bg-white/[0.08] ..."> */}
<GlassButton onClick={onClose}>OK</GlassButton>
```

- [ ] **Step 2: Verify build and test modal**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/dashboard, click "Add Transaction". Modal should have a deeper glass surface with blurred background. Save/Cancel buttons should use the new glass styles.

- [ ] **Step 3: Commit**

```bash
git add src/components/AddTransactionModal.tsx
git commit -m "feat(design): update AddTransactionModal with GlassCard surface and GlassButton actions"
```

---

## Task 11: Update Transactions Page

**Files:**
- Modify: `src/app/[locale]/(protected)/transactions/page.tsx`

- [ ] **Step 1: Read the current transactions page**

```bash
cat src/app/[locale]/(protected)/transactions/page.tsx
```

- [ ] **Step 2: Apply GlassCard and GlassButton to filter bar and action buttons**

Add imports at the top:

```tsx
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowBadge } from '@/components/ui/GlowBadge';
import { GlassButton } from '@/components/ui/GlassButton';
```

Wrap the filter bar section (the div containing date/type/category/search inputs) with `<GlassCard className="p-3 md:p-4 mb-4">...</GlassCard>`.

Replace the "Add Transaction" and "Export CSV" buttons with:

```tsx
<GlassButton variant="primary" onClick={() => setAddOpen(true)}>
  + Add
</GlassButton>
<GlassButton variant="ghost" onClick={exportCSV}>
  Export CSV
</GlassButton>
```

Replace active filter chips (the removable `×` pills) with:

```tsx
<GlowBadge color="sky" className="cursor-pointer" onClick={() => clearFilter(key)}>
  {label} ×
</GlowBadge>
```

- [ ] **Step 3: Verify build and check transactions page**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/transactions. Filter bar should sit in a glass card. Active filters should render as sky GlowBadge pills. Buttons should use glass styles.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/(protected)/transactions/page.tsx
git commit -m "feat(design): update transactions page with GlassCard filter bar and GlowBadge chips"
```

---

## Task 12: Update Categories Page

**Files:**
- Modify: `src/app/[locale]/(protected)/categories/page.tsx`

- [ ] **Step 1: Read the current categories page**

```bash
cat src/app/[locale]/(protected)/categories/page.tsx
```

- [ ] **Step 2: Apply GlassCard per category item, GlassButton for edit/delete, gradient budget bars**

Add imports at the top:

```tsx
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
```

Wrap each category list item container with `<GlassCard className="p-3">`.

Replace edit buttons with `<GlassButton variant="ghost" onClick={...}>Edit</GlassButton>`.

Replace delete buttons with `<GlassButton variant="danger" onClick={...}>Delete</GlassButton>`.

Replace progress bar `<div className="h-1.5 ...">` with:

```tsx
<div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
  <div
    className="h-full rounded-full transition-all"
    style={{
      width: `${Math.min(pct, 100)}%`,
      background: over
        ? 'linear-gradient(90deg, #ef4444, #f87171)'
        : pct >= 80
        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
        : 'linear-gradient(90deg, #10b981, #34d399)',
      boxShadow: over
        ? '0 0 6px rgba(239,68,68,0.5)'
        : pct >= 80
        ? '0 0 6px rgba(245,158,11,0.5)'
        : '0 0 6px rgba(16,185,129,0.5)',
    }}
  />
</div>
```

- [ ] **Step 3: Verify build and check categories page**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/categories. Each category item should be inside a glass card. Edit and delete buttons should use the new styles. Budget bars should glow.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/(protected)/categories/page.tsx
git commit -m "feat(design): update categories page with GlassCard items and gradient budget bars"
```

---

## Task 13: Update Accounts Page

**Files:**
- Modify: `src/app/[locale]/(protected)/accounts/page.tsx`

- [ ] **Step 1: Read the current accounts page**

```bash
cat src/app/[locale]/(protected)/accounts/page.tsx
```

- [ ] **Step 2: Apply GlassCard with tint per account type, GlowBadge for status**

Add imports:

```tsx
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowBadge } from '@/components/ui/GlowBadge';
import { GlassButton } from '@/components/ui/GlassButton';
```

Wrap each account card with `<GlassCard tint={account.type === 'group' ? 'sky' : 'emerald'} className="p-4">`.

Replace the "WhatsApp linked" / "Not linked" status indicator with:

```tsx
{isLinked
  ? <GlowBadge color="emerald" dot>Linked</GlowBadge>
  : <GlowBadge color="red">Not linked</GlowBadge>
}
```

Replace action buttons (Edit, Delete, Generate invite, Copy) with `GlassButton` variants (`ghost` for neutral, `danger` for delete).

- [ ] **Step 3: Verify build and check accounts page**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/accounts. Personal accounts should have an emerald tint. Group accounts should have a sky tint. Link status should show as GlowBadge pills.

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/(protected)/accounts/page.tsx
git commit -m "feat(design): update accounts page with tinted GlassCards and GlowBadge status"
```

---

## Task 14: Update Login Page

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`

- [ ] **Step 1: Replace login page with elevated glass styling**

```tsx
// src/app/[locale]/login/page.tsx
'use client';
import { createClient } from '@/lib/supabase-browser';
import { GlassCard } from '@/components/ui/GlassCard';

export default function LoginPage() {
  const supabase = createClient();

  async function signIn() {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect') ?? '/dashboard';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          window.location.origin + '/api/auth/callback?next=' + encodeURIComponent(redirect),
        queryParams: { prompt: 'select_account' },
      },
    });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Ambient glow behind card */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.05) 0%, transparent 65%)' }}
        />
      </div>

      <div className="relative w-full max-w-sm z-[1]">
        {/* Login card */}
        <GlassCard className="p-8 text-center mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-5"
            style={{
              background: 'linear-gradient(135deg, #10b981, #0ea5e9)',
              boxShadow: '0 0 28px rgba(16,185,129,0.4), 0 0 60px rgba(14,165,233,0.15)',
            }}
          >
            F
          </div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: '#f1f5f9' }}>Finance Bot</h1>
          <p className="text-sm mb-7" style={{ color: 'rgba(241,245,249,0.4)' }}>Personal finance via WhatsApp</p>
          <button
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(241,245,249,0.85)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </GlassCard>

        {/* How it works */}
        <GlassCard className="p-6">
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: 'rgba(241,245,249,0.35)' }}
          >
            How it works
          </h2>
          <ol className="space-y-4">
            {[
              { step: '1', title: 'Sign in & create account', desc: 'Login with Google, then create a finance account on the Accounts page.' },
              { step: '2', title: 'Link WhatsApp', desc: 'Generate a setup code on the Accounts page, then send /setup CODE to the bot on WhatsApp.' },
              { step: '3', title: 'Record transactions', desc: 'Just chat naturally — makan siang 35k, gaji masuk 5jt, bayar listrik 150rb.' },
              { step: '4', title: 'Track on dashboard', desc: 'View your income, expenses, and charts here. Switch between accounts anytime.' },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-3">
                <span
                  className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#34d399',
                  }}
                >
                  {step}
                </span>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'rgba(241,245,249,0.8)' }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(241,245,249,0.35)' }}>{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </GlassCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and check login page**

```bash
npm run build && npm run dev
```

Open http://localhost:3000/login (sign out first if needed). Logo should show the emerald-to-sky gradient with a strong glow. Both cards should use the glass surface. The Google button should use the ghost glass style.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/login/page.tsx
git commit -m "feat(design): update login page with elevated glass cards and gradient logo glow"
```

---

## Final Verification

- [ ] **Full build check**

```bash
npm run build
```

Expected: zero errors, zero type errors.

- [ ] **Visual smoke test — visit every page**

```bash
npm run dev
```

| Page | URL | Check |
|------|-----|-------|
| Login | `/login` | Glass cards, gradient logo glow |
| Dashboard | `/dashboard` | Summary card tints, gradient bars, glowing budget bars |
| Transactions | `/transactions` | GlassCard filter bar, GlowBadge chips |
| Categories | `/categories` | GlassCard items, gradient budget bars |
| Accounts | `/accounts` | Sky/emerald tinted cards, GlowBadge status |

- [ ] **Mobile check** — resize browser to 375px wide on each page

Sidebar should be hidden. Bottom nav should show glass background with emerald active item. All cards should be full-width.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete elevated glass UI redesign — Phase B"
```
