# 📊 Finance Bot — Dashboard

Web dashboard for the WhatsApp Finance Bot. View transactions, manage accounts, and generate WhatsApp setup codes. Built with Next.js 15 + Supabase.

---

## Preview

```
┌─────────────────────────────────────────────────────┐
│  F  FinanceBot        [Tabungan ▾]                  │
│─────────────────────────────────────────────────────│
│  ▦  Dashboard    ┌──────────────┬──────────────┐    │
│  ↕  Transactions │ TOTAL INCOME │ TOTAL EXPENSE│    │
│  ◎  Accounts     │ Rp5.000.000  │ Rp350.000    │    │
│  ⊞  Categories   ├──────────────┴──────────────┤    │
│                  │  ████ Income vs Expense      │    │
│                  │  ████████                    │    │
│  ─────────────   └────────────────────────────  │    │
│  ID  EN          │  🍕 Kebutuhan  🚗 Transport  │    │
│  ⎋ Sign out      └─────────────────────────────-┘    │
└─────────────────────────────────────────────────────┘
```

---

## Architecture

```
Browser
  │
  ├── Next.js App Router (src/app/)
  │     ├── [locale]/                    # next-intl locale routing
  │     │     ├── layout.tsx             # NextIntlClientProvider
  │     │     ├── page.tsx               # Auth check → redirect
  │     │     ├── login/page.tsx         # Google OAuth
  │     │     └── (protected)/          # Auth-gated pages
  │     │           ├── layout.tsx       # Sidebar + nav
  │     │           ├── dashboard/       # Summary + charts
  │     │           ├── transactions/    # Transaction list
  │     │           ├── accounts/        # Account management
  │     │           └── categories/      # Category management
  │     │
  │     └── api/                         # Server-side API routes
  │           ├── auth/callback/         # Supabase OAuth callback
  │           ├── accounts/              # GET, POST
  │           ├── accounts/[id]/link-code/  # Generate /setup code
  │           ├── transactions/          # GET, POST
  │           ├── transactions/[id]/     # PATCH, DELETE
  │           ├── summary/               # Income/expense totals
  │           └── categories/            # GET, POST
  │
  └── Supabase
        ├── Auth (Google OAuth)
        └── PostgreSQL (RLS enforced)
```

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | React Server + Client Components |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | Dark glass design system |
| Auth | Supabase Auth + Google OAuth | `@supabase/ssr` |
| Database | Supabase PostgreSQL | RLS via anon key |
| Charts | Recharts | BarChart + PieChart |
| i18n | next-intl | Indonesian + English |
| Linting | ESLint v9 + Prettier | `eslint.config.mjs` (ESM) |
| Deployment | Vercel | Auto-deploy on push |

---

## Project Structure

```
src/
  app/
    layout.tsx                    # Root layout (html + body)
    globals.css
    [locale]/
      layout.tsx                  # NextIntlClientProvider
      page.tsx                    # Auth → redirect to /dashboard or /login
      login/
        page.tsx                  # Google sign-in + How it works
      (protected)/                # Route group — requires auth
        layout.tsx                # Sidebar navigation + auth check
        dashboard/page.tsx        # Summary cards + charts
        transactions/page.tsx     # Transaction table + filters
        accounts/page.tsx         # Account list + link code generator
        categories/page.tsx       # Category list + add custom
    api/
      auth/callback/route.ts
      accounts/route.ts
      accounts/[id]/link-code/route.ts
      transactions/route.ts
      transactions/[id]/route.ts
      summary/route.ts
      categories/route.ts

  components/
    AccountSwitcher.tsx           # Account dropdown + useAccountId() hook
    NavLink.tsx                   # Active-aware sidebar link
    LanguageSwitcher.tsx          # ID / EN toggle with cookie persistence
    SignOutButton.tsx
    SummaryCards.tsx
    IncomeExpenseChart.tsx        # Recharts BarChart
    CategoryPieChart.tsx          # Recharts PieChart
    TransactionTable.tsx
    LinkCodeModal.tsx             # /setup CODE generator

  lib/
    supabase-browser.ts           # createBrowserClient (client components)
    supabase-server.ts            # createAdminClient (API routes, service key)
    utils.ts                      # formatIDR, formatDate, startOfMonth, today

  i18n/
    request.ts                    # next-intl server config

messages/
  id.json                         # Indonesian translations
  en.json                         # English translations
```

---

## Environment Variables

Create `.env.local` in the project root:

```env
# Supabase — get from Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...    # anon key — safe to expose, RLS enforced
SUPABASE_SERVICE_KEY=eyJ...             # service_role — server only, never expose

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000   # change to Vercel URL after deploy
```

> **Security note:** `SUPABASE_SERVICE_KEY` bypasses Row Level Security. Only use it in API routes (`src/app/api/`), never in client components.

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run the SQL migrations from the implementation guide (Phase 1)
3. Enable Google OAuth: Authentication → Providers → Google
4. Copy keys from Project Settings → API into `.env.local`

### 3. Configure Google OAuth

1. [console.cloud.google.com](https://console.cloud.google.com) → Credentials → Create OAuth Client
2. Authorized JavaScript origins: `http://localhost:3000`
3. Authorized redirect URIs: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
4. Paste Client ID + Secret into Supabase → Authentication → Providers → Google

### 4. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

### 5. Connect to the bot

1. Sign in with Google
2. Create an account on the Accounts page
3. Click **Generate Code** → copy the code (e.g. `TABUNGAN-X7K2`)
4. Send `/setup TABUNGAN-X7K2` to your bot on WhatsApp
5. Transactions recorded in WhatsApp now appear in the dashboard

---

## Scripts

```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint check
npm run lint:fix  # ESLint auto-fix
npm run format    # Prettier format
```

---

## Deployment (Vercel)

1. Push to GitHub
2. [vercel.com](https://vercel.com) → New Project → Import repo
3. Add all `.env.local` variables in Vercel Environment Variables
4. Deploy

**After deploying — critical steps:**

```
Supabase → Authentication → URL Configuration
  Site URL:      https://your-app.vercel.app        ← must update or login redirects to localhost
  Redirect URLs: https://your-app.vercel.app/**

Google Cloud Console → OAuth credentials → Edit
  Authorized JavaScript origins: https://your-app.vercel.app
```

---

## Key Design Decisions

**Account state without URL params** — `AccountSwitcher` uses a module-level variable (`_accountId`) shared across components via a subscriber pattern. No URL params, no localStorage issues, no re-render loops.

```typescript
// In any page:
import { useAccountId } from '@/components/AccountSwitcher';
const accountId = useAccountId(); // reactive — re-renders when account changes
```

**Two layouts** — locale layout only wraps with NextIntl. Auth check + nav lives in `(protected)/layout.tsx`. This prevents redirect loops that happen when a single layout tries to both detect locale and check auth.

**i18n** — `localePrefix: 'as-needed'` means Indonesian (default) has no prefix (`/dashboard`), English gets `/en/dashboard`. Language preference stored in `NEXT_LOCALE` cookie with `SameSite=Lax; Secure` for production.