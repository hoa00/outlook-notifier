---
phase: 2
title: "Run sanitized delegated PoC"
status: pending
priority: P1
dependencies: [1]
effort: "1-2 days"
---

# Phase 2: Run sanitized delegated PoC

## Context Links

- Phase 1 evidence matrix.
- `docs/02-technical-design.md` sections 3.3, 4.1 and 4.2.
- `docs/project-roadmap.md` Chặng 0 exit gate.

## Overview

Run the smallest live delegated Graph experiment needed to resolve permission and notification-shape uncertainty. Evidence is sanitized immediately; raw external payloads remain transient.

## Requirements

- Functional: obtain delegated tokens for the declared scopes; attempt Inbox message subscription; complete validation handshake; capture a basic created notification; fetch the message with minimal `$select`.
- Non-functional: public HTTPS endpoint; deterministic pass/fail matrix; no production persistence; no broad permission fallback inside the same test.

## Architecture

Use a disposable PoC endpoint and local/ephemeral harness. Execute two isolated permission tracks only when authorized: baseline `Mail.ReadBasic`; `Mail.Read` comparison track only after explicit owner approval. Never silently retry with broader scope.

## Related Code Files

- Create: `/Users/hoadev/Projects/pet/outlook-notifier/scripts/spikes/graph-permission-subscription-poc.ts`.
- Create: `/Users/hoadev/Projects/pet/outlook-notifier/docs/spikes/graph-permission-subscription-spike.md`.
- Create: `/Users/hoadev/Projects/pet/outlook-notifier/.dev.vars.example` only if a safe placeholder convention is needed.
- Modify: none of the future production Worker modules.
- Delete: disposable deployed PoC endpoint after evidence capture.

## Implementation Steps

1. Confirm prerequisites and record test matrix: account type, tenant model, cloud, consent status; never record tenant/user identifiers.
2. Implement minimal OAuth/webhook harness with secrets supplied outside source control and allowlisted logging only.
3. With exactly documented baseline scopes, attempt `POST /subscriptions` for `/me/mailFolders('inbox')/messages`, `changeType: created`, `notificationUrl`, `lifecycleNotificationUrl`, random `clientState`.
4. Verify `validationToken` is echoed unchanged as `200 text/plain` within the current documented deadline.
5. Trigger a synthetic, non-sensitive test email; record sanitized notification field names, resource pattern and whether a stable message/resource ID is available.
6. Call message GET using `$select=id,subject,from,sender,receivedDateTime,webLink`; record allowed/omitted/failed fields without recording values.
7. Record status codes, Graph error codes and structural assertions only. Replace all IDs with typed placeholders before writing evidence.
8. If baseline fails, stop. Do not request or consent to `Mail.Read` until written approval enables a separate comparison run.
9. Revoke test consent/credentials where appropriate and remove the disposable endpoint.

## Todo List

- [ ] Verify prerequisites without committing secrets.
- [ ] Run baseline subscription assertion.
- [ ] Verify validation and basic notification shape.
- [ ] Run minimal message GET assertions.
- [ ] Sanitize and review evidence.
- [ ] Tear down disposable infrastructure.

## Success Criteria

- [ ] Each capability has reproducible pass/fail evidence and exact tested context.
- [ ] Raw message values, tokens and identifiers are absent from repo, logs and artifacts.
- [ ] Failed baseline does not cause implicit permission expansion.
- [ ] Resource/message ID behavior comes from a real notification, not an example payload.

## Risk Assessment

- Missing Entra/mailbox/HTTPS access blocks live execution: report exact prerequisite; do not downgrade gate to docs-only.
- Real email leakage: use synthetic values, deny raw-body logging, manually inspect staged artifacts.
- Tenant-specific result: scope conclusion to the tested matrix.

## Security Considerations

- Secrets through environment/Workers secret bindings only.
- Disable request-body logs and external error trackers.
- Store only field presence, redacted codes and typed placeholders.

## Test and Privacy Gate

- Scan git-visible files for test sender, subject, token fragments, tenant/user/message IDs.
- Inspect endpoint/runtime logs and any queue/DLQ equivalent; expected raw payload retention: none.
- Negative test proves baseline permission failure is reported without broader-scope retry.

## Rollback

- Delete subscription if created, revoke test authorization as appropriate, remove endpoint and rotate any exposed disposable secret.

## Next Steps

- Phase 3 adjudicates evidence; it does not rerun the experiment with changed scopes silently.

