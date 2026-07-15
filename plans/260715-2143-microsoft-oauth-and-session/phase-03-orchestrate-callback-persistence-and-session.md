---
phase: 3
title: "Orchestrate Callback Persistence and Session"
status: pending
priority: P1
dependencies: [1, 2]
---

# Phase 3: Orchestrate Callback Persistence and Session

## Overview

Wire start/callback routes to the domain service, repositories, token envelope, and existing opaque session service with failure-safe ordering.

## Requirements

- Functional: start redirect; atomic state claim; callback exchange/verified identity/profile; create-or-resolve user; encrypted connection upsert; create-if-absent settings; safe session replacement; safe return redirect.
- Non-functional: no partial authenticated session on failure; idempotent duplicate identity handling; CSRF/state boundaries explicit.

## Architecture

Thin Hono routes delegate to `MicrosoftOAuthService`. Callback atomically claims state, exchanges the code, verifies identity, enriches profile, encrypts the refresh token, then commits user/connection/create-if-absent settings as one mandatory D1 transaction boundary. Session replacement resolves the actual previous owner, creates the new session before revoking the old one (or performs both atomically), and clears mismatched cookies according to explicit account-switch behavior.

## Related Code Files

- Create: `apps/worker/src/oauth/service.ts`
- Create: `apps/worker/src/routes/auth-microsoft.ts`
- Create: `apps/worker/test/microsoft-auth-routes.test.ts`
- Modify: `apps/worker/src/app.ts`
- Modify: `apps/worker/src/repositories/users.ts`
- Modify: `apps/worker/src/repositories/microsoft-connections.ts`
- Modify: `apps/worker/src/repositories/notification-settings.ts`
- Modify: `apps/worker/src/repositories/sessions.ts`
- Modify: `apps/worker/src/session/service.ts`
- Modify: `apps/worker/src/middleware/session.ts` or route mounting so stale-cookie/session lookup failure cannot prevent public callback state validation
- Modify: `apps/worker/test/session.test.ts`

## Implementation Steps

1. Add repository primitives for create-or-resolve verified `(tid, oid)` identity and `INSERT ... ON CONFLICT DO NOTHING` default settings.
2. Add a mandatory D1 transaction/batch persistence unit for user + identity-bound encrypted connection + initial settings, with unique-identity race handling and statement-boundary failure tests.
3. Implement start and callback service workflows with explicit ordering and early failure exits.
4. Mount public auth routes so CSRF does not block GET callback and stale-cookie/session lookup failure cannot bypass or preempt state validation.
5. Replace sessions safely: resolve actual prior owner, create replacement first, then revoke/clear the old session; define user-A to user-B account switch explicitly.
6. Test first connect, reconnect with non-default preferences, concurrent/duplicate callback, every persistence statement failure, stale cookie, session lookup/touch/create/revoke failure, cross-user account switch, missing refresh token, insufficient scopes, and unsafe return path.

## Success Criteria

- [ ] Invalid callback paths perform zero exchange/persistence/session mutation as applicable.
- [ ] Successful callback stores identity-bound ciphertext only and creates one usable opaque session.
- [ ] Reconnect does not duplicate user or reset existing notification preferences.
- [ ] Failure ordering leaves no plaintext token, dangling authenticated cookie, or misleading active state.
- [ ] Routes contain orchestration only; business rules remain in services.

## Risk Assessment

- D1 multi-write partial failure can leave durable credentials without completed auth. Atomic persistence is mandatory, with rollback proven at each statement boundary.
- Session fixation/cross-account confusion is possible if callback trusts the cookie owner. Resolve actual ownership, create replacement before revoke, clear mismatches, and test account switching.
