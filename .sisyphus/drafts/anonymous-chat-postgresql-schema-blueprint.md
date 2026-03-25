# Anonymous Chat PostgreSQL Schema Blueprint

## Scope Decisions (locked)
- Chat is **1:1 only**. No room/group-chat tables.
- Forum is **not implemented now**. Do not create `forum_*` tables in V1.
- Chat requires **registered account** first.
- Registration = **email + password**.
- Registration success = **auto-login**.
- Email must be **verified before chat access**.
- Email verification uses a **single-use token link** with **15-minute TTL**.
- Login session uses **HttpOnly cookie** with **7-day TTL**.
- Logout revokes **current session only**.
- `language` is **removed entirely** from DB / backend / frontend.
- `interests` / `keywords` are stored as **profile fields only** in V1.
- `interests` / `keywords` do **not** participate in current matching.
- Redis queue remains **FIFO** in V1.
- Turnstile is abstracted behind a verifier interface; only verification result/audit is stored.
- Email sending is abstracted behind `EmailSender`; provider-specific behavior is **not** modeled as DB tables.
- Retention/cleanup stays as **in-process scheduled jobs** in the application.

---

## Storage Boundary

### PostgreSQL owns
- Accounts and auth state
- Email verification state
- Auth cookie sessions
- Interests/profile fields
- Durable chat session/match/message records
- Audit and risk events

### Redis owns
- Online presence
- Waiting queue (FIFO)
- Reconnect deadline runtime state
- Typing status / in-memory live transport coordination

**Rule**: PostgreSQL is the durable source of truth. Redis is ephemeral runtime coordination only.

---

## Naming Rules
- Use `snake_case` table and column names.
- Use `uuid` for core identity tables.
- Use `bigint` identity for append-heavy log/event/message tables.
- Use `timestamptz` for all time columns.
- Prefer `text + CHECK` over PostgreSQL enum types in V1 to reduce migration friction.

---

## Entity Map

```text
accounts
  ├─< auth_sessions
  ├─< email_verification_tokens
  ├─< account_interests
  ├─< auth_risk_events
  ├─< chat_sessions
  └─< audit_events

chat_sessions
  ├─< chat_matches (as left_chat_session_id)
  ├─< chat_matches (as right_chat_session_id)
  ├─< chat_messages (as sender_chat_session_id)
  └─< audit_events

chat_matches
  ├─< chat_messages
  └─< audit_events
```

---

## Table Designs

## 1) `accounts`

**Purpose**: system-recognizable identity. Users are anonymous to peers, but governed through this table.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `email` | `text` | no | original email as entered, trimmed |
| `email_normalized` | `text` | no | lowercased canonical email, unique |
| `password_hash` | `text` | no | Argon2id hash only |
| `display_name` | `text` | no | peer-visible name, validated server-side |
| `email_verified` | `boolean` | no | default `false` |
| `email_verified_at` | `timestamptz` | yes | set on successful link consumption |
| `status` | `text` | no | CHECK in (`active`,`suspended`,`closed`) |
| `created_at` | `timestamptz` | no | default `now()` |
| `updated_at` | `timestamptz` | no | default `now()` |
| `last_login_at` | `timestamptz` | yes | updated on successful login |

**Constraints**
- PK: `id`
- UNIQUE: `email_normalized`
- CHECK: `status IN ('active','suspended','closed')`

**Indexes**
- `ux_accounts_email_normalized`
- `ix_accounts_status`

**Notes**
- V1 uses **single account, single visible identity**.
- `display_name` lives here because there is no multi-persona system in V1.
- Do **not** expose `id`, `email`, or `email_normalized` in chat payloads.
- Business lookup, login, uniqueness, resend verification, and duplicate-account detection must use **only** `email_normalized`.
- `email` is retained only for display/audit of original user input.
- Registration pipeline must execute `trim -> lowercase -> canonicalize` before writing `email_normalized`.
- In V1, `suspended` means **full-site access disabled**, not merely “cannot chat”. If later you need “can log in but cannot chat”, add a dedicated restriction model rather than overloading `status`.

---

## 2) `auth_sessions`

