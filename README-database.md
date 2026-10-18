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
Income and expense categories per account. Default categories are seeded on account creation. UUIDs identify categories; labels never identify financial rows.

| Column     | Type        | Notes                              |
|------------|-------------|------------------------------------|
| id         | uuid PK     |                                    |
| account_id | uuid        | → `accounts`                       |
| code       | text nullable | Stable account-scoped default identity, including `salary`; null for custom categories |
| name_id    | text nullable | Indonesian label |
| name_en    | text nullable | English label; at least one label must be nonblank |
| parent_id  | uuid nullable | Same-account/type root; at most two levels, `ON DELETE RESTRICT` |
| type       | text        | `'income'` \| `'expense'`          |
| is_custom  | boolean     | False = default, True = user-added |
| is_active  | boolean     | Soft delete flag                   |
| sort_order | int         |                                    |
| created_at | timestamptz |                                    |

Account, type, parent, code, and custom/default identity are immutable. Active siblings cannot share a normalized nonblank label in either language; repeated labels under different parents or transaction types remain distinct. Account-row locking serializes graph changes, duplicate checks, transaction eligibility, and budget writes. New selections require an active category and, for children, an active parent. Deactivation retains historical references and labels. Description-only corrections retain unchanged inactive or legacy references.

`salary` is an income root without children. Bonus is separate and never starts a salary period. Salary boundaries retain the earliest marker in the selected month and latest marker in the following month minus one day; without a following marker the end is today's Asia/Jakarta date. Monthly calendar reports remain the default, and budgets remain monthly.

Budgets accept only active expense roots. A root budget includes direct spending and child spending once. The original Kebutuhan Pokok UUID, transactions, and budget remain separate from the new Food & Drinks and Household roots; migration does not split historical records or distribute budgets.

After the final migration there is no live `categories.name` column. `categoryName` inside an immutable bot reply snapshot remains a historical presentation string, not a schema alias.

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

`finance_summary(uuid,date,date)` returns `income`, `expense`, and `net` as decimal strings. Expense category totals carry root IDs and bilingual `name_id`/`name_en` labels. `spendingByCategoryId` and `finance_budget_spending(uuid,date,date)` are keyed by root IDs. `categoryDetails` records the root ID, actual stored category ID, and exact amount, including direct-root transactions. Uncategorized or incompatible legacy references retain their amounts without leaking foreign labels. Consumers must use exact money helpers, not JavaScript `Number`.

`finance_transaction_view(uuid,jsonb,integer,integer)` returns `{rows,total,summary}` over a single materialized selection. Rows contain explicit bilingual category and parent metadata and exact decimal-string amounts. The same validated SQL predicate drives table rows, total count, complete filtered summary, and export. Parent filters include all children by default; `subcategoryId` selects one child, and `categoryScope: "direct"` selects direct-parent rows only. Existing exact-child saved links remain exact-ID filters. Foreign/type-mismatched categories, incompatible root/child pairs, invalid dates/locales, and inactive accounts are rejected. Query strings use `category_id`, `subcategory_id`, and `category_scope`; normalized RPC filters use camel-case names. Search retains its SQL wildcard semantics.

`finance_export_snapshots` stores the requesting user, account, normalized filters, format version, row count, and a 15-minute expiry. `finance_export_rows` freezes the ordered transaction values and exact amounts. CSV columns are Date, Description, Category, Subcategory, Type, Amount. Category is the root label in the explicitly requested `id` or `en` locale, falling back to the other label; direct-root rows have blank Subcategory. Both labels and description receive CSV quoting and formula neutralization. Changing live labels or transactions does not change existing snapshot pages. Old snapshots retain their frozen category strings and receive blank subcategory values, without reinterpretation.

Export RPCs recheck current account membership on creation and every read. Pages contain at most 500 rows, with contiguous ordinals. Creation rejects more than 99,999 rows or a conservative UTF-8 CSV estimate above 33,554,432 bytes without creating a partial snapshot. Snapshot tables are inaccessible to `public`, `anon`, and `authenticated`; only the service role can execute export and cleanup RPCs.

Use the isolated database suites documented in the bot README for PostgreSQL verification. The Phase 1 delete-confirmation suite requires a separately named `finance_phase1_test` database. Phase 2 suites require a loopback database named with the `finance_phase2_test` prefix. Never point either suite at the application database.

### Phase 3 migration and rollout boundaries

The bot's append-only `202610150001` through `202610150006` migrations expand identity, update operations/quota, replace reporting, extend exports, activate the full catalog, and finally contract the old name contract. Each migration is transactional with a five-second lock timeout and prerequisite checks. Earlier Phase 1/2 migrations remain unchanged.

Before any separately authorized production rollout, run the read-only `scripts/inspect-phase3-catalog.sql` with the operator's approved database connection. Inspect actual category/default provenance, exact old default/type/label tuples, `seed_categories`, triggers, grants, and all dependencies. The Phase 2 test seeder is synthetic and is not evidence for production catalog mappings. Exact known default tuples are mapped without replacing UUIDs; unmatched rows are preserved, not guessed into codes. Ambiguous tuples, sibling collisions, or catalog identity conflicts stop the migration and need an explicit reviewed mapping. Preserve a verified backup and comparison of category IDs, transaction references, flags, and budget IDs/amounts.

Apply 001-004 before clients depend on hierarchy. The temporary command adapter accepts persisted old `{name,type}` add-category commands without rewriting their stored JSON or already-frozen replies. Drain those commands using the compatible worker before deploying the final worker decoder, which accepts only `{kind,accountId,type,nameId,nameEn,parentId}`. Activate 005 only after both clients are ready. Repeated `seed_categories` calls preserve existing UUIDs, labels, ordering, custom edits, and inactive flags, and add only missing catalog identities.

