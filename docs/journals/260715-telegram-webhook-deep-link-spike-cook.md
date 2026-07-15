---
title: "Cook: Telegram webhook and deep-link spike"
date: 2026-07-15
tags: [telegram, webhook, deep-link, spike, cook]
plan: "plans/260715-1521-telegram-webhook-deep-link-spike/plan.md"
---

# Cook: Telegram webhook and deep-link spike

## What shipped

- Phase 1 official contract matrix: `docs/spikes/telegram-webhook-deep-link-spike.md` (access date 2026-07-15, Bot API 10.2).
- Phase 2 harness (no live bot this session):
  - `scripts/spikes/telegram-webhook-deep-link-poc.ts`
  - `scripts/spikes/telegram-poc-worker.ts`
  - `.dev.vars.example` Telegram placeholders
- Phase 3 ADR (conditionally decided / go blocked): `docs/decisions/telegram-webhook-and-linking-contract.md`
- Roadmap Chặng 0 spike status updated for both Graph + Telegram live blockers

## Decisions locked from docs

- Bearer-capability linking; no Telegram same-person proof
- Private chat only; `chat_id` as string; omit `chat_title` for MVP
- Consume-once linking is a hard gate; KV get-then-delete rejected as sole mechanism
- `update_id` dedupe separate from start-code replay
- No exactly-once or undocumented retry schedule claims

## Exit gate

**blocked** for full production go until live matrix: project bot, two private clients, deployed `/spikes/telegram-poc/*`, concurrent durable redeem pass, privacy scan after run.

## Review notes

Code review caught app-user vs Telegram-user keying bug in PoC worker; fixed before finalize. Offline harness + secret scan pass.
