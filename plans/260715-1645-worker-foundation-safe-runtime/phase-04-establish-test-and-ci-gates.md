---
phase: 4
title: "Establish Test and CI Gates"
status: pending
priority: P1
dependencies: [3]
effort: "0.5-1 day"
---

# Phase 4: Establish Test and CI Gates

<!-- Updated: Validation Session 1 - verify locked workspace, D1 sessions and full repository baseline -->

## Overview

Lock the Foundation with deterministic local tests and CI gates before any Microsoft or Telegram logic begins.

## Requirements

- Functional: CI runs install, lint, typecheck, unit/integration tests, build, migration validation and secret/forbidden-data scans.
- Non-functional: deterministic, credential-free and suitable for forks/local development.

## Architecture

CI uses local Workers simulation and fake adapters only. Live test jobs do not exist until Chặng 7 and must be separately protected when introduced.

## Related Code Files

- Create: `.github/workflows/ci.yml`.
- Create: test helpers/fixtures under `apps/worker/test/fixtures/` with synthetic data only.
- Create: repository scripts for migration and forbidden-pattern checks.
- Modify: `package.json`, contributor setup docs if needed.

## Implementation Steps

1. Add deterministic fake Graph/Telegram adapter contracts for later phases.
2. Configure Vitest Workers integration and isolated local binding state.
3. Add CI commands for lint, typecheck, test and build.
4. Add migration-from-empty validation and schema forbidden-field scan.
5. Add secret/runtime-value scan covering source, fixtures and artifacts.
6. Add session isolation, expiry, revocation and rotation tests against local D1.
7. Verify every approved Foundation table has a minimal repository contract and user-scope tests where applicable.
8. Document evidence required before advancing to Chặng 2.

## Success Criteria

- [ ] CI passes without network credentials or provisioned resources.
- [ ] Tests are isolated and repeatable.
- [ ] Migration and privacy scans fail on known-bad fixtures.
- [ ] Session tests prove opaque-cookie behavior and immediate server-side revocation.
- [ ] Full approved schema has minimal repository coverage without integration business logic.
- [ ] Secret/runtime-value scan covers URL, tenant/client/resource identifiers and token patterns.
- [ ] Foundation exit evidence maps to roadmap Chặng 1 gate.

## Risk Assessment

- Pattern scans can be noisy: maintain a narrow reviewed allowlist for documented placeholders.
- Fake adapters can diverge from platforms: version contracts and keep all live-dependent claims provisional until Chặng 7.
