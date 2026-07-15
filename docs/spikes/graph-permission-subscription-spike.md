# Graph permission and subscription spike — evidence

**Access date:** 2026-07-15  
**API version:** Microsoft Graph v1.0 only  
**Status:** Phase 1 official-contract audit complete; Phase 2 live PoC blocked on test infrastructure

## Official source index

| Topic | Canonical URL | Notes |
|-------|---------------|--------|
| Create subscription | https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0 | Permissions table + mail example |
| Outlook change notifications | https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview | Outlook-specific permissions, paths, lifecycle |
| Change notifications overview | https://learn.microsoft.com/en-us/graph/change-notifications-overview | Lifetime, quota, supported resources |
| Webhook delivery | https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks | Validation handshake, 2xx SLA |
| Lifecycle events | https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events | reauthorizationRequired / subscriptionRemoved / missed |
| Get message | https://learn.microsoft.com/en-us/graph/api/message-get?view=graph-rest-1.0 | Least-privileged GET |
| Message resource | https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0 | Field inventory |
| Permissions reference | https://learn.microsoft.com/en-us/graph/permissions-reference | AdminConsentRequired metadata |

## Evidence matrix

| # | Capability | Repository claim | Official documented contract | Evidence URL | Status |
|---|------------|------------------|------------------------------|--------------|--------|
| 1 | Create Inbox message subscription (delegated) | Prefer `Mail.ReadBasic`; PoC must prove | **Permissions table (create subscription):** message → delegated work/school `Mail.ReadBasic, Mail.Read`; personal `Mail.ReadBasic, Mail.Read`; application `Mail.Read`. **Prose** on same page and Outlook overview still says “needs the Mail.Read permission” as a generic example. **Outlook overview table:** message → delegated `Mail.ReadBasic, Mail.Read` (both account types). | subscription-post-subscriptions; outlook-change-notifications-overview | **needs-live-proof** (tables allow Mail.ReadBasic; prose still cites Mail.Read; runtime must decide) |
| 2 | Message GET least privilege | `Mail.ReadBasic` sufficient for minimal fields | Delegated work/school and personal: `Mail.ReadBasic, Mail.Read` (least → most). Application: `Mail.ReadBasic.All, Mail.Read`. | message-get | **confirmed** (docs) |
| 3 | Resource path Inbox | `/me/mailFolders('inbox')/messages` | Supported: `/me/mailFolders('inbox')/messages`, `/users/{id}/mailFolders('inbox')/messages`, also `/me/messages`. Create-subscription example uses `me/mailFolders('Inbox')/messages`. | change-notifications-overview; subscription-post-subscriptions | **confirmed** |
| 4 | changeType `created` | Subscribe to new mail only | Supported change types include `created`. Example subscriptions use `"changeType": "created"`. | outlook-change-notifications-overview; subscription-post-subscriptions | **confirmed** |
| 5 | Validation handshake | Echo `validationToken` as `200 text/plain` | POST to notificationUrl with `?validationToken=…`; respond within **10 seconds** with HTTP 200, content-type `text/plain`, body = **URL-decoded plain text** token (not re-encoded). Same validation applies to `lifecycleNotificationUrl`. | change-notifications-delivery-webhooks | **confirmed** (docs); live echo still **needs-live-proof** |
| 6 | Basic notification shape | Use `resource` / `resourceData.id` as stable message id | Basic notification includes `subscriptionId`, `changeType`, `resource`, `resourceData` (`@odata.type`, `@odata.id`, `id`), optional `clientState`, `tenantId`. No body/subject in basic payload. | outlook-change-notifications-overview; webhooks | **confirmed** (docs); real ID stability **needs-live-proof** |
| 7 | Lifecycle notifications | Handle reauthorizationRequired, subscriptionRemoved, missed | Outlook message supports all three when `lifecycleNotificationUrl` is set at create time. Cannot add lifecycle URL to existing subscription — must recreate. | change-notifications-lifecycle-events; outlook overview | **confirmed** |
| 8 | Max lifetime (basic, no resource data) | Do not hard-code from memory | Outlook message/event/contact: **10,080 minutes (under 7 days)**. Rich (with resource data): **1,440 minutes (under 1 day)**. | change-notifications-overview § Subscription lifetime | **confirmed** as of 2026-07-15 (time-bound fact) |
| 9 | Subscription quota | N/A in repo design | Max **1,000 active subscriptions per mailbox** for all apps (Outlook message/event/contact). | change-notifications-overview; outlook overview | **confirmed** as of 2026-07-15 |
| 10 | Mail.ReadBasic field surface | `$select=id,subject,from,sender,receivedDateTime,webLink` | Permissions reference: Mail.ReadBasic excludes **body, bodyPreview/previewBody, attachments, extended properties**. Listed fields are not in the exclusion set; still **needs-live-proof** that Graph returns them under Basic. | permissions-reference Mail.ReadBasic; message resource | **needs-live-proof** |
| 11 | webLink optional product value | Prefer drop field over elevating permission | message.webLink is a standard property. Not excluded by Mail.ReadBasic description. Optional for MVP notification UX. | message resource; product FR-03 | **needs-live-proof** if retained |
| 12 | Delegated admin consent metadata | User self-consent; no admin workflow in MVP | Delegated `Mail.ReadBasic` and `Mail.Read`: **AdminConsentRequired = No**. Application variants require admin consent. Tenant **user-consent policy** can still block self-consent independently of this metadata. | permissions-reference | **confirmed** (metadata); tenant policy behavior **needs-live-proof** |
| 13 | Application permission prohibited | Never use app-only mail for MVP | Application message subscription lists `Mail.Read` (create-sub table) / `Mail.ReadBasic, Mail.Read` (Outlook overview). Explicit product boundary: delegated only. | plan Validation Session 1 | **confirmed** (product decision, not Graph requirement) |
| 14 | Personal + work/school matrix | Both tracks required | Subscription and message GET tables list both delegated personal and work/school. | subscription-post; message-get | **confirmed** (docs support both); live matrix **needs-live-proof** |
| 15 | Notification delivery SLA | Return 2xx quickly | Prefer `202 Accepted` after queueing; first attempt timeout **3s**; retries up to 4h. | change-notifications-delivery-webhooks | **confirmed** |
| 16 | clientState | Secret known only to app + Graph | Required for secure validation of notification origin (webhook docs). | webhooks | **confirmed** |

