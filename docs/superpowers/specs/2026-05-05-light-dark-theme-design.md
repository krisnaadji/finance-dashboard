# Light / Dark Theme System — Design Spec

**Date:** 2026-05-05  
**Status:** Approved, ready for implementation planning  
**Scope:** All pages and components

---

## Overview

Add a warm minimal **light theme** to the app, switchable from the existing dark glass morphism theme via a sun/moon toggle. Both themes are first-class — neither is a fallback. The toggle persists via `localStorage` and is accessible from every page.

---

## Design Decisions

### Themes

| | Dark (current) | Light (new) |
|---|---|---|
| Background | `#080c10` | `#f7f4f0` |
| Surface (cards) | `rgba(255,255,255,0.035)` | `#ffffff` |
| Surface secondary | `rgba(255,255,255,0.06)` | `#ede9e3` |
| Border | `rgba(255,255,255,0.07–0.12)` | `rgba(0,0,0,0.06–0.08)` |
| Text primary | `#f1f5f9` | `#1c1815` |
| Text secondary | `rgba(241,245,249,0.4–0.55)` | `#a89880` |
| Text tertiary | `rgba(241,245,249,0.2–0.3)` | `#c4b8a8` |
| Accent | Emerald `#10b981` / Sky `#0ea5e9` | Dusty Indigo `#4a4e8a` |
| Income | `#34d399` (emerald) | `#2d7a4a` (forest green) |
| Expense | `#f87171` (red) | `#c0392b` (deep red) |
| Sidebar / nav bg | `rgba(8,12,16,0.85)` | `#ede9e3` |
| Film grain | Yes, `opacity: 0.028` | No |
| Backdrop blur on cards | Yes | No |

### Typography

| | Dark | Light |
|---|---|---|
| All text | Geist (current) | Numbers & headings: Palatino / `'Palatino Linotype', Palatino, Georgia, serif`; Labels & body: system sans |
| Label style | Normal weight, low opacity | Small-caps tracking (`letter-spacing: 0.14–0.18em`), `#a89880` |

### Toggle

- **Placement (mobile):** Sun/moon icon in the mobile top bar, to the left of the Sign Out button — same row as the language switcher
- **Placement (desktop):** Icon button in the sidebar footer, below the language switcher
- **Persistence:** `localStorage` key `theme`, values `"dark"` | `"light"`. Default: `"dark"` (preserves current behaviour for existing users)
- **Application:** Toggle adds/removes a `data-theme="light"` attribute on `<html>`. All colour tokens are CSS custom properties scoped to `[data-theme="light"]`

---

## CSS Token Architecture

All colour and typography values move to CSS custom properties in `globals.css`. Components reference tokens, never raw values.

```css
/* Default (dark) */
:root {
  --bg-base: #080c10;
  --bg-surface: rgba(255,255,255,0.035);
  --bg-surface-2: rgba(255,255,255,0.06);
  --border: rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.12);
  --text-primary: #f1f5f9;
  --text-secondary: rgba(241,245,249,0.45);
  --text-tertiary: rgba(241,245,249,0.25);
  --accent: #10b981;
  --accent-2: #0ea5e9;
  --income: #34d399;
  --expense: #f87171;
  --font-display: inherit; /* Geist */
  --font-number: inherit;
}

/* Light override */
[data-theme="light"] {
  --bg-base: #f7f4f0;
  --bg-surface: #ffffff;
  --bg-surface-2: #ede9e3;
  --border: rgba(0,0,0,0.06);
  --border-strong: rgba(0,0,0,0.10);
  --text-primary: #1c1815;
  --text-secondary: #a89880;
  --text-tertiary: #c4b8a8;
  --accent: #4a4e8a;
  --accent-2: #6b70b8;
  --income: #2d7a4a;
  --expense: #c0392b;
  --font-display: 'Palatino Linotype', Palatino, Georgia, serif;
  --font-number: 'Palatino Linotype', Palatino, Georgia, serif;
}
```

---

## Component Changes

### ThemeToggle (new component)
- `src/components/ThemeToggle.tsx`
- Reads `localStorage.getItem('theme')` on mount, applies `data-theme` to `document.documentElement`
- Renders a sun icon (☀) in dark mode, moon icon (☾) in light mode
- On click: toggles theme, writes to `localStorage`, updates `data-theme`
- Must handle SSR: no `localStorage` access during server render (use `useEffect`)

### Layout (`src/app/[locale]/(protected)/layout.tsx`)
- Add `<ThemeToggle />` to mobile top bar (beside language switcher)
- Add `<ThemeToggle />` to desktop sidebar footer (below language switcher)

### GlassCard (`src/components/ui/GlassCard.tsx`)
- Replace hardcoded `rgba(255,255,255,0.035)` / `rgba(255,255,255,0.07)` values with `var(--bg-surface)` / `var(--border)`
- Suppress `backdrop-filter` in light theme via CSS: `[data-theme="light"] .backdrop-blur-md { backdrop-filter: none; -webkit-backdrop-filter: none; }` in `globals.css` — no component change needed
- `overflow-hidden` stays on GlassCard (needed for rounded corners + shimmer clipping); the AddTransactionModal already uses a plain div instead of GlassCard so it is unaffected

### GlassButton (`src/components/ui/GlassButton.tsx`)
- Primary variant: use `var(--accent)` as background
- Ghost variant: use `var(--bg-surface-2)` / `var(--border)`

### SummaryCards
- Replace accent color hardcodes with semantic tokens
- In light theme: use indigo for balance card instead of sky

### IncomeExpenseChart
- Bar fill: use `var(--income)` / `var(--expense)`
- Grid lines, axis tick colours: use `var(--border)` / `var(--text-tertiary)`
- Tooltip background: use `var(--bg-surface)`

### CategoryPieChart
- Keep existing colour palette (works on both themes)
- Legend text: use `var(--text-secondary)`

### TransactionTable
- Row hover: use `var(--bg-surface-2)`
- Amount colours: use `var(--income)` / `var(--expense)`

### AddTransactionModal
- Backdrop overlay: `bg-black/70` stays (works on both themes)
- Card background: `var(--bg-surface)` with `var(--border-strong)` border
- Input fields: `var(--bg-surface-2)` background, `var(--border)` border, `var(--text-primary)` text

### Login page
- Light theme: cream background, indigo button, no grain overlay

### globals.css
- Film grain `.grain` class: hide in light theme via `[data-theme="light"] .grain { display: none; }`
- All ambient radial gradients (emerald/sky glow): hide in light theme

---

## Page-by-Page Notes

### Dashboard
- Balance hero: white card on cream, Palatino `font-size: 32px` for balance amount
- Summary cards: white cards, coloured dots for labels, no glow effects
- Charts: stacked vertically on mobile (unchanged layout, new colours)
- Budget bars: indigo (healthy) / amber (near) / red (over)
- Top bar: greeting + name in Palatino, language toggle pill, avatar in indigo

### Transactions
- Filter section GlassCard: cream background, white inputs
- Transaction rows: white cards on cream container
- Inline edit form: inherits card styling

### Accounts / Categories
- Follow same card/token pattern as Dashboard

---

## What Does NOT Change

- Page structure, routing, data fetching — untouched
- Dark theme visual appearance — pixel-for-pixel identical to today
- Feature set — no new features added
- Animation system — `fadeSlideUp`, `scaleIn` keep working in both themes
- Font loading for dark theme — Geist unchanged

---

## Out of Scope

- Syncing theme preference to Supabase (can be added later)
- System `prefers-color-scheme` auto-detection (can be added later)
- Per-page theme overrides
