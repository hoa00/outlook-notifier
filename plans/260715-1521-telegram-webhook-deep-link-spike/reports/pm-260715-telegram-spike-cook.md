# PM report — Telegram webhook deep-link spike cook

**Date:** 2026-07-15  
**Plan:** `plans/260715-1521-telegram-webhook-deep-link-spike`  
**Mode:** code + auto

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1 Official contracts | completed | `docs/spikes/telegram-webhook-deep-link-spike.md` |
| 2 Live PoC | blocked | Harness ready; no bot/clients/route |
| 3 ADR baseline | completed (go blocked) | `docs/decisions/telegram-webhook-and-linking-contract.md` |

**Plan status:** `in-progress` (live Phase 2 remains)

## Artifacts

- Spike evidence matrix + threat models
- PoC harness + disposable Worker
- ADR handoff for architecture baseline / Foundation
- Journal: `docs/journals/260715-telegram-webhook-deep-link-spike-cook.md`

## Gates

| Gate | Result |
|------|--------|
| Offline harness | pass (all blocked without token) |
| Secret scan | pass |
| Code review | approve (after H1/M1–M4 fixes) |
| Full go | **blocked** on live concurrent_redeem + multi-client matrix |

## Next

1. Provision disposable bot + two private clients + deploy `/spikes/telegram-poc/*`
2. Run harness with `LOCAL_SECRET_MATRIX=1` and interactive deep-link matrix
3. Update ADR exit to `go` or keep `blocked` with evidence