### Permission mismatch (blocking for implementation)

| Source | What it says about message subscription least privilege |
|--------|----------------------------------------------------------|
| create subscription **permissions table** (message row) | Delegated: `Mail.ReadBasic, Mail.Read` |
| create subscription **prose** (“Permissions” intro + contact/event/message note) | Example / wording: needs `Mail.Read` |
| Outlook change-notifications overview **table** | Delegated: `Mail.ReadBasic, Mail.Read` |
| message GET | Least: `Mail.ReadBasic` |

**Classification:** Docs no longer uniquely require `Mail.Read` for subscription creation in the structured tables, but prose still cites `Mail.Read`. **Do not treat tables as live proof.** Phase 2 must attempt `Mail.ReadBasic` first on both account tracks.

## Account / tenant test matrix

| Track | Account type | Tenant model | Consent expectation | Failure class if blocked |
|-------|--------------|--------------|---------------------|--------------------------|
| A | Outlook.com personal Microsoft account | Consumer | User self-consent for delegated scopes | Graph/OAuth error (not tenant policy) |
| B | Microsoft 365 work/school in **isolated** project-owned Entra tenant | Cloud, user consent enabled | User self-consent | Graph/OAuth error |
| C | Work/school tenant with user consent disabled (if available) | Enterprise policy | Consent denied | `unsupported_tenant_consent_policy` — **not** a Graph permission failure |

Rules:

- Never use a company-controlled tenant or tenant-wide admin consent.
- Success on B does **not** imply success on arbitrary enterprise tenants.
- Track C is a product classification, not a Graph API defect.

## Expected `unsupported_tenant_consent_policy` outcome

When a work/school tenant blocks user consent for the requested delegated scopes:

1. OAuth/consent step fails before a usable delegated token is obtained.
2. Product maps the failure to error code **`unsupported_tenant_consent_policy`**.
3. Flow **stops** — no admin-consent URL, no admin-approval onboarding in MVP.
4. Do not classify this as “Mail.ReadBasic insufficient for Graph”.

## Sanitized evidence schema (Phase 2 write format)

Store only structural facts. Never store tokens, tenant IDs, user IDs, message IDs, subjects, addresses, or raw payloads.

```ts
type SanitizedPocEvidence = {
  accessDate: string; // ISO date
  graphVersion: "v1.0";
  track: "personal" | "work_school_isolated" | "work_school_consent_blocked";
  cloud: "global";
  permissionAttempted: "Mail.ReadBasic" | "Mail.Read";
  steps: Array<{
    assertion:
      | "oauth_token"
      | "create_subscription"
      | "validation_handshake"
      | "basic_notification"
      | "message_get"
      | "consent_policy";
    result: "pass" | "fail" | "blocked" | "skipped";
    httpStatus?: number;
    graphErrorCode?: string; // e.g. ErrorAccessDenied — no message text with PII
    fieldPresence?: Record<string, "present" | "absent" | "error">;
    notes?: string; // non-sensitive only
  }>;
  placeholdersUsed: string[]; // e.g. ["<subscriptionId>", "<messageId>"]
};
```

### Placeholder conventions

