# 01. Đặc tả sản phẩm

## 1. Tầm nhìn

Sản phẩm là một dịch vụ thông báo, không phải email client. Người dùng kết nối tài khoản Microsoft và Telegram một lần; sau đó nhận thông báo Telegram khi Inbox có thư mới.

## 2. Đối tượng sử dụng

- Người dùng Outlook.com hoặc tài khoản Microsoft 365 có mailbox Outlook.
- Người thường xuyên theo dõi Telegram nhưng không muốn liên tục mở Outlook.
- MVP phục vụ từng cá nhân; không quản trị mailbox của người khác.

## 3. User journey chuẩn

1. Người dùng mở landing page và chọn “Đăng nhập với Microsoft”.
2. Hệ thống thực hiện OAuth Authorization Code Flow và xin đúng quyền tối thiểu.
3. Sau callback thành công, hệ thống tạo Microsoft Graph subscription cho Inbox.
4. Dashboard yêu cầu người dùng kết nối Telegram.
5. Hệ thống tạo one-time link có thời hạn và mở bot Telegram.
6. Người dùng nhấn Start; Telegram webhook liên kết `chat_id` với tài khoản.
7. Hệ thống gửi thông báo thử.
8. Người dùng bật dịch vụ.
9. Khi Inbox có email mới, Telegram nhận một thông báo.
10. Người dùng có thể tắt thông báo hoặc ngắt từng kết nối bất cứ lúc nào.

## 4. Chức năng MVP

### FR-01 — Đăng nhập và kết nối Microsoft

- Đăng nhập bằng Microsoft OAuth 2.0 delegated flow.
- Chấp nhận tài khoản Microsoft theo cấu hình Entra app đã chọn; phải ghi rõ app là single-tenant hay multi-tenant trong biến cấu hình và tài liệu triển khai.
- Scope dự kiến: `openid profile offline_access User.Read Mail.ReadBasic`.
- Sau đăng nhập, lấy định danh Microsoft, tenant ID và email đăng nhập cần thiết cho tài khoản ứng dụng.
- Refresh token phải được mã hóa trước khi ghi D1.
- Nếu Microsoft không cấp đủ quyền, hiển thị lỗi có hướng dẫn thử lại.

### FR-02 — Quản lý Graph subscription

- Tạo subscription trên `/me/mailFolders('inbox')/messages`.
- `changeType` chỉ gồm `created`.
- Có `notificationUrl`, `lifecycleNotificationUrl` và `clientState` riêng, ngẫu nhiên, đủ entropy.
- Lưu ID, thời hạn và trạng thái subscription; không lưu email payload.
- Tự động gia hạn trước khi hết hạn bằng Cron Trigger.
- Tự khôi phục khi nhận `subscriptionRemoved`, `reauthorizationRequired` hoặc `missed` theo chính sách kỹ thuật.
- Khi người dùng disconnect Microsoft, xóa subscription từ Graph nếu còn truy cập được và xóa token cục bộ dù xóa Graph thất bại.

### FR-03 — Xác thực Graph webhook

- Khi Graph gửi `validationToken`, trả về đúng token dạng plain text trong thời hạn Microsoft yêu cầu.
- Với notification thông thường, kiểm tra subscription tồn tại và `clientState` khớp bằng so sánh an toàn.
- Không tin `resource` hoặc ID từ request nếu subscription không hợp lệ.
- Webhook chỉ chuẩn hóa envelope tối thiểu, enqueue và phản hồi nhanh.
- Hỗ trợ notification batch.

### FR-04 — Kết nối Telegram bằng bot chung

- Bot token là secret cấp hệ thống, không lưu theo user.
- Từ dashboard, tạo mã liên kết một lần, ngẫu nhiên, TTL tối đa 10 phút.
- Deep link có dạng `https://t.me/<bot_username>?start=<opaque_code>`.
- Telegram webhook nhận `/start <opaque_code>`, xác minh mã chưa dùng/chưa hết hạn rồi gắn `chat_id` với đúng user.
- Mã phải bị vô hiệu ngay sau lần dùng đầu tiên.
- Bot gửi xác nhận kết nối thành công.
- MVP hỗ trợ private chat. Group chat là tính năng 1.1, không cài ngầm trong MVP.

### FR-05 — Gửi notification email mới

- Queue consumer nhận job từ Graph webhook.
- Làm mới access token khi cần.
- Gọi Graph lấy đúng các trường: message ID, sender/from, subject, receivedDateTime và web link nếu quyền/API hỗ trợ.
- Không yêu cầu body, body preview, recipients hoặc attachment.
- Escape toàn bộ dữ liệu không tin cậy trước khi dùng Telegram parse mode; MVP ưu tiên plain text.
- Mẫu mặc định:

```text
Email mới

Từ: Nguyễn Văn A <a@example.com>
Tiêu đề: Báo giá tháng 7
Thời gian: 15/07/2026 14:30
```

- Nếu người dùng tắt sender hoặc subject, loại bỏ dòng tương ứng.
- Nếu trường bị thiếu, dùng giá trị an toàn như “Không xác định” hoặc “(Không có tiêu đề)”.
- Sau lần gọi Telegram, không ghi dữ liệu email vào D1, KV, log, analytics, dead-letter payload hoặc error tracker.

### FR-06 — Chống gửi trùng

- Tạo khóa dedupe từ subscription ID và message/resource ID.
- Lưu khóa kỹ thuật trong KV với TTL 24–72 giờ; không lưu metadata email.
- Cần trạng thái đủ để tránh gửi lặp khi Queue retry nhưng không được tạo lịch sử email vĩnh viễn.
- Thiết kế phải nêu rõ thời điểm đánh dấu “sent”: chỉ sau Telegram thành công, đồng thời giảm rủi ro double-send do crash bằng idempotency/best-effort phù hợp giới hạn Telegram.

