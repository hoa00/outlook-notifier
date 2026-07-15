---
title: "Lập kế hoạch spike Telegram webhook và deep link"
date: 2026-07-15
status: completed
tags: [planning, telegram, webhook, security, spike]
plan: "plans/260715-1521-telegram-webhook-deep-link-spike/plan.md"
---

# Lập kế hoạch spike Telegram webhook và deep link

## Context

Chặng 0 cần xác minh hợp đồng Telegram trước khi triển khai production. Spike này độc lập với Graph live PoC, nhưng cả hai đều cung cấp bằng chứng cho architecture baseline và Foundation.

## What happened

- Tạo plan ba phase: audit tài liệu chính thức, chạy PoC cô lập, rồi chốt ADR.
- Bổ sung research và repo scout report.
- Chạy hard-mode red-team và validation: 30/30 claim được xác minh, không còn mâu thuẫn.
- Phạm vi chỉ gồm kế hoạch và bằng chứng; chưa triển khai runtime production.

## Key decisions

- Deep link là bearer capability: người đầu tiên redeem hợp lệ trong private chat được bind; Telegram không chứng minh cùng danh tính.
- Consume-once phải dùng primitive có tính single-consumer được kiểm chứng; KV read-then-delete không đủ atomic.
- Tách replay của start code khỏi dedupe `update_id`.
- Binding và gửi confirmation cần các trạng thái trung gian có thể phục hồi.
- Không phụ thuộc vào retry timing, ordering hoặc exactly-once vì Telegram không cam kết các thuộc tính này.
- Cấm lưu token, secret, raw Update, định danh, username hoặc nội dung tin nhắn trong artifact và log.

## Impact

Plan tạo một exit gate rõ ràng `go`, `revise` hoặc `blocked` cho Telegram integration baseline. Các kế hoạch downstream chỉ được tiếp tục khi có bằng chứng live đã sanitize, kiểm chứng concurrency và hoàn tất teardown tài nguyên dùng một lần.

## Next

- Thực thi Phase 1 để dựng contract matrix từ nguồn Telegram chính thức.
- Chạy PoC bằng bot test, hai tài khoản/client độc lập và Worker route cô lập.
- Xuất ADR, cập nhật roadmap khi quyết định đã được phê duyệt.
- Xác minh teardown và quét dữ liệu nhạy cảm trước khi đóng spike.
