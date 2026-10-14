# 🗄️ Finance Bot — Database

Shared Supabase PostgreSQL database used by both the bot backend and the dashboard.

---

## Tables

### `accounts`
Represents a finance account — either personal (DM) or group (group chat).

| Column       | Type         | Notes                          |
|--------------|--------------|--------------------------------|
| id           | uuid PK      |                                |
| name         | text         | e.g. "Personal", "Keluarga"    |
| type         | text         | `'personal'` \| `'group'`      |
| wa_chat_id   | text UNIQUE  | Linked WhatsApp phone or group |
| owner_id     | uuid         | → `auth.users`                 |
| language     | text         | Default bot reply language     |
| is_active    | boolean      | Soft delete flag               |
| created_at   | timestamptz  |                                |

---

### `members`
Links Google or WhatsApp users to accounts. Ownership comes from `accounts.owner_id`; an owner can access an account without a member row, and a member's `role` value does not grant ownership.

| Column        | Type        | Notes                                      |
|---------------|-------------|--------------------------------------------|
| id            | uuid PK     |                                            |
| account_id    | uuid        | → `accounts`                               |
| user_id       | uuid        | → `auth.users` (null for WA-only members)  |
| wa_phone      | text        | Set on `/setup`, used for attribution      |
| role          | text        | `'owner'` \| `'member'`                    |
| display_name  | text        | User-set name shown on transactions        |
| language_pref | text        | Overrides account language if set          |
| created_at    | timestamptz |                                            |

---

### `categories`
Income and expense categories per account. Default categories are seeded on account creation.

| Column     | Type        | Notes                              |
|------------|-------------|------------------------------------|
| id         | uuid PK     |                                    |
| account_id | uuid        | → `accounts`                       |
| name       | text        |                                    |
| type       | text        | `'income'` \| `'expense'`          |
| is_custom  | boolean     | False = default, True = user-added |
| is_active  | boolean     | Soft delete flag                   |
| sort_order | int         |                                    |
| created_at | timestamptz |                                    |

---

### `transactions`
Every financial transaction recorded via WhatsApp or the dashboard.

| Column              | Type          | Notes                                   |
|---------------------|---------------|-----------------------------------------|
| id                  | uuid PK       |                                         |
| account_id          | uuid          | → `accounts`                            |
| category_id         | uuid          | → `categories`                          |
| amount              | numeric(15,2) |                                         |
| type                | text          | `'income'` \| `'expense'`               |
| description         | text          |                                         |
| date                | date          |                                         |
| raw_message         | text          | Original WhatsApp message               |
| wa_user_message_id  | text          | For deduplication                       |
| wa_bot_message_id   | text          | For reply-to-edit lookup                |
| recorded_by_name    | text          | Display name of WA sender               |
| recorded_by_phone   | text          | WA phone of sender                      |
| edited_by_name      | text          | Display name of last dashboard editor   |
| created_at          | timestamptz   |                                         |
| updated_at          | timestamptz   |                                         |

---

### `pending_actions`
Temporary records for delete confirmations. Expires after 60 seconds.

| Column         | Type        | Notes                  |
|----------------|-------------|------------------------|
| id             | uuid PK     | Fresh UUID for each confirmation request |
| account_id     | uuid        | → `accounts`           |
| transaction_id | uuid        | → `transactions`       |
| action         | text        | `'DELETE'` \| `'EDIT'` |
| expires_at     | timestamptz | 60 second TTL          |
| requested_by_phone | text | Requester binding added by Phase 1 migration |
| wa_chat_id | text | Chat binding added by Phase 1 migration |
| confirmation_message_id | text | Delivered prompt identity added by Phase 1 migration |
| created_at     | timestamptz |                        |

---

### `link_codes`
One-time codes for linking a WhatsApp chat to an account via `/setup CODE`.

| Column     | Type        | Notes            |
|------------|-------------|------------------|
| id         | uuid PK     |                  |
| account_id | uuid        | → `accounts`     |
| code       | text UNIQUE | Randomized code with account prefix |
| used       | boolean     |                  |
| expires_at | timestamptz | 15 minute TTL    |
| created_at | timestamptz |                  |

---

### `invite_tokens`
One-time tokens for inviting a Google account to access a group account dashboard.

| Column     | Type        | Notes                             |
|------------|-------------|-----------------------------------|
| id         | uuid PK     |                                   |
| account_id | uuid        | → `accounts`                      |
| token      | text UNIQUE | UUID token used in invite URL     |
| used       | boolean     |                                   |
| expires_at | timestamptz | 24 hour TTL                       |
| created_at | timestamptz |                                   |

---

### `account_creation_operations`
Idempotency records for account creation. The owner and operation UUID identify a retry; the normalized name, type, and display name must match the original request.

| Column       | Type        | Notes                                  |
|--------------|-------------|----------------------------------------|
| owner_id     | uuid        | → `auth.users`                         |
| operation_id | uuid        | Client-generated retry key             |
| payload      | jsonb       | Normalized request values              |
| account_id   | uuid        | → `accounts`                           |
| created_at   | timestamptz |                                        |
---

### `invite_redemptions`
Records the user who redeemed each invite token. A retry by that user returns the original account; a different user cannot reuse the token.

| Column      | Type        | Notes                       |
|-------------|-------------|-----------------------------|
| token_id    | uuid PK     | → `invite_tokens`           |
| user_id     | uuid        | → `auth.users`              |
| member_id   | uuid        | → `members`                 |
| redeemed_at | timestamptz |                             |
---

