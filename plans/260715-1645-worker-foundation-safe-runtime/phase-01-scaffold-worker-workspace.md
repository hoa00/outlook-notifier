---
phase: 1
title: "Scaffold Worker Workspace"
status: pending
priority: P1
dependencies: []
effort: "0.5-1 day"
---

# Phase 1: Scaffold Worker Workspace

<!-- Updated: Validation Session 1 - lock pnpm workspace and apps/worker location -->

## Overview

Create the minimal pnpm/TypeScript/Hono/Cloudflare Workers workspace that runs locally and exposes no real integration.

## Requirements

- Functional: Worker health route, typed `fetch` entrypoint, scripts for lint/typecheck/test/build.
- Non-functional: strict TypeScript, Workers-compatible APIs, minimal dependencies, no real account/resource configuration.

## Architecture

One pnpm workspace with exactly one application package at `apps/worker/`. Thin handlers call explicit domain/service boundaries. Microsoft and Telegram clients start as interfaces plus fakes; no live SDK wiring.

## Related Code Files

- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `apps/worker/package.json`, `apps/worker/wrangler.jsonc`.
- Create: `apps/worker/src/index.ts`, `apps/worker/src/routes/health.ts`.
- Create: `apps/worker/test/health.test.ts`.
- Modify: `.gitignore`, `.dev.vars.example` only for safe placeholders.

## Implementation Steps

1. Initialize pnpm workspace and strict shared TypeScript configuration.
2. Add minimal Hono Worker package and local dev/build scripts.
3. Implement health route with no environment or upstream dependency.
4. Add lint/format policy consistent with the repository.
5. Add a Workers test harness and first request test.
6. Verify no Node-only API or live binding is required.
7. Keep executable Worker code out of the repository root; root contains workspace-wide configuration only.

## Success Criteria

- [ ] Local Worker health request passes.
- [ ] lint/typecheck/test/build commands exist and pass.
- [ ] Dependency set is minimal and Workers-compatible.
- [ ] Worker source and tests live under `apps/worker/`; no competing root Worker entrypoint exists.
- [ ] No real URL, tenant, resource ID, token or secret is introduced.

## Risk Assessment

- Premature monorepo complexity: retain one application package and shared root config only.
- Framework leakage into domain logic: keep route thin and adapters injectable.
