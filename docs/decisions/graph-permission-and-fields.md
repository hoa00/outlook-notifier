# ADR: Graph permission and notification fields

- **Status:** Conditionally decided (docs) / **blocked for go** (live PoC incomplete)
- **Date:** 2026-07-15
- **Deciders:** Project owner (product); spike implementer (technical evidence)
- **Related:** `docs/spikes/graph-permission-subscription-spike.md`, plan `260715-1426-graph-permission-subscription-spike`

## Context

MVP must notify Telegram of new Inbox mail with least privilege. Repository baseline is delegated `Mail.ReadBasic` and minimal `$select`. Official create-subscription **tables** (2026-07-15) list `Mail.ReadBasic` for message subscriptions; some **prose** still says `Mail.Read`. Live PoC has not run because Entra/M365/Outlook.com/Worker prerequisites are unprovisioned.

## Decision

### Permission (implementation gate)

| State | Permission | When |
|-------|------------|------|
| **Target baseline** | Delegated `Mail.ReadBasic` only (plus `openid profile offline_access User.Read`) | Default until live evidence says otherwise |
| **Approved conditional fallback** | Delegated `Mail.Read` (user consent) | Only if baseline create-subscription or required fields fail for permission-class reasons **and** product owner re-confirms after reviewing sanitized evidence |
| **Prohibited** | Application mail permissions; tenant-wide admin consent; company tenant | Always for MVP |

**Exit gate:** `blocked` until Phase 2 produces pass/fail on personal **and** isolated work/school tracks. Do not start Foundation OAuth/subscription code that assumes a final permission.

### Field subset for message GET

Requested: `id, subject, from, sender, receivedDateTime, webLink`.

| Field | Status | Rule |
|-------|--------|------|
| `id` | **required** | Must be obtainable from notification `resourceData.id` or resource path |
| `subject` | **required if Basic allows** | Drop from product copy only if GET fails under chosen permission |
| `from` | **required if Basic allows** | Prefer `from`; keep `sender` as secondary |
| `sender` | **optional** | Drop before elevating permission |
| `receivedDateTime` | **required if Basic allows** | Drop only if unavailable |
| `webLink` | **optional product value** | **Drop first** before any permission expansion |

Until live evidence: treat all non-id fields as **needs-live-proof**, not supported.

### Consent policy (MVP locked)

- Only **user self-consent**.
- Tenant policy denial → user-facing / API error code **`unsupported_tenant_consent_policy`**.
- **No** admin-consent URL, admin onboarding, or IT ticket workflow in MVP.
- Admin-consent onboarding is deferred to a future upgrade phase.

### Account coverage claim

- Documented intent: Outlook.com personal + Microsoft 365 work/school (isolated tenant).
- Until both tracks pass live: **do not claim** production readiness for either class.
- Success on isolated tenant ≠ success on every enterprise tenant.

## Alternatives considered

1. **Assume Mail.ReadBasic from docs tables** — Rejected for go: tables ≠ live proof; prose still ambiguous.
2. **Start with Mail.Read** — Rejected: violates least privilege and product rule against silent expansion.
3. **Application permission** — Rejected: out of scope; requires admin consent.
4. **Docs-only Chặng 0 exit** — Rejected: plan hard-mode forbids it.

## Consequences

- Next plans may scaffold Worker modules but must treat permission/fields as **parameters from this ADR after live update**.
- When live evidence lands, update this ADR status to `Accepted` with matrix rows; supersede rather than erase alternatives.
- Privacy: ADRs and spikes never store tokens, raw payloads, or email metadata.

## Evidence references

- Official matrix: `docs/spikes/graph-permission-subscription-spike.md` (access date 2026-07-15)
- Live matrix: empty / blocked