### FR-07 — Dashboard

Hiển thị:

- Tài khoản Microsoft đã kết nối.
- Telegram đã kết nối hay chưa; tên bot và loại chat, không bắt buộc hiện chat ID thô.
- Trạng thái dịch vụ: bật/tắt.
- Trạng thái Graph subscription.
- Lần gửi thành công gần nhất, chỉ timestamp.
- Lỗi gần nhất dưới dạng mã lỗi đã khử dữ liệu nhạy cảm.
- Các thao tác: kết nối/ngắt Microsoft, kết nối/ngắt Telegram, bật/tắt, gửi thử.

Dashboard không hiển thị email gần nhất, sender gần nhất hoặc subject gần nhất.

### FR-08 — Cấu hình thông báo

MVP gồm:

- `enabled`.
- `showSender`, mặc định `true`.
- `showSubject`, mặc định `true`.
- `timezone`, mặc định `Asia/Ho_Chi_Minh`.
- Gửi notification thử không chứa dữ liệu email thật.

### FR-09 — Disconnect và xóa dữ liệu

- Disconnect Telegram: xóa destination và ngừng gửi ngay.
- Disconnect Microsoft: xóa token, subscription record và ngừng xử lý job mới.
- Xóa tài khoản: xóa toàn bộ cấu hình, token, destination, trạng thái và khóa liên kết liên quan.
- Job đã enqueue nhưng user đã disconnect phải tự hủy an toàn khi consumer kiểm tra trạng thái.

## 5. Yêu cầu phi chức năng

### NFR-01 — Độ trễ

- Mục tiêu p95 từ khi nhận Graph webhook đến khi Telegram API chấp nhận message: dưới 30 giây trong điều kiện dịch vụ ngoài hoạt động bình thường.
- Không cam kết thời gian từ lúc email đến Microsoft đến lúc Microsoft phát webhook.

### NFR-02 — Độ tin cậy

- Retry lỗi mạng, `429` và `5xx` với exponential backoff và jitter.
- Không retry vô hạn các lỗi xác thực hoặc chat bị block.
- Có dead-letter handling nhưng payload DLQ chỉ chứa ID kỹ thuật, không chứa email metadata.

### NFR-03 — Bảo mật

- Least privilege.
- Secrets không nằm trong source control hoặc frontend bundle.
- Token mã hóa at application layer trước khi lưu D1.
- State OAuth và PKCE/nonce theo flow đã chọn phải được kiểm tra.
- Cookie session `HttpOnly`, `Secure`, `SameSite=Lax` hoặc chặt hơn.

### NFR-04 — Quyền riêng tư

- Không lưu email content hoặc metadata ngoài thời gian xử lý request/job.
- Không log Graph response body hay Telegram message text.
- Chính sách quyền riêng tư phải nói rõ metadata được truyền sang Telegram.

### NFR-05 — Khả năng quan sát

- Metrics theo mã/nhóm, không theo nội dung: webhook accepted/rejected, queue success/retry/fail, Graph status class, Telegram status class, active subscription count.
- Correlation ID ngẫu nhiên không chứa message ID nếu hệ thống log được truy cập rộng.

## 6. Trạng thái hệ thống

Một user có thể có các trạng thái:

- `microsoft_disconnected`
- `telegram_disconnected`
- `ready_disabled`
- `active`
- `reauthorization_required`
- `subscription_degraded`
- `telegram_unreachable`

Chỉ trạng thái `active` mới được gửi notification thật.

## 7. Edge cases bắt buộc

- Graph gửi cùng notification nhiều lần.
- Một webhook chứa nhiều notification.
- Email bị di chuyển/xóa trước khi consumer fetch.
- Một item xuất hiện trong Inbox do move thay vì vừa được giao đến; chấp nhận đây là giới hạn của `created` trong Inbox và ghi vào UI/help.
- User disconnect trong khi job đang chờ.
- Refresh token bị revoke.
- Subscription hết hạn trong lúc Cron lỗi.
- Lifecycle event `missed`.
- Telegram trả `429` với `retry_after`.
- Bot bị người dùng block hoặc bị xóa khỏi chat.
- Subject chứa HTML/Markdown/control characters hoặc dài hơn giới hạn message.
- Sender hoặc subject rỗng.
- Hai webhook đến đồng thời cho cùng message.

## 8. Tính năng sau MVP

### Version 1.1

- Telegram group.
- Quiet hours.
- Filter sender/domain/từ khóa.
- Nút mở email trong Outlook nếu có URL ổn định.
- Nhiều mailbox Microsoft trên một tài khoản app.

### Version 2

- Bot riêng của người dùng.
- Nhiều Telegram destination.
- Rule routing.
- Daily digest.
- Gói trả phí/quota.

Mọi tính năng filter theo subject/sender vẫn phải xử lý tạm thời và không tạo lịch sử email.

## 9. Definition of Done cấp sản phẩm

- Luồng Microsoft connect hoàn chỉnh trên môi trường production-like HTTPS.
- Luồng Telegram deep link hoàn chỉnh.
- Email mới thực tế tạo đúng một notification trong ca kiểm thử bình thường.
- Không có email metadata trong D1/KV lâu dài, log hoặc DLQ.
- Subscription được gia hạn tự động và có test cho recovery.
- Disconnect có hiệu lực cả với job đang chờ.
- Security checklist và acceptance tests trong tài liệu 04 đều đạt.

