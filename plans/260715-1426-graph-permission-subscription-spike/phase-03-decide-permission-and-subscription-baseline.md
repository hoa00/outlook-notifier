---
phase: 3
title: "Decide permission and subscription baseline"
status: pending
priority: P1
dependencies: [2]
effort: "0.5-1 day"
---

# Phase 3: Decide permission and subscription baseline

<!-- Updated: Validation Session 1 - conditional delegated Mail.Read approved, unsupported tenant policy locked for MVP -->

## Context Links

- Phase 1 official-contract matrix.
- Phase 2 sanitized PoC report.
- `README.md` least-privilege and no-silent-expansion rules.
- `docs/project-roadmap.md` Chặng 0 exit gate.

## Overview

Convert evidence into reviewable ADRs and a clear go/reduce-scope/blocked decision for subsequent plans.

## Requirements

- Functional: decide permission baseline, allowed notification field set, subscription contract and renewal constants policy.
- Non-functional: least privilege; explicit decision owner; no raw evidence; future plans get unambiguous constraints.

## Architecture

Decision tree:

```text
Mail.ReadBasic subscription + minimal GET pass on both account tracks
  -> lock Mail.ReadBasic and supported field subset
subscription fails but GET passes
  -> review evidence; run approved delegated Mail.Read comparison
Mail.Read comparison passes
  -> ADR may select delegated Mail.Read with explicit privacy rationale
tenant blocks user consent
  -> unsupported_tenant_consent_policy; no admin workflow in MVP
field fails
  -> drop field first; no automatic permission expansion
evidence incomplete
  -> keep roadmap blocked and list missing test context
```

## Related Code Files

- Create: `/Users/hoadev/Projects/pet/outlook-notifier/docs/decisions/graph-permission-and-fields.md`.
- Create: `/Users/hoadev/Projects/pet/outlook-notifier/docs/decisions/graph-subscription-contract.md`.
- Modify: `/Users/hoadev/Projects/pet/outlook-notifier/docs/project-roadmap.md` only if an approved decision changes a documented assumption.
- Modify: `/Users/hoadev/Projects/pet/outlook-notifier/README.md` only if an approved decision changes the locked MVP boundary.
- Delete: none.

## Implementation Steps

1. Review evidence completeness and privacy scan before interpreting results.
2. Produce ADR for permission and final field subset, with alternatives: keep `Mail.ReadBasic`, reduce fields, select the approved delegated `Mail.Read` fallback, or stop feasibility. Application permission remains prohibited.
3. Produce ADR for basic notification contract: resource path, `created`, ID extraction, validation response, lifecycle support, maximum lifetime source/date and conservative renewal configuration rule.
4. Record MVP consent policy: user self-consent only; tenant-policy denial is unsupported; admin-consent onboarding belongs to a future upgrade phase.
5. Compare personal and work/school evidence separately; do not claim untested tenant coverage.
6. Update roadmap/README only for approved decisions; retain history and rationale.
7. Publish a handoff checklist for the next Chặng 0 plan and Phase 1 foundation.

## Todo List

- [ ] Validate evidence completeness and sanitization.
- [ ] Decide permission and field subset.
- [ ] Decide subscription contract baseline.
- [ ] Record blockers/owners.
- [ ] Record unsupported tenant behavior and deferred admin-consent flow.
- [ ] Update affected docs only after approval.

## Success Criteria

- [ ] ADRs cite official sources and sanitized live evidence.
- [ ] Permission is `Mail.ReadBasic` or the explicitly approved delegated `Mail.Read` fallback backed by PoC evidence; never application permission or implicit upgrade.
- [ ] ADR covers both personal and work/school account results.
- [ ] Tenant-policy denial has a sanitized user-facing error contract and no admin-consent path in MVP.
- [ ] Every requested field is `supported`, `dropped`, or `blocked`.
- [ ] Subsequent implementation plans can consume a precise subscription contract.
- [ ] Exit gate states `go`, `reduce scope`, or `blocked` with evidence.

## Risk Assessment

- Confirmation bias toward original design: require pass/fail matrix and alternatives.
- Scope creep into tenant/missed-policy work: record dependency, leave implementation to the dedicated Chặng 0 plan.

## Security Considerations

- ADRs contain no tokens, raw payloads, real identifiers or email metadata.
- Broader permission is a security-impacting product decision requiring named approval.

## Validation Gate

- Fact-check every file/source reference.
- Contract review confirms Foundation/Microsoft plans inherit the exact chosen permission and fields.
- Whole-plan sweep finds zero stale assumptions across README, roadmap and ADRs before marking complete.

## Rollback

- ADR supersession only; do not erase rejected alternatives or evidence date.

## Next Steps

- If `go`: plan the remaining Chặng 0 Telegram/architecture decisions, then Foundation.
- If `blocked`: request the specific product/security decision; do not recommend implementation cook.
