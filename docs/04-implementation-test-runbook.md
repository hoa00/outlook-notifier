# 04. Kế hoạch triển khai, kiểm thử và vận hành

## 1. Cấu trúc repository đề xuất

```text
.
├── apps/
│   └── worker/
│       ├── src/
│       │   ├── index.ts
│       │   ├── env.ts
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── api.ts
│       │   │   ├── microsoft-webhook.ts
│       │   │   └── telegram-webhook.ts
│       │   ├── services/
│       │   │   ├── microsoft-auth.ts
│       │   │   ├── microsoft-graph.ts
│       │   │   ├── graph-subscriptions.ts
│       │   │   ├── telegram.ts
│       │   │   ├── token-crypto.ts
│       │   │   └── notification.ts
│       │   ├── queue/
│       │   │   └── mail-consumer.ts
│       │   ├── scheduled/
│       │   │   └── renew-subscriptions.ts
│       │   ├── repositories/
│       │   ├── schemas/
│       │   └── ui/
│       ├── test/
│       └── wrangler.jsonc
├── migrations/
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

Monorepo không bắt buộc nếu chỉ có một Worker; giữ cấu trúc đơn giản hơn nếu không làm giảm separation of concerns.

## 2. Quy tắc coding cho Codex

- TypeScript `strict: true`; tránh `any`.
- Validate mọi payload ngoài biên bằng schema runtime.
- Không để business logic trực tiếp trong route handler.
- Inject client/fetch hoặc dùng adapter để test Graph và Telegram.
- Mọi repository query theo user phải nhận user ID từ session, không từ body tùy ý.
- Dùng UTC trong database; chỉ đổi timezone khi format notification.
- Không log object lỗi upstream nếu object có request/response body.
- Không thêm dependency khi platform API đáp ứng tốt.
- Mỗi migration bất biến, không sửa migration đã áp dụng.

## 3. Các giai đoạn triển khai

### Phase 0 — Khóa contract và rủi ro

- Audit official contracts cho `Mail.ReadBasic`, resource ID, expiration/lifecycle, Telegram webhook/deep link/`sendMessage`.
- Dùng fixture/harness để khóa parser, adapter và failure contract.
- Ghi ADR; claim cần môi trường thật phải mang trạng thái `provisional` và có fallback/decision owner.

### Phase 1 — Foundation

- Khởi tạo TypeScript/Hono/Workers.
- Bind D1, KV, Queue, Cron.
- Migration schema.
- Env validation và secret placeholders.
- Session/auth shell, error model, logging allowlist.

Phase 0–6 chỉ dùng placeholder, fake upstream, fixture và local bindings. Không điền URL, tenant/app/client ID, resource ID, bot token hoặc secret thật.

### Phase 2 — Microsoft connection

- OAuth start/callback.
- Token encryption/rotation-ready envelope.
- Microsoft connection repository.
- Graph subscription create/delete/renew.
- Webhook validation và clientState verification.

### Phase 3 — Telegram connection

- Telegram adapter `getMe`/`sendMessage`.
- Webhook secret validation.
- One-time link và `/start` binding.
- Test notification và disconnect.

### Phase 4 — Notification pipeline

- Enqueue Graph event.
- Queue consumer.
- Fetch minimal fields.
- Plain text formatter.
- Retry classification.
- KV dedupe.
- Health status updates không chứa email data.

### Phase 5 — Lifecycle và hardening

- Cron renewal.
- Lifecycle recovery.
- Missed notification policy.
- Rate limiting.
- Account deletion.
- Security/privacy audit.

### Phase 6 — UI và release logic

- Landing/login/dashboard/settings.
- Connection state UX.
- Privacy disclosure.
- End-to-end bằng test harness.
- Runbook và checklist rollback.

### Phase 7 — Provision, deploy và live validation

- Provision Entra test tenant/app/mailboxes, Telegram test bot/accounts và Cloudflare resources.
- Ánh xạ placeholder sang runtime values bằng bindings/secret manager; không ghi giá trị thật vào repo.
- Apply migrations, deploy Worker, cấu hình Graph/Telegram webhooks.
- Chạy live PoC, AT-01..12, email-to-Telegram E2E, privacy scan, smoke test và rollback rehearsal.
- Chốt các ADR `provisional`; dừng release nếu permission/API contract không đạt.

## 4. Acceptance tests

### AT-01 Microsoft connect

Given user chưa kết nối Microsoft  
When hoàn thành consent  
Then connection được lưu, refresh token được mã hóa và subscription active.

### AT-02 Telegram connect

Given user đã đăng nhập  
When mở deep link và gửi `/start`  
Then chat được liên kết đúng user, code bị vô hiệu và bot gửi xác nhận.

### AT-03 Email notification

Given cả hai kết nối active  
When email mới xuất hiện trong Inbox  
Then Telegram nhận sender, subject và thời gian theo settings, trong mục tiêu độ trễ.

### AT-04 Không lưu email

After AT-03  
Then không tìm thấy sender/subject/body/message payload trong D1, KV values, logs, traces hoặc DLQ.

Lưu ý: KV có thể có message/resource ID đã TTL cho dedupe.

### AT-05 Duplicate webhook

Given cùng notification được gửi ít nhất hai lần  
When consumer xử lý  
Then thông thường chỉ một Telegram message được gửi; test cũng ghi nhận giới hạn exactly-once đã mô tả.

### AT-06 Disabled

Given user đặt `enabled=false`  
When email mới đến  
Then không gửi Telegram và không fetch metadata nếu có thể bỏ sớm.

### AT-07 Disconnect while queued

Given job đang trong queue  
When user disconnect trước lúc consumer chạy  
Then job được ACK/bỏ qua và không gửi Telegram.

### AT-08 Token revoked

Given refresh token bị revoke  
When job hoặc renewal chạy  
Then user thành `reauthorization_required`, không retry vô hạn và UI hướng dẫn connect lại.

### AT-09 Telegram blocked

Given user block bot  
When gửi notification  
Then destination thành `telegram_unreachable`, không retry vô hạn và lỗi không chứa email data.

### AT-10 Subscription renewal

Given subscription sắp hết hạn  
When Cron chạy  
Then subscription được renew trước expiry và DB cập nhật atomically.

### AT-11 Malicious content

Given subject chứa HTML, Markdown, Unicode/control characters và chuỗi rất dài  
When gửi Telegram  
Then message không phá format, không inject link và nằm trong giới hạn API.

### AT-12 Forged webhooks

- Sai Graph clientState: reject/no enqueue.
- Sai Telegram secret: reject/no mutation.
- OAuth callback sai state: reject/no token exchange persistence.

## 5. Test pyramid

### Unit tests

- Token encryption round-trip, random nonce, wrong key failure.
- OAuth state lifecycle.
- Notification formatter và truncation.
- Telegram error classification.
- Graph error classification.
- Settings validation/timezone.
- Status state machine.

### Integration tests

- Hono routes với D1/KV test bindings.
- Webhook validationToken plain-text response.
- Graph webhook batch → Queue job.
- Queue job → mocked Graph → mocked Telegram.
- Cron renewal phân trang.
- Cascading account deletion.

### End-to-end tests

- Microsoft sandbox/test tenant thực tế.
- Telegram test bot thực tế.
- Email mới end-to-end.
- Revoke consent và reconnect.
- Block/unblock bot.
- Redeploy trong khi subscription vẫn active.

Không đưa tài khoản, token hoặc địa chỉ email thật vào fixture/CI artifact.

## 6. CI/CD gates

Mỗi pull request phải chạy:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Thêm kiểm tra:

- Secret scanning.
- Dependency audit phù hợp.
- Migration validation.
- Test chứng minh logger redaction/allowlist.
- Không có bảng/model lưu email ngoài danh sách đã duyệt.

Deployment:

1. Apply D1 migration tương thích ngược.
2. Deploy Worker.
3. Cấu hình/kiểm tra Telegram webhook.
4. Smoke test health, OAuth start, webhook validation và test notification.
5. Theo dõi error-rate không chứa payload.

## 7. Observability

Metrics tối thiểu:

```text
graph_webhook_received_total
graph_webhook_rejected_total
graph_subscription_active
graph_subscription_renew_success_total
graph_subscription_renew_failure_total
mail_jobs_processed_total
mail_jobs_retry_total
mail_jobs_failed_total
telegram_send_success_total
telegram_send_failure_total
telegram_destination_unreachable_total
```

Dashboard/alert:

- Subscription renewal failure tăng cao.
- Webhook reject tăng bất thường.
- Queue backlog/oldest age vượt ngưỡng.
- Telegram `429`, `5xx` tăng.
- Tỷ lệ reauthorization tăng.

Không tạo metric label có cardinality cao như user ID, message ID, sender hoặc subject.

## 8. Runbook sự cố

### Graph webhook không đến

1. Kiểm tra subscription active/expiry.
2. Kiểm tra validation và endpoint HTTPS.
3. Kiểm tra Graph lifecycle event metrics.
4. Renew hoặc recreate subscription.
5. Không quét toàn mailbox để “bù” nếu chưa tuân chính sách missed.

### Queue backlog

1. Kiểm tra Graph/Telegram rate limit.
2. Kiểm tra consumer error classification.
3. Tăng concurrency trong giới hạn an toàn.
4. Đảm bảo DLQ không chứa email metadata.

### Telegram bot token lộ

1. Revoke/rotate qua BotFather ngay.
2. Cập nhật Workers Secret.
3. Cập nhật webhook.
4. Kiểm tra truy cập bất thường bằng metadata vận hành được phép.
5. Không log token cũ trong ticket.

### Encryption key cần rotate

1. Tạo key version mới.
2. Deploy khả năng decrypt cả cũ/mới, encrypt chỉ bằng key mới.
3. Re-encrypt token dần khi sử dụng hoặc bằng job kiểm soát.
4. Chỉ gỡ key cũ sau khi không còn record sử dụng.

## 9. Rollback

- Giữ migration tương thích ít nhất một phiên bản deploy.
- Rollback code không được làm mất khả năng decrypt token hiện tại.
- Nếu pipeline gửi lỗi hàng loạt, có feature flag/kill switch toàn hệ thống để ngừng consumer gửi Telegram nhưng vẫn có thể nhận/ACK webhook an toàn.
- Không replay DLQ hàng loạt nếu có nguy cơ spam; yêu cầu thao tác có kiểm soát.

## 10. Checklist bàn giao cuối cùng

- [ ] README cài đặt local và deploy đầy đủ.
- [ ] `.dev.vars.example`/env example không có secret thật.
- [ ] Entra app registration guide.
- [ ] Telegram BotFather/webhook setup guide.
- [ ] Wrangler bindings và migrations.
- [ ] Architecture Decision Records cho scope, permission và missed policy.
- [ ] API schemas và OpenAPI nếu dự án dùng.
- [ ] Unit/integration/E2E tests đạt.
- [ ] Privacy policy draft và consent copy.
- [ ] Không lưu/log email được kiểm chứng.
- [ ] Monitoring, alert và incident runbook hoạt động.
- [ ] Chủ sản phẩm xác nhận giới hạn best-effort dedupe và hành vi email moved-to-Inbox.

## 11. Prompt khởi động dành cho Codex

```text
Hãy triển khai Outlook → Telegram Notifier theo toàn bộ tài liệu trong thư mục docs.
Đọc README.md rồi đọc lần lượt 01 đến 04 trước khi chỉnh sửa mã nguồn.

