# Anonymous Chat PostgreSQL DDL Draft (Migration-Oriented Baseline)

This document translates the current schema blueprint into a PostgreSQL-first DDL baseline that is close to direct migration output.

## Scope lock
- 1:1 anonymous chat only
- No rooms / no group chat
- No forum tables in V1
- No `language` field anywhere
- `interests` stored only as profile data, not as a V1 matching condition
- Redis remains FIFO queue / presence / reconnect runtime store
- PostgreSQL remains durable system of record
- No Celery / RQ / worker tables

---

## Migration order

Recommended dependency order:

1. Extensions
2. `accounts`
3. `auth_sessions`
4. `email_verification_tokens`
5. `account_interests`
6. `auth_risk_events`
7. `chat_sessions`
8. `chat_matches`
9. `chat_messages`
10. `chat_reports`
11. `audit_events`
12. Partial indexes / follow-up indexes

---

## 0) Extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Why
- `gen_random_uuid()` is used for UUID PK defaults.

---

## 1) `accounts`

```sql
CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    email_normalized text NOT NULL,
    password_hash text NOT NULL,
    display_name text NOT NULL,
    email_verified boolean NOT NULL DEFAULT false,
    email_verified_at timestamptz NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz NULL,
    CONSTRAINT ck_accounts_status
        CHECK (status IN ('active', 'suspended', 'closed')),
    CONSTRAINT ck_accounts_display_name_nonempty
        CHECK (btrim(display_name) <> ''),
    CONSTRAINT ck_accounts_email_nonempty
        CHECK (btrim(email) <> ''),
    CONSTRAINT ck_accounts_email_normalized_nonempty
        CHECK (btrim(email_normalized) <> ''),
    CONSTRAINT ck_accounts_email_verified_consistency
        CHECK (
            (email_verified = false AND email_verified_at IS NULL)
            OR
            (email_verified = true AND email_verified_at IS NOT NULL)
        )
);

CREATE UNIQUE INDEX ux_accounts_email_normalized
    ON accounts (email_normalized);

CREATE INDEX ix_accounts_status
    ON accounts (status);

CREATE INDEX ix_accounts_created_at
    ON accounts (created_at);
```

### Business constraints
- All business lookup, duplicate detection, login lookup, resend verification lookup must use `email_normalized` only.
- `email` stores the original user input for display/audit only.
- Registration must normalize email before insert: `trim -> lowercase -> canonicalize`.
- `status='suspended'` means full-site disabled in V1, not “chat-only restricted”.

### FK behavior
- None; root table.

---

## 2) `auth_sessions`

```sql
CREATE TABLE auth_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    session_token_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz NULL,
    last_seen_at timestamptz NULL,
    created_ip_hash text NULL,
    created_user_agent text NULL,
    last_seen_ip_hash text NULL,
    last_seen_user_agent text NULL,
    CONSTRAINT fk_auth_sessions_account_id
        FOREIGN KEY (account_id)
        REFERENCES accounts (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT ck_auth_sessions_token_hash_nonempty
        CHECK (btrim(session_token_hash) <> ''),
    CONSTRAINT ck_auth_sessions_expiry_after_create
        CHECK (expires_at > created_at),
    CONSTRAINT ck_auth_sessions_revoked_after_create
        CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CONSTRAINT ck_auth_sessions_last_seen_after_create
        CHECK (last_seen_at IS NULL OR last_seen_at >= created_at)
);

CREATE UNIQUE INDEX ux_auth_sessions_session_token_hash
    ON auth_sessions (session_token_hash);

CREATE INDEX ix_auth_sessions_account_id
    ON auth_sessions (account_id);

CREATE INDEX ix_auth_sessions_expires_at
    ON auth_sessions (expires_at);

CREATE INDEX ix_auth_sessions_active_by_account
    ON auth_sessions (account_id, expires_at)
    WHERE revoked_at IS NULL;
```

### Business constraints
- Cookie stores raw opaque token; DB stores hash only.
- Register success auto-creates one session.
- Logout revokes current session only by setting `revoked_at`.
- Unverified accounts may keep auth sessions; chat access remains blocked in application logic.

### FK strategy
- `ON DELETE RESTRICT`: deleting accounts with historical auth sessions is intentionally blocked in V1.
- `ON UPDATE RESTRICT`: account PKs are immutable.

---

## 3) `email_verification_tokens`

