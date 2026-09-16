# Active Documentation Index — agency-event-os

Status: ACTIVE
Purpose: single operator entrypoint that prevents doc sprawl. If a document is not listed here or mapped in `docs/DOCS_CONSOLIDATION_MAP.md`, it is not an active operating authority.

## Active operating surfaces
- `ARCHITECTURAL_DECISIONS.md`
- `ARTIFACT_MANIFEST.md`
- `COMPLEXITY_LEDGER.md`
- `E2E_REQUIRED_TEST_MATRIX.md`
- `ENVIRONMENT_VARIABLES.md`
- `HOSTILE_REVIEW_AND_MASTER_ADDENDUM_CROSSCHECK.md`
- `KNOWN_EDGE_CASE_INVENTORY.md`
- `PLACEHOLDER_LEDGER.md`
- `README.md`
- `REPO_PRODUCT_PROMISE_LEDGER.md`
- `REPO_VALIDATION_MATRIX.md`
- `docs/ACTIVE_DOCS.md`
- `docs/AGENCY_EVENT_OS_DAY1_OPERATOR_PACKET.md`
- `docs/BRANDING_ROLLOUT_CHECKLIST.md`
- `docs/BRAND_SYSTEM_WEST_PEEK_LIVE.md`
- `docs/CHAT_HANDOFF_DEPLOYMENT_PARITY_RULES.md`
- `docs/DAILY_AUTOMATIC_FALLBACK.md`
- `docs/DEPLOYMENT_ENV_CHECKLIST.md`
- `docs/DEPLOYMENT_PARITY_CHECKLIST.md`
- `docs/E2E_OUTCOME_TESTING_STANDARD.md`
- `docs/LIVEKIT_WEBHOOKS.md`
- `docs/MOBILE_TABLET_QA_WEST_PEEK_LIVE.md`
- `docs/PERSONA_ROUTE_OUTCOME_MAP.md`
- `docs/POST_DEPLOYMENT_SMOKE_TEST.md`
- `docs/README.md`
- `docs/ROLE_JOURNEY_E2E_MATRIX.md`
- `docs/START_HERE_FOR_FUTURE_CHATS.md`
- `docs/TESTING_CONSOLE.md`
- `docs/TRANSACTIONAL_FULL_BUFFETT_E2E_MATRIX.md`
- `docs/VALIDATION_COMPLEXITY_POLICY.md`
- `docs/VALIDATION_PROOF_MATRIX.md`
- `docs/VIDEO_PROVIDER_ABSTRACTION_7.md`
- `docs/WHITE_LABEL_BACKUP_ROOMS.md`
- `docs/WHITE_LABEL_FALLBACK_VIDEO_19A.md`
- `docs/product/journey-matrix.md`
- `docs/product/provider-proof-matrix.md`
- `docs/product/role-permission-matrix.md`
- `docs/runbooks/deployment-cloudflare.md`
- `docs/runbooks/environment-setup.md`
- `docs/runbooks/postdeploy.md`
- `docs/runbooks/validation-operations.md`
- `docs/testing/PREDEPLOY_PLAYWRIGHT_E2E.md`

## Operator rule
- Start here, then use the root ledgers and `docs/runbooks/*` for execution.
- Archived docs are historical only unless an active validator still references them and the consolidation map says so.
- New docs require an entry in `docs/DOCS_CONSOLIDATION_MAP.md`; otherwise `npm run validate:docs-consolidation` fails.

- `REPO_IDENTITY.md` — repo identity anchor for packaging, updater routing, and wrong-repo prevention.

## Final Tier / Master Addendum Docs

- `TIER_VALIDATION_MODEL.md`
- `MASTER_ADDENDUM_COMPLIANCE_LEDGER.md`
- `RUNTIME_CONTEXT_TRACE_MATRIX.md`
- `REAL_PROVIDER_LANE_MATRIX.md`
- `USER_JOURNEY_TEST_MATRIX.md`
- `TESTING_SEQUENCE.md`
- `LIVE_PROVIDER_EVIDENCE_TEMPLATE.md`

## Final-tier release/test docs

| Document | Status | Purpose |
|---|---|---|
| `TERMINAL_RELEASE_RUNBOOK.md` | ACTIVE | Terminal release/update/deploy/postdeploy/provider-proof runbook. |

## Root env restore policy

- `ENV_RESTORE_POLICY.md` — active local private env restore policy for temporary `.env.local` during Tier 2/Tier 3 test-everything runs.


## Active Doc Simplification Contract — 2026-06-12

The active doc set is intentionally split into four lanes only:

1. **Operator entry** — `README.md`, `TERMINAL_RELEASE_RUNBOOK.md`, `docs/START_HERE_FOR_FUTURE_CHATS.md`.
2. **Validation authority** — `REPO_VALIDATION_MATRIX.md`, `_repo_validation_matrix.json`, `VALIDATOR_ADMISSION_REGISTER.md`, `_validator_admission_register.json`, `TESTING_SEQUENCE.md`.
3. **Runtime/provider proof** — `TIER_VALIDATION_MODEL.md`, `REAL_PROVIDER_LANE_MATRIX.md`, `LIVE_PROVIDER_EVIDENCE_TEMPLATE.md`, `RUNTIME_CONTEXT_TRACE_MATRIX.md`.
4. **Product/role proof** — `USER_JOURNEY_TEST_MATRIX.md`, `docs/product/*`, and `docs/runbooks/*`.

No new validation or runbook doc may be added without one of these outcomes: merge into an existing active doc, archive with replacement, or admit it in `docs/DOCS_CONSOLIDATION_MAP.md`.

Advisory-style validators are retired. Validation outputs must be either **HARD FAIL** or **INFO / NO VALIDATION**.
