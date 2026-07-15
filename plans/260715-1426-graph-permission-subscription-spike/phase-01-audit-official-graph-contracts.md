---
phase: 1
title: "Audit official Graph contracts"
status: pending
priority: P1
dependencies: []
effort: "0.5-1 day"
---

# Phase 1: Audit official Graph contracts

<!-- Updated: Validation Session 1 - two-account matrix, self-consent-only policy, conditional Mail.Read fallback -->

## Context Links

- `README.md`; `docs/01-product-requirements.md` FR-01/02/03.
- `docs/02-technical-design.md` sections 3, 4 and 10.
- `docs/04-implementation-test-runbook.md` Phase 0.
- `docs/project-roadmap.md` Chặng 0 and proposed starting point.

## Overview

Build an evidence matrix from Microsoft v1.0 documentation before writing PoC code. Surface contradictions rather than resolving them by assumption.

## Requirements

- Functional: verify least-privileged permission for subscription creation and message GET across Outlook.com personal and Microsoft 365 work/school; Inbox resource path; `created` support; validation-token response; basic notification ID/resource shape; lifecycle support; maximum lifetime; tenant user-consent behavior.
- Non-functional: cite canonical URLs and access date; distinguish documented contract from hypotheses needing live proof.

## Architecture

No runtime architecture change. Output is a traceability matrix mapping repository claims to official Microsoft contracts and PoC assertions.

## Related Code Files

- Create: `/Users/hoadev/Projects/pet/outlook-notifier/docs/spikes/graph-permission-subscription-spike.md` during implementation.
- Modify: none.
- Delete: none.

## Implementation Steps

1. Record exact v1.0 URLs and access date for subscription creation, change-notification overview, webhook delivery, lifecycle events, message GET, message resource and permissions reference.
2. Build matrix: capability, repository claim, official documented permission/contract, evidence URL, status (`confirmed`, `contradicted`, `needs-live-proof`).
3. Explicitly flag current mismatch: subscription docs list `Mail.Read`, message GET lists delegated `Mail.ReadBasic`.
4. Record current non-rich Outlook subscription maximum and quota as observed facts, not timeless constants.
5. Record that delegated permission metadata does not itself require admin consent, while a work/school tenant policy can still block user consent.
6. Define two account tracks: Outlook.com personal and Microsoft 365 work/school in an isolated tenant controlled by the project owner.
7. Derive the smallest PoC assertion set. Do not treat documentation examples as live evidence.

## Todo List

- [ ] Capture official-source matrix with date.
- [ ] Mark permission mismatch as blocking.
- [ ] Define account/tenant test matrix.
- [ ] Define expected `unsupported_tenant_consent_policy` outcome without admin-consent fallback.
- [ ] Define sanitized evidence schema.

## Success Criteria

- [ ] Every PoC assertion traces to a repository requirement and official source.
- [ ] Conflicting claims are visible and assigned to Phase 2.
- [ ] Personal and work/school coverage are distinct; tenant-policy denial is not misclassified as a Graph permission failure.
- [ ] No blog, memory, or beta-only behavior is used as authoritative evidence.

## Risk Assessment

- Docs can change: store URL/date and rerun audit at implementation time.
- Documentation may be ambiguous: classify as `needs-live-proof`; do not select the favorable interpretation.

## Security Considerations

- Documentation report contains no credentials, tenant IDs, message IDs or email data.

## Test and Validation Gate

- Peer-check each cited claim against the current v1.0 page.
- Fail the phase if permission requirements remain paraphrased without a direct source.

## Next Steps

- Phase 2 consumes only the explicit assertion matrix.
