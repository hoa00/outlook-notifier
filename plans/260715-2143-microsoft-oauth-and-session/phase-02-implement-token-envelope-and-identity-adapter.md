---
phase: 2
title: "Implement Token Envelope and Identity Adapter"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Implement Token Envelope and Identity Adapter

## Overview

Add the crypto and fakeable upstream boundaries required by callback orchestration, without Graph subscription or message-fetch behavior.

## Requirements

- Functional: exchange authorization code, validate ID token through Microsoft OIDC/JWKS, bind `(tid, oid)`, retrieve minimal `/me` enrichment, serialize/deserialize a versioned refresh-token envelope, reject missing approved scopes.
- Non-functional: Web Crypto AES-GCM, fresh nonce per encryption, key-version compatibility, dependency-injected fetch, sanitized failures.

## Architecture

Create a dedicated `MicrosoftOAuthAdapter`; leave `MicrosoftAdapter` message metadata unchanged. The adapter validates ID-token signature, issuer, audience, nonce and supported account/tenant policy before returning normalized `(tid, oid)`. `/me` provides only approved profile enrichment and must agree with verified identity. `token/envelope.ts` uses the configured versioned keyring and identity-bound AAD, emitting a serialized envelope suitable for the existing D1 text column.

## Related Code Files

- Create: `apps/worker/src/token/envelope.ts`
- Create: `apps/worker/src/adapters/microsoft-oauth.ts`
- Create: `apps/worker/src/oauth/id-token.ts`
- Create: `apps/worker/test/token-envelope.test.ts`
- Create: `apps/worker/test/microsoft-oauth-adapter.test.ts`
- Reuse: `apps/worker/src/adapters/microsoft.ts` without expanding it
- Modify: `apps/worker/src/schemas/env.ts`, `apps/worker/src/env.ts`, `apps/worker/wrangler.jsonc`, `apps/worker/worker-configuration.d.ts`, `apps/worker/test/env.test.ts` for keyring/current-version contract
- Reuse: `migrations/0001-initial-schema.sql`; connection schema needs no edit

## Implementation Steps

1. Define a keyring `{version -> base64url 32-byte key}`, bounded current integer version, versioned envelope, and canonical AAD containing envelope/key version plus verified `(tid, oid)`.
2. Add encryption round-trip, randomized nonce, tamper, wrong/unknown key, retained-old-key decrypt, malformed envelope, and cross-identity swap tests.
3. Implement OIDC discovery/JWKS adapter seams with injected fetch/cache and validate supported algorithms, signature, issuer, audience, timestamps, nonce, `tid`, and `oid`.
4. Define OAuth adapter methods for authorize URL, code exchange, verified identity, and minimal profile retrieval; inject fetch/clock/config.
5. Runtime-validate token/profile responses and identity agreement; discard access token after enrichment; never surface raw response bodies.
6. Enforce approved scopes and map consent/invalid-response/network failures to stable internal codes.

## Success Criteria

- [ ] Same plaintext encrypted twice yields different ciphertext envelopes.
- [ ] Tamper, wrong key/version, and malformed input fail closed without secret material.
- [ ] Old retained key versions decrypt; new encryption uses current version; removed/unknown versions fail predictably.
- [ ] Cross-user/cross-tenant envelope swaps fail authentication.
- [ ] Invalid signature/issuer/audience/nonce/tid/oid or `/me` mismatch fails before D1 writes.
- [ ] Fake adapter tests cover success and sanitized upstream error classes.
- [ ] `Mail.Read` is never selected automatically.
- [ ] No SDK or Node-only crypto dependency is added.

## Risk Assessment

- Hand-written crypto formats can become ambiguous. Use a small explicit versioned schema and standard Web Crypto only.
- JWKS rotation/cache bugs can reject good tokens or trust stale keys. Cache by `kid` with bounded lifetime and retry discovery once for an unknown key; never accept an unverified fallback.
