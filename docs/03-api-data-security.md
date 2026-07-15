# 03. API, dữ liệu và bảo mật

## 1. API contract

Tất cả `/api/*` yêu cầu session hợp lệ và CSRF protection cho mutation nếu dùng cookie auth. Response lỗi không để lộ token, payload bên thứ ba hoặc stack trace.

### Authentication

| Method | Route | Mục đích |
|---|---|---|
| GET | `/auth/microsoft` | Bắt đầu OAuth |
| GET | `/auth/microsoft/callback` | Nhận authorization code |
| POST | `/api/microsoft/disconnect` | Thu hồi/xóa kết nối |
| POST | `/api/logout` | Kết thúc session app |

### Telegram

| Method | Route | Mục đích |
|---|---|---|
| POST | `/api/telegram/link` | Tạo deep link one-time |
| POST | `/api/telegram/test` | Gửi notification giả lập |
| POST | `/api/telegram/disconnect` | Xóa destination |
| POST | `/webhooks/telegram` | Nhận update từ bot |

`POST /api/telegram/link` response:

```json
{
  "url": "https://t.me/example_bot?start=opaque-code",
  "expiresAt": "2026-07-15T08:10:00Z"
}
```

### Microsoft webhook

| Method | Route | Mục đích |
|---|---|---|
| POST | `/webhooks/microsoft` | Validation và mail notification |
| POST | `/webhooks/microsoft/lifecycle` | Lifecycle notification |

### Settings/status

| Method | Route | Mục đích |
|---|---|---|
| GET | `/api/status` | Trạng thái kết nối đã khử nhạy cảm |
| GET | `/api/settings` | Đọc cấu hình notification |
| PUT | `/api/settings` | Cập nhật cấu hình |
| POST | `/api/notifications/test` | Gửi tin mẫu |
| DELETE | `/api/account` | Xóa tài khoản và cấu hình |

Settings schema:

```ts
type NotificationSettings = {
  enabled: boolean;
  showSender: boolean;
  showSubject: boolean;
  timezone: string;
};
```

Status response không được có email event data:

```ts
type AppStatus = {
  state:
    | 'microsoft_disconnected'
    | 'telegram_disconnected'
    | 'ready_disabled'
    | 'active'
    | 'reauthorization_required'
    | 'subscription_degraded'
    | 'telegram_unreachable';
  microsoft: { connected: boolean; accountEmail?: string };
  telegram: { connected: boolean; botUsername?: string; chatType?: string };
  subscription: { status: string; expiresAt?: string };
  delivery: { lastSuccessAt?: string; lastFailureAt?: string; lastErrorCode?: string };
};
```

## 2. D1 schema đề xuất

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  microsoft_user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, microsoft_user_id)
);

