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
Links users (Google or WhatsApp) to accounts. Every account owner also has a member row.

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
| id             | uuid PK     |                        |
| account_id     | uuid        | → `accounts`           |
| transaction_id | uuid        | → `transactions`       |
| action         | text        | `'DELETE'` \| `'EDIT'` |
| expires_at     | timestamptz | 60 second TTL          |
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

All tables have RLS enabled. The dashboard uses the `anon` key (RLS enforced). The bot backend and API routes use the `service_role` key (bypasses RLS — server only, never expose to client).

Key policies:

| Table          | Policy                                                    |
|----------------|-----------------------------------------------------------|
| accounts       | Owner can read/write own accounts; members can read       |
| members        | Account owner can manage; members can read own row        |
| categories     | Account owner/members can read; owner can write           |
| transactions   | Account owner/members can read; owner can delete          |
| pending_actions| Account owner only                                        |
| link_codes     | Account owner only                                        |
| invite_tokens  | Account owner only                                        |