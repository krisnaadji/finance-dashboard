# 📊 Finance Bot — Dashboard

Web dashboard for the WhatsApp Finance Bot. View transactions, manage accounts, invite members, and generate WhatsApp setup codes. Built with Next.js 16 + Supabase.

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
        └── PostgreSQL (server admin client bypasses RLS)
```

> See [README-database.md](https://github.com/krisnaadji/finance-dashboard/blob/main/README-database.md) for full schema, table definitions, and ER diagram.

---

## Tech Stack

| Layer      | Tech                          | Notes                            |
|------------|-------------------------------|----------------------------------|
| Framework  | Next.js 16 (App Router)       | React Server + Client Components |
| Language   | TypeScript                    | Strict mode                      |
| Styling    | Tailwind CSS                  | Dark glass design system         |
| Auth       | Supabase Auth + Google OAuth  | `@supabase/ssr`                  |
| Database   | Supabase PostgreSQL           | Admin client in API routes — ownership enforced in app code |
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
      transactions/route.ts
      transactions/[id]/route.ts           # PATCH (any member), DELETE (owner only)
      summary/route.ts
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
    AddTransactionModal.tsx                # Manual transaction entry form

  lib/
    supabase-browser.ts                    # createBrowserClient (client components)
    supabase-server.ts                     # createAdminClient (API routes, service key)
    utils.ts                               # formatIDR, formatDate, startOfMonth, today

  i18n/
    request.ts                             # next-intl server config

messages/
  id.json                                  # Indonesian translations
  en.json                                  # English translations
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

For local development, point both public Supabase settings and the server service key at an isolated local Supabase project. Do not copy production keys into `.env.local`.

Optional category translation suggestions use server-only `AI_PROVIDER` (`groq` or `gemini`), `AI_API_KEY`, and optional `AI_MODEL`. Defaults are `openai/gpt-oss-120b` for Groq and `gemini-2.5-flash-lite` for Gemini. Never prefix these variables with `NEXT_PUBLIC_` or send them to the browser. The adapter uses fixed provider hosts, sends only the requested label and languages, makes one request with an eight-second timeout and a 128-token output cap, and never retries. Missing configuration disables suggestions, not category saves.

`POST /api/categories/translate` accepts exactly `{account_id,name,source,target}` and returns `{translation}`. Only the account owner can request a suggestion; authentication, the same-origin mutation check, a 4 KiB body limit, supported distinct languages (`id`/`en`), and a single-line 1-120-code-point label are checked before the provider call. The service-only `reserve_category_translation` RPC atomically reserves at most ten requests per user/account in sixty seconds. Quota denial returns `429`; unavailable configuration/storage returns `503`, provider failure returns `502`, and timeout returns `504`. No category is inserted by translation.

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

**Manual transaction entry** — `AddTransactionModal` is triggered from an "Add Transaction" button on both the Dashboard and Transactions pages. Writes go through `POST /api/transactions`, which uses `createAdminClient` and verifies the authenticated user owns or is a member of the target account server-side before inserting. Category dropdown filters by the selected transaction type (income vs expense). Available to both owners and members — anyone on an account can record a transaction.

---

## Known Limitations

| Feature                       | Status       | Notes                                               |
|-------------------------------|--------------|-----------------------------------------------------|
| Unlink WhatsApp from account  | ❌ Not built | Workaround: /setup with a code from another account |
| Edit/delete account from bot  | ❌ Not built | Use dashboard Accounts page instead                 |
| Edit/delete category from bot | ❌ Not built | Use dashboard Categories page instead               |
| Receipt / bill photo parsing  | ❌ Not built | Planned — Gemini Vision can handle this             |

## Financial input and offline checks

Financial writes accept positive amounts up to `9999999999999.99`, with at most two nonzero decimal places. Server input uses plain decimal notation without currency separators or exponents; storage input is a canonical decimal string. Malformed values are rejected instead of rounded or defaulted to zero.

Business dates use real calendar days in `YYYY-MM-DD` format, from 2000 through 2100. Invalid dates such as `2026-02-30` are rejected.

Run `npm test -- tests/financialValidation.test.ts tests/apiResponse.test.ts` for money/date and origin/content-type boundaries. Run `npm test`, `npm run test:typecheck`, `npm run build`, and `npm run lint` for integration checks. Tests use disposable state and do not authorize production database changes or deployment.

## Phase 1 security boundaries

API routes verify the user at request time and check access to the active account before using the admin client. `accounts.owner_id` defines ownership; a member row claiming an owner role does not grant administration rights. Owners do not need a redundant member row.

Transaction edits validate the resulting amount/type/category combination, write only supplied fields, and condition the update on the original financial snapshot. A stale or deleted record returns `409`. Inactive categories may remain on historical records but cannot be newly selected. Account and category removal deactivate them without deleting transaction history.

Numeric request amounts use the original JSON token for exact decimal validation. The server runtime must support `JSON.parse` reviver source context, exercised on Node 24.14.1. Decimal-string inputs also work; unsupported numeric decoding fails closed.

Local tests and anonymous API smoke checks are separate from the required disposable Supabase/Auth/PostgREST and actual gateway acceptance checks. Production migration and deployment are not part of local verification.

## Reports and CSV exports

Report totals cross the API boundary as exact decimal strings. Summary responses use `income`, `expense`, and `net`; root category totals include `id`, `name_id`, `name_en`, and `amount`, with per-stored-category amounts in `categoryDetails`. Budget spending is keyed by root IDs, so direct root transactions and child transactions count once against the same budget. Monthly and budget totals are also strings. Parse them with the money helpers instead of `Number`.

`GET /api/transactions` returns `{data,total,summary,page,pageSize,totalPages}`. The table, count, filtered summary, and CSV share normalized filters: `account_id`, `from`, `to`, `type`, `category_id`, `subcategory_id`, `category_scope`, `search`, and `locale`. A root `category_id` includes direct transactions and children; `category_scope=direct` excludes children; `subcategory_id` selects an exact child of that root. An existing link containing a child `category_id` alone remains an exact-ID filter. Invalid account/type/root/child combinations are rejected rather than shown as empty results. Search retains SQL `%` and `_` wildcard semantics.

`GET /api/transactions/export` checks current account membership and captures an immutable 15-minute snapshot before paging through it in batches of at most 500 rows. CSV columns are `Date,Description,Category,Subcategory,Type,Amount`; root and child labels are frozen in the requested `locale` (`id` by default), with fallback to the other available label. Direct-root and old frozen rows have an empty Subcategory cell. The route validates every row, quotes each CSV cell, and prefixes formula-like description and both category labels. Empty exports contain the header row. Exports above 99,999 rows or 32 MiB return an error without a downloadable partial file.

Unit tests cover filter parity, CSV escaping, authorization, missing pages, and export limits. PostgreSQL integration tests cover snapshot immutability and current membership. Running these tests does not verify a signed-in browser session; that requires an isolated Supabase Auth/PostgREST runtime.

## Bilingual category management

Category identity is an account-scoped UUID; labels are presentation, not identity. Responses project `id,account_id,code,name_id,name_en,parent_id,type,is_custom,is_active,sort_order`, without the former live `name` field. At least one label must be present; duplicate labels in different parents or types remain distinct. Hierarchies have only roots and one child level; salary uses stable code `salary` and cannot have children.

Category GET is available to account members, with `include_inactive=true` for historical labels. Owner-only POST accepts `account_id,name_id,name_en,parent_id,type`; PATCH accepts only `id` and supplied label fields, preserving an omitted translation; DELETE softly deactivates custom rows. Defaults cannot be renamed or deleted. Budget writes are owner-only and accept active expense roots, never children.

New transaction selections reject inactive categories and inactive parents. Edits preserve an unchanged historical category ID even if inactive, retain optimistic before-snapshot matching, and return `409` on a concurrent correction. Transaction rows include `categories` and `parent` metadata for localized paths. A successful write whose subsequent category lookup fails stays successful with `categoryProjectionError: 'dependency_unavailable'`; the saved `category_id` is retained and the UI can request a refresh instead of resubmitting the transaction. POST also reports `budgetWarningError` and skips the unavailable root warning lookup. Successful budget warnings include bilingual root `category` metadata.

Local verification on 2026-10-17 passed 430 unit tests, TypeScript, lint (one existing unused `isOwner` warning), and a production build using generated local Supabase settings. Authenticated owner/member/outsider requests against actual local GoTrue/PostgREST verified authorization, matching bilingual table/summary/CSV totals (overall 1000, parent 600, direct 100, child 200), root-only budgets, inactive historical edits, SQL-null descriptions, salary/bonus boundaries, and translation throttling. Browser checks covered language/account continuity, keyboard chart drilldown and save, nonblocking translation failure, and a 390-pixel phone layout without horizontal overflow. Actual provider translation/classification quality was not evaluated; no non-production provider credentials were authorized.
