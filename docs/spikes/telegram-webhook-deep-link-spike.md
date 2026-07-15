# Telegram webhook and deep-link spike — evidence

**Access date:** 2026-07-15  
**Bot API reference:** https://core.telegram.org/bots/api (Bot API 10.2 changelog dated July 14, 2026)  
**Status:** Phase 1 official-contract audit complete; Phase 2 live PoC blocked on test bot / Worker / two-client matrix

## Official source index

| Topic | Canonical URL | Notes |
|-------|---------------|--------|
| setWebhook | https://core.telegram.org/bots/api#setwebhook | secret_token, allowed_updates, drop_pending_updates, retry note |
| deleteWebhook | https://core.telegram.org/bots/api#deletewebhook | drop_pending_updates |
| getWebhookInfo | https://core.telegram.org/bots/api#getwebhookinfo | WebhookInfo fields |
| getMe | https://core.telegram.org/bots/api#getme | Token / bot identity smoke test |
| sendMessage | https://core.telegram.org/bots/api#sendmessage | Explicit outbound message |
| Update | https://core.telegram.org/bots/api#update | update_id, message, allowed_updates semantics |
| Message | https://core.telegram.org/bots/api#message | text, chat, from |
| Chat | https://core.telegram.org/bots/api#chat | type private/group/supergroup/channel; id width |
| User | https://core.telegram.org/bots/api#user | id width (≤52 significant bits) |
| ResponseParameters | https://core.telegram.org/bots/api#responseparameters | retry_after |
| Deep linking | https://core.telegram.org/bots/features#deep-linking | start parameter charset/length |
| Bot links | https://core.telegram.org/api/links#bot-links | t.me link forms |
| Bot FAQ | https://core.telegram.org/bots/faq | Operational guidance (not hard API guarantees) |

## Evidence matrix

| # | Capability | Repository claim | Official documented contract | Evidence URL | Status |
|---|------------|------------------|------------------------------|--------------|--------|
| 1 | Webhook secret charset/length | Validate `secret_token` before parse | Optional `secret_token`: **1–256** chars; only `A-Z a-z 0-9 _ -`. Telegram sends header **`X-Telegram-Bot-Api-Secret-Token`**. | setWebhook | **confirmed** (docs) |
| 2 | Webhook secret delivery | Reject missing/wrong secret, no mutation | Header present only when secret_token was set on setWebhook. Docs do not specify constant-time compare; application must implement safe compare and reject before side effects. | setWebhook | **confirmed** (header contract); rejection semantics **application** |
| 3 | Non-2xx retry | Do not depend on schedule | Unsuccessful webhook (status not `2XY`) is retried and given up after a **“reasonable amount of attempts”**. No interval, horizon, ordering, or timeout is specified. | setWebhook | **non-contract / observational-only** for timing |
| 4 | Update retention | Do not assume infinite pending | Incoming updates stored until received; **not kept longer than 24 hours**. | Getting updates | **confirmed** (docs) |
| 5 | update_id | Dedupe / out-of-order recovery | Unique positive id; increases sequentially; useful to ignore repeated updates or restore sequence if out of order. After ≥1 week idle, next id may be chosen randomly. | Update | **confirmed** (docs); app must own namespaced dedupe key/TTL |
| 6 | Chat.id / User.id width | Store as string / int64-safe | May have **more than 32** significant bits; **at most 52**; 64-bit integer or double-precision float is safe. | Chat; User | **confirmed** (docs) |
| 7 | Chat.type private only (MVP) | Reject group/supergroup/channel binding | `type` ∈ `private` \| `group` \| `supergroup` \| `channel`. Product FR-04: private only. | Chat; FR-04 | **confirmed** (type enum); private-only is **product** |
| 8 | Deep-link parameter | Opaque code in start param | `https://t.me/<bot>?start=<parameter>`. Charset **A–Z a–z 0–9 _ -**; recommend base64url; **max 64 characters**. Opens as `/start <parameter>`. | deep-linking | **confirmed** (docs) |
| 9 | Deep-link TTL / one-time | Application-owned | Telegram documents **no** application TTL, consume-once, or same-person proof for the start parameter. | deep-linking | **application decision** (not Telegram contract) |
| 10 | Bearer capability trust | First valid private redeemer wins | Telegram only delivers the start payload to the bot; it does not assert that the opener is the dashboard user. Possession of the code is the capability. | deep-linking; FR-04 | **application decision** |
| 11 | getMe | Bot identity smoke test | A successful method call with the bot token; result is a User (bot). Use before destructive setWebhook. | getMe; Making requests | **confirmed** (docs); fingerprint compare **needs-live-proof** |
| 12 | setWebhook / getWebhookInfo | Register + inspect | setWebhook returns True; getWebhookInfo returns url, pending_update_count, last_error_*, allowed_updates, etc. Ports **443, 80, 88, 8443**. | setWebhook; WebhookInfo | **confirmed** (docs); live path **needs-live-proof** |
| 13 | allowed_updates | Restrict to message for MVP | Optional list of update types; empty list receives all except chat_member / message_reaction / message_reaction_count by default. Does not filter updates created before the call. | setWebhook | **confirmed** (docs) |
| 14 | drop_pending_updates | Clear pending before matrix | Boolean on setWebhook / deleteWebhook. | setWebhook; deleteWebhook | **confirmed** (docs) |
| 15 | sendMessage | Explicit confirmation | Method sends a text message; response `ok` + Message on success. Text length after entities: **1–4096** characters (API sendMessage). | sendMessage | **confirmed** (docs, length as dated observation) |
| 16 | Rate limits / 429 | Honor retry_after when present | Errors may include `parameters` of type ResponseParameters with `retry_after`. Exact global rate limits are FAQ/guidance and change; do not hard-code product constants from memory. | Making requests; ResponseParameters; FAQ | **partial** (retry_after field **confirmed**); numeric limits **observational / FAQ** |
| 17 | Bots cannot cold-start users | Bind only after inbound /start | Product/design: bot cannot message a user who has never started the bot. FAQ guidance; treat as operational constraint for confirmation send. | Bot FAQ; FR-04 | **guidance** (label separately from API method contracts) |
| 18 | Exactly-once delivery | Forbidden claim | No Telegram guarantee of exactly-once webhook delivery or exactly-once sendMessage. update_id helps app-side dedupe only. | setWebhook; Update; design §7 | **confirmed non-guarantee** |
| 19 | Concurrent start-code redeem | Hard go/no-go for linking | Not a Telegram contract. Application must use a mechanically single-consumer durable primitive. KV read-then-delete is **not** atomic. | FR-04; design §6.2 | **application decision**; live race matrix **needs-live-proof** |
| 20 | Valid-Update replay vs code replay | Separate threat models | update_id replay is Telegram redelivery; start-code replay is bearer-token reuse. Different keys, TTLs, and outcomes. | Update; FR-04 | **application decision** |