CREATE TABLE sessions (
  id_digest TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user_expiry
  ON sessions(user_id, expires_at);

CREATE TABLE microsoft_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_refresh_token TEXT NOT NULL,
  token_key_version INTEGER NOT NULL,
  granted_scopes TEXT NOT NULL,
  status TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE graph_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  client_state_digest TEXT NOT NULL,
  resource TEXT NOT NULL,
  change_type TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL,
  last_renewed_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_graph_subscriptions_expiry
  ON graph_subscriptions(status, expires_at);

CREATE TABLE telegram_destinations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  chat_type TEXT NOT NULL,
  chat_title TEXT,
  status TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notification_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  show_sender INTEGER NOT NULL DEFAULT 1 CHECK(show_sender IN (0,1)),
  show_subject INTEGER NOT NULL DEFAULT 1 CHECK(show_subject IN (0,1)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  updated_at TEXT NOT NULL
);

CREATE TABLE delivery_status (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_success_at TEXT,
  last_failure_at TEXT,
  last_error_code TEXT,
  updated_at TEXT NOT NULL
);
```

Không tạo bảng `messages`, `emails`, `notifications_history` hoặc bảng tương đương.

`chat_title` là dữ liệu cấu hình Telegram, không phải email; có thể bỏ nếu muốn tối thiểu hóa dữ liệu.

Cookie session chỉ chứa ID ngẫu nhiên opaque. D1 chỉ lưu digest của ID cùng user, expiry và trạng thái revoke; không lưu access/refresh token, profile hoặc authorization payload trong cookie/session record. KV dành cho OAuth state, link code và dedupe TTL ngắn hạn, không phải session store authoritative.

## 3. Bindings và secrets

Ví dụ tên binding, không đưa giá trị thật vào repo:

```ts
type Env = {
  DB: D1Database;
  APP_KV: KVNamespace;
  MAIL_QUEUE: Queue<MailNotificationJob>;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_TENANT: string;
  TOKEN_ENCRYPTION_KEY: string;
  TOKEN_KEY_VERSION: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_BOT_USERNAME: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  APP_BASE_URL: string;
  SESSION_SECRET: string;
};
```

Non-secret config có thể nằm trong `wrangler.jsonc`; secret phải dùng secret bindings.

Từ Chặng 0–6, các tên trên chỉ là config contract/placeholder cho local test. Giá trị tenant/app/client, URL public, resource ID, bot token và secret thật chỉ được provision ở Chặng 7 qua Workers bindings/secret manager; runtime inventory và giá trị thật không nằm trong repo.

## 4. Mã hóa token

- Dùng Web Crypto API tương thích Workers.
- Mã hóa authenticated encryption, ví dụ AES-GCM với nonce ngẫu nhiên duy nhất cho mỗi encryption.
- Record chứa key version, nonce và ciphertext; không dùng một nonce cố định.
- Encryption key không lưu D1.
- Hỗ trợ rotation: decrypt theo key version cũ, re-encrypt khi token được cập nhật.
- Không tự thiết kế crypto ngoài primitive chuẩn.

## 5. Threat model tối thiểu

| Nguy cơ | Biện pháp bắt buộc |
|---|---|
| OAuth login CSRF | state ngẫu nhiên, TTL, single use, redirect allowlist |
| Token bị lộ từ D1 | application-layer encryption, key tách biệt |
| Graph webhook giả | validation flow, subscription lookup, clientState verification |
| Telegram webhook giả | webhook secret header, route secret, schema validation |
| Link Telegram bị chiếm | code entropy cao, TTL, one-time, không chứa user ID |
| IDOR trên API | mọi query scope theo authenticated user ID |
| Stored/reflected injection | không render raw values; escape UI và Telegram formatting |
| Log rò rỉ email | structured allowlist logging; cấm raw request/response |
| Queue/DLQ rò rỉ | job chỉ có ID kỹ thuật |
| Replay webhook | dedupe TTL và validate subscription state |
| Bot token bị lộ | Workers Secret, không trả frontend, rotate runbook |
| Abuse test endpoint | auth, rate limit, cooldown |

## 6. Logging allowlist

Được log:

- `correlationId`.
- Route name.
- Event type chuẩn hóa.
- HTTP status class.
- Error code nội bộ.
- Duration.
- Retry count.
- User ID nội bộ đã hash/pseudonymize nếu cần.

Không được log:

- Authorization header, cookie, OAuth code.
- Access/refresh token.
- Telegram bot token hoặc webhook secret.
- Graph/Telegram raw body.
- Message ID nếu không thật sự cần; nếu cần debug, hash với secret riêng.
- Subject, sender, email address người gửi, recipients, body hoặc attachment names.
- Nội dung message gửi Telegram.

## 7. Error codes nội bộ

Ví dụ:

```text
MS_AUTH_REAUTH_REQUIRED
MS_SUBSCRIPTION_CREATE_FAILED
MS_SUBSCRIPTION_RENEW_FAILED
MS_MESSAGE_NOT_FOUND
MS_GRAPH_RATE_LIMITED
TG_DESTINATION_BLOCKED
TG_CHAT_NOT_FOUND
TG_RATE_LIMITED
TG_SEND_FAILED
WEBHOOK_INVALID_CLIENT_STATE
WEBHOOK_INVALID_TELEGRAM_SECRET
QUEUE_RETRY_EXHAUSTED
```

Không dùng upstream error message nguyên văn làm nội dung UI.

## 8. Chính sách dữ liệu

- Retention user/config: tới khi người dùng disconnect/xóa tài khoản hoặc theo policy kinh doanh được công bố.
- Link code: tối đa 10 phút.
- Dedupe ID: 24–72 giờ.
- Application logs: theo retention ngắn nhất đáp ứng vận hành; không chứa email metadata.
- Delivery timestamps/error codes: có thể giữ để health status; không tạo lịch sử theo từng email.
- Account deletion phải hoàn tất xóa dữ liệu hoạt động trong thời hạn được công bố.

## 9. Privacy copy tối thiểu cho UI

Ứng dụng cần thông báo rõ:

- Ứng dụng truy cập thông tin cơ bản của thư mới để tạo notification.
- Sender, subject và thời gian được truyền sang Telegram theo cấu hình người dùng.
- Ứng dụng không lưu nội dung hoặc metadata email sau khi gửi.
- Telegram là bên thứ ba và việc gửi dữ liệu chịu chính sách của Telegram.
- Người dùng có thể tắt hoặc thu hồi kết nối bất cứ lúc nào.