```sql
CREATE TABLE email_verification_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz NULL,
    revoked_at timestamptz NULL,
    requested_ip_hash text NULL,
    requested_user_agent text NULL,
    delivery_provider text NOT NULL,
    delivery_message_id text NULL,
    CONSTRAINT fk_email_verification_tokens_account_id
        FOREIGN KEY (account_id)
        REFERENCES accounts (id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT ck_email_verification_tokens_token_hash_nonempty
        CHECK (btrim(token_hash) <> ''),
    CONSTRAINT ck_email_verification_tokens_provider
        CHECK (delivery_provider IN ('mailpit', 'fake', 'resend')),
    CONSTRAINT ck_email_verification_tokens_expiry_after_create
        CHECK (expires_at > created_at),
    CONSTRAINT ck_email_verification_tokens_consumed_after_create
        CHECK (consumed_at IS NULL OR consumed_at >= created_at),
    CONSTRAINT ck_email_verification_tokens_revoked_after_create
        CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CONSTRAINT ck_email_verification_tokens_not_both_consumed_and_revoked
        CHECK (NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX ux_email_verification_tokens_token_hash
    ON email_verification_tokens (token_hash);

CREATE INDEX ix_email_verification_tokens_account_id_created_at
    ON email_verification_tokens (account_id, created_at DESC);

CREATE INDEX ix_email_verification_tokens_expires_at
    ON email_verification_tokens (expires_at);

CREATE INDEX ix_email_verification_tokens_active_by_account
    ON email_verification_tokens (account_id, expires_at)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
```

### Business constraints
- Token TTL = 15 minutes.
- Token is single-use.
- Resend must revoke all previous active tokens before inserting a new row.
- Raw token must never be stored; hash only.
- Rate limits are computed from recent rows plus risk-event rows, not from a separate resend table.

### FK strategy
- `ON DELETE CASCADE`: deleting an account can delete its verification tokens safely.
- `ON UPDATE RESTRICT`: account PKs are immutable.

---

## 4) `account_interests`

```sql
CREATE TABLE account_interests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id uuid NOT NULL,
    interest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_account_interests_account_id
        FOREIGN KEY (account_id)
        REFERENCES accounts (id)
        ON DELETE CASCADE
        ON UPDATE RESTRICT,
    CONSTRAINT ck_account_interests_nonempty
        CHECK (btrim(interest) <> '')
);

CREATE UNIQUE INDEX ux_account_interests_account_id_interest
    ON account_interests (account_id, interest);

CREATE INDEX ix_account_interests_interest
    ON account_interests (interest);
```

### Business constraints
- Values must be normalized in application code before insert: trim, lowercase, dedupe.
- V1 stores interests only as profile metadata.
- Interests do not affect queueing or matching in V1.

### FK strategy
- `ON DELETE CASCADE`: interests should disappear when account disappears.

---

## 5) `auth_risk_events`

```sql
CREATE TABLE auth_risk_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id uuid NULL,
    email_normalized text NULL,
    event_type text NOT NULL,
    outcome text NOT NULL,
    ip_hash text NULL,
    user_agent text NULL,
    turnstile_mode text NULL,
    turnstile_success boolean NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_auth_risk_events_account_id
        FOREIGN KEY (account_id)
        REFERENCES accounts (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT ck_auth_risk_events_event_type_nonempty
        CHECK (btrim(event_type) <> ''),
    CONSTRAINT ck_auth_risk_events_outcome
        CHECK (outcome IN ('allow', 'deny', 'error')),
    CONSTRAINT ck_auth_risk_events_turnstile_mode
        CHECK (turnstile_mode IS NULL OR turnstile_mode IN ('real', 'fake', 'test_key'))
);

CREATE INDEX ix_auth_risk_events_account_id_created_at
    ON auth_risk_events (account_id, created_at DESC);

CREATE INDEX ix_auth_risk_events_email_normalized_created_at
    ON auth_risk_events (email_normalized, created_at DESC);

CREATE INDEX ix_auth_risk_events_event_type_created_at
    ON auth_risk_events (event_type, created_at DESC);

CREATE INDEX ix_auth_risk_events_created_at
    ON auth_risk_events (created_at);
```

### Business constraints
- This table records outcomes only, not raw Turnstile challenge tokens.
- Use for registration/login/resend/verification audit and abuse review.
- Retention target = 180 days via in-process cleanup job.

