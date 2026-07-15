---
phase: 2
title: "Run sanitized bot and webhook PoC"
status: blocked
priority: P1
dependencies: [1]
effort: "1 day"
---

# Phase 2: Run sanitized bot and webhook PoC

## Overview

Run the smallest disposable live experiment that proves Telegram webhook authentication, private `/start` delivery, application-owned one-time linking, and explicit `sendMessage`. Persist only sanitized structure and outcomes.

## Context Links

- Phase 1 evidence matrix.
- `docs/02-technical-design.md` section 6.
- `docs/03-api-data-security.md` threat model and no-log policy.
- `docs/04-implementation-test-runbook.md` AT-02 and negative tests.

## Requirements

- Functional: test bot identity, webhook registration/inspection, valid and invalid secret paths, deep link, private-only bearer binding, expiry/replay/user-chat conflicts, explicit confirmation/recovery, valid-Update replay, and selected retry/error behavior.
- Non-functional: isolated HTTPS route; deterministic assertions; no production persistence; mandatory teardown.

## Architecture

Use a project-owned disposable Telegram test bot, at least two independently controlled private test accounts/two concurrent clients, isolated route such as `/spikes/telegram-poc/*` on `outlook-notifier.hoadev.com`, and a local/ephemeral harness. The harness stores only an allowlisted evidence schema: typed placeholders, field presence, status/error classes, and timestamps. Secrets stay in environment/Worker bindings.

The PoC may use memory/disposable KV only to reproduce the race. A barrier-based N-way test must then exercise each candidate production primitive. Concurrency-safe single-consumer behavior is a hard go/no-go decision; best-effort is forbidden for account linking.

## Related Code Files

- Create: `scripts/spikes/telegram-webhook-deep-link-poc.ts`.
- Create: `scripts/spikes/telegram-poc-worker.ts`.
- Modify: `docs/spikes/telegram-webhook-deep-link-spike.md`.
- Create: `.dev.vars.example` only if safe placeholders are absent.
- Retain for reproducibility: sanitized harness and Worker source.
- External teardown: webhook, deployed route, disposable state, secrets, and bot credential/test resource per inventory.

## Implementation Steps

1. Create a project-owned test bot, two private test accounts/clients, and a resource inventory with owner, expiry, prior webhook snapshot, secret location, and cleanup postconditions.
2. Generate a webhook secret valid under the documented charset/length and an opaque base64url start code with at least 128 bits of entropy and at most 64 characters.
3. Deploy an isolated Worker route with body-size/content-type checks, exact secret validation before parsing, runtime schema validation, and request-body logging disabled.
4. Call `getMe`; compare an expected sanitized bot fingerprint and current webhook ownership before destructive mutation. Abort on mismatch.
5. Clear or explicitly retain pending updates, call `setWebhook` with explicit `allowed_updates` and secret, and require `getWebhookInfo.pending_update_count == 0` before each unique-code matrix.
6. Prove missing/wrong secret returns a safe non-2xx response and causes no binding or message send; prove valid secret reaches schema handling.
7. Open unique deep links from two accounts and verify bearer semantics: first valid private redeemer binds; expired/replayed codes, already-linked user, chat-linked-elsewhere, and non-private updates fail deterministically. State clearly that Telegram supplies no same-person proof.
8. Run barrier-based concurrent redemption against candidate primitives and record one winner plus deterministic loser states. Block `go` if no primitive provides mechanical single-consumer behavior.
9. Replay an identical valid `update_id` and send out-of-order IDs; require duplicates to return success without rebinding or resending confirmation. Capture namespaced dedupe-key/TTL requirements separately from start-code replay.
10. Exercise bind + confirmation partial failures with `pending`, `bound-confirmation-pending`, and `active` candidate states; inject timeout, 429, 5xx, and crash boundaries using fixtures/mocks when unsafe live.
11. Safely induce one 500 retry using a uniquely tagged no-side-effect Update; cap the observation window, restore 2xx immediately, dedupe it, inspect/clear pending count, and trigger cleanup on abort.
12. Test old/new/wrong webhook secrets during replacement and rollback. Classify zero-downtime rotation as supported, maintenance-required, or blocked from observed evidence only.
13. Test bounded ingress rejection: explicit byte limit, content type/encoding, malformed JSON, deep nesting, unsupported Update, and read/processing timeout; prove rejection before mutation with bounded resources.
14. Validate operational error classes live or via sanitized fixtures. Mark `go` impossible if a mandatory class lacks either live or fixture evidence.
15. Run automated forbidden-pattern/secret scanning plus manual allowlist review across git, Worker logs/tail/logpush, and configured error trackers. Record provider retention/deletion evidence without printing secrets.
16. In a `finally`/trap cleanup path, call `deleteWebhook(drop_pending_updates=true)`, verify empty webhook URL/pending count, remove the route/state, and revoke the bot/token unconditionally unless retained as an inventoried test resource with owner and cleanup date.

## Todo List

- [x] Provision harness + isolated route source (`telegram-poc-worker.ts`); live bot/clients **blocked** (no credentials this session).
- [x] Webhook authentication matrix implemented (LOCAL_SECRET_MATRIX against deployed worker).
- [x] Private deep-link / negative matrix scripted; interactive two-client run **blocked**.
- [x] Explicit sendMessage path in harness (CONFIRM_CHAT_ID); live **blocked**.
- [x] update_id dedupe + concurrent_redeem hard-gate documented; concurrent live **blocked**.
- [x] Sanitized evidence schema + harness JSON output; no secrets in git.
- [x] Teardown path in harness (`deleteWebhook`); live teardown N/A until provisioned.

## Success Criteria

- [x] Harness encodes getMe / webhook / start / sendMessage assertions; live rows blocked without bot.
- [x] Worker rejects missing/wrong secret and bad ingress before mutation (code-level; deploy to prove).
- [x] Outcomes enumerated for expired/replay/conflict/non-private/concurrent under bearer model.
- [x] update_id dedupe returns success without second bind (worker + LOCAL_SECRET_MATRIX).
- [x] Concurrent redeem: **exit blocked** until durable primitive race passes (in-memory claim is not proof).
- [x] Recovery states defined in ADR; live partial-commit matrix blocked.
- [x] Git artifacts contain no tokens/secrets/raw payloads/ids (scan required after any live run).
- [x] Teardown automated in harness; no disposable resources provisioned this session.

## Risk Assessment

- Raw Update data is highly identifying: disable request logs and sanitize before persistence.
- Reusing the public hostname can leave stale exposure: isolate paths and verify deletion.
- A sequential happy path hides replay races: include a concurrent redemption test.
- Telegram retries are intentionally underspecified: record observations only.

## Security Considerations

- Compare secrets without leaking values; reject before body parsing or side effects.
- Use private chat only; reject group, supergroup, and channel binding.
- Do not embed user IDs in start payloads.

## Test and Privacy Gate

- Validate evidence against an allowlisted schema; scan for bot tokens, webhook secrets, raw Update keys/values, IDs, names/usernames, URLs with credentials, and test canary text.
- Inspect configured Cloudflare log surfaces/error trackers and document retention/deletion rather than assuming disabled request logging is sufficient.
- Review external resource inventory after teardown.

## Rollback

- Restore prior webhook only if the inventoried bot is retained; otherwise delete webhook with pending updates, remove route/state, and revoke the disposable bot/token. Cleanup failure blocks phase completion.
