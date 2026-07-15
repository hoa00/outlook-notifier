---
title: "Repository next-phase scout report"
date: 2026-07-15
source: "ck:plan hard-mode scout"
---

# Repository next-phase scout report

## Summary

Recommend `telegram-webhook-deep-link-spike` as the next Chặng 0 plan. It is independent from the blocked Graph live PoC, but both feed the future architecture baseline and Foundation gate.

## Evidence

- `docs/project-roadmap.md` lists Graph spike, Telegram spike, then architecture baseline.
- Existing Graph plan explicitly excludes Telegram.
- `docs/01-product-requirements.md` FR-04 defines shared bot, one-time link, confirmation, and private-only scope.
- `docs/02-technical-design.md` section 6 defines secret validation, application-owned link state, and plain-text delivery boundaries.
- `docs/03-api-data-security.md` defines routes, minimal destination data, and no raw Telegram logging.
- `docs/04-implementation-test-runbook.md` AT-02/AT-12 define positive and forged-secret acceptance paths.

## Dependency Classification

- Existing Graph spike: none. Same milestone, deliberately disjoint output.
- Future architecture baseline: depends on both spikes; do not add a dangling plan reference before it exists.

## Principal Risks

- False claim that KV read/delete is atomic.
- Raw Telegram Update data retained in logs/evidence.
- Group/channel binding slips into MVP.
- Retry timing or exactly-once behavior asserted without evidence.
- Disposable webhook/Worker route remains exposed after the spike.

## Unresolved Questions

- None for plan creation.