### FK strategy
- `ON DELETE SET NULL`: retain risk history even if account is later removed/closed.

---

## 6) `chat_sessions`

```sql
CREATE TABLE chat_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    auth_session_id uuid NULL,
    display_name_snapshot text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NULL,
    closed_at timestamptz NULL,
    close_reason text NULL,
    CONSTRAINT fk_chat_sessions_account_id
        FOREIGN KEY (account_id)
        REFERENCES accounts (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_chat_sessions_auth_session_id
        FOREIGN KEY (auth_session_id)
        REFERENCES auth_sessions (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT ck_chat_sessions_status
        CHECK (status IN ('active', 'closed', 'expired')),
    CONSTRAINT ck_chat_sessions_display_name_nonempty
        CHECK (btrim(display_name_snapshot) <> ''),
    CONSTRAINT ck_chat_sessions_closed_at_consistency
        CHECK (
            (status = 'active' AND closed_at IS NULL)
            OR
            (status IN ('closed', 'expired') AND closed_at IS NOT NULL)
        )
);

CREATE INDEX ix_chat_sessions_account_id_created_at
    ON chat_sessions (account_id, created_at DESC);

CREATE INDEX ix_chat_sessions_auth_session_id
    ON chat_sessions (auth_session_id);

CREATE UNIQUE INDEX ux_chat_sessions_one_active_per_account
    ON chat_sessions (account_id)
    WHERE status = 'active';
```

### Partial unique index
- `ux_chat_sessions_one_active_per_account` is a **partial unique index**.

### Business constraints
- One account may own at most one active anonymous chat session in V1.
- `id` may be returned externally as `session_id`, but ownership must still be validated against the authenticated account.
- New bootstrap should reuse or supersede active row inside a transaction.

### FK strategy
- `account_id ON DELETE RESTRICT`: durable chat history should block hard account deletion in V1.
- `auth_session_id ON DELETE SET NULL`: chat session remains historically valid even if browser login session is revoked/deleted.

---

## 7) `chat_matches`

```sql
CREATE TABLE chat_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    left_chat_session_id uuid NOT NULL,
    right_chat_session_id uuid NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz NULL,
    end_reason text NULL,
    CONSTRAINT fk_chat_matches_left_chat_session_id
        FOREIGN KEY (left_chat_session_id)
        REFERENCES chat_sessions (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_chat_matches_right_chat_session_id
        FOREIGN KEY (right_chat_session_id)
        REFERENCES chat_sessions (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT ck_chat_matches_distinct_sides
        CHECK (left_chat_session_id <> right_chat_session_id),
    CONSTRAINT ck_chat_matches_ended_after_started
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX ix_chat_matches_left_chat_session_id_started_at
    ON chat_matches (left_chat_session_id, started_at DESC);

CREATE INDEX ix_chat_matches_right_chat_session_id_started_at
    ON chat_matches (right_chat_session_id, started_at DESC);

CREATE INDEX ix_chat_matches_started_at
    ON chat_matches (started_at DESC);

CREATE UNIQUE INDEX ux_chat_matches_active_left
    ON chat_matches (left_chat_session_id)
    WHERE ended_at IS NULL;

CREATE UNIQUE INDEX ux_chat_matches_active_right
    ON chat_matches (right_chat_session_id)
    WHERE ended_at IS NULL;
```

### Partial unique indexes
- `ux_chat_matches_active_left` is partial unique.
- `ux_chat_matches_active_right` is partial unique.

### Important limitation
These two indexes alone do **not fully guarantee** that the same `chat_session_id` cannot appear once on the left side and once on the right side across two different active rows.

### Business constraints
- V1 invariant: one `chat_session` can belong to at most one active 1:1 match.
- Therefore the matcher must create rows inside a transaction and explicitly lock/check both candidate `chat_sessions` before insert.
- Ending a match must set `ended_at` and `end_reason` exactly once.

### FK strategy
- Both FKs use `ON DELETE RESTRICT`: historical match rows must not silently disappear.

---

## 8) `chat_messages`

