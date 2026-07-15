---
phase: 3
title: "Decide Telegram integration baseline"
status: pending
priority: P1
dependencies: [2]
effort: "0.5 day"
---

# Phase 3: Decide Telegram integration baseline

## Overview

Convert reviewed evidence into a Telegram integration ADR and a clear go/revise/blocked handoff for the architecture baseline and Foundation plans.

## Context Links

- Phase 1 contract matrix.
- Phase 2 sanitized live evidence.
- `docs/01-product-requirements.md` FR-04.
- `docs/02-technical-design.md` section 6.
- `docs/03-api-data-security.md` Telegram destination schema and threat model.

## Requirements

- Functional: decide webhook registration/authentication, accepted Update subset, `update_id` replay gate, private-chat bearer binding, start-code format/TTL, concurrency-safe redemption, bind/confirmation recovery, stored destination fields, and error classes.
- Non-functional: least data; explicit limits; no false atomicity or exactly-once guarantee; named blockers.

## Architecture

Decision baseline:

```text
setWebhook(secret_token, allowed_updates=[message])
  -> verify header + size/type + schema
  -> dedupe namespaced update_id
  -> accept only private /start <opaque-code>
  -> atomically claim application bearer token
  -> persist minimal destination (pending -> confirmation-pending -> active)
  -> explicit idempotent sendMessage confirmation/recovery
```

Possession of a high-entropy short-lived code authorizes the first valid private-chat binding; Telegram provides no same-person identity proof. Prefer omitting the optional `chat_title` value for MVP because private binding does not require it; this is data minimization, not a schema migration decision. A KV read-then-delete sequence is not atomic. The ADR must select a mechanically verified single-consumer primitive or mark implementation blocked.

## Related Code Files

- Create: `docs/decisions/telegram-webhook-and-linking-contract.md`.
- Modify: `docs/project-roadmap.md` only when an approved decision changes a documented assumption or closes this spike gate.
- Modify: `README.md` only if an approved decision changes the locked MVP boundary.
- Delete: none.

## Implementation Steps

1. Verify evidence completeness, sanitization, and teardown before interpretation.
2. Decide webhook path/header strategy, exact accepted update types, size/content checks, schema, and secret rotation rule.
3. Document bearer-code theft semantics and decide start-code entropy, charset, length, ten-minute maximum application TTL, invalidation of older outstanding codes, consume-once behavior, and user/chat uniqueness conflicts.
4. Select a concurrency-safe production approach using mechanical evidence: transactional/conditional durable storage or a single-writer primitive. Best-effort is not acceptable for linking; block if none fits.
5. Lock private-chat-only behavior and `chat_id` string/int64-safe storage; omit `chat_title` unless evidence proves a required product use.
6. Define namespaced `update_id` dedupe key/TTL and idempotent duplicate/out-of-order outcomes, separate from link-code replay.
7. Define binding/confirmation recovery states and behavior for timeout, 429, 5xx, and crashes at each state boundary.
8. Define sanitized operational error classes for invalid secret/schema, expired/replayed link, user/chat conflict, blocked bot, 429, and transient failure.
9. Decide rotation/rollback, pending-update policy, ingress size/time bounds, and mechanically verified teardown requirements.
10. Record Telegram transport limits: no exactly-once delivery claim and no undocumented webhook retry schedule.
11. Require product/architecture approval if evidence would change FR-04, the consume-once guarantee, or migration schema; compatible omission of optional `chat_title` data does not itself change schema.
12. Publish a handoff checklist for `architecture-decisions-baseline`, Foundation, and later Telegram implementation plans.

## Todo List

- [ ] Validate evidence and privacy scan.
- [ ] Decide webhook and Update contract.
- [ ] Decide linking concurrency strategy.
- [ ] Decide valid-Update replay and confirmation recovery contracts.
- [ ] Decide minimal stored fields and error classes.
- [ ] Record blockers and handoff constraints.

## Success Criteria

- [ ] ADR cites official contracts and sanitized live evidence.
- [ ] Webhook rejection paths guarantee no mutation.
- [ ] Start-code TTL, replay, user/chat conflict, and concurrency semantics are explicit.
- [ ] Bearer-code trust, user/chat conflicts, and lack of same-person proof are explicit.
- [ ] Valid-Update replay and confirmation partial failures are idempotent and recoverable.
- [ ] Private chat is the only supported MVP destination; `chat_title` is omitted unless justified.
- [ ] No atomic KV or exactly-once claim remains.
- [ ] Downstream plans can consume a precise, testable Telegram contract.
- [ ] Exit gate is `go`, `revise`, or `blocked` with evidence.

## Risk Assessment

- Happy-path bias: require negative and concurrency evidence.
- Overengineering replay protection: choose the smallest primitive that satisfies one-time semantics.
- Premature production scope: keep implementation in later roadmap plans.

## Security Considerations

- ADR contains no secrets, real identifiers, raw payloads, names/usernames, or test message text.
- Secret rotation and failure logging must not expose header values.

## Validation Gate

- Fact-check all file/source references.
- Contract review covers every downstream consumer and negative test.
- Whole-plan sweep finds zero stale assumptions before marking ready.

## Rollback

- Supersede the ADR with new evidence; preserve rejected alternatives and evidence date.