**Purpose**: server-managed browser login sessions for HttpOnly cookie auth.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `account_id` | `uuid` | no | FK → `accounts.id` |
| `session_token_hash` | `text` | no | hash of opaque cookie token, unique |
| `created_at` | `timestamptz` | no | default `now()` |
| `expires_at` | `timestamptz` | no | default issue time + 7 days |
| `revoked_at` | `timestamptz` | yes | set on logout |
| `last_seen_at` | `timestamptz` | yes | updated on authenticated activity |
| `created_ip_hash` | `text` | yes | hashed/truncated request IP |
| `created_user_agent` | `text` | yes | UA snapshot |
| `last_seen_ip_hash` | `text` | yes | hashed/truncated request IP |
| `last_seen_user_agent` | `text` | yes | latest UA snapshot |

**Constraints**
- PK: `id`
- FK: `account_id` → `accounts.id` ON DELETE RESTRICT
- UNIQUE: `session_token_hash`

**Indexes**
- `ux_auth_sessions_session_token_hash`
- `ix_auth_sessions_account_id`
- `ix_auth_sessions_expires_at`
- partial index on active sessions: `WHERE revoked_at IS NULL`

**Notes**
- Cookie stores the raw opaque token; DB stores **hash only**.
- Register success creates one row here immediately.
- Unverified accounts can have login sessions, but chat access remains blocked.

---

## 3) `email_verification_tokens`

**Purpose**: single-use email verification link tokens.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `account_id` | `uuid` | no | FK → `accounts.id` |
| `token_hash` | `text` | no | hash of opaque verification token, unique |
| `created_at` | `timestamptz` | no | default `now()` |
| `expires_at` | `timestamptz` | no | `created_at + 15 minutes` |
| `consumed_at` | `timestamptz` | yes | set once verification succeeds |
| `revoked_at` | `timestamptz` | yes | old tokens invalidated on resend |
| `requested_ip_hash` | `text` | yes | hashed/truncated IP |
| `requested_user_agent` | `text` | yes | UA snapshot |
| `delivery_provider` | `text` | no | CHECK in (`mailpit`,`fake`,`resend`) |
| `delivery_message_id` | `text` | yes | provider message ID if available |

**Constraints**
- PK: `id`
- FK: `account_id` → `accounts.id` ON DELETE CASCADE
- UNIQUE: `token_hash`
- CHECK: `delivery_provider IN ('mailpit','fake','resend')`

**Indexes**
- `ux_email_verification_tokens_token_hash`
- `ix_email_verification_tokens_account_id_created_at`
- `ix_email_verification_tokens_expires_at`
- partial active-token index: `WHERE consumed_at IS NULL AND revoked_at IS NULL`

**Operational rules**
- TTL = **15 minutes**.
- **Single-use only**.
- On resend:
  - revoke all previous active tokens for that account
  - create a new token row
- Reuse must return explicit business error such as `VERIFICATION_LINK_ALREADY_USED`.
- Expired token must return explicit business error such as `VERIFICATION_LINK_EXPIRED`.

**Why this table also supports resend rate limit**
- Cooldown and hourly caps can be calculated from recent rows by `account_id` and/or `requested_ip_hash`.
- No separate resend table is required in V1.

---

## 4) `account_interests`

**Purpose**: store interests/keywords as account profile data for future soft matching.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `bigint` | no | PK, identity |
| `account_id` | `uuid` | no | FK → `accounts.id` |
| `interest` | `text` | no | normalized lowercase trimmed value |
| `created_at` | `timestamptz` | no | default `now()` |

**Constraints**
- PK: `id`
- FK: `account_id` → `accounts.id` ON DELETE CASCADE
- UNIQUE: (`account_id`, `interest`)

**Indexes**
- `ux_account_interests_account_id_interest`
- `ix_account_interests_interest`

**Notes**
- This is **not used for matching in V1**.
- Keep the table because future soft match can query overlaps efficiently.
- Use this table even if the frontend still calls them `keywords`; the domain term in DB should be `interests`.

---

## 5) `auth_risk_events`