Các ràng buộc không được vi phạm:
- TypeScript + Hono + Cloudflare Workers ecosystem.
- Microsoft delegated OAuth, mỗi user chỉ truy cập mailbox của chính họ.
- Microsoft Graph webhook cho email mới trong Inbox.
- MVP dùng một Telegram bot chung và deep-link one-time để lấy chat_id.
- Không lưu hoặc log sender, subject, body, recipients, attachment hoặc raw Graph/Telegram payload.
- Queue job chỉ chứa ID kỹ thuật; webhook phải phản hồi nhanh.
- Không tự nâng Mail.ReadBasic thành Mail.Read nếu chưa báo cáo spike và được phê duyệt.

Trước khi code, hãy:
1. Khảo sát repository và AGENTS.md.
2. Lập plan theo Phase 0–6.
3. Thực hiện Phase 0 để xác minh các giả định API hiện hành bằng tài liệu chính thức.
4. Báo cáo mọi mâu thuẫn giữa API hiện hành và tài liệu trước khi thay đổi phạm vi.

Sau mỗi phase, chạy lint, typecheck và tests liên quan. Khi hoàn tất, cung cấp bằng chứng test, migration, hướng dẫn cấu hình Entra/Telegram/Cloudflare và danh sách giới hạn còn lại.
```
