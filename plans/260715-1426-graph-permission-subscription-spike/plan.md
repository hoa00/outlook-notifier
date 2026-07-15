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
- Boundary: mọi yêu cầu `Mail.Read` phải dừng ở decision gate và cần phê duyệt bằng văn bản.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Audit official Graph contracts](./phase-01-audit-official-graph-contracts.md) | Pending |
| 2 | [Run sanitized delegated PoC](./phase-02-run-sanitized-delegated-poc.md) | Pending |
| 3 | [Decide permission and subscription baseline](./phase-03-decide-permission-and-subscription-baseline.md) | Pending |

## Dependencies

- Cross-plan: none; đây là điểm bắt đầu roadmap.
- Execution prerequisites: Entra test app, test mailbox, delegated test user, public HTTPS callback/webhook, quyền quản trị cần thiết để cấp consent.
- Phase 2 bị chặn nếu các prerequisite trên chưa được cung cấp; Phase 1 vẫn thực hiện độc lập.

## Success Criteria

- Mỗi claim quan trọng có URL Microsoft chính thức, ngày kiểm tra và kết luận.
- Có bằng chứng live pass/fail cho subscription, webhook validation/notification và minimal message fetch.
- Không commit token, identifier thật, raw payload hoặc email metadata.
- ADR khóa permission/tập field hoặc ghi rõ blocker cần chủ sản phẩm quyết định.
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

## Open Questions

- Which Entra tenant/test accounts are available for the PoC? Record, do not assume, single-tenant vs multi-tenant coverage.
- If subscription creation requires `Mail.Read`, should the product drop Graph subscription feasibility or request a separately approved scope change? Phase 3 must stop for owner decision.

