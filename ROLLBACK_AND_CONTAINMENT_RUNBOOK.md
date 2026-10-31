# Rollback and Containment Runbook

## Immediate containment

- Authentication bypass, cross-role/cross-tenant exposure, data loss/corruption, or widespread route failure: stop promotion and roll back to the last known good deployment before diagnosis.
- Provider outage: activate documented fallback; do not churn source without evidence of a source defect.
- Cleanup failure: preserve the exact fixture ledger, block completion, and repair exact-ID cleanup.

## Repair loop

Patch source → checkpoint → `release:self-heal` → Hallmark → prepush → package → updater/deploy → postdeploy audits → exact cleanup → final report. Production files are never edited in place.

## Concrete steps (31 Oct 2026)

Code, data and show-day rollback commands: `docs/SETUP_AND_ACCOUNTS.md` → Rollback.
