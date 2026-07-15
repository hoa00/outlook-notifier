---
phase: 1
title: "Define OAuth Contracts and State"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Define OAuth Contracts and State

## Overview

Define the OAuth transaction contract and a short-lived D1 state ledger with an atomic consume-once claim before any route exchanges credentials.

## Requirements

- Functional: generate high-entropy state and PKCE verifier/challenge; persist only a state digest plus nonce/verifier/relative return path with bounded TTL; atomically consume once.
- Non-functional: no open redirect, raw secret/token, unbounded input, or reusable state; deterministic error taxonomy.

## Architecture

`GET /auth/microsoft` validates a relative return path, creates a transaction, stores its digest and bounded data in D1, and builds the authorization URL through the OAuth adapter. Callback atomically claims the unexpired row before exchange. Concurrent callbacks must yield one winner and one exchange. Expired rows are deleted by bounded opportunistic cleanup; scheduled cleanup is unnecessary in this plan.

## Related Code Files

- Create: `apps/worker/src/oauth/contracts.ts`
- Create: `apps/worker/src/oauth/state.ts`
- Create: `apps/worker/src/repositories/oauth-transactions.ts`
- Create: `migrations/0002-oauth-transactions.sql`
- Create: `apps/worker/test/oauth-state.test.ts`
- Modify: `apps/worker/src/schemas/env.ts`
- Modify: `apps/worker/src/env.ts`
- Modify: `apps/worker/wrangler.jsonc` with placeholder-only config
- Modify: `apps/worker/worker-configuration.d.ts` when generated binding declarations require it
- Modify: `apps/worker/test/env.test.ts`
- Modify: `scripts/check-migrations.mjs` only if additive-migration validation requires enumeration
- Reuse: `apps/worker/src/errors/codes.ts`, `apps/worker/src/logging/logger.ts`

## Implementation Steps

1. Define transaction, callback result, sanitized error, scope-baseline, and adapter contracts without upstream response bodies.
2. Implement random state/verifier creation with Web Crypto; derive S256 challenge; reject unsafe or absolute return paths.
3. Add immutable migration `0002` with state digest primary key, bounded transaction fields, created/expiry/consumed timestamps, and no token/profile fields.
4. Implement repository create and atomic claim using one conditional D1 statement/transaction; never store raw state.
5. Define multi-tenant + personal-account authority allowlist and placeholder config across all env consumers.
6. Test success, expiry, wrong/missing state, replay, corruption, return-path injection, migration constraints, and concurrent claims proving one winner.

## Success Criteria

- [ ] State and verifier have sufficient entropy and never enter logs/errors.
- [ ] Only allowlisted relative return paths survive normalization.
- [ ] Expired/replayed/corrupt transactions fail before adapter exchange.
- [ ] Concurrent claims produce one winner and one adapter exchange.
- [ ] D1 stores only a state digest and bounded transaction data.
- [ ] No real tenant/client/URL/secret value is introduced.

## Risk Assessment

- D1 claim SQL may be accidentally non-atomic. Require a single conditional claim/delete/return statement or explicit transaction and a real concurrent test.
- Configured authority can create SSRF/open-redirect risk. Build only from a fixed Microsoft host plus a validated authority segment.
