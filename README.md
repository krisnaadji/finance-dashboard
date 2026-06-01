# 📊 Finance Bot — Dashboard

Web dashboard for the WhatsApp Finance Bot. View transactions, manage accounts, invite members, configure budgets, and generate WhatsApp setup codes. Built with Next.js 16 + React 19 + Supabase.

---

## Preview

```
+--------------------------------------------------+
| F  FinanceBot             [Keluarga v]           |
+--------------------------------------------------+
| [Dashboard]   +---------------+---------------+  |
| [Transactions]| TOTAL INCOME  | TOTAL EXPENSE |  |
| [Accounts]    | Rp5.000.000   | Rp350.000     |  |
| [Categories]  +---------------+---------------+  |
|               |  ### Income vs Expense        |  |
| ----------    +-------------------------------+  |
| ID  EN        | Kebutuhan      Transport      |  |
| Sign out      +-------------------------------+  |
+--------------------------------------------------+
```

---

## Architecture

```
Browser
  │
  ├── Next.js App Router (src/app/)
  │     ├── [locale]/                          # next-intl locale routing
  │     │     ├── layout.tsx                   # NextIntlClientProvider
  │     │     ├── page.tsx                     # Auth check → redirect
  │     │     ├── login/page.tsx               # Google OAuth + How it works
  │     │     ├── invite/[token]/page.tsx      # Member invite redemption
  │     │     └── (protected)/                # Auth-gated pages
  │     │           ├── layout.tsx             # Sidebar + nav + auth check
  │     │           ├── dashboard/             # Summary cards + charts
  │     │           ├── transactions/          # Transaction list + inline edit
  │     │           ├── accounts/              # Account management + member list
  │     │           └── categories/            # Category management
  │     │
  │     └── api/                               # Server-side API routes
  │           ├── auth/callback/               # Supabase OAuth callback (?next= support)
  │           ├── me/                          # GET current user display name
  │           ├── accounts/                    # GET, POST, PATCH, DELETE
  │           ├── accounts/[id]/link-code/     # Generate /setup code
  │           ├── accounts/[id]/invite/        # Generate member invite link
  │           ├── accounts/[id]/members/       # GET member list
  │           ├── transactions/                # GET, POST
  │           ├── transactions/[id]/           # PATCH (members), DELETE (owner only)
  │           ├── summary/                     # Income/expense totals
  │           ├── categories/                  # GET, POST, PATCH, DELETE
  │           └── members/display-name/        # PATCH display name
  │
  └── Supabase
        ├── Auth (Google OAuth)
        └── PostgreSQL (RLS enforced)
```

