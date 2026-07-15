---
title: "Worker Foundation safe runtime complete"
date: 2026-07-15
tags: [foundation, worker, hono, d1, session, ci]
plan: "plans/260715-1645-worker-foundation-safe-runtime/plan.md"
status: completed
---

# Worker Foundation and Safe Runtime Baseline

**Date**: 2026-07-15 17:37  
**Severity**: Low (foundation only; no prod surface)  
**Component**: `apps/worker` + root gates  
**Status**: Resolved (local/test)

## What Happened

Chặng 1 shipped: production-shaped Worker shell that never leaves local/test.

- **Workspace**: pnpm monorepo, package `@outlook-notifier/worker` at `apps/worker/`
- **Runtime**: Hono app — env validation middleware, correlation IDs, error taxonomy, health
- **Data**: `migrations/0001-initial-schema.sql` + minimal repositories (users, sessions, MS connections, Graph subscriptions, Telegram destinations, notification settings, delivery status)
- **Session**: opaque random cookie ID; D1 stores `id_digest` only (HMAC-SHA-256 with `SESSION_SECRET` as pepper)
- **CSRF**: double-submit shell on mutating routes
- **Logger**: allowlisted technical fields only; forbidden keys (token, email, body, subject, …) stripped
- **Kill switch**: `NOTIFICATIONS_KILL_SWITCH` — delivery enabled only when explicitly `false`
- **Gates**: root `pnpm verify` = lint + typecheck + test + build + schema/secrets/migration checks; `.github/workflows/ci.yml`

## Key Decisions

| Decision | Rejected | Why |
|----------|----------|-----|
| Worker under `apps/worker/` | Root-level Worker | Matches runbook; root stays workspace/config |
| Cookie = opaque ID; D1 = revocable digest row | Encrypted full session in cookie | Revoke/rotate; no identity/token in client storage |
| `SESSION_SECRET` as HMAC pepper | Store raw session ID in D1 | Cookie theft ≠ DB dump of usable IDs |
| Health skips full env validation | Fail health if any secret missing | Liveness must not require full secret set |
| Kill switch default **on** (blocked) | Default delivery enabled | Safe until ops explicitly opens the gate |

## Verification

- `pnpm verify` pass — **28** Vitest tests
- No live deploy, no real Cloudflare/Entra/Telegram resources this session
- Artifact finalize: WARN only (remote CI not executed here)

## Out of Scope (Chặng 7+)

Microsoft OAuth, live Telegram bot/webhook, real D1/KV/Worker deploy, public URLs, tenant/client IDs, production secrets.

## Residual Risk

- Spike path allowlist still admits historical PoC hosts — tighten before any public surface
- Remote CI not run this session; treat green local `pnpm verify` as necessary, not sufficient, until Actions is observed green on push

## Lesson

Ship the security shell (opaque sessions, CSRF, logger allowlist, kill switch, schema forbidden-column gates) **before** integration code. Deferring live infra was right; do not let placeholder config silently become prod config.

## Next Steps

- Owner: next cook — Chặng 2 Microsoft connection (OAuth, token crypto, Graph subscription) behind adapters
- Keep live-dependent ADRs `provisional` until Chặng 7 go/no-go
- On first push of this tree: confirm GitHub Actions `ci.yml` is green
