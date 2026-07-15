# ADR: Telegram webhook and linking contract

- **Status:** Conditionally decided (docs) / **blocked for go** (live PoC incomplete)
- **Date:** 2026-07-15
- **Deciders:** Spike implementer (docs); live confirm via Phase 2
- **Related:** `docs/spikes/telegram-webhook-deep-link-spike.md`, plan `260715-1521-telegram-webhook-deep-link-spike`

## Context

Chặng 0 must lock Telegram webhook authentication, private deep-link binding, confirmation send, and error classes before Foundation implements production routes. Official Bot API contracts (access date 2026-07-15) are audited; live PoC harness exists but has not run against a real bot, two clients, or a deployed Worker route.

## Decision

### Exit gate

| Gate | Value |
|------|--------|
| Docs contract baseline | **Accepted** for constants below |
| Full production go | **`blocked`** until Phase 2 sanitized live matrix passes, including concurrent single-consumer redeem |
| Downstream | `architecture-decisions-baseline` and Foundation Telegram work may scaffold against this ADR but must not claim AT-02/AT-12 green |

### Webhook registration and ingress

```text
setWebhook({
  url: "https://<public-host>/webhooks/telegram",   // production path (later)
  secret_token: "<1-256 A-Za-z0-9_->",
  allowed_updates: ["message"],
  drop_pending_updates: true   // at install / rebind windows only
})
```

| Rule | Decision |
|------|----------|
| Auth header | Require exact match on `X-Telegram-Bot-Api-Secret-Token` before body side effects |
| Compare | Constant-time; never log header or secret |
| Missing/wrong secret | Non-2xx; **zero** binding or sendMessage mutation |
| Content-Type | Require `application/json` |
| Body size | Hard max (PoC default 256 KiB; production config constant) |
| Schema | Runtime validation of Update subset; reject malformed before mutation |
| Accepted updates | MVP: `message` only |
| Ports | 443 (preferred); API also lists 80, 88, 8443 |

### Secret rotation

| Classification | Condition |
|----------------|-----------|
| **maintenance-required** (default until live proves otherwise) | Replace secret via setWebhook; brief reject window for in-flight old-secret deliveries is acceptable |
| **supported** zero-downtime | Only if live matrix shows dual-accept or ordered drain without mutation bugs |
| **blocked** | If rotation cannot be done without unbounded forged-accept risk |

Do not claim zero-downtime rotation without Phase 2 `secret_rotation` evidence.

### Valid-Update replay (`update_id`)

| Rule | Decision |
|------|----------|
| Dedupe key | `telegram-update:<botId>:<update_id>` (namespaced) |
| TTL | ≥ 24h (Telegram pending horizon) and ≤ product ops choice; re-audit before ship |
| Duplicate / out-of-order | Return success; **no** rebind; **no** second confirmation send |
| Separation | Independent from start-code consume keys |

### Bearer deep-link linking

| Rule | Decision |
|------|----------|
| Trust model | **Bearer capability**: possession of high-entropy code authorizes the **first** valid **private** redeemer. Telegram provides **no** same-person proof vs dashboard user. |
| Link form | `https://t.me/<bot_username>?start=<opaque_code>` |
| Code charset | base64url-compatible: `A-Z a-z 0-9 _ -` |
| Code length | ≤ 64 characters (Telegram max) |
| Entropy | ≥ 128 bits |
| Application TTL | ≤ **10 minutes** (FR-04); not a Telegram property |
| Consume-once | **Hard requirement** for account linking — best-effort is **forbidden** |
| Outstanding codes | Creating a new code for a user invalidates older outstanding codes for that user |
| Private only | `chat.type === "private"`; reject group / supergroup / channel |
| User uniqueness | One active destination per app user |
| Chat uniqueness | One active destination per `chat_id` |
| Conflicts | Deterministic fail: expired / replayed / user_conflict / chat_conflict / non_private |

### Concurrency-safe redeem (hard gate)

| Approach | Status |
|----------|--------|
| KV get-then-delete | **Rejected** as sole mechanism (not atomic) |
| Durable conditional write (e.g. D1 transaction / unique constraint on code) | **Preferred candidate** — must pass barrier N-way live test |
| Single-writer primitive (e.g. Queue serialization or DO) | **Acceptable** if mechanically single-consumer under race |
| Best-effort linking | **Forbidden** |

**Until live concurrent_redeem = pass:** implementation of production link handler is **blocked** for go, even if docs are ready.

### Binding / confirmation state machine

```text
pending (code issued)
  -> bound-confirmation-pending (code consumed, destination row written)
  -> active (sendMessage confirmation succeeded)
```