| Real value | Placeholder |
|------------|-------------|
| Subscription id | `<subscriptionId>` |
| Message / resource id | `<messageId>` |
| User object id | `<userId>` |
| Tenant id | `<tenantId>` |
| Access / refresh token | `<token>` |
| clientState secret | `<clientState>` |
| Subject / addresses | never store |

## PoC assertion set (Phase 2 consumes only these)

Derived from repository FR-01/02/03 and official contracts above. Documentation examples are **not** evidence.

| ID | Assertion | Baseline scope | Tracks |
|----|-----------|----------------|--------|
| A1 | Obtain delegated token with `openid profile offline_access User.Read Mail.ReadBasic` via user consent | Mail.ReadBasic | A, B |
| A2 | `POST /v1.0/subscriptions` with resource `/me/mailFolders('inbox')/messages`, `changeType: created`, `notificationUrl`, `lifecycleNotificationUrl`, random `clientState`, expiration within 10080 minutes | Mail.ReadBasic | A, B |
| A3 | Webhook returns validation token as `200 text/plain` unchanged (URL-decoded) | n/a endpoint | A, B |
| A4 | Receive basic `created` notification; record field **names** only; confirm `resourceData.id` or parseable resource path yields usable message id | Mail.ReadBasic | A, B |
| A5 | `GET /me/messages/{id}?$select=id,subject,from,sender,receivedDateTime,webLink` — record allowed/omitted/failed fields without values | Mail.ReadBasic | A, B |
| A6 | Consent-policy denial maps to `unsupported_tenant_consent_policy` with no admin URL | n/a | C if available |
| A7 | If A2 fails with permission-class error only: after evidence review, one isolated `Mail.Read` comparison (never application permission) | Mail.Read | A and/or B |

## Phase 2 infrastructure prerequisites (not design decisions)

| Prerequisite | Status at plan time | Owner |
|--------------|---------------------|-------|
| Isolated Entra tenant (project owner) | Not provisioned | Project owner |
| Microsoft 365 trial/test mailbox | Not provisioned | Project owner |
| Outlook.com test account | Not provisioned | Project owner |
| Entra app: work/school + personal accounts | Not registered | Project owner |
| Public HTTPS Worker at `outlook-notifier.hoadev.com` | Not deployed | Project owner |

If M365 trial is unavailable or paid, record exact blocker/cost; **do not** substitute company tenant or mark Phase 2 pass on docs alone.

## Hypotheses vs confirmed

| Item | Class |
|------|--------|
| Tables allow Mail.ReadBasic for create subscription | Documented contract (2026-07-15) |
| Runtime accepts Mail.ReadBasic for create subscription | Hypothesis → live proof |
| Minimal `$select` fields available under Mail.ReadBasic | Strong docs support → live proof |
| webLink available under Mail.ReadBasic | Hypothesis → live proof |
| Max lifetime 10080 min basic | Documented time-bound fact |
| Tenant policy can block self-consent | Documented + product classification |

## Phase 2 live run status

| Item | Status | Notes |
|------|--------|-------|
| PoC harness | Created | `scripts/spikes/graph-permission-subscription-poc.ts` |
| Disposable Worker | Created | `scripts/spikes/poc-worker.ts` |
| Env template | Created | `.dev.vars.example` (placeholders only) |
| Isolated Entra tenant | **Blocked** | Project owner must provision |
| M365 trial/test mailbox | **Blocked** | Project owner must provision; record cost if paid |
| Outlook.com test account | **Blocked** | Project owner must provision |
| Entra app registration | **Blocked** | Work/school + personal accounts; delegated scopes only |
| Deploy Worker + DNS on `outlook-notifier.hoadev.com` | **Blocked** | Paths under `/spikes/graph-poc/*` only; tear down after |
| Live pass/fail matrix A1–A7 | **Not run** | Forbidden to mark pass from docs alone |

### Operator checklist (when infrastructure is ready)

1. Create isolated Entra tenant + M365 test mailbox; create Outlook.com account.
2. Register app: accounts in any org directory + personal Microsoft accounts; redirect `https://outlook-notifier.hoadev.com/spikes/graph-poc/oauth/callback`.
3. Add delegated permissions: `openid`, `profile`, `offline_access`, `User.Read`, `Mail.ReadBasic` (add `Mail.Read` only for isolated comparison after baseline fail).
4. Deploy `poc-worker.ts` to custom hostname; set `POC_EVIDENCE_TOKEN` secret.
5. User-consent OAuth for track A and B; put access token in env only.
6. Run harness; send synthetic test mail; pull `/spikes/graph-poc/evidence`.
7. Sanitize and paste structural JSON into this file under “Live evidence (sanitized)”.
8. Delete Graph subscriptions, undeploy Worker routes, revoke consent, rotate secrets.

### Live evidence (sanitized)

_None yet — blocked on prerequisites._

## Security note

This document contains no credentials, tenant IDs, message IDs, or email content.
