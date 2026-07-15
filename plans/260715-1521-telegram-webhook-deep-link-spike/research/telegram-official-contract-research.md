---
title: "Telegram official contract research"
date: 2026-07-15
source: "ck:plan hard-mode researcher"
---

# Telegram official contract research

## Summary

- `setWebhook.secret_token` is optional, 1-256 characters, charset `A-Z a-z 0-9 _ -`; Telegram sends it in `X-Telegram-Bot-Api-Secret-Token`.
- Non-2xx webhook responses are retried, but official docs do not define schedule, horizon, ordering, timeout, or attempt count.
- Private deep-link payload uses `?start=<parameter>`, maximum 64 base64url-compatible characters. Telegram supplies no application TTL or consume-once behavior.
- `getMe` is the token/identity smoke test. `sendMessage` returns a `Message`; text limit is 1-4096 characters after entity parsing.
- Bots cannot initiate a user conversation. Bind only after verified inbound private `/start`.
- Chat IDs may exceed 32-bit storage. Use string/int64-safe representation.

## Official Sources

- https://core.telegram.org/bots/api#setwebhook
- https://core.telegram.org/bots/api#getwebhookinfo
- https://core.telegram.org/bots/api#getme
- https://core.telegram.org/bots/api#sendmessage
- https://core.telegram.org/bots/api#chat
- https://core.telegram.org/bots/features#deep-linking
- https://core.telegram.org/api/links#bot-links
- https://core.telegram.org/bots/faq

## Needs Live Proof

- Retry intervals/horizon, response timeout, delivery ordering, and secret rotation behavior.
- Exact `/start` representation across clients and previously-started bot state.
- Expiry, replay, user/chat uniqueness conflicts, and concurrent redemption behavior of the application bearer token.
- Sanitized structures for blocked bot, invalid chat, `429 retry_after`, and transient errors.

## Unresolved Questions

- None for plan creation. Live behavior becomes ADR evidence, not an assumed contract.