| Boundary failure | Behavior |
|------------------|----------|
| Crash after consume before durable dest | Treat as failed link; user retries with new code (code already consumed) — prefer transactional consume+insert |
| Crash after dest before confirm | Stay `bound-confirmation-pending`; recovery job/idempotent confirm send |
| sendMessage 429 | Honor `retry_after` when present; stay confirmation-pending |
| sendMessage 5xx / timeout | Retry with backoff limits; no second bind |
| sendMessage 403 blocked | Mark destination unreachable; do not spin forever |
| Duplicate Update during confirm | Dedupe by update_id; do not double-send if confirm already recorded |

### Stored destination fields (MVP)

| Field | Store? |
|-------|--------|
| `chat_id` | **Yes**, as **string** (int64-safe) |
| `user_id` (Telegram) | Optional technical; prefer not if unused |
| `chat_title` | **Omit** for MVP (private chat; data minimization). Not a schema migration. |
| Username / first_name | **No** |
| Raw Update / message text | **Never** |

### Explicit sendMessage

| Rule | Decision |
|------|----------|
| Confirmation | Plain-text fixed template; no email metadata |
| Notification path (later) | Plain text; escape if parse_mode ever used; MVP plain |
| Length | Stay within API **1–4096** after entities (dated 2026-07-15 observation) |
| Exactly-once | **Not claimed**; notifications remain at-least-once + best-effort dedupe (design §7). Linking consume-once is stricter and separate. |

### Operational error classes (sanitized)

| Class | Typical cause | User/ops mapping |
|-------|---------------|------------------|
| `telegram_secret_invalid` | Missing/wrong webhook secret | Drop; metric only |
| `telegram_schema_invalid` | Malformed / oversize / wrong type | Drop; metric |
| `link_code_expired` | TTL exceeded | User: generate new link |
| `link_code_replayed` | Second redeem | User: already used |
| `link_user_conflict` | User already linked elsewhere | User: unlink first |
| `link_chat_conflict` | Chat already linked to another user | User: support/unlink |
| `link_non_private` | Group/channel /start | User: use private chat |
| `telegram_blocked` | 403 bot blocked | Destination unreachable |
| `telegram_rate_limited` | 429 + retry_after | Retry with bound delay |
| `telegram_transient` | 5xx / network | Retry with policy |

Never put secrets, chat ids, or message text into logs/error trackers.

### Transport limits (locked language)

- No **exactly-once** webhook or sendMessage guarantee.
- No product dependency on undocumented webhook **retry schedule**.
- Updates not retained by Telegram longer than **24 hours**.

### Teardown (spike and production rebind)

- Spike: `deleteWebhook(drop_pending_updates=true)` + verify empty url/pending + remove route/state + revoke or inventory bot token.
- Production rebind: inventory prior webhook URL; prefer drop_pending only in controlled windows.

## Alternatives considered

1. **Trust Telegram user id equals dashboard user without bearer code** — Rejected: no such proof.
2. **Best-effort link consume** — Rejected: FR-04 one-time; race would dual-bind.
3. **Support groups in MVP** — Rejected: FR-04 private only; groups are 1.1.
4. **Store chat_title always** — Rejected for MVP minimization; optional later without treating as FR change.
5. **Docs-only full go** — Rejected: plan hard-mode requires live sanitized evidence for go.

## Consequences

- Phase 2 harness: `scripts/spikes/telegram-webhook-deep-link-poc.ts`, `scripts/spikes/telegram-poc-worker.ts`.
- When live evidence lands, update this ADR status to `Accepted` with matrix rows; supersede rather than erase alternatives.
- Concurrent redeem failure keeps Foundation Telegram linking **blocked**.
- Privacy: ADR and spike artifacts never contain tokens, secrets, raw Updates, real ids, usernames, or message text.

## Handoff checklist

### For `architecture-decisions-baseline`

- [ ] Adopt bearer-capability + private-only + string chat_id
- [ ] Require durable single-consumer primitive for link codes
- [ ] Separate update_id dedupe from link-code consume
- [ ] Omit chat_title unless product reopens it
- [ ] Keep notification exactly-once claims out of UX copy

### For Foundation / `telegram-adapter-and-webhook`

- [ ] Env: bot token + webhook secret as Worker secrets
- [ ] Routes: `/webhooks/telegram`, `/api/telegram/link`
- [ ] Tests: AT-02, AT-12 Telegram half, negative link matrix
- [ ] Do not implement production link until `concurrent_redeem` live pass

### Evidence references

- Official matrix: `docs/spikes/telegram-webhook-deep-link-spike.md` (2026-07-15)
- Live matrix: empty / blocked (no TELEGRAM_BOT_TOKEN / clients / deployed route in this session)
