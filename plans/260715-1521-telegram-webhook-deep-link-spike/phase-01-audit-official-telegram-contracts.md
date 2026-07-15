---
phase: 1
title: "Audit official Telegram contracts"
status: pending
priority: P1
dependencies: []
effort: "0.5 day"
---

# Phase 1: Audit official Telegram contracts

## Overview

Build an evidence matrix from current official Telegram documentation. Separate guaranteed contracts from behavior that needs a live experiment.

## Context Links

- `README.md`; `docs/01-product-requirements.md` FR-04.
- `docs/02-technical-design.md` section 6.
- `docs/03-api-data-security.md` Telegram API, schema, threat controls.
- `docs/04-implementation-test-runbook.md` Phase 0, AT-02, AT-12.
- Official: https://core.telegram.org/bots/api#setwebhook
- Official: https://core.telegram.org/bots/api#getwebhookinfo
- Official: https://core.telegram.org/bots/api#getme
- Official: https://core.telegram.org/bots/api#sendmessage
- Official: https://core.telegram.org/bots/features#deep-linking

## Requirements

- Functional: verify webhook secret syntax/header, Update/Message/Chat shapes, deep-link payload format/length, private chat type, `getMe`, `sendMessage`, error and rate-limit fields.
- Non-functional: canonical URLs plus access date; no undocumented retry schedule, delivery TTL, ordering, timeout, or exactly-once promise.

## Architecture

No runtime change. Produce a traceability matrix from repository requirement -> official contract -> PoC assertion -> decision owner.

## Related Code Files

- Create: `docs/spikes/telegram-webhook-deep-link-spike.md`.
- Modify: none.
- Delete: none.

## Implementation Steps

1. Record the current Bot API and deep-link documentation URLs with access date.
2. Verify `secret_token` character/length constraints and `X-Telegram-Bot-Api-Secret-Token` delivery contract.
3. Verify `Update`, `Message`, `Chat.type`, chat-ID numeric range, and `update_id` semantics relevant to dedupe.
4. Verify private bot-link syntax and the maximum `/start` parameter length/charset.
5. Verify `getMe`, `setWebhook`, `getWebhookInfo`, and explicit `sendMessage` request/response contracts.
6. Record documented `sendMessage` length and rate-limit guidance as dated observations, not stable product constants.
7. Classify unspecified retry timing, timeout, ordering, and delivery horizon as `non-contract/observational-only`; production correctness must not depend on them.
8. Mark secret rotation, valid-Update replay handling, binding recovery, and concurrent redemption as application decisions requiring PoC evidence and an ADR.

## Todo List

- [ ] Capture official-source matrix.
- [ ] Map repository claims to official contracts.
- [ ] Define sanitized PoC assertions.
- [ ] Flag every non-contract assumption.
- [ ] Define separate threat models for bearer-code replay and valid-Update replay.

## Success Criteria

- [ ] Every PoC assertion traces to a repository requirement and official source.
- [ ] Deep-link TTL and consume-once are classified as application behavior.
- [ ] Chat IDs are planned as string/int64-safe values, never 32-bit integers.
- [ ] No unofficial source or remembered behavior is authoritative.

## Risk Assessment

- Telegram docs can change: date every claim and rerun before implementation.
- FAQ guidance can be mistaken for API guarantees: label guidance separately.

## Security Considerations

- The audit contains no token, user/chat identifier, payload, username, or message text.

## Test and Validation Gate

- Peer-check each cited claim against the current official page.
- Fail if any retry timing, atomicity, or exactly-once property lacks an explicit source.
