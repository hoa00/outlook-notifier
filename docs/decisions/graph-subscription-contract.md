# ADR: Graph Inbox subscription contract

- **Status:** Accepted for documented contract constants; **live validation pending**
- **Date:** 2026-07-15
- **Deciders:** Spike implementer (docs); live confirm via Phase 2
- **Related:** `docs/spikes/graph-permission-subscription-spike.md`, `docs/decisions/graph-permission-and-fields.md`

## Context

Foundation needs a precise subscription shape, validation behavior, lifecycle handling, and renewal policy without hard-coding obsolete Microsoft limits from memory.

## Decision

### Create payload (MVP)

```json
{
  "changeType": "created",
  "notificationUrl": "https://<public-host>/webhooks/microsoft",
  "lifecycleNotificationUrl": "https://<public-host>/webhooks/microsoft/lifecycle",
  "resource": "/me/mailFolders('inbox')/messages",
  "expirationDateTime": "<now + configured minutes, <= documented max>",
  "clientState": "<cryptographically random secret>"
}
```

- API: `POST https://graph.microsoft.com/v1.0/subscriptions`
- No rich notifications (`includeResourceData` false) in MVP — avoids encryption cert and 1-day lifetime.
- Duplicate subscriptions with same changeType+resource → expect `409 Conflict`.

### Validation handshake

| Rule | Value (docs 2026-07-15) |
|------|-------------------------|
| Trigger | `POST` with `validationToken` query param |
| Response status | `200` |
| Content-Type | `text/plain` |
| Body | URL-decoded validation token, unmodified |
| Deadline | 10 seconds |
| Applies to | Both `notificationUrl` and `lifecycleNotificationUrl` |

No user-auth middleware on these routes.

### Basic notification processing

1. Reject if `clientState` mismatches (constant-time compare).
2. Extract message id from `resourceData.id` when present; else parse `resource` path.
3. Enqueue **technical IDs only** (userId, subscriptionId, resourceId, correlationId, receivedAt).
4. Respond `202` (preferred) or other 2xx within ~3s first-attempt window.

### Lifecycle (Outlook message)

| Event | MVP action (policy direction) |
|-------|-------------------------------|
| `reauthorizationRequired` | Reauthorize and/or renew subscription with valid token; if token invalid → `reauthorization_required` connection state |
| `subscriptionRemoved` | Recreate subscription if user/connection still active |
| `missed` | **Not implemented in this spike**; dedicated Chặng 0/ops plan owns catch-up vs `missed_unrecovered` |

Lifecycle URL must be set at **create** time; cannot PATCH onto existing subscription.

### Lifetime and renewal configuration

| Constant | Value | Source date |
|----------|-------|-------------|
| Documented max (basic Outlook message) | 10,080 minutes (under 7 days) | change-notifications-overview, 2026-07-15 |
| Documented max (rich) | 1,440 minutes | same |
| **Configured create/renew target** | **4,200 minutes (~2.9 days)** | Conservative buffer under max; re-read docs at implementation |
| **Renew-before-expiry buffer** | **≥ 720 minutes (12 hours)** before expirationDateTime | Operational safety |
| Quota awareness | ≤ 1,000 active subscriptions per mailbox (all apps) | same overview |

Rule: implementation reads max from a named config constant documented with URL+date; never invent a higher max than the last audited Microsoft table.

### Consent / unsupported tenant

Aligned with permission ADR: self-consent only; `unsupported_tenant_consent_policy` stops the flow.

## Alternatives considered

1. **Rich notifications with resource data** — Deferred: cert management + shorter lifetime; privacy risk of larger payloads.
2. **Hard-code 4230 minutes from older memory** — Rejected: use audited table + conservative config.
3. **Implement missed catch-up in this spike** — Out of scope; record dependency only.

## Consequences

- Foundation `graph-subscriptions` module must implement validation and clientState checks exactly as above.
- Cron renew uses configured target and buffer; re-audit Microsoft lifetime table before production ship.
- Live PoC must still prove create + validation + basic notification on both account tracks before Chặng 0 exit gate `go`.

## Handoff checklist (next Chặng 0 / Foundation)

- [ ] Live evidence: subscription create with chosen permission (both tracks)
- [ ] Live evidence: validation + basic notification id shape
- [ ] Live evidence: message GET field presence matrix
- [ ] Permission ADR status flipped from blocked → Accepted
- [ ] Telegram / architecture decisions (separate plan)
- [ ] Foundation: OAuth + encrypted refresh token + subscription persistence
- [ ] Ops plan: renewal cron, lifecycle recovery, missed policy

## Evidence references

- https://learn.microsoft.com/en-us/graph/change-notifications-overview
- https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
- https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events
- https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview
- https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0