### Non-contract / observational-only (must not drive correctness)

| Topic | Why |
|-------|-----|
| Webhook retry interval / max attempts | “Reasonable amount of attempts” only |
| Delivery ordering of concurrent updates | Not guaranteed |
| Webhook response timeout value | Not specified in API method text |
| Global sendMessage rate as a fixed constant | FAQ/operational; re-measure |
| Zero-downtime secret rotation | Not specified; classify from live evidence only |

## Threat models (separate)

### A — Bearer start-code replay / theft

| Threat | Control (application) |
|--------|------------------------|
| Code leaked via URL history / shoulder surf | ≥128-bit entropy; ≤64 base64url chars; TTL ≤10 min; single outstanding code per user optional invalidation |
| Second client redeems first | First successful private redeem wins; later codes fail as replayed/consumed |
| Concurrent double redeem | Conditional durable claim (not best-effort) |
| Already-linked user or chat | Deterministic conflict errors; no rebinding without explicit unlink |
| Non-private chat /start | Reject; no bind |

Telegram supplies **no same-person proof** between dashboard session and Telegram user.

### B — Valid Update replay / redelivery

| Threat | Control (application) |
|--------|------------------------|
| Telegram retries after non-2xx | Return 2xx only after durable handling decision; or accept at-least-once and dedupe |
| Duplicate update_id | Namespaced key `telegram-update:<botId>:<update_id>` with TTL; ack without rebinding or re-sending confirmation |
| Out-of-order update_id | Process if not seen; do not assume monotonic processing order across isolates |
| Forged Update without secret | Reject before JSON parse side effects; no mutation |

## Repository claim → PoC assertion map

| Repo source | PoC assertion ID | Official anchor |
|-------------|------------------|-----------------|
| FR-04 deep link + one-time | `deep_link_private_bind`, `code_expired`, `code_replay`, `user_conflict`, `chat_conflict`, `non_private_reject` | deep-linking; application TTL |
| FR-04 confirmation | `send_message_confirm` | sendMessage |
| design §6.1 secret | `secret_missing`, `secret_wrong`, `secret_valid` | setWebhook secret_token |
| design §6.2 chat_id string | `chat_id_width_safe` | Chat.id |
| AT-02 | `get_me`, `set_webhook`, `start_bind`, `send_message_confirm` | getMe; setWebhook; deep-linking; sendMessage |
| AT-12 forged Telegram | `secret_missing`, `secret_wrong` | setWebhook |
| design §7 no exactly-once | `update_id_dedupe` (idempotent ack only) | Update; setWebhook retry note |

