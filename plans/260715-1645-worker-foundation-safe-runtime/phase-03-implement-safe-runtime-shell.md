---
phase: 3
title: "Implement Safe Runtime Shell"
status: completed
priority: P1
dependencies: [2]
effort: "1-1.5 days"
---

# Phase 3: Implement Safe Runtime Shell

<!-- Updated: Validation Session 1 - opaque cookie ID backed by revocable D1 session state -->

## Overview

Implement shared request/session/error/logging controls that later Microsoft and Telegram phases can reuse safely.

## Requirements

- Functional: correlation ID, normalized errors, allowlist logger, opaque-cookie/D1 session shell, CSRF strategy and notification kill switch.
- Non-functional: no upstream object dumps, no PII/secret labels, constant safe failure responses where appropriate.

## Architecture

Middleware hashes/lookups an opaque random cookie session ID through the D1 session repository and creates trusted request context. Cookie data contains no token, profile or authorization state. Routes call services; services receive repositories/adapters. Logging accepts a closed technical-event schema rather than arbitrary objects.

## Related Code Files

- Create: `apps/worker/src/middleware/*`, `apps/worker/src/errors/*`, `apps/worker/src/logging/*`, `apps/worker/src/session/*`.
- Create: `apps/worker/src/config/feature-flags.ts`.
- Modify: `apps/worker/src/index.ts`.
- Create: unit/integration tests under `apps/worker/test/`.

## Implementation Steps

1. Define stable error codes and safe HTTP mapping.
2. Generate/propagate random correlation IDs without message/user identifiers.
3. Implement allowlisted structured logging and explicit redaction rejection tests.
4. Add an opaque random session-ID cookie, store only its digest in D1, enforce expiry/revocation, apply secure cookie defaults and rotate the session on privilege/authentication changes.
5. Define CSRF protection for future authenticated mutations.
6. Add a system-wide delivery kill switch that defaults safe in tests/missing config.
7. Test malformed input, error paths and sensitive-object rejection.

## Success Criteria

- [x] Logger tests prove tokens, raw payloads and email fields cannot be serialized.
- [x] Session cookie defaults are `HttpOnly`, `Secure` outside local test and `SameSite=Lax` or stricter.
- [x] Cookie contains only an opaque session identifier; logout/revocation invalidates the D1 session immediately.
- [x] CSRF contract covers all future user-scoped mutations.
- [x] Kill switch prevents delivery service invocation.
- [x] Error responses contain stable codes but no upstream detail.

## Risk Assessment

- A generic logger reopens privacy leakage: expose only typed, allowlisted event functions.
- Session design may overreach before OAuth: implement the shell and contracts, not Microsoft flow.
