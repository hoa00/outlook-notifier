---
title: "Graph Permission and Subscription Spike"
description: "Khóa tính khả thi của Mail.ReadBasic và Graph Inbox subscription trước khi bắt đầu nền tảng MVP."
status: pending
priority: P1
branch: ""
tags: [research, api, auth, critical]
blockedBy: []
blocks: []
created: 2026-07-15
createdBy: "ck:plan"
source: skill
---

# Graph Permission and Subscription Spike

## Overview

Plan đầu tiên của Chặng 0. Xác minh bằng tài liệu chính thức và PoC đã khử nhạy cảm rằng delegated `Mail.ReadBasic` đáp ứng subscription Inbox và tập trường notification tối thiểu. Không triển khai production foundation.

Phát hiện hard-review ban đầu: tài liệu Microsoft hiện liệt kê `Mail.Read` cho tạo Outlook message subscription, trong khi `GET message` liệt kê `Mail.ReadBasic`. Đây là mâu thuẫn chặn roadmap, không được suy diễn là `Mail.ReadBasic` đủ dùng.

## Scope

- In: official-contract audit; delegated live PoC; basic notification shape; validation handshake; expiration/lifecycle facts; ADR và báo cáo sanitized.
- Out: Telegram; production OAuth/token storage; D1/KV/Queue; renewal/recovery implementation; `missed` policy; UI; tự nâng quyền.
- Boundary: thử `Mail.ReadBasic` trước. Nếu bằng chứng cho thấy subscription không hoạt động, Phase 3 được phép đề xuất delegated `Mail.Read` đã được chủ sản phẩm phê duyệt trong Validation Session 1; không dùng application permission hoặc tenant-wide admin consent.
- Account coverage: Outlook.com cá nhân và Microsoft 365 work/school. MVP chỉ hỗ trợ tenant cho phép người dùng tự consent; tenant chặn user consent nhận lỗi `unsupported_tenant_consent_policy` và luồng dừng.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Audit official Graph contracts](./phase-01-audit-official-graph-contracts.md) | Pending |
| 2 | [Run sanitized delegated PoC](./phase-02-run-sanitized-delegated-poc.md) | Pending |
| 3 | [Decide permission and subscription baseline](./phase-03-decide-permission-and-subscription-baseline.md) | Pending |

## Dependencies

- Cross-plan: none; đây là điểm bắt đầu roadmap.
- Execution prerequisites to provision inside Phase 2: Entra tenant thử nghiệm do chủ dự án quản lý, Microsoft 365 trial/test mailbox, Outlook.com test account, Entra app hỗ trợ work/school + personal accounts, Cloudflare Worker tại `outlook-notifier.hoadev.com`.
- Không dùng tenant hoặc admin công ty. Nếu Microsoft không cung cấp trial/mailbox phù hợp, Phase 2 ghi blocker/cost thay vì đổi sang tài khoản công ty.

## Success Criteria

- Mỗi claim quan trọng có URL Microsoft chính thức, ngày kiểm tra và kết luận.
- Có bằng chứng live pass/fail cho subscription, webhook validation/notification và minimal message fetch.
- Không commit token, identifier thật, raw payload hoặc email metadata.
- ADR khóa permission/tập field hoặc ghi rõ blocker cần chủ sản phẩm quyết định.
- Có bằng chứng cho cả personal và work/school; tenant chặn self-consent được phân loại unsupported, không phát sinh admin-consent workflow.
- Không còn giả định permission/data-policy chưa được gắn decision owner.

## Validation Log

### Hard-mode red-team findings

- Critical: official create-subscription docs currently say Outlook messages require `Mail.Read`; repository assumes `Mail.ReadBasic` may suffice.
- High: live PoC cannot run without external test infrastructure; do not fake completion with docs-only evidence.
- High: tenant-specific success is not proof for every tenant/account type; record the exact matrix tested.
- Medium: `webLink` is optional product value; drop it before considering broader permission.

### Verification Results

- **Tier:** Standard
- **Claims checked:** 12
- **Verified:** 12 | **Failed:** 0 | **Unverified:** 0
- Verified repository is documentation-only; all referenced project files exist; all planned implementation artifacts are explicitly marked Create.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, all three phase files.
- Decision deltas checked: 4.
- Reconciled stale references: 0.
- Unresolved contradictions: 0; the Microsoft permission mismatch is an explicit PoC decision gate, not an internal plan contradiction.