```sql
CREATE TABLE chat_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chat_match_id uuid NOT NULL,
    sender_chat_session_id uuid NOT NULL,
    client_message_id uuid NULL,
    message_type text NOT NULL DEFAULT 'text',
    sender_display_name_snapshot text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    CONSTRAINT fk_chat_messages_chat_match_id
        FOREIGN KEY (chat_match_id)
        REFERENCES chat_matches (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_chat_messages_sender_chat_session_id
        FOREIGN KEY (sender_chat_session_id)
        REFERENCES chat_sessions (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT ck_chat_messages_message_type
        CHECK (message_type IN ('text', 'system')),
    CONSTRAINT ck_chat_messages_sender_display_name_nonempty
        CHECK (btrim(sender_display_name_snapshot) <> ''),
    CONSTRAINT ck_chat_messages_body_nonempty
        CHECK (btrim(body) <> ''),
    CONSTRAINT ck_chat_messages_expires_after_create
        CHECK (expires_at > created_at)
);

CREATE INDEX ix_chat_messages_chat_match_id_created_at
    ON chat_messages (chat_match_id, created_at ASC);

CREATE INDEX ix_chat_messages_sender_chat_session_id_created_at
    ON chat_messages (sender_chat_session_id, created_at DESC);

CREATE INDEX ix_chat_messages_expires_at
    ON chat_messages (expires_at);

CREATE UNIQUE INDEX ux_chat_messages_match_client_message_id
    ON chat_messages (chat_match_id, client_message_id)
    WHERE client_message_id IS NOT NULL;
```

### Partial unique index
- `ux_chat_messages_match_client_message_id` is a **partial unique index**.

### Business constraints
- Persist only successfully accepted/delivered messages.
- Malformed payloads and failed sends must not be inserted.
- `client_message_id` is the idempotency key for client retries.
- `message_type='system'` is reserved for server-generated durable timeline entries.
- Retention target = 30 days via `expires_at` and in-process cleanup job.

### FK strategy
- All FKs use `ON DELETE RESTRICT`: transcripts should not disappear automatically when parent rows are changed.

---

## 9) `chat_reports`

```sql
CREATE TABLE chat_reports (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_account_id uuid NOT NULL,
    chat_match_id uuid NOT NULL,
    reported_chat_session_id uuid NOT NULL,
    reason text NOT NULL,
    details text NULL,
    status text NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz NULL,
    CONSTRAINT fk_chat_reports_reporter_account_id
        FOREIGN KEY (reporter_account_id)
        REFERENCES accounts (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_chat_reports_chat_match_id
        FOREIGN KEY (chat_match_id)
        REFERENCES chat_matches (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT fk_chat_reports_reported_chat_session_id
        FOREIGN KEY (reported_chat_session_id)
        REFERENCES chat_sessions (id)
        ON DELETE RESTRICT
        ON UPDATE RESTRICT,
    CONSTRAINT ck_chat_reports_reason_nonempty
        CHECK (btrim(reason) <> ''),
    CONSTRAINT ck_chat_reports_status
        CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
    CONSTRAINT ck_chat_reports_reviewed_at_consistency
        CHECK (
            (status = 'open' AND reviewed_at IS NULL)
            OR
            (status IN ('reviewed', 'dismissed', 'actioned') AND reviewed_at IS NOT NULL)
        )
);

CREATE INDEX ix_chat_reports_reporter_account_id_created_at
    ON chat_reports (reporter_account_id, created_at DESC);

CREATE INDEX ix_chat_reports_chat_match_id_created_at
    ON chat_reports (chat_match_id, created_at DESC);

CREATE INDEX ix_chat_reports_reported_chat_session_id_created_at
    ON chat_reports (reported_chat_session_id, created_at DESC);

CREATE INDEX ix_chat_reports_status_created_at
    ON chat_reports (status, created_at DESC);
```

### Business constraints
- Minimal V1 reporting only; no moderation workflow tables beyond this.
- A report must reference a durable match and a reported peer chat session.
- Optional V1.1 enhancement: dedupe multiple reports from the same reporter on the same match.

### FK strategy
- All FKs use `ON DELETE RESTRICT`: reports must remain intact as governance records.

---

## 10) `audit_events`

