---
phase: 4
title: "Verify Security Privacy and Contract Gates"
status: pending
priority: P1
dependencies: [1, 2, 3]
---

# Phase 4: Verify Security Privacy and Contract Gates

## Overview

Close the bounded OAuth slice with adversarial contract tests, privacy scans, and an explicit partial-AT-01 handoff to later Chặng 2 plans.

## Requirements

- Functional: verify start/callback behavior across success and all locked failure classes.
- Non-functional: no sensitive log/error/fixture content; deterministic tests; full repository verification gate.

## Architecture

Use Workers Vitest with synthetic identities, fake fetch/OIDC/JWKS adapters, test D1, and an allowlist logger sink. No network or live credential. Contract tests assert both returned status/cookies and forbidden side effects.

## Related Code Files

- Modify: focused tests created in phases 1-3
- Modify: `apps/worker/test/fixtures/synthetic.ts` only with synthetic OAuth fixtures
- Modify: `scripts/check-secrets.mjs` to replace blanket test-directory bypass with narrow synthetic-value/file policy and canary coverage
- Reuse: `apps/worker/test/helpers/apply-migrations.ts`
- Reuse: `scripts/check-secrets.mjs`, `scripts/check-forbidden-schema.mjs`, root `package.json`

## Implementation Steps

1. Build a matrix for wrong/missing/replayed/expired/concurrent state, invalid ID-token signature/issuer/audience/nonce/identity, malformed provider response, insufficient scopes, consent denial, timeout/5xx, D1 failure, and session failure.
2. Assert zero token exchange for pre-exchange validation failures and zero session issuance for every failed callback.
3. Inspect D1/logger/error outputs for authorization codes, tokens, raw state/verifier/nonce, upstream bodies, secrets, and email-event/provider payloads. Allow account login email only in `users.email` and explicitly synthetic fixtures.
4. Verify tenant authority and scopes are configuration-driven placeholders; assert no real values or silent permission fallback.
5. Add secret-scanner canaries for JWTs, OAuth codes, refresh tokens, and non-allowlisted email; run `pnpm verify` and `git diff --check`.
6. Mark the handoff: this plan enables later token-refresh/subscription work but does not claim active subscription or complete AT-01.

## Success Criteria

- [ ] Microsoft portion of AT-12 for wrong OAuth state passes with no persistence.
- [ ] Token-at-rest tests prove ciphertext-only D1 storage.
- [ ] Privacy assertions cover D1, logs, errors, and fixtures with the explicit account-email allowlist.
- [ ] Concurrent callback test proves one state claim, one exchange, and one resulting session.
- [ ] Identity trust tests cover personal and organization accounts plus issuer/tenant mismatch.
- [ ] Keyring tests cover current encryption and retained-version decryption.
- [ ] `pnpm verify` and `git diff --check` pass.
- [ ] No live infrastructure, queue, webhook, subscription, or message-fetch code enters the plan.
- [ ] Validation decisions are propagated with zero unresolved contradictions.

## Risk Assessment

- Tests can pass while upstream assumptions remain wrong. Keep adapter claims provisional and require live validation at Chặng 7.
- Secret scans may miss semantic leaks or over-allow test fixtures. Use narrow allowlists, negative canaries, and explicit logger/error assertions for every failure class.
