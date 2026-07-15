# Documentation and Roadmap Research

## Summary

- Foundation/Chặng 1 is complete local/test; Chặng 2 is next.
- The immediate bounded plan is `microsoft-oauth-and-session`; subscription/webhook/refresh/disconnect remain later plans.
- Live Graph/Entra claims stay provisional until Chặng 7.

## Locked Contracts

- Delegated authorization code flow; state and PKCE required; safe return path.
- Approved baseline scopes are configurable; no automatic `Mail.Read` escalation.
- Refresh token encrypted before D1; no token/upstream body logging.
- Exit evidence is fake/contract based; AT-01 remains partial without active subscription.

## Risks

- Tenant model/value is not yet production-locked.
- Roadmap and older ADR wording differ on live-gate timing; updated roadmap controls and defers live proof to Chặng 7.
- Cron renewal/lifecycle recovery belong Chặng 5, not this plan.