```sql
CREATE TABLE audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id uuid NULL,
    chat_session_id uuid NULL,
    chat_match_id uuid NULL,
    event_type text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_audit_events_account_id
        FOREIGN KEY (account_id)
        REFERENCES accounts (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT fk_audit_events_chat_session_id
        FOREIGN KEY (chat_session_id)
        REFERENCES chat_sessions (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT fk_audit_events_chat_match_id
        FOREIGN KEY (chat_match_id)
        REFERENCES chat_matches (id)
        ON DELETE SET NULL
        ON UPDATE RESTRICT,
    CONSTRAINT ck_audit_events_event_type_nonempty
        CHECK (btrim(event_type) <> '')
);

CREATE INDEX ix_audit_events_account_id_created_at
    ON audit_events (account_id, created_at DESC);

CREATE INDEX ix_audit_events_chat_session_id_created_at
    ON audit_events (chat_session_id, created_at DESC);

CREATE INDEX ix_audit_events_chat_match_id_created_at
    ON audit_events (chat_match_id, created_at DESC);

CREATE INDEX ix_audit_events_event_type_created_at
    ON audit_events (event_type, created_at DESC);

CREATE INDEX ix_audit_events_created_at
    ON audit_events (created_at);
```

### Business constraints
- Retention target = 365 days.
- This table survives transcript cleanup and keeps governance traceability.
- Do not store secrets, raw tokens, or plaintext sensitive fields in `metadata`.

### FK strategy
- `ON DELETE SET NULL`: preserve audit history even if referenced domain rows are later removed or archived.

---

## Partial unique indexes summary

The following uniqueness rules require **partial unique indexes** rather than regular unique constraints:

1. `chat_sessions`: one active chat session per account
   - `ux_chat_sessions_one_active_per_account`
2. `chat_matches`: one active left-side match per left session
   - `ux_chat_matches_active_left`
3. `chat_matches`: one active right-side match per right session
   - `ux_chat_matches_active_right`
4. `chat_messages`: idempotency only when `client_message_id` is present
   - `ux_chat_messages_match_client_message_id`

Also note:
- `ix_auth_sessions_active_by_account`
- `ix_email_verification_tokens_active_by_account`

are partial indexes for performance/lookup, but they are **not** unique constraints.

---

## Tables intentionally absent in V1

- No `forum_*`
- No `account_restrictions`
- No password-reset tables
- No change-email tables
- No device tables
- No worker / Celery / RQ tables
- No language-preference tables
- No matching-score/materialized queue tables

---

## Implementation notes

## Constraints that should be enforced by the database
- Primary keys
- Foreign keys and their `ON DELETE / ON UPDATE` behavior
- `status`, `message_type`, `outcome`, provider checks
- Non-empty checks for key text columns
- `email_normalized` uniqueness
- `session_token_hash` uniqueness
- `token_hash` uniqueness
- One active `chat_session` per account via partial unique index
- Message idempotency via partial unique index on `(chat_match_id, client_message_id)`

## Constraints that require database + application cooperation
- **Active match global uniqueness** for `chat_matches`
  - The two partial unique indexes only protect same-side duplication.
  - Application must create matches in a transaction and lock/check both chat sessions to prevent cross-side overlap.
- **Email normalization correctness**
  - Database stores the normalized output; application must perform normalization consistently before insert/update.
- **Verification resend rules**
  - Database stores rows and active-token indexes; application must revoke old tokens and enforce 60-second cooldown / hourly caps.
- **Auto-login on register**
  - DB stores `auth_sessions`; application must issue cookie and bind it correctly.
- **Verified-before-chat gating**
  - DB stores `email_verified`; application must enforce 403 / `EMAIL_NOT_VERIFIED` on chat entrypoints.
- **Transcript write timing**
  - DB schema supports persistence, but application must insert only after message acceptance/delivery.

## Constraints that should remain application-layer only in V1
- Turnstile verification itself
- Mail provider selection (`Mailpit` / `fake` / `Resend`) and send orchestration
- Redis queue order and queue membership
- Reconnect windows, typing state, and live online presence
- Whether a report reason comes from a fixed enum list or controlled free-text list

## Migration splitting guidance
- Migration 1: extensions + `accounts` + `auth_sessions` + `email_verification_tokens`
- Migration 2: `account_interests` + `auth_risk_events`
- Migration 3: `chat_sessions` + partial unique active-session index
- Migration 4: `chat_matches` + active-side partial unique indexes
- Migration 5: `chat_messages` + idempotency partial unique index
- Migration 6: `chat_reports` + `audit_events`

## Final baseline recommendation
If you turn this into Alembic migrations, keep this exact principle:

- PostgreSQL stores durable identity, session, verification, transcript, report, and audit data.
- Redis continues to own ephemeral runtime coordination.
- V1 remains intentionally narrow: verified-account-gated anonymous 1:1 chat with minimal reporting and no matching intelligence beyond FIFO.