## Sanitized evidence schema (Phase 2 write format)

Store only structural facts. Never store bot tokens, webhook secrets, raw Update bodies, chat IDs, user IDs, usernames, names, or message text.

```ts
type SanitizedTelegramPocEvidence = {
  accessDate: string; // ISO date
  botApiDocsDate: string;
  steps: Array<{
    assertion:
      | "get_me"
      | "webhook_ownership"
      | "set_webhook"
      | "get_webhook_info"
      | "secret_missing"
      | "secret_wrong"
      | "secret_valid"
      | "deep_link_private_bind"
      | "code_expired"
      | "code_replay"
      | "user_conflict"
      | "chat_conflict"
      | "non_private_reject"
      | "concurrent_redeem"
      | "update_id_dedupe"
      | "bind_confirm_recovery"
      | "send_message_confirm"
      | "ingress_reject"
      | "secret_rotation"
      | "teardown";
    result: "pass" | "fail" | "blocked" | "skipped";
    httpStatus?: number;
    telegramErrorCode?: number; // error_code only, no description with PII
    fieldPresence?: Record<string, "present" | "absent" | "error">;
    notes?: string; // non-sensitive only
  }>;
  placeholdersUsed: string[];
};
```

### Placeholder conventions

| Real value | Placeholder |
|------------|-------------|
| Bot token | `<botToken>` |
| Webhook secret | `<webhookSecret>` |
| Bot username | `<botUsername>` |
| Bot numeric id | `<botId>` |
| chat_id | `<chatId>` |
| user id | `<userId>` |
| update_id | `<updateId>` |
| start code | `<startCode>` |
| Message text | never store |

## PoC assertion set (Phase 2 consumes only these)

| ID | Assertion | Baseline |
|----|-----------|----------|
| get_me | Token resolves; sanitized fingerprint matches expected bot | Required for go |
| webhook_ownership | getWebhookInfo before mutate; abort if unexpected URL | Required |
| set_webhook | setWebhook with secret + allowed_updates=`["message"]` | Required |
| get_webhook_info | pending_update_count==0 before unique-code matrix | Required |
| secret_missing / secret_wrong | Non-2xx; zero binding mutation | Required |
| secret_valid | Reaches schema handling | Required |
| deep_link_private_bind | First private redeemer binds under bearer model | Required |
| code_expired / code_replay | Deterministic fail | Required |
| user_conflict / chat_conflict | Deterministic fail | Required |
| non_private_reject | No bind | Required |
| concurrent_redeem | Exactly one winner via production-capable primitive | **Hard gate** |
| update_id_dedupe | Duplicate valid Update: success without rebind/resend | Required |
| bind_confirm_recovery | pending → bound-confirmation-pending → active | Required |
| send_message_confirm | Explicit sendMessage after bind | Required |
| ingress_reject | Oversize / wrong type / malformed / deep nest | Required |
| secret_rotation | Classify supported / maintenance / blocked from evidence | Required for rotation claim |
| teardown | deleteWebhook(drop_pending=true); route/state gone | Required |

## Live Phase 2 status

| Prerequisite | Status |
|--------------|--------|
| Project-owned test bot + token in env (not git) | **missing** |
| Two independently controlled private clients | **missing** |
| Isolated HTTPS route `/spikes/telegram-poc/*` | harness source ready; **not deployed** |
| Concurrent redemption against candidate primitive | **not run** |
| Privacy scan of logs after run | **n/a until live** |

**Exit for full go:** blocked until the live matrix above produces sanitized pass/fail rows. Docs-only decisions may proceed into ADR as **conditionally decided**.

## Privacy and teardown inventory (template)

| Resource | Owner | Expiry | Cleanup postcondition |
|----------|-------|--------|------------------------|
| Test bot token | `<owner>` | spike end | revoke or inventory with date |
| Webhook URL | spike | spike end | empty url; pending_update_count=0 |
| Worker route | spike | spike end | route removed |
| Ephemeral link codes | spike | TTL | none remain |
| Evidence artifact | repo | n/a | allowlisted schema only |

## Forbidden-pattern scan (run after any live capture)

```bash
rg -n '(bot[0-9]+:|api\.telegram\.org/bot[0-9]|chat_id\s*[:=]\s*[0-9])' plans docs scripts
git diff --check
```
