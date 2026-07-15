# Codebase Readiness Research

## Reusable Seams

- `createApp()` middleware composition and route mount.
- D1 opaque session service with create/resolve/revoke/rotate.
- Users, Microsoft connections, notification settings repositories and existing schema.
- Workers Vitest/Miniflare harness and synthetic fixtures.

## Gaps

- No OAuth transaction/state service or auth routes.
- Existing Microsoft adapter covers profile/message metadata only and should not become a god adapter.
- No token envelope/crypto service.
- Existing repository methods need an idempotent, transaction-aware callback persistence seam.

## Recommended Boundary

- Four phases: state/contracts; token envelope/identity adapter; callback persistence/session; security/privacy gates.
- Add one immutable D1 OAuth-state migration for atomic consumption; the connection/token envelope needs no schema change.
- No queue, webhook, subscription, live setup, UI, or message fetch.
