---
title: "Telegram Webhook and Deep-Link Spike"
description: "Verify Telegram webhook, deep-link, private-chat, and send-message contracts before production implementation."
status: pending
priority: P1
branch: "main"
tags: [research, api, security, critical]
blockedBy: []
blocks: []
created: "2026-07-15T08:22:58.148Z"
createdBy: "ck:plan"
source: skill
---

# Telegram Webhook and Deep-Link Spike

## Overview

Second independent feasibility plan in Chặng 0. Verify current Telegram Bot API contracts and run a disposable, sanitized live PoC for webhook authentication, `/start` linking, private-chat binding, and explicit `sendMessage`. Do not implement the production application.

## Scope

- In: official contract audit; disposable test bot/Worker PoC; sanitized evidence; webhook/deep-link ADR; teardown.
- Out: production KV/D1/session code; dashboard; Graph integration; groups; multiple destinations; email notification delivery.
- Invariant: never commit bot tokens, webhook secrets, raw Update bodies, Telegram names/usernames, chat IDs, or message text.

## Scope Challenge

- Existing code: reusable product/security contracts exist in `docs/`; no Telegram runtime exists.
- Minimum change: three phases and documentation artifacts only.
- Complexity: plan output only; expected implementation creates one disposable harness, one Worker entry, one spike report, and one ADR.
- Selected mode: HOLD SCOPE (`--hard`).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Audit official Telegram contracts](./phase-01-audit-official-telegram-contracts.md) | Pending |
| 2 | [Run sanitized bot and webhook PoC](./phase-02-run-sanitized-bot-and-webhook-poc.md) | Pending |
| 3 | [Decide Telegram integration baseline](./phase-03-decide-telegram-integration-baseline.md) | Pending |

## Dependencies

- Cross-plan: none. The unfinished Graph spike is independent; do not add a false dependency.
- Execution prerequisites: project-owned Telegram test bot, two independently controlled private test accounts/clients, and isolated HTTPS Worker route.
- Downstream: future `architecture-decisions-baseline` and Foundation remain blocked until this plan and Graph live evidence are resolved.

## Architecture Decision Boundary

```text
official contracts -> sanitized live PoC -> reviewed Telegram ADR
                              |
                              +-> teardown disposable bot webhook/Worker route
```

Telegram's deep-link payload has no application TTL or one-time guarantee. The application owns entropy, expiry, replay protection, and concurrency semantics. A sequential PoC cannot prove atomic KV consumption.

## Acceptance Criteria

- Official assertions cite current Telegram URLs and an access date.
- Valid secret reaches parsing; missing/wrong secret causes no mutation.
- A private `/start <opaque-code>` binds the first valid redeemer under the documented bearer-capability model; expired, replayed, user/chat-conflict, and non-private attempts fail safely.
- `getMe`, `setWebhook`/`getWebhookInfo`, and explicit `sendMessage` have sanitized pass/fail evidence.
- No undocumented retry timing, atomic consume-once, or exactly-once claim survives review.
- All disposable external resources are removed or listed as an explicit blocker.

## Validation Commands

```bash
ck plan status plans/260715-1521-telegram-webhook-deep-link-spike/plan.md
git diff --check
rg -n '(bot[0-9]+:|api\.telegram\.org/bot[0-9]|chat_id\s*[:=]\s*[0-9])' plans docs scripts
```

## Red Team Review

### Adjudication

- Findings: 2 Critical, 9 High, 8 Medium after deduplication.
- Accepted: 11 evidence-backed decision deltas. Rejected: duplicate formulations only.
- Accepted deltas: bearer-capability trust model; concurrency-safe consume gate; two-account/two-client matrix; `update_id` dedupe; binding/confirmation recovery state; pending-update isolation; bounded retry experiment; mechanical teardown; allowlisted privacy evidence; ingress resource limits; bot identity/rotation checks.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, phases 1-3.
- Decision deltas checked: 11.
- Reconciled stale references: cross-user identity, best-effort linking, optional teardown, live-only unsafe failure tests.
- Unresolved contradictions: 0.

## Validation Log

### Plan Recap

- Three sequential phases: official audit -> disposable PoC -> ADR.
- Linking uses a bearer capability; Telegram supplies no same-person proof.
- First valid private redeemer wins; replay and uniqueness conflicts fail deterministically.
- Concurrency-safe consume-once is a hard gate, unlike best-effort notification delivery.
- Valid-Update replay is separate from start-code replay.
- Binding and confirmation need recoverable intermediate states.
- Raw Telegram data and external resources have explicit privacy/teardown gates.

### Verification Results — Session 1

- Tier: Standard (Fact Checker + Contract Verifier).
- Claims checked: 30.
- Verified: 30 | Failed: 0 | Unverified: 0.
- Verified repository consumers: FR-04, technical design section 6, Telegram API/schema/threat controls, AT-02/AT-12, Chặng 0 roadmap.
- Verified official-source set: `setWebhook`, `getWebhookInfo`, `getMe`, `sendMessage`, Chat, deep linking, bot links, Bot FAQ.
- Planned create paths do not collide with existing repository files.
- Existing Graph plan is independent; no false `blockedBy`/`blocks` relationship added.

### Critical-Question Validation — Session 1

- Questions requiring user choice: 0.
- Bearer-link trust model resolved from actual Telegram/code mapping contract.
- Consume-once guarantee resolved by locked FR-04/roadmap gate: best-effort linking rejected.
- Optional `chat_title` minimization does not authorize a schema rewrite; any schema/FR change requires approval.
- Unsafe live error induction may use sanitized fixtures, but mandatory operational classes cannot remain unevidenced at `go`.

### Whole-Plan Consistency Sweep — Validation Session 1

- Files reread: `plan.md`, all three `phase-*.md`, research report, scout report.
- Decision deltas checked: 11.
- Reconciled stale terms: `cross-user`, `best-effort` linking, `needs-live-proof` platform timing, optional cleanup.
- Duplicate contracts checked: trust model, replay layers, concurrency gate, confirmation recovery, teardown.
- Unresolved contradictions: 0.

## Open Questions

- None requiring product input before planning. Live credentials/infrastructure are execution prerequisites, not plan-design choices.