**Purpose**: security/risk signal log for registration, login, resend, and Turnstile outcomes.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `bigint` | no | PK, identity |
| `account_id` | `uuid` | yes | FK → `accounts.id`, nullable before account exists |
| `email_normalized` | `text` | yes | for pre-account events |
| `event_type` | `text` | no | e.g. `register_attempt`, `turnstile_failed`, `verification_resend_blocked`, `login_failed` |
| `outcome` | `text` | no | CHECK in (`allow`,`deny`,`error`) |
| `ip_hash` | `text` | yes | hashed/truncated IP |
| `user_agent` | `text` | yes | UA snapshot |
| `turnstile_mode` | `text` | yes | CHECK in (`real`,`fake`,`test_key`) |
| `turnstile_success` | `boolean` | yes | result snapshot |
| `metadata` | `jsonb` | no | default `'{}'::jsonb` |
| `created_at` | `timestamptz` | no | default `now()` |

**Constraints**
- FK: `account_id` → `accounts.id` ON DELETE SET NULL
- CHECK: `outcome IN ('allow','deny','error')`
- CHECK: `turnstile_mode IN ('real','fake','test_key')` when not null

**Indexes**
- `ix_auth_risk_events_account_id_created_at`
- `ix_auth_risk_events_email_normalized_created_at`
- `ix_auth_risk_events_event_type_created_at`
- `ix_auth_risk_events_created_at`

**Retention**
- Keep for **180 days**.

**Notes**
- Store the **result**, not the raw Turnstile token.
- This table supports abuse review and resend throttling diagnostics.

---

## 6) `chat_sessions`

**Purpose**: durable record of account-owned anonymous chat entry sessions. This maps to the current `/api/session` concept but becomes account-bound.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `uuid` | no | PK; this can also be the public `session_id` returned to client |
| `account_id` | `uuid` | no | FK → `accounts.id` |
| `auth_session_id` | `uuid` | yes | FK → `auth_sessions.id` that created it |
| `display_name_snapshot` | `text` | no | visible anonymous name at session creation |
| `status` | `text` | no | CHECK in (`active`,`closed`,`expired`) |
| `created_at` | `timestamptz` | no | default `now()` |
| `last_seen_at` | `timestamptz` | yes | heartbeat/bootstrap activity |
| `closed_at` | `timestamptz` | yes | when intentionally closed |
| `close_reason` | `text` | yes | e.g. `logout`,`close_endpoint`,`expired`,`superseded` |

**Constraints**
- PK: `id`
- FK: `account_id` → `accounts.id` ON DELETE RESTRICT
- FK: `auth_session_id` → `auth_sessions.id` ON DELETE SET NULL
- CHECK: `status IN ('active','closed','expired')`

**Indexes**
- `ix_chat_sessions_account_id_created_at`
- partial unique active session index: one active chat session per account

**V1 rule**
- Enforce **at most one active `chat_session` per account**.
- New bootstrap should reuse or supersede the existing active row instead of creating parallel anonymous identities.

**Notes**
- This table is durable.
- Redis still owns runtime reconnect deadline and online presence.

---

## 7) `chat_matches`

**Purpose**: durable 1:1 conversation pairing records.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `uuid` | no | PK, default `gen_random_uuid()` |
| `left_chat_session_id` | `uuid` | no | FK → `chat_sessions.id` |
| `right_chat_session_id` | `uuid` | no | FK → `chat_sessions.id` |
| `started_at` | `timestamptz` | no | default `now()` |
| `ended_at` | `timestamptz` | yes | when conversation ends |
| `end_reason` | `text` | yes | e.g. `next`,`disconnect`,`expired`,`moderated` |

**Constraints**
- PK: `id`
- FK: `left_chat_session_id` → `chat_sessions.id` ON DELETE RESTRICT
- FK: `right_chat_session_id` → `chat_sessions.id` ON DELETE RESTRICT
- CHECK: `left_chat_session_id <> right_chat_session_id`

**Indexes**
- `ix_chat_matches_left_chat_session_id_started_at`
- `ix_chat_matches_right_chat_session_id_started_at`
- `ix_chat_matches_started_at`

**Active-match uniqueness rule**
- In V1 1:1 chat, one `chat_session` may belong to **at most one active match** at a time.
- This must be enforced in implementation by **database-backed uniqueness strategy plus transactional matching logic**, not documentation alone.
- Recommended implementation shape:
  - partial unique index for active left side where `ended_at IS NULL`
  - partial unique index for active right side where `ended_at IS NULL`
  - plus transactional protection in match creation logic
- If the implementer chooses a normalized helper view/table instead, the invariant must stay identical: no chat session can appear in two concurrent open matches.