### Session 1 — 2026-07-15

**Trigger:** Critical-questions validation before PoC implementation
**Questions asked:** 5

#### Questions & Answers

1. **[Scope]** PoC sẽ kiểm thử loại tài khoản nào và hạ tầng nào đã có?
   - Options: Outlook.com | Microsoft 365 work/school | Cả hai
   - **Answer:** Cả hai; chưa có Entra app, mailbox test hoặc endpoint HTTPS.
   - **Rationale:** Bắt buộc provision prerequisites và không suy rộng kết quả từ một loại tài khoản.
2. **[Consent policy]** Tenant doanh nghiệp chặn user consent có được coi là không hỗ trợ thay vì thêm admin approval không?
   - Options: Dừng với unsupported (Recommended) | Thêm admin-consent flow
   - **Answer:** MVP dừng với “không được hỗ trợ”; admin approval để phase nâng cấp.
   - **Rationale:** Giữ đúng yêu cầu không phụ thuộc admin công ty.
3. **[Test infrastructure]** Có tạo Entra tenant và Microsoft 365 trial/test mailbox do chủ dự án quản lý không?
   - Options: Tạo tenant/mailbox test riêng (Recommended) | Dùng tenant công ty | Chỉ test personal
   - **Answer:** Tạo tenant/mailbox test riêng.
   - **Rationale:** Cho phép test work/school độc lập với admin công ty.
4. **[HTTPS endpoint]** Endpoint PoC dùng Cloudflare Worker tạm hay hạ tầng khác?
   - Options: Worker tạm trên custom hostname (Recommended) | `workers.dev` | Hạ tầng khác
   - **Answer:** Cloudflare Worker tại `outlook-notifier.hoadev.com`.
   - **Rationale:** Có HTTPS công khai và phù hợp stack đã khóa.
5. **[Permission trade-off]** Nếu `Mail.ReadBasic` không tạo được subscription, có cho phép đề xuất delegated `Mail.Read` user-consent không?
   - Options: Cho phép fallback có decision gate (Recommended) | Dừng feasibility | Chỉ giảm fields
   - **Answer:** Cho phép.
   - **Rationale:** Giữ khả năng tiếp tục MVP nhưng không tự động mở rộng quyền.

#### Confirmed Decisions

- Test matrix: Outlook.com personal + Microsoft 365 work/school.
- Consent: delegated self-consent only; tenant policy can make an account unsupported.
- Infrastructure: provision isolated Entra tenant/mailbox; deploy disposable Worker on `outlook-notifier.hoadev.com`.
- Permission: baseline `Mail.ReadBasic`; delegated `Mail.Read` is an approved conditional fallback after evidence review.
- Future scope: admin-consent workflow explicitly deferred beyond MVP.

#### Impact on Phases

- Phase 1: document consent-policy distinction and two-account test matrix.
- Phase 2: provision missing test infrastructure; test consent-policy failure; use custom hostname and teardown.
- Phase 3: record conditional `Mail.Read` fallback and MVP unsupported-tenant behavior in ADRs.

### Verification Results — Validation Session 1

- **Tier:** Standard
- **Claims checked:** 30
- **Verified:** 30 | **Failed:** 0 | **Unverified:** 0
- Repository contracts verified against `README.md`, product FR-01/02/03, technical design sections 3/4, runbook Phase 0, and roadmap Chặng 0.
- Contract consumers: documentation only; no application source, routes, configuration, migrations or tests exist yet.
- Planned paths under `docs/spikes/`, `docs/decisions/` and `scripts/spikes/` are correctly marked Create.
- Current Microsoft permissions reference marks delegated `Mail.ReadBasic` and delegated `Mail.Read` as not inherently requiring admin consent; tenant user-consent policy can still deny self-consent.

### Whole-Plan Consistency Sweep — Validation Session 1

- Files reread: `plan.md`, `phase-01-audit-official-graph-contracts.md`, `phase-02-run-sanitized-delegated-poc.md`, `phase-03-decide-permission-and-subscription-baseline.md`.
- Decision deltas checked: 5.
- Reconciled stale references: 8.
- Unresolved contradictions: 0.

## Open Questions

- None for plan validation. Availability/price of a Microsoft 365 trial/test mailbox remains an execution prerequisite to verify, not a design decision.