> See [README-database.md](https://github.com/krisnaadji/finance-dashboard/blob/main/README-database.md) for full schema, table definitions, and ER diagram.

The diagram above is a high-level overview. Current local API routes also include budgets, invite token redemption, reporting period resolution, and summary trend endpoints. Supabase RLS is enabled, but server-side API routes use the service-role key and must enforce account access in application code.

---

## Tech Stack

| Layer      | Tech                          | Notes                            |
|------------|-------------------------------|----------------------------------|
| Framework  | Next.js 16.2.2 (App Router)   | React Server + Client Components |
| React      | React 19.2.4                  | Client and Server Components     |
| Language   | TypeScript 5                  | Strict mode                      |
| Styling    | Tailwind CSS                  | Dark glass design system         |
| Auth       | Supabase Auth + Google OAuth  | `@supabase/ssr`                  |
| Database   | Supabase PostgreSQL           | Admin client in API routes; RLS in database |
| Charts     | Recharts                      | BarChart + PieChart              |
| i18n       | next-intl                     | Indonesian + English             |
| Linting    | ESLint v9 + Prettier          | `eslint.config.mjs` (ESM)        |
| Deployment | Vercel                        | Auto-deploy on push              |

---

## Project Structure

```
src/
  app/
    layout.tsx                              # Root layout (html + body)
    globals.css
    [locale]/
      layout.tsx                            # NextIntlClientProvider
      page.tsx                              # Auth → redirect to /dashboard or /login
      login/
        page.tsx                            # Google sign-in + How it works
      invite/[token]/
        page.tsx                            # Invite link redemption page
      (protected)/                          # Route group — requires auth
        layout.tsx                          # Sidebar navigation + auth check
        dashboard/page.tsx                  # Summary cards + charts
        transactions/page.tsx               # Transaction table + inline edit
        accounts/page.tsx                   # Account + member management
        categories/page.tsx                 # Category list + add/edit/delete
    api/
      auth/callback/route.ts               # Handles ?next= redirect after OAuth
      me/route.ts                          # Returns saved display name or Google name
      accounts/route.ts                    # GET (with role), POST, PATCH, DELETE
      accounts/[id]/link-code/route.ts
      accounts/[id]/invite/route.ts        # Generate one-time invite link
      accounts/[id]/members/route.ts       # List members with Google name fallback
      budgets/route.ts                     # GET, POST, DELETE category budgets
      invite/[token]/route.ts              # Invite validation/redeem
      transactions/route.ts
      transactions/[id]/route.ts           # PATCH (any member), DELETE (owner only)
      summary/route.ts
      summary/trend/route.ts               # 12-month trend data
      period/route.ts                      # Reporting period resolver
      categories/route.ts                  # GET, POST, PATCH, DELETE
      members/display-name/route.ts        # Update display name across all accounts

  components/
    AccountSwitcher.tsx                    # Dropdown + useAccountId/Role/Type hooks
    NavLink.tsx                            # Active-aware sidebar link
    LanguageSwitcher.tsx                   # ID / EN toggle
    SignOutButton.tsx
    SummaryCards.tsx
    IncomeExpenseChart.tsx                 # Recharts BarChart
    CategoryPieChart.tsx                   # Recharts PieChart with legend
    TransactionTable.tsx                   # Card (mobile) + table (desktop) + inline edit
    LinkCodeModal.tsx                      # /setup CODE generator
    AddTransactionModal.tsx                # Manual dashboard transaction form
    PeriodControl.tsx                      # Reporting period selector
    ui/                                    # Glass UI primitives

  lib/
    reporting-period.ts                    # Shared reporting period helpers
    supabase-browser.ts                    # createBrowserClient (client components)
    supabase-server.ts                     # createAdminClient (API routes, service key)
    utils.ts                               # formatIDR, formatDate, startOfMonth, today

  i18n/
    request.ts                             # next-intl server config

messages/
  id.json                                  # Indonesian translations
  en.json                                  # English translations
```

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

> **Security note:** `SUPABASE_SERVICE_KEY` bypasses Row Level Security. Only use it in trusted server code such as API routes (`src/app/api/`), never in client components. Account-scoped API routes must still enforce membership/owner checks in application code.

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Run the SQL from the implementation guide (Phase 1)
3. Enable Google OAuth: Authentication → Providers → Google
4. Copy keys from Project Settings → API into `.env.local`

### 3. Configure Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Credentials → Create OAuth Client
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
2. Create an account on the Accounts page (e.g. "Personal")
3. Click **Generate Code** → copy the code (e.g. `PERSONAL-X7K2`)
4. Send `/setup PERSONAL-X7K2` to your bot on WhatsApp
5. Transactions recorded in WhatsApp now appear in the dashboard

---

## Scripts

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint check
npm run lint:fix   # ESLint auto-fix
npm run format     # Prettier format
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Add all `.env.local` variables in Vercel Environment Variables
4. Deploy

**After deploying — critical steps:**

```
Supabase → Authentication → URL Configuration
  Site URL:      https://your-app.vercel.app   ← must update or login redirects to localhost
  Redirect URLs: https://your-app.vercel.app/**

Google Cloud Console → OAuth credentials → Edit
  Authorized JavaScript origins: https://your-app.vercel.app
  Authorized redirect URIs:      https://YOUR-PROJECT.supabase.co/auth/v1/callback
```

---

## Member Invite Flow

For group accounts, owners can invite other Google accounts to access the dashboard:

```
Owner (Dashboard)               Invitee
        │                           │
        │  1. Click "Invite Member" │
        │  2. Copy invite link      │
        │     (expires 24h, 1-use)  │
        │                           │
        │       3. Share link ─────►│
        │                           │  4. Click link
        │                           │  5. Sign in with Google
        │                           │  6. Automatically joined
        │◄──────────────────────────│
        │  7. Appears in            │
        │     member list           │
```

Members can view all transactions and record/edit their own via WhatsApp. Only the account owner can delete transactions or manage the account from the dashboard.

---

## Key Design Decisions

**Account state without URL params** — `AccountSwitcher` uses module-level variables (`_accountId`, `_accountRole`, `_accountType`) shared across components via a subscriber pattern. No URL params, no localStorage hydration issues, no re-render loops.

```typescript
import { useAccountId, useAccountRole, useAccountType } from '@/components/AccountSwitcher';
const accountId   = useAccountId();    // reactive — re-renders when account changes
const accountRole = useAccountRole();  // 'owner' | 'member'
const accountType = useAccountType();  // 'personal' | 'group'
```

**Role-based UI** — edit/delete buttons in `TransactionTable`, category controls, and account management buttons all check role. The `isGroup` flag controls whether "by Name" attribution is shown on transactions.

**Per-card role check** — the Accounts page checks `acc.role` per account card (not the global `accountRole`) so a user who owns some accounts and is a member of others sees the correct controls for each.

**Two layouts** — locale layout only wraps with NextIntl. Auth check + nav lives in `(protected)/layout.tsx`. This prevents redirect loops that occur when a single layout tries to both detect locale and check auth simultaneously.

**i18n** — `localePrefix: 'as-needed'` means Indonesian (default) has no prefix (`/dashboard`), English gets `/en/dashboard`. Language switching uses `window.location.assign()` for a full navigation so `next-intl` middleware correctly detects the new locale.

**Transaction list** — responsive: card view on mobile (description + amount + edit/delete + attribution), full table on desktop. Inline edit supports description, amount, date, type, and category.

---

## Known Limitations

> Current dashboard API behavior is implemented with local Next.js route handlers. A separate external dashboard API is not built yet.

| Feature                       | Status       | Notes                                               |
|-------------------------------|--------------|-----------------------------------------------------|
| Unlink WhatsApp from account  | ❌ Not built | Workaround: /setup with a code from another account |
| Edit/delete account from bot  | ❌ Not built | Use dashboard Accounts page instead                 |
| Edit/delete category from bot | ❌ Not built | Use dashboard Categories page instead               |
| Receipt / bill photo parsing  | ❌ Not built | Planned — Gemini Vision can handle this             |