Before 006, stop old writers, finish all unfinished old-form add-category commands, and finish old-format export snapshots or let their 15-minute TTL expire. Existing cleanup removes expired snapshots. The final preflight checks catalog completeness, unfinished commands, unexpired old exports, catalog-tracked dependencies, and textual live SQL name consumers. It aborts rather than cascading dependencies or rewriting historical content. It removes the temporary command adapter/name bridge, drops `categories.name` without `CASCADE`, and notifies PostgREST to reload its schema cache. A missing or duplicated compatibility-removal statement in the commit function also blocks contraction and requires review; unrelated reviewed commit behavior is retained.

Rollback must retain post-migration financial writes and bilingual/hierarchy data. Prefer a compatible forward repair or a previous hierarchy-aware release; do not roll an old single-name client onto the contracted schema. Never delete new transactions, flatten child IDs, or restore an old database snapshot over newer writes. Production rollout, credentials, deployments, messages/webhooks, and destructive financial tests require separate specific authorization and are not part of local implementation.

### Translation quota

`category_translation_quotas` contains one row per `user_id/account_id` with a window timestamp and request count. Both foreign keys clean up on deletion. RLS and grants restrict access to the service role. `reserve_category_translation(uuid,uuid)` checks active-account ownership and atomically reserves at most ten requests per sixty-second window. Members, nonowners, and inactive accounts receive no reservation. A denied reservation must not call an AI provider.

The dashboard suggestion endpoint uses server-only `AI_PROVIDER`, `AI_MODEL`, and `AI_API_KEY`, fixed provider hosts, an eight-second timeout, a 120-codepoint input limit, a 4 KiB request limit, and at most 128 output tokens without retries. Missing configuration or provider failure does not prevent saving the original category label. Saving categories remains a separate owner-authorized mutation.

### Guarded native integration lifecycle

Use an initially empty loopback database whose name starts with `finance_phase2_test`, for example `finance_phase2_test_phase3`. Set `FINANCE_TEST_DATABASE_URL` only in the local test process; do not load production environment files. The unchanged guard rejects non-loopback hosts and other database names. `helpers/phase3Db.ts` explicitly applies the synthetic baseline, immutable Phase 1/2 chain, and all six Phase 3 migrations. Phase 2-only SQL suites retain their original migration boundaries. Runtime preparation/routing suites use the Phase 3 helper and ID-based model fixtures.

From the bot worktree, run the combined Phase 2/3 suites with:

```sh
npm run test:db -- --exclude tests/integration/deleteConfirmation.db.test.ts
```

The integration config runs files serially with one worker. Each file owns its fixture schema, applies its required migrations, and drops only that owned schema on teardown; do not preapply migrations into this database or run another suite against it concurrently. A migration failure is rolled back before releasing its pooled connection. Transition tests deliberately stop before contraction to prove drain/dependency gates, then continue after removing each blocker.

Run `npm run test:db -- tests/integration/deleteConfirmation.db.test.ts` separately with a different empty loopback database named with the `finance_phase1_test` prefix. Never run that suite with the Phase 2/3 URL. Native pg-backed adapter tests prove SQL and the changed local application paths, not Supabase Auth/PostgREST exposure or external provider quality. This documentation records intended execution, not a claim that any local gate or production rollout has run.

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

### Local Supabase verification caveats (2026-10-17)

All six Phase 3 migrations applied sequentially to the disposable PostgreSQL 15 / actual Supabase Auth and PostgREST stack, including the final `categories.name` removal and schema reload. The final contract guard accepts both LF and CRLF stored function bodies and still rejects missing or duplicated compatibility-adapter calls.

The inherited Phase 2 `create_finance_account` and `redeem_finance_invite` invoker functions read `auth.users.id`. A fresh Supabase stack did not grant this column to `service_role`; the broad grants in the synthetic native fixture had hidden that prerequisite. Readiness migration `202610180001_account_operation_access.sql` supplies Auth schema usage and `SELECT(id)` only, plus UPDATE privileges on `account_creation_operations` and `invite_redemptions` for their `SELECT FOR UPDATE` row locks. It preserves existing privileges and grants nothing to browser roles. Run it after the Phase 2 account-operation migration using authorized table owners; its transactional postcondition rejects ineffective grants. Synthetic native tests remove the broad Auth grants and prove account/invite creation and replay, unknown-user rejection, denial of Auth email reads, and browser-role denial. Actual local Supabase service-role creation and replay also passed in a rolled-back synthetic transaction. Production privileges remain unverified until the trusted database CA is available.

Drain legacy `{name,type}` category commands with the released Worker before deploying the final decoder; the SQL adapter cannot repair a command rejected by that decoder first. Pause queue delivery during the final Worker switch, and recheck that no old-format prepared command remains before resuming. Do not purge inboxes or queue messages. The reporting bridge in migration 003 retains old root `name` labels and top-row `category` strings alongside new `categories` metadata; new clients consume only the metadata. Migration 006 removes the old summary keys as well as the old category-column bridge after both clients have switched. Native transition tests compare the released summary/export fields before contraction and assert the legacy summary keys are absent afterward.

For local Next.js testing, bind its launcher to `localhost`. Binding to `127.0.0.1` caused NextURL normalization to make the default-locale internal rewrite look external and loop through redirects. This was corrected only in the ignored test launcher; public locale routing remains unchanged.