**Notes**
- V1 is strictly 1:1, so no participant join table is needed.
- If group chat ever exists, it should introduce a new conversation-participant model later instead of mutating this table beyond recognition.

---

## 8) `chat_messages`

**Purpose**: durable transcript rows for successfully delivered messages.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `bigint` | no | PK, identity |
| `chat_match_id` | `uuid` | no | FK → `chat_matches.id` |
| `sender_chat_session_id` | `uuid` | no | FK → `chat_sessions.id` |
| `client_message_id` | `uuid` | yes | client-supplied idempotency key for resend protection |
| `message_type` | `text` | no | CHECK in (`text`,`system`) |
| `sender_display_name_snapshot` | `text` | no | preserves visible name as seen in chat |
| `body` | `text` | no | normalized text payload |
| `created_at` | `timestamptz` | no | default `now()` |
| `expires_at` | `timestamptz` | no | `created_at + retention policy` |

**Constraints**
- PK: `id`
- FK: `chat_match_id` → `chat_matches.id` ON DELETE RESTRICT
- FK: `sender_chat_session_id` → `chat_sessions.id` ON DELETE RESTRICT
- CHECK: `message_type IN ('text','system')`
- UNIQUE: (`chat_match_id`, `client_message_id`) WHERE `client_message_id IS NOT NULL`

**Indexes**
- `ix_chat_messages_chat_match_id_created_at`
- `ix_chat_messages_sender_chat_session_id_created_at`
- `ix_chat_messages_expires_at`
- `ux_chat_messages_match_client_message_id` (partial)

**Retention**
- Keep for **30 days** in V1.
- Cleanup job may **hard delete** expired rows.

**Write rule**
- Persist **only after successful delivery / accepted message flow**.
- Do not persist malformed payloads or failed sends.
- Use `client_message_id` for client retry idempotency in user-generated text messages.
- `message_type='system'` is reserved for server-generated durable timeline events when V1/V1.1 needs them (for example, explicit durable disconnect/system notices). It should not force immediate UI changes, but the schema must support it now.

---

## 8.5) `chat_reports`

**Purpose**: minimal user-reporting capability for abusive anonymous chat without requiring a full moderation backend in V1.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `bigint` | no | PK, identity |
| `reporter_account_id` | `uuid` | no | FK → `accounts.id` |
| `chat_match_id` | `uuid` | no | FK → `chat_matches.id` |
| `reported_chat_session_id` | `uuid` | no | FK → `chat_sessions.id` |
| `reason` | `text` | no | user-selected or normalized free text reason |
| `details` | `text` | yes | optional extra report details |
| `status` | `text` | no | CHECK in (`open`,`reviewed`,`dismissed`,`actioned`) |
| `created_at` | `timestamptz` | no | default `now()` |
| `reviewed_at` | `timestamptz` | yes | future moderation support |

**Constraints**
- PK: `id`
- FK: `reporter_account_id` → `accounts.id` ON DELETE RESTRICT
- FK: `chat_match_id` → `chat_matches.id` ON DELETE RESTRICT
- FK: `reported_chat_session_id` → `chat_sessions.id` ON DELETE RESTRICT
- CHECK: `status IN ('open','reviewed','dismissed','actioned')`

**Indexes**
- `ix_chat_reports_reporter_account_id_created_at`
- `ix_chat_reports_chat_match_id_created_at`
- `ix_chat_reports_reported_chat_session_id_created_at`
- `ix_chat_reports_status_created_at`

**Notes**
- This is intentionally minimal for V1.
- It gives the product a durable “report abuse” path even before a full moderation console exists.
- If desired, an additional uniqueness rule may prevent duplicate reports by the same reporter on the same match, but that is optional for V1.

---

## 9) `audit_events`

**Purpose**: longer-lived operator/governance audit trail that survives chat transcript cleanup.

| Column | Type | Null | Notes |
|---|---|---:|---|
| `id` | `bigint` | no | PK, identity |
| `account_id` | `uuid` | yes | FK → `accounts.id` |
| `chat_session_id` | `uuid` | yes | FK → `chat_sessions.id` |
| `chat_match_id` | `uuid` | yes | FK → `chat_matches.id` |
| `event_type` | `text` | no | e.g. `account_registered`, `email_verified`, `chat_queue_entered`, `chat_match_created`, `chat_message_sent`, `chat_session_expired` |
| `metadata` | `jsonb` | no | default `'{}'::jsonb` |
| `created_at` | `timestamptz` | no | default `now()` |

