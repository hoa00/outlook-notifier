# Outlook → Telegram Notifier

## Bộ tài liệu bàn giao triển khai

Phiên bản tài liệu: 1.0  
Ngày chốt yêu cầu: 15/07/2026  
Stack bắt buộc: TypeScript, Hono, Cloudflare Workers ecosystem  

## Mục tiêu

Xây dựng ứng dụng giúp người dùng nhận thông báo Telegram gần thời gian thực khi có email mới trong Inbox Outlook/Microsoft 365, không cần mở Outlook và không lưu trữ nội dung email.

## Thứ tự đọc dành cho Codex

1. `docs/01-product-requirements.md`: phạm vi, chức năng, hành vi và tiêu chí nghiệm thu.
2. `docs/02-technical-design.md`: kiến trúc, OAuth, Microsoft Graph webhook, Telegram và dữ liệu.
3. `docs/03-api-data-security.md`: API contract, schema D1, bảo mật và quyền riêng tư.
4. `docs/04-implementation-test-runbook.md`: cấu trúc mã nguồn, kế hoạch thực hiện, kiểm thử và vận hành.
5. `docs/project-roadmap.md`: thứ tự các chặng, dependency, cổng nghiệm thu và phạm vi để lập từng implementation plan nhỏ.

## Các quyết định đã chốt

- Dùng Microsoft Graph change notifications qua webhook, không polling làm cơ chế chính.
- Dùng delegated OAuth: mỗi người dùng chỉ kết nối mailbox của chính họ.
- Chỉ theo dõi email mới được tạo trong Inbox.
- Không lưu subject, sender, body, body preview, recipient hoặc attachment.
- Khi có webhook, worker lấy metadata tối thiểu từ Graph trong bộ nhớ, gửi Telegram rồi loại bỏ.
- MVP dùng một Telegram bot chung do hệ thống quản lý.
- Kết nối Telegram bằng deep link `/start <one-time-code>`; không yêu cầu người dùng nhập `chat_id`.
- Dùng Hono trên Cloudflare Workers, D1, Queues, Cron Triggers và KV.
- Dùng `Mail.ReadBasic` nếu các trường thực tế cần lấy đều được phép; không tự nâng lên `Mail.Read` nếu chưa có yêu cầu và phê duyệt.
- Webhook phải phản hồi nhanh; mọi xử lý Graph/Telegram diễn ra qua Queue.
- Không ghi payload Graph, thông tin email hoặc nội dung Telegram notification vào log.

## Ngoài phạm vi MVP

- Quản lý, tìm kiếm hoặc hiển thị danh sách email.
- Lưu nội dung email và attachment.
- Đánh dấu đã đọc, di chuyển, xóa hoặc trả lời email.
- Shared mailbox hoặc quyền application toàn tổ chức.
- Người dùng tự cấu hình bot token riêng.
- AI phân loại hoặc tóm tắt nội dung email.
- Đồng bộ lịch sử mailbox.

## Local setup (Foundation)

```bash
pnpm install
pnpm verify
```

Foundation is local/test only (`apps/worker`, D1 migration, CI gates). Do not provision real Cloudflare, Entra, or Telegram resources here — that stays deferred to Chặng 7.

## Nguyên tắc xử lý điểm chưa rõ

Codex không được tự mở rộng quyền Microsoft hoặc phạm vi lưu dữ liệu. Nếu tài liệu chưa quy định một hành vi có ảnh hưởng đến quyền riêng tư, chi phí hoặc mô hình cấp quyền, phải dừng và yêu cầu quyết định thay vì tự suy đoán.
