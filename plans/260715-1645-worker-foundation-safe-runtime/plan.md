---
title: "Worker Foundation and Safe Runtime Baseline"
description: "Build the local, testable Worker foundation without provisioning or deploying real external infrastructure."
status: pending
priority: P1
branch: "main"
tags: [foundation, cloudflare-workers, security, testing]
blockedBy: []
blocks: []
created: "2026-07-15T09:38:02.295Z"
createdBy: "ck:plan"
source: skill
---

# Worker Foundation and Safe Runtime Baseline

## Overview

Kế hoạch cho **Chặng 1**, là phase roadmap kế tiếp sau khi contract/ADR Chặng 0 đủ để code. Repo hiện chưa có `package.json`, Worker source, migrations hay tests; vì vậy chưa thể nhảy sang Chặng 2 Microsoft.

Plan tạo một foundation production-shaped nhưng chỉ chạy local/test. Mọi runtime value thật — URL public, Entra tenant/app/client ID, Cloudflare resource ID, Telegram bot/token/webhook secret — bị cấm trong plan này và được dời sang Chặng 7.

## Scope Challenge

- Existing code: documentation, Graph ADR/spike artifacts và placeholder env; chưa có application runtime.
- Minimum change: scaffold, binding/schema contracts, safe runtime shell, test/CI gates.
- Complexity: 4 phase tuần tự; không tạo integration thật hoặc UI.
- Selected mode: HOLD SCOPE (`--hard --auto`).

## Scope

- In: TypeScript strict, pnpm, Hono Worker, local bindings, additive D1 migrations, env schema, session/error/logging shell, kill switch, tests và CI commands.
- Locked architecture: pnpm workspace with the Worker under `apps/worker/`; opaque random session ID in the cookie with revocable server-side session state in D1; initial migration and minimal repositories cover the full approved Foundation schema.
- Out: real Cloudflare resources, deployment, DNS/domain, Entra registration, tenant/client values, Telegram bot, live OAuth/webhooks, production dashboard.
- Provisional boundary: platform-dependent ADRs remain replaceable behind adapters until Chặng 7 live validation.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Scaffold Worker Workspace](./phase-01-scaffold-worker-workspace.md) | Pending |
| 2 | [Define Bindings and Data Baseline](./phase-02-define-bindings-and-data-baseline.md) | Pending |
| 3 | [Implement Safe Runtime Shell](./phase-03-implement-safe-runtime-shell.md) | Pending |
| 4 | [Establish Test and CI Gates](./phase-04-establish-test-and-ci-gates.md) | Pending |

## Dependencies

- Roadmap: Chặng 1 — Nền tảng an toàn và có thể kiểm thử.
- `260715-1521-telegram-webhook-deep-link-spike`: contract audit/ADR là đầu vào mềm có thể hoàn thiện song song; live bot/Worker PoC đã dời Chặng 7 nên không tạo formal blocker cho Foundation.
- Graph live PoC không chặn plan này; permission baseline vẫn `provisional` và không được hard-code xuyên domain layer.

## Acceptance Criteria

- `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm build` chạy local/CI.
- D1 migrations chạy sạch trên database test và không lưu email metadata.
- Env validation nhận placeholder/test values, từ chối thiếu/sai kiểu và không in secret.
- Logger allowlist, error taxonomy, correlation ID, session/CSRF shell và kill switch có test.
- Không có URL/tenant/client/resource ID/token/secret thật hoặc thao tác deploy.

## Validation Log

### Hard-mode Red Team

- Critical risk: defer live Graph validation may cause permission rework. Mitigation: adapter boundary, provisional ADR, final go/no-go at Chặng 7.
- High risk: placeholder config can silently become production config. Mitigation: explicit environment schema, test-only values and secret scanning.
- High risk: schema foundation can violate privacy before feature code exists. Mitigation: allowlisted tables/columns and migration inspection tests.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, phases 1–4, `docs/project-roadmap.md`.
- Decision deltas checked: deploy/runtime values deferred to Chặng 7; Foundation is local/test only.
- Unresolved contradictions: 0.

### Session 1 — 2026-07-15

**Trigger:** Explicit `/ck:plan validate` before Foundation implementation
**Questions asked:** 3

#### Questions & Answers

1. **[Architecture]** Cấu trúc Worker nên đặt ở đâu?
   - Options: `apps/worker/` trong pnpm workspace (Recommended) | Worker đặt trực tiếp ở root
   - **Answer:** `apps/worker/` trong pnpm workspace.
   - **Rationale:** Khớp runbook, giữ root cho workspace/config và không buộc thêm package ứng dụng chưa cần thiết.
2. **[Architecture]** Session shell ở Foundation dùng mô hình nào?
   - Options: Cookie chỉ chứa session ID ngẫu nhiên; trạng thái session lưu D1/KV (Recommended) | Cookie mã hóa chứa toàn bộ session | Chỉ định nghĩa interface, hoãn storage đến Microsoft OAuth
   - **Answer:** Cookie chỉ chứa session ID ngẫu nhiên; trạng thái session lưu server-side.
   - **Rationale:** Cho phép revoke/rotate và tránh đưa token hoặc identity payload vào cookie. D1 là authoritative session store; KV chỉ dành cho state/code TTL ngắn hạn ở phase integration.
3. **[Scope]** Phạm vi Phase 2 nên thế nào?
   - Options: Migration và repositories tối thiểu cho toàn bộ schema đã duyệt (Recommended) | Chỉ migration/schema contract | Tách thành plan riêng
   - **Answer:** Migration và repositories tối thiểu cho toàn bộ schema đã duyệt.
   - **Rationale:** Foundation bàn giao data boundary hoàn chỉnh trước khi integration logic bắt đầu.

#### Confirmed Decisions

- Workspace: one Worker package at `apps/worker/`.
- Sessions: opaque random cookie ID; revocable server-side D1 record; no token/profile payload in cookie.
- Data baseline: initial migration plus minimal repositories for the full approved Foundation schema.

#### Impact on Phases

- Phase 1: workspace location is locked; no root-level Worker alternative.
- Phase 2: add server-side sessions to the migration/repository baseline and cover the full approved schema.
- Phase 3: implement opaque-cookie session middleware backed by the Phase 2 D1 repository.
- Phase 4: test session revocation/isolation and verify the complete migration/repository contract.

### Verification Results — Validation Session 1

- **Tier:** Standard (Fact Checker + Contract Verifier)
- **Claims checked:** 40
- **Verified:** 40 | **Failed:** 0 | **Unverified:** 0
- Existing modify targets verified: `.gitignore`, `.dev.vars.example`, `docs/03-api-data-security.md`.
- Planned create paths do not collide with repository files.
- Binding, schema, privacy, session-cookie, CSRF, logging and kill-switch requirements map to `README.md` and `docs/01`–`04`.
- Validation propagated the selected server-side session contract to `docs/03-api-data-security.md` (`sessions` stores only an opaque-ID digest and lifecycle timestamps).
- Contract consumers currently consist of documentation and spike harnesses; no application callers/imports exist yet.

### Whole-Plan Consistency Sweep — Validation Session 1

- Files reread: `plan.md`, all four `phase-*.md` files.
- Decision deltas checked: workspace location, session storage model, full schema/repository scope.
- Reconciled stale references: encrypted self-contained session wording, optional workspace location, ambiguous repository scope.
- Unresolved contradictions: 0.

## Open Questions

- None. Runtime provisioning choices are intentionally deferred to Chặng 7.
