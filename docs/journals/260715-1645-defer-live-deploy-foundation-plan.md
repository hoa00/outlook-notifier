---
date: 2026-07-15
session: "Roadmap deferral and Foundation planning"
---

# Journal: 2026-07-15 — Dời live deploy và lập kế hoạch Foundation

## Context

Roadmap cần tách việc hoàn thiện logic khỏi provisioning hạ tầng thật. Repo hiện chủ yếu là tài liệu, ADR và spike; application runtime chưa được scaffold.

## What Happened

- Điều chỉnh roadmap: Chặng 0–6 chỉ dùng placeholder, fixture, fake adapter và local bindings.
- Dời URL public, tenant/app/client ID, resource ID, bot identity, secret, deploy và live validation sang Chặng 7.
- Giữ các kết luận phụ thuộc hành vi Graph/Telegram thật ở trạng thái `provisional`; chúng không chặn Foundation nhưng vẫn chặn release.
- Lập plan Chặng 1 cho Worker Foundation: scaffold, binding/schema contract, safe runtime shell, test và CI gates.

## Reflection

Quyết định này giảm phụ thuộc credential và hạ tầng trong giai đoạn xây logic, đồng thời làm ranh giới secret rõ hơn. Đổi lại, rủi ro lệch giữa fake contract và platform thật bị dồn về cuối; adapter boundary, contract tests và go/no-go bắt buộc ở Chặng 7 phải được giữ nghiêm.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Hoãn provisioning, deploy và live PoC đến Chặng 7 | Hoàn thiện logic/hardening trước khi cần runtime thật | Chặng 0–6 chạy credential-free; Chặng 7 trở thành release gate bắt buộc |
| Không ghi runtime value thật vào repo hoặc docs | Giảm rò rỉ secret và coupling môi trường | Chỉ dùng placeholder; giá trị thật đi qua bindings/secret manager |
| Bắt đầu Chặng 1 bằng Foundation local/test | Repo chưa có runtime, schema hay CI | Tạo nền Worker tối thiểu trước logic Microsoft/Telegram |

## Next Steps

- Review và thực thi tuần tự bốn phase của plan Foundation.
- Duy trì ADR live-dependent ở trạng thái `provisional` cho đến Chặng 7.
- Khi logic và hardening hoàn tất, lập plan riêng cho runtime inventory, deploy, live E2E, privacy scan và rollback gate.
