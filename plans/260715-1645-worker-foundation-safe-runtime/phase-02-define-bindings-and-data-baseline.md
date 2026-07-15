---
phase: 2
title: "Define Bindings and Data Baseline"
status: pending
priority: P1
dependencies: [1]
effort: "1-1.5 days"
---

# Phase 2: Define Bindings and Data Baseline

<!-- Updated: Validation Session 1 - full approved schema/repositories and D1 server-side sessions -->

## Overview

Define local binding contracts and the privacy-safe D1 schema without provisioning Cloudflare resources.

## Requirements

- Functional: typed env contract, local D1/KV/Queue/DLQ/Cron placeholders, additive initial migration and minimal repositories for the full approved Foundation schema, including revocable server-side sessions.
- Non-functional: no email metadata persistence, no secret defaults, UTC timestamps, user-scoped queries.

## Architecture

`Env` describes binding names, not concrete IDs. D1 is authoritative for users, connections, subscriptions, Telegram destinations, settings, delivery status and revocable sessions. Repositories accept the authenticated user ID from trusted context. KV remains for later short-lived OAuth state, linking codes and dedupe—not authoritative sessions. External platform values remain opaque configuration.

## Related Code Files

- Create: `apps/worker/src/env.ts`, `apps/worker/src/repositories/*`, `apps/worker/src/schemas/*`, including a minimal session repository.
- Create: `migrations/0001-initial-schema.sql`.
- Modify: `apps/worker/wrangler.jsonc`, `.dev.vars.example` with placeholders only.
- Create: migration and repository tests under `apps/worker/test/`.

## Implementation Steps

1. Translate the approved schema in `docs/03-api-data-security.md` into an immutable migration.
2. Define binding/config types and runtime validation with test-only placeholder values.
3. Add minimal repositories for users, Microsoft connections, subscriptions, Telegram destinations, settings, technical delivery status and revocable sessions.
4. Enforce user scope and avoid tables/columns for subject, sender, body, recipients or raw payloads.
5. Configure local D1/KV/Queue/DLQ/Cron simulation without resource IDs.
6. Add migration, query-isolation, session-expiry/revocation and forbidden-column tests.

## Success Criteria

- [ ] Migration applies from empty and re-runs according to migration tooling expectations.
- [ ] Repository tests prove user isolation.
- [ ] Session records can expire and be revoked without changing or exposing cookie payload data.
- [ ] Forbidden email/raw-payload columns are absent.
- [ ] Config validation never logs values classified as secret.
- [ ] No Cloudflare resource is created or referenced by real ID.

## Risk Assessment

- Schema drift from provisional ADRs: keep external platform details out of core tables where possible; use additive migration policy.
- Accidental data retention: mechanically scan schema and repository fixtures for forbidden fields.