**Constraints**
- FK: `account_id` → `accounts.id` ON DELETE SET NULL
- FK: `chat_session_id` → `chat_sessions.id` ON DELETE SET NULL
- FK: `chat_match_id` → `chat_matches.id` ON DELETE SET NULL

**Indexes**
- `ix_audit_events_account_id_created_at`
- `ix_audit_events_chat_session_id_created_at`
- `ix_audit_events_chat_match_id_created_at`
- `ix_audit_events_event_type_created_at`

**Retention**
- Keep for **365 days** in V1.

**Notes**
- This table is the answer to: “chat content expires, but system still needs governance traceability.”
- Keep metadata minimal; no raw secrets, no plaintext tokens.

---

## Explicitly Removed / Not Modeled

### Removed from V1 schema
- `language`
- any `preferred_language`
- any hard-filter match tables

### Not implemented in V1
- `forum_*`
- password reset tables
- change-email workflow tables
- admin/staff tables
- device tables
- Celery/RQ job tables
- file/media attachment tables
- dedicated `account_restrictions` table (deferred until you need chat-only bans or timed restrictions)

### Not persisted in PostgreSQL
- live waiting queue state
- live presence state
- reconnect countdown runtime state
- raw Turnstile tokens
- raw auth cookie tokens

---

## Recommended Error Codes / Business States

- `EMAIL_NOT_VERIFIED`
- `VERIFICATION_LINK_EXPIRED`
- `VERIFICATION_LINK_ALREADY_USED`
- `TURNSTILE_VERIFICATION_FAILED`
- `RESEND_VERIFICATION_RATE_LIMITED`
- `UNAUTHENTICATED`
- `FORBIDDEN_CHAT_ACCESS`

---

## Matching Policy Impact on Schema

### V1 actual behavior
- Redis queue remains FIFO.
- No `language` condition.
- No `interest` condition.

### Why still keep `account_interests`
- Future V2 can add soft match by joining queued accounts to `account_interests`.
- No schema migration is needed later to introduce interests as a ranking signal.

---

## Email / Turnstile Interface Impact on Schema

### EmailSender abstraction
- No provider-specific tables are needed.
- Provider information is recorded only as metadata on `email_verification_tokens`.

### TurnstileVerifier abstraction
- Production = real Turnstile verification.
- Dev/test = fake verifier or official test key.
- Schema stores **verification result metadata**, not raw challenge tokens.

---

## In-Process Job Responsibilities

### Job 1: verification token cleanup
- purge/revoke expired unused verification tokens

### Job 2: expired auth session cleanup
- revoke or delete expired `auth_sessions`

### Job 3: chat message retention cleanup
- hard-delete `chat_messages` where `expires_at < now()`

### Job 4: audit/risk retention cleanup
- delete `auth_risk_events` older than 180 days
- delete `audit_events` older than 365 days

**V1 rule**: all jobs run inside the application process. No Celery/RQ/worker split.

---

## Minimal DDL Order

1. `accounts`
2. `auth_sessions`
3. `email_verification_tokens`
4. `account_interests`
5. `auth_risk_events`
6. `chat_sessions`
7. `chat_matches`
8. `chat_messages`
9. `chat_reports`
10. `audit_events`

---

## Final Recommendation

For V1, the cleanest PostgreSQL architecture is:

- `accounts` as the real governed identity
- `auth_sessions` as browser login state
- `email_verification_tokens` for single-use verification links
- `account_interests` as future soft-match profile data
- `auth_risk_events` for anti-abuse and Turnstile outcomes
- `chat_sessions` as account-bound anonymous chat entry identities
- `chat_matches` as durable 1:1 conversation records
- `chat_messages` as TTL-based transcripts with idempotency and system-message support
- `chat_reports` as minimal abuse-reporting support for campus rollout
- `audit_events` as longer-lived governance evidence

This gives you a schema that is:
- simple enough for V1
- aligned with your current Redis runtime
- safe for email verification + auto-login + gated anonymous chat
- extensible later for forum and soft matching without polluting V1 behavior
