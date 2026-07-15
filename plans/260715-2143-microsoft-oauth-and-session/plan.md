---
title: "Microsoft OAuth and Session"
description: "Implement the local/test Microsoft OAuth connection slice with single-use state, PKCE, encrypted refresh-token persistence, and application session creation."
status: pending
priority: P1
branch: "main"
tags: [feature, auth, backend, security]
blockedBy: []
blocks: []
created: "2026-07-15T14:43:46.071Z"
createdBy: "ck:plan"
source: skill
---

# Microsoft OAuth and Session

## Overview

Kế hoạch nhỏ đầu tiên của Chặng 2. Bàn giao `GET /auth/microsoft` và callback bằng fake upstream/contract tests: state claim atomically trong D1, PKCE, return-path allowlist, verified ID token, token envelope AES-GCM, profile tối thiểu, D1 persistence và opaque application session.

Plan không hoàn tất toàn bộ AT-01: Graph subscription active thuộc plan `graph-subscription-management`. Mọi tenant/client/URL/secret thật và live OAuth vẫn dời Chặng 7.

## Scope Challenge

- Existing code: Hono middleware shell, D1 session service, user/connection/settings repositories, Microsoft message adapter seam, Workers Vitest harness.
- Minimum change: OAuth-only modules, one additive state-ledger migration, focused tests; no queue/webhook/subscription work.
- Complexity: 4 sequential phases, OAuth/identity/crypto service boundaries, narrow repository/session changes.
- Selected mode: HOLD SCOPE (`--hard validate`).

## Scope

- In: multi-tenant + personal-account authority policy, delegated authorization-code flow, atomic state/PKCE, safe callback, verified ID-token `(tid, oid)` identity, minimal `/me` enrichment, encrypted refresh-token persistence, default settings, safe session replacement, negative/privacy tests.
- Out: Graph subscription, webhook ingress, message fetch, refresh lifecycle/single-flight, disconnect/reauth workflow, UI, real provisioning/deploy.
- Permission invariant: request the approved configurable baseline only; never auto-escalate to `Mail.Read`.
- Privacy invariant: no token, authorization code, raw OAuth state, upstream body, or secret in logs/errors/fixtures; account login email is allowed only in `users.email` and explicitly synthetic fixtures.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Define OAuth Contracts and State](./phase-01-define-oauth-contracts-and-state.md) | Pending |
| 2 | [Implement Token Envelope and Identity Adapter](./phase-02-implement-token-envelope-and-identity-adapter.md) | Pending |
| 3 | [Orchestrate Callback Persistence and Session](./phase-03-orchestrate-callback-persistence-and-session.md) | Pending |
| 4 | [Verify Security Privacy and Contract Gates](./phase-04-verify-security-privacy-and-contract-gates.md) | Pending |

## Dependencies

- Completed prerequisite: `260715-1645-worker-foundation-safe-runtime` (not a blocker).
- Provisional inputs: Graph permission/tenant claims remain release-blocking at Chặng 7, but do not block fake/contract implementation.
- Downstream: token refresh and Graph subscription plans consume the contracts created here.

## Architecture Decisions

- Keep `apps/worker/src/adapters/microsoft.ts` focused on later message metadata; create a separate OAuth identity adapter.
- Store an OAuth state digest and short-lived transaction data in an additive D1 table; atomically claim exactly once before code exchange. KV is not the security authority for state consumption.
- Validate ID-token signature through Microsoft OIDC/JWKS, issuer, audience, nonce and supported tenant/account policy; bind persisted identity to `(tid, oid)`. Use `/me` only for minimal profile enrichment and reject identity mismatches.
- Store a versioned serialized AES-GCM envelope in existing `encrypted_refresh_token`; keyring config maps version to 32-byte keys, encrypts with the current version, and decrypts retained versions.
- Bind ciphertext AAD to envelope/key version and stable `(tid, oid)` identity so cross-row swaps fail closed.

## Acceptance Criteria

- Start emits an authorize redirect with exact configured scopes, random state and S256 PKCE; D1 state entry expires and contains no token or raw state.
- Missing, wrong, expired, or replayed state performs zero token exchange and zero D1/session mutation.
- Success verifies `(tid, oid)`, stores only identity-bound ciphertext envelope + key version/scopes, creates or resolves the user, creates settings only when absent, and safely replaces/creates the opaque session.
- Insufficient scopes and tenant-consent denial map to sanitized stable error codes; no automatic broader permission.
- Focused tests and `pnpm verify` pass without real external resources.
- AT-01 remains explicitly partial until subscription management is complete.

## Validation Log

### Initial Verification

- Tier: Standard (4 phases; Fact Checker + Contract Verifier).
- Existing reuse targets verified: app composition, env schema, session service, user/connection/settings repositories, migration and Workers test harness.
- Planned create targets verified absent; token-envelope storage reuses the existing connection column, while atomic OAuth state requires additive migration `0002`.
- Initial open decisions were resolved in Validation Session 1.

## Red Team Review

### Evidence-backed adjudication

- Accepted — replace KV security authority with D1 state-digest ledger and atomic claim; test concurrent callbacks.
- Accepted — multi-tenant + personal accounts; validate ID-token signature/issuer/audience/nonce and bind `(tid, oid)` before writes; `/me` only enriches profile.
- Accepted — mandatory D1 transaction/batch boundary for user + encrypted connection + create-if-absent settings.
- Accepted — identity-bound AES-GCM AAD and cross-user/cross-tenant swap tests.
- Accepted — safe session replacement resolves the existing owner, creates replacement before revocation or uses an atomic primitive, and covers cross-user/failure cases.
- Accepted — update all config consumers and use a versioned encryption keyring.
- Accepted — reconnect creates defaults only when absent.
- Accepted — allow account login email only in `users.email` and synthetic fixtures; forbid email-event/provider payload leakage elsewhere.

### Verification Results

- Tier: Standard.
- Claims checked: 40 across four phases.
- Verified: 40 | Failed: 0 | Unverified: 0 after accepted findings were propagated.

### Validation Session 1 — 2026-07-15

- Phase 1 defines OAuth transaction/state and redirect safety.
- Phase 2 defines verified identity adapter and versioned token encryption.
- Phase 3 persists identity/connection/settings and issues an opaque session.
- Phase 4 proves negative paths, privacy boundaries, and repository gates.
- Questions asked: 1 bundled decision gate.
- Answer: approved all recommended baselines.
- Confirmed: multi-tenant + personal accounts; verified ID-token `(tid, oid)` identity; additive D1 atomic state ledger; versioned encryption keyring.
- Propagation: phases 1–4, architecture decisions, file inventories, tests, risks, and acceptance criteria updated.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md` and all four `phase-*.md` files.
- Decision deltas checked: 8 accepted red-team findings + 4 confirmed validation baselines.
- Reconciled stale references: KV consume authority, `/me` identity authority, no-migration assumption, single-key config, overwrite-on-reconnect, ambiguous rotation, over-broad email privacy assertion.
- Unresolved contradictions: 0.

## Open Questions

- None.