Migration `202610130004_atomic_account_operations.sql` adds these tables and RPCs. Apply it before releasing the matching dashboard routes. Account creation inserts the account, owner membership, default categories, and retry record in one transaction. Link-code replacement inserts the new code before retiring prior unused codes. Invite redemption creates membership, records the recipient, and consumes the token atomically.

## Phase 2 bot persistence and recovery

The bot records each provider message in `bot_inbox`, keyed by gateway and provider message ID. `bot_chat_claims` serializes processing by chat. A lease fence prevents an expired worker from saving or committing work after a newer worker takes ownership.

`bot_batches` and `bot_batch_items` keep the original receipt and item numbers. Deleting a transaction clears its item reference while preserving the number. `bot_receipt_ids` maps accepted provider replies to their batch. `bot_legacy_receipt_items` holds verified mappings for receipts created before Phase 2.

`bot_outbound` stores each frozen reply and delivery state: `pending`, `sending`, `accepted`, `rejected`, `uncertain`, or `resolved`. A timeout or interrupted send stays `uncertain` until an operator resolves it. `bot_delivery_audit` records recovery actions. `bot_help_context` stores short-lived reply context for help messages.

The bot tables use row-level security and grant direct table access only to `service_role`. RPC execution is also restricted to `service_role`. Apply migrations `202610130001` through `202610130006` only after checking each migration's schema preflight. Local tests use synthetic PostgreSQL fixtures and do not prove production compatibility or authorize deployment.

The minute scheduler claims due inbox and outbound work and removes expired export snapshots. Outbound sends are retried only when the provider response identifies a definite retryable rejection. Unknown outcomes stay held to avoid duplicate messages. Operators can inspect or resolve them with `npm run recover:delivery -- <action> <outbound-uuid> [argument]`; see the bot README for the accepted actions.

## Exact reports and CSV exports

`finance_summary` returns `income`, `expense`, and `net` as decimal strings. It also returns category totals keyed by category ID, monthly totals, and the five largest income and expense transactions. `finance_budget_spending` returns expense totals keyed by category ID. Consumers must parse these strings with the exact money helpers, not JavaScript `Number`.

`finance_export_snapshots` stores the requesting user, account, filters, row count, and a 15-minute expiry. `finance_export_rows` stores the ordered transaction values, including the category label and exact amount. The export RPCs verify current account membership when creating and reading a snapshot. Pages are limited to 500 rows. The dashboard rejects incomplete results and formula-like user text before returning a CSV. Snapshot tables are inaccessible to `public`, `anon`, and `authenticated`; only the service role can execute the export and cleanup RPCs.

Use the isolated database suites documented in the bot README for PostgreSQL verification. The Phase 1 delete-confirmation suite requires a separately named `finance_phase1_test` database. Phase 2 suites require a loopback database named with the `finance_phase2_test` prefix. Never point either suite at the application database.

---

## Account entity relationship diagram

```
auth.users
    │
    ├─────────────────────────────────────┐
    │ (owner_id)                          │ (user_id)
    ▼                                     ▼
accounts ──────────────────────────── members
    │
    ├──► categories
    │       (account_id)
    │
    ├──► transactions
    │       (account_id)
    │       (category_id) ──────────► categories
    │
    ├──► pending_actions
    │       (account_id)
    │       (transaction_id) ───────► transactions
    │
    ├──► link_codes
    │       (account_id)
    ├──► invite_tokens
    │       (account_id)
    ├──► account_creation_operations
    │       (owner_id, account_id)
    └──► invite_redemptions
            (token_id, user_id, member_id)

---

## Row Level Security

Both the bot backend and dashboard API routes use the service-role key, which bypasses RLS. Dashboard routes verify the authenticated user and active-account access independently. Administrative operations require `accounts.owner_id`; member roles are not ownership authority.

The policy matrix below was checked against the production catalog on 2026-10-13. Reinspect policies before a user-scoped database client cutover; the current application uses the service-role client.

Inspected policy matrix:

| Table           | SELECT policy                                             | Write policies |
|-----------------|-----------------------------------------------------------|----------------|
| accounts        | `owner_id = auth.uid()` OR member of `id`                 | — (service role only) |
| categories      | account owner OR member                                   | — (service role only) |
| transactions    | account owner OR member                                   | — (service role only) |
| members         | `user_id = auth.uid()`                                    | — (service role only) |
| budgets         | account owner (ALL — read + write)                        | — (owner, ALL) |
| invite_tokens   | account owner (ALL — read + write)                        | — (owner, ALL) |
| pending_actions | none — bot-only (service role)                            | — |
| link_codes      | none — bot-only (service role)                            | — |
The Phase 2 migration enables RLS on `account_creation_operations` and `invite_redemptions`, with access limited to `service_role`.

Production has the `members_select` policy with `user_id = auth.uid()`. No policy change was needed during the catalog inspection.

Service-role access does not exercise these policies. Application authorization tests cannot prove deployed RLS behavior.

## Phase 1 migration gate

The bot repository contains `scripts/inspect-phase1-catalog.sql` and the expand/enforce delete-confirmation migrations. They check the existing foreign key and requester-binding constraints before changing the pending-action schema. The enforcement migration removes unbound legacy delete prompts, not financial transactions or unrelated edit actions.

`consume_delete_confirmation` locks the account, pending request, and target, checks expiry using the database clock after lock waits, and consumes the prompt with the deletion in one transaction. Execution is restricted to the service role. The handler calls this RPC when delete confirmations are enabled; a plain `ya` or `tidak` from the original sender and chat is accepted without requiring a direct reply to the prompt. Confirmation prompts remain bounded by their original 60-second expiry.


Mutation origin checks use the inbound `Host` header with the request scheme. Next.js can normalize a loopback request URL to `localhost`, which must not change whether the browser's actual origin is accepted.