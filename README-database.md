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
| code       | text UNIQUE | e.g. `KODE-X7K2` |
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

## Entity Relationship Diagram

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
    │
    └──► invite_tokens
            (account_id)
```

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

Production has the `members_select` policy with `user_id = auth.uid()`. No policy change was needed during the catalog inspection.

Service-role access does not exercise these policies. Application authorization tests cannot prove deployed RLS behavior.

## Phase 1 migration gate

The bot repository contains `scripts/inspect-phase1-catalog.sql` and the expand/enforce delete-confirmation migrations. They check the existing foreign key and requester-binding constraints before changing the pending-action schema. The enforcement migration removes unbound legacy delete prompts, not financial transactions or unrelated edit actions.

`consume_delete_confirmation` locks the account, pending request, and target, checks expiry using the database clock after lock waits, and consumes the prompt with the deletion in one transaction. Execution is restricted to the service role. The bot keeps this path disabled until migration and external acceptance checks pass.

Native PostgreSQL verification covers database behavior. The guarded production rollout applied both migrations after backup and recovery verification. Supabase exposed the RPC. The updated dashboard passed 26 real Auth/PostgREST scenarios locally and 28 on the Vercel production deployment, including shared-account access, checked persisted writes, rejected unauthorized writes, and soft-deactivation history retention. Disposable accounts and Auth users were removed. Actual WhatsApp confirmation delivery and reply binding remain unverified, so deletion confirmation stays disabled.

Mutation origin checks use the inbound `Host` header with the request scheme. Next.js can normalize a loopback request URL to `localhost`, which must not change whether the browser's actual origin is accepted.