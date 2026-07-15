---
phase: 2
title: "Run sanitized delegated PoC"
status: blocked
priority: P1
dependencies: [1]
effort: "1-2 days"
---

# Phase 2: Run sanitized delegated PoC

<!-- Updated: Validation Session 1 - provision isolated tenant/mailbox, custom Cloudflare hostname, self-consent-only behavior -->
<!-- 2026-07-15 cook: harness created; live run blocked on external infrastructure -->

## Context Links

- Phase 1 evidence matrix.
- `docs/02-technical-design.md` sections 3.3, 4.1 and 4.2.
- `docs/project-roadmap.md` Chặng 0 exit gate.
- Harness: `scripts/spikes/graph-permission-subscription-poc.ts`, `scripts/spikes/poc-worker.ts`

## Overview

Run the smallest live delegated Graph experiment needed to resolve permission and notification-shape uncertainty. Evidence is sanitized immediately; raw external payloads remain transient.

## Requirements

- Functional: provision isolated test prerequisites; obtain delegated tokens for both account tracks; attempt Inbox message subscription; complete validation handshake; capture a basic created notification; fetch the message with minimal `$select`; verify graceful failure when tenant policy blocks self-consent.
- Non-functional: public HTTPS endpoint; deterministic pass/fail matrix; no production persistence; no broad permission fallback inside the same test.

## Architecture

Use a disposable Cloudflare Worker routed through `outlook-notifier.hoadev.com` and a local/ephemeral harness. Entra app audience supports work/school plus personal Microsoft accounts. Execute baseline `Mail.ReadBasic` first; delegated `Mail.Read` comparison is allowed only after baseline evidence is reviewed. Never use application permission, tenant-wide admin consent or a company-controlled tenant.

## Related Code Files

- Create: `scripts/spikes/graph-permission-subscription-poc.ts`.
- Create: `scripts/spikes/poc-worker.ts`.
- Create: `docs/spikes/graph-permission-subscription-spike.md`.
- Create: `.dev.vars.example` only if a safe placeholder convention is needed.
- Modify: none of the future production Worker modules.
- Delete: disposable deployed PoC endpoint after evidence capture.

## Implementation Steps

1. Create an isolated Entra tenant controlled by the project owner and obtain a Microsoft 365 trial/test mailbox; separately prepare an Outlook.com test account. Record cost/expiry constraints without identifiers.
2. Register an Entra app for work/school plus personal Microsoft accounts. Configure only delegated scopes and exact redirect/webhook paths under `https://outlook-notifier.hoadev.com`.
3. Deploy a disposable Cloudflare Worker with OAuth callback, Graph validation and notification endpoints; secrets stay in bindings, request-body logging disabled.
4. Record test matrix: account type, tenant model, cloud and consent outcome; never record tenant/user identifiers.
5. With `Mail.ReadBasic`, attempt `POST /subscriptions` for `/me/mailFolders('inbox')/messages`, `changeType: created`, `notificationUrl`, `lifecycleNotificationUrl`, random `clientState`.
6. Verify `validationToken` is echoed unchanged as `200 text/plain` within the current documented deadline.
7. Trigger a synthetic, non-sensitive test email for each account track; record sanitized notification field names, resource pattern and stable ID availability.
8. Call message GET using `$select=id,subject,from,sender,receivedDateTime,webLink`; record allowed/omitted/failed fields without values.
9. Verify a work/school consent-policy denial maps to `unsupported_tenant_consent_policy`, stops the flow and does not expose an admin-consent URL.
10. Record status codes, Graph error codes and structural assertions only. Replace all IDs with typed placeholders before writing evidence.
11. If baseline subscription fails for permission reasons, review evidence, then run one isolated delegated `Mail.Read` comparison; never use application permission or tenant-wide consent.
12. Delete Graph subscriptions, Worker routes/deployment and temporary DNS/route configuration; revoke test consent/credentials where appropriate.

## Todo List

- [x] Document missing prerequisites without committing secrets.
- [x] Create PoC harness + disposable Worker code (not a live pass).
- [ ] Provision isolated work/school and personal test accounts.
- [ ] Deploy Worker on `outlook-notifier.hoadev.com` and register Entra app.
- [ ] Run baseline subscription assertion (live).
- [ ] Verify validation and basic notification shape (live).
- [ ] Run minimal message GET assertions (live).
- [ ] Sanitize and review evidence.
- [ ] Tear down disposable infrastructure.

## Success Criteria

- [ ] Each capability has reproducible pass/fail evidence and exact tested context.
- [x] Raw message values, tokens and identifiers are absent from repo, logs and artifacts.
- [x] Failed baseline does not cause implicit permission expansion. *(harness enforces)*
- [x] Consent-policy denial stops with `unsupported_tenant_consent_policy` and no admin workflow. *(product mapping defined; live optional track C)*
- [ ] Resource/message ID behavior comes from a real notification, not an example payload.

## Risk Assessment

- Microsoft 365 trial/mailbox may be unavailable or paid: report exact blocker/cost; do not substitute a company tenant or downgrade gate to docs-only.
- Reusing the intended public hostname can leave stale exposure: isolate PoC paths/routes and verify full teardown.
- Real email leakage: use synthetic values, deny raw-body logging, manually inspect staged artifacts.
- Tenant-specific result: scope conclusion to the tested matrix.

## Security Considerations

- Secrets through environment/Workers secret bindings only.
- Disable request-body logs and external error trackers.
- Store only field presence, redacted codes and typed placeholders.

## Test and Privacy Gate

- Scan git-visible files for test sender, subject, token fragments, tenant/user/message IDs.
- Inspect endpoint/runtime logs and any queue/DLQ equivalent; expected raw payload retention: none.
- Negative test proves baseline permission failure is reported without an automatic broader-scope retry; the separately approved delegated `Mail.Read` comparison runs only after evidence review.

## Rollback

- Delete subscription if created, revoke test authorization as appropriate, remove endpoint and rotate any exposed disposable secret.
- Remove PoC routes/DNS bindings from `outlook-notifier.hoadev.com` without deleting unrelated zone records.

## Blocker (2026-07-15)

| Prerequisite | Status |
|--------------|--------|
| Isolated Entra tenant | Not provisioned by project owner |
| M365 trial/test mailbox | Not provisioned |
| Outlook.com test account | Not provisioned |
| Entra app (multi-account) | Not registered |
| Worker on `outlook-notifier.hoadev.com` | Not deployed |

**Do not mark Phase 2 complete until live A1–A7 matrix is filled with sanitized evidence.**

## Next Steps

- Phase 3 adjudicates evidence; it does not rerun the experiment with changed scopes silently.
- Owner action: provision infrastructure, then re-run cook/PoC steps 4–12.
