# Elevated Glass UI Redesign

**Date:** 2026-05-05  
**Scope:** Full app — all pages (Dashboard, Transactions, Categories, Accounts, Login)  
**Approach:** Design System Layer — reusable Glass components + CSS custom properties  

---

## Goals

Upgrade the existing dark glass aesthetic from a functional but generic look to a cinematic, premium "Elevated Glass" feel — without restructuring page layouts (that comes later in Phase C).

---

## Design Direction

**Palette:**
- Background base: `#080c10` (deeper than current `#0f0f11`)
- Emerald (`#10b981` / `#34d399`) — income, positive values, primary CTA, active nav
- Sky blue (`#0ea5e9` / `#38bdf8`) — balance, UI highlights, account pill, section badges
- Red (`#f87171`) — expenses, danger
- Amber (`#fbbf24`) — warnings, budget near-limit, top expense
- Surface: `rgba(255,255,255,0.035)` with `rgba(255,255,255,0.06)` on hover
- Borders: `rgba(255,255,255,0.07)` subtle / `rgba(255,255,255,0.12)` medium

**Typography:**
- Font: Geist (Google Fonts) — weights 300, 400, 500, 600, 700
- Loaded via `<link>` in root `layout.tsx`, fallback `system-ui, sans-serif`

**Ambient glows:**
- Two fixed radial gradients on `<body>` — emerald top-left, sky blue top-right
- Per-card tinted backgrounds on summary cards (color-matched to their data role)
- Glowing box-shadows on progress bars and primary buttons

---

## CSS Custom Properties

All design tokens live in `src/app/globals.css` under `:root`:

```css
:root {
  --bg-base: #080c10;
  --bg-surface: rgba(255,255,255,0.035);
  --bg-surface-hover: rgba(255,255,255,0.06);
  --bg-elevated: rgba(255,255,255,0.055);
  --border-subtle: rgba(255,255,255,0.07);
  --border-medium: rgba(255,255,255,0.12);
  --text-primary: #f1f5f9;
  --text-secondary: rgba(241,245,249,0.55);
  --text-tertiary: rgba(241,245,249,0.3);

  --emerald: #10b981;
  --emerald-light: #34d399;
  --emerald-glow: rgba(16,185,129,0.18);
  --emerald-border: rgba(16,185,129,0.25);

  --sky: #0ea5e9;
  --sky-light: #38bdf8;
  --sky-glow: rgba(14,165,233,0.15);
  --sky-border: rgba(14,165,233,0.22);

  --red: #f87171;
  --red-glow: rgba(248,113,113,0.12);
  --red-border: rgba(248,113,113,0.22);

  --amber: #fbbf24;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}
```

---

## New Components

### `GlassCard` (`src/components/ui/GlassCard.tsx`)

Base card wrapper used everywhere in place of raw `div` with repeated glass classes.

```tsx
// Props: className?, tint?: 'emerald' | 'sky' | 'red' | 'amber' | 'none', children
```

- `backdrop-filter: blur(12px)`
- Subtle shimmer via `::before` gradient overlay
- `tint` prop applies a color-matched gradient background + border

### `GlowBadge` (`src/components/ui/GlowBadge.tsx`)

Pill-shaped badge with glow border. Used for account pill, section badges, status chips.

```tsx
// Props: color: 'emerald' | 'sky' | 'red' | 'amber', children
```

### `GlassButton` (`src/components/ui/GlassButton.tsx`)

Two variants:
- `primary` — gradient emerald background, glowing box-shadow
- `ghost` — glass surface background, subtle border

### `NavLink` (update `src/components/NavLink.tsx`)

Update existing `NavLink` to use new active/hover tokens. Active state uses emerald tint + border. Shared by sidebar and mobile bottom nav.

---

## Page-by-Page Changes

### Root Layout (`src/app/[locale]/(protected)/layout.tsx`)
- Add Geist font import to root `layout.tsx`
- Add ambient glow `::before` / `::after` pseudo-elements to `<body>` in `globals.css`
- Update sidebar: use `GlassCard`-style surface, `NavItem` components, gradient logo icon, user avatar at bottom
- Update mobile bottom nav: glassmorphism background, `NavItem` active state with emerald tint

### Dashboard (`src/app/[locale]/(protected)/dashboard/page.tsx` + components)
- `SummaryCards`: wrap each in `GlassCard` with matching `tint`, add colored `label-dot` with glow, add trend percentage line
- `IncomeExpenseChart`: update bar colors to gradient fills, update grid/axis colors to match new tokens
- `CategoryPieChart`: update slice colors, add glow on active slice
- Budget overview: upgrade progress bars to gradient fills with colored `box-shadow`
- Add `GlowBadge` for account/period indicator above page title

### Transactions (`src/app/[locale]/(protected)/transactions/page.tsx`)
- Wrap filter bar in `GlassCard`
- Update active filter chips to use `GlowBadge`
- Table rows: use new border/hover tokens
- `AddTransactionModal`: use `GlassCard` for modal surface, `GlassButton` for actions

### Categories (`src/app/[locale]/(protected)/categories/page.tsx`)
- Category items: `GlassCard` per item, budget progress bars upgraded
- Edit/Delete buttons: use `GlassButton ghost`

### Accounts (`src/app/[locale]/(protected)/accounts/page.tsx`)
- Account cards: `GlassCard` with sky tint for group accounts, emerald tint for personal
- Invite link area: `GlowBadge` for status

### Login (`src/app/[locale]/login/page.tsx`)
- Center card: `GlassCard` elevated
- Logo: gradient emerald-to-sky, glowing
- Google button: `GlassButton ghost` style
- Background: ambient emerald glow

---

## Responsive Behaviour

No changes to existing breakpoint logic. The new components inherit the existing `md:` responsive patterns. Specific mobile refinements:
- Summary cards: 2×2 on mobile (already the case, ensure card padding scales down)
- Chart cards: full-width stacked on mobile
- Bottom nav active item: emerald tint pill

---

## What Is NOT In Scope

- Page layout restructuring (Phase C — later)
- New page sections or features
- Animation / page transitions (Phase C)
- Light mode

---

## Mockup Reference

`.superpowers/brainstorm/` — `dashboard-mockup-v2.html` shows the validated responsive design.
