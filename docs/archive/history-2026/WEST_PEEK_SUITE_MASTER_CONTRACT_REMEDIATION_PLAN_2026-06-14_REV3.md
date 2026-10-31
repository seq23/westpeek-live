# West Peek Suite — Master Contract Remediation Plan

**Date:** 2026-06-14  
**Repositories:** `west-peek-network-os`, `agency-event-os`, `west-peek-pitch-lab`  
**Source baselines:**

- `west-peek-network-os-main_BASELINE_06-13-26_e95ba5f0.zip`
- `agency-event-os-main_BASELINE_06-13-26_5a7ddf56.zip`
- `west-peek-pitch-lab-main_BASELINE_06-14-26_2b27700b.zip`

**Controlling authority:** `Repo and Project Instructions — Master Operating Contract v4.0`  
**Plan status:** CUMULATIVE MASTER IMPLEMENTATION PLAN — REVISION 3  
**Revision focus:** Autonomous engineering department, container-first validation, expanded self-heal authority, mandatory Hallmark-before-deploy, scripted Terminal execution, rollback, and postdeploy remediation  
**Implementation status:** `STRUCTURALLY PLANNED — SOURCE CHANGES AND LOCAL VALIDATION REQUIRED`

---

## 1. Purpose

This plan closes the delta between the three current repository snapshots and the full Master Operating Contract, with particular emphasis on Section 13, the mandatory deployed click-audit law. It also installs an autonomous engineering lifecycle in which Juniper owns routine implementation, repair, validation, hostile review, packaging, and technical decision-making. Bounded self-heal limits repeated tactics rather than transferring unresolved engineering work to the owner.

This is not a documentation-only exercise. Every contract requirement must be wired into executable package commands, validator admission, updater contracts, diagnostics, release gates, and final proof reports.

The plan preserves repo-specific product truth:

- **Network OS:** authenticated operator product with protected operational routes.
- **Agency Event OS:** mixed public-preview and authenticated multi-role event product.
- **Pitch Lab:** public, no-auth founder product. Authentication, browser-session vaulting, and protected-route audit requirements are explicitly not applicable.

---
\n## 1A. Autonomous engineering operating model\n\nJuniper is the engineering department for this program. The owner supplies product intent, credentials or account authorization when necessary, approval for material expense, and decisions that are inherently legal, contractual, brand, monetization, or business-policy choices. The owner is not expected to review source code, select package versions, interpret validators, debug builds, or choose routine technical repairs.\n\n### Owner interruption conditions\n\nExecution may pause for the owner only when:\n\n1. credentials, account approval, or physical-device access are required;\n2. a paid service or material expense needs approval;\n3. an irreversible or materially destructive operation against real production data is proposed;\n4. a legal, regulatory, contractual, or customer-policy question lacks written authority;\n5. a brand, monetization, or business-rule choice has multiple valid outcomes;\n6. an external platform prevents further execution.\n\nAll other failures remain in Juniper's remediation queue.\n\n### Validation ownership\n\nBefore any artifact handoff, Juniper must exhaust the safe capabilities of the container, including clean extraction, install, audit, typecheck, lint, tests, browserless contracts, browser tests when available, builds, hostile review, regression, secret scan, packaging, ZIP reopen, and artifact checks. Terminal Mode is a remote execution channel in which Juniper selects one command at a time, favors repo scripts, interprets output, fixes routine failures, and provides the next command.\n
## 2. Contract read verification

The Master Operating Contract was read end to end twice from the same uploaded file.

- Line count: 483
- SHA-256: `4dd01dcd353add974d917bf1f4ac6b3555daf6a9ef89b1d5b22c147ebb87718a`
- Second read byte comparison: identical

---

## 3. Correct audit architecture by repo

### 3.1 West Peek Network OS

Required deployed audit lanes:

1. **Authenticated product crawl** for all protected operator routes and navigation states.
2. **Public route crawl** only for any intentionally public surfaces.
3. Authenticated state loaded from `.auth/playwright-storage-state.json` after `auth:restore` and `auth:status` pass.

### 3.2 Agency Event OS

Required deployed audit lanes:

1. **Public/no-auth crawl** for login, signup, invite entry, password reset, public event, registration, attendee, public preview, and other intentionally public routes.
2. **Authenticated crawl** for owner, admin, operator, crew, client, speaker, sponsor, venue, and production roles.
3. Role-specific storage states or deterministic role bootstrap must be used where route permissions differ.
4. The no-auth preview route does not replace authenticated proof.

### 3.3 West Peek Pitch Lab

Required deployed audit lane:

1. **Public deployed click audit only.**
2. No auth state, no auth vault, no login bootstrap, and no protected-route gate.
3. Authentication requirements must be recorded as `NOT APPLICABLE — PUBLIC PRODUCT` in the validation matrix, proof matrix, and updater contract.
4. The current `AUTHENTICATED_ROUTE_MANIFEST.md` title is inaccurate and must be replaced or renamed to a neutral public route manifest.

---

## 4. Executive gap summary

| Contract area | Network OS | Agency Event OS | Pitch Lab |
|---|---|---|---|
| Section 13 exact command | Present, incomplete implementation | Missing | Missing; must use public equivalent |
| Manifest-driven route crawl | No | No consolidated harness | No |
| Contract viewport sizes | Wrong | Not consolidated | Not consolidated |
| Auth-state enforcement | Present | Present but not wired to Section 13 | N/A and must be removed from plan |
| Public no-auth audit lane | Missing formal lane | Missing formal lane | Required primary lane |
| Console/network hard fail | Partial | Fragmented across scripts | Fragmented across gauntlets |
| Canonical evidence output | Partial path mismatch | Missing unified output | Missing unified output |
| `release:prepush` command | Present | Missing | Missing |
| `release:cleanup` command | Missing | Missing | Missing |
| Validator admission of release gates | Missing/incomplete | Missing/incomplete | Missing/incomplete |
| Updater-contract release hooks | Partial | Partial | Partial |
| `.gitignore` exact auth exclusions | Incomplete | Incomplete | Auth exclusions N/A; env rules still apply |
| Environment isolation harness | Implemented under `.mjs`, docs naming drift | Implemented under `.mjs`, docs naming drift | Separate env vault exists; contract alignment needed |
| Final proof matrix executable population | Unproven | Unproven | Unproven |
| GitHub Actions/deployment verification | Not executable from package lifecycle | Not executable from package lifecycle | Not executable from package lifecycle |

---

## 4A. Revised canonical lifecycle — self-heal, Hallmark, deploy, verify

The three repos must use this lifecycle in this order:

1. **Implement source change.**
2. **Run static self-heal pass.**
3. **Build local candidate.**
4. **Run local route-complete browser audit.**
5. **Apply approved deterministic UI/runtime auto-fixes.**
6. **Rebuild and rerun local validation.**
7. **Generate Hallmark evidence for every applicable route and viewport.**
8. **Run hostile Hallmark review.**
9. **Apply Hallmark remediation to source.**
10. **Rerun self-heal, build, browser audit, and Hallmark delta audit.**
11. **Run Deep Validation and `release:prepush`.**
12. **Package and reopen the baseline ZIP.**
13. **Apply through the contract-driven updater and deploy.**
14. **Run deployed public/authenticated/role click audits as applicable.**
15. **Classify failures against the approved auto-fix catalog.**
16. **For qualifying deterministic failures, patch source, rerun the full predeploy loop, redeploy, and rerun postdeploy audit.**
17. **Run provider, mutation, persistence, and cleanup proof lanes.**
18. **Run post-cleanup deployed click audits.**
19. **Populate the final proof matrix and assign the honest completion status.**

### Non-negotiable sequencing law

- Hallmark is a **predeploy design gate**.
- The deployed click audit is a **postdeploy runtime verification gate**.
- Postdeploy evidence may trigger another source remediation cycle, but it does not replace the predeploy Hallmark review.
- No production files are edited in place. Every fix must occur in source, be rebuilt, repackaged, redeployed, and reverified.

---

## 4B. Bounded self-healing architecture

Each repo must expose a canonical command:

- `release:self-heal`

The command must run a bounded detect → repair → rebuild → validate loop.

### Required stages

1. `release:autofix:static`
2. `release:autofix:routes`
3. `release:autofix:rendering`
4. `release:validate:local`
5. local public/authenticated/role browser audit as applicable
6. Hallmark evidence generation
7. deterministic Hallmark remediation rules
8. rebuild
9. rerun validation
10. emit pass/fail remediation report

### Strategy budgets and continued ownership

- Maximum passes per repair strategy: **3**.
- Each pass records detected defects, applied changes, changed files, validation results, and unresolved failures.
- If the third pass still fails, deployment remains blocked, but engineering work does not automatically return to the owner.
- Juniper must checkpoint, preserve diagnostics, stop repeating the same tactic, perform deeper root-cause analysis, select a different repair strategy, and begin another bounded cycle.
- Work stops only when the repo is clean, an external dependency blocks execution, or an owner-only decision under Section 1A is required.
- Infinite repetition of one repair tactic is forbidden; continued autonomous diagnosis is required.


### Autonomous repair authority

#### Class A — autonomous repair with standard proof

Juniper may repair, validate, and continue without owner approval:

- formatter, lint, imports, dead variables, and code hygiene;
- tests, test fixtures, validators, diagnostics, and report generators;
- route manifests, package scripts, validation-matrix wiring, and updater contracts;
- canonical viewport and evidence paths;
- display normalization, CSS overflow, focus, accessibility, and responsive defects;
- build, deployment, environment, and platform adapter configuration;
- application, API, routing, and provider-adapter defects;
- authentication implementation and authorization enforcement defects;
- persistence and cleanup bugs;
- approved dependency and framework updates;
- stale generated artifact removal and exact registered fixture cleanup.

#### Class B — autonomous repair with enhanced proof

Juniper still owns these changes, but must checkpoint and run elevated validation:

- major dependency or framework upgrades;
- authentication architecture or permission-model changes;
- persistence semantics or database schema migrations;
- provider SDK or live-integration migrations;
- destructive cleanup implementation;
- cross-repo handoff contracts;
- major component, route, or layout restructuring.

Enhanced proof requires focused regression tests, all applicable full-suite validation, hostile review, rollback instructions, and a rebuilt artifact.

#### Class C — owner authority required

Escalate only for:

- credentials or account authorization;
- material expense;
- irreversible action against real production data;
- legal, contractual, or regulatory judgment;
- brand, monetization, or business-policy choice with multiple valid outcomes;
- product behavior where no authority document resolves intent.

### Auto-fix provenance

Every automatic or autonomous change must produce:

- rule or decision ID;
- detected failure and root-cause classification;
- files and dependencies changed;
- before/after hash;
- validation command proving the repair;
- repair-strategy number;
- rollback artifact or instructions.


## 5. Shared implementation program

## Phase 0 — Source lock and acceptance ledger

### Work

1. Reopen each named ZIP and verify true repository root.
2. Record ZIP SHA-256, package manager, Node version, deployment target, branch, and repo identity.
3. Create a per-repo contract acceptance ledger mapping Sections 1–18 to:
   - implemented;
   - implemented but not wired;
   - missing;
   - not applicable with reason.
4. Package a checkpoint before any source changes.

### Exit gate

No repo identity ambiguity and no reliance on a working folder outside the supplied ZIP.

---
\n## Phase 0A — Container-first autonomous validation harness\n\n### Work\n\n1. Add or standardize `release:validate:container` in each repo.\n2. The command must orchestrate all safe locally available checks and write logs plus a structured report.\n3. Run clean dependency installation, security audit, typecheck, lint, unit/integration, domain contracts, secret scan, route parity, validator admission, browserless contracts, browser tests when available, production build, platform build, and artifact hygiene.\n4. After the nominal green path, run hostile static review and risk-specific regression.\n5. Repair proven failures in source and repeat until clean or genuinely blocked.\n6. Treat unavailable Chromium, network, credentials, or providers as narrow proof gaps; continue every unrelated validation lane.\n\n### Exit gate\n\nNo artifact may be handed off merely because the first validation attempt failed. The container must either produce a clean result or a precise external block with a recoverable checkpoint.\n
## Phase 1 — Route-manifest correction and normalization

### Shared work

1. Replace prose-only route tables with a machine-readable route manifest, preferably JSON or TypeScript, containing:
   - route ID;
   - path template;
   - resolved test path;
   - persona/role;
   - auth mode: `public`, `authenticated`, or `role-specific`;
   - criticality;
   - allowed safe actions;
   - destructive actions forbidden in click audit;
   - fixture requirements;
   - desktop/mobile requirement;
   - expected route identity assertion;
   - persistence requirement;
   - cleanup policy.
2. Generate the Markdown route manifest from the machine-readable source or validate parity in both directions.
3. Add a route-manifest validator that fails on:
   - app route missing from manifest;
   - critical manifest route with no resolved test path;
   - invalid auth classification;
   - missing expected-page assertion;
   - missing desktop/mobile requirement;
   - blank proof owner.

### Repo-specific corrections

- **Network OS:** encode single-page navigation states and any actual URL routes separately.
- **Agency Event OS:** split public, authenticated, and role-specific routes. Resolve `:eventId` with a registered proof fixture.
- **Pitch Lab:** rename `AUTHENTICATED_ROUTE_MANIFEST.md` to `DEPLOYED_ROUTE_MANIFEST.md` or `PUBLIC_ROUTE_MANIFEST.md`; mark every route public.

### Exit gate

The click-audit cannot maintain a second hardcoded route list.

---

## Phase 2 — Section 13 deployed click-audit implementation

### Canonical commands

#### Network OS

- `postdeploy:public-click-audit`
- `postdeploy:authenticated-click-audit`
- `postdeploy:click-audit:all`

#### Agency Event OS

- `postdeploy:public-click-audit`
- `postdeploy:authenticated-click-audit`
- `postdeploy:role-click-audit`
- `postdeploy:click-audit:all`

#### Pitch Lab

- `postdeploy:public-click-audit`
- `postdeploy:click-audit:all`
- `postdeploy:authenticated-click-audit` must not be a fake alias. It should either be absent with validator N/A registration, or emit a deterministic N/A report without launching a browser. Preferred: absent and formally registered N/A.

### Mandatory harness behavior

1. Require an explicit HTTPS deployed target from `POSTDEPLOY_BASE_URL` or `SMOKE_BASE_URL`.
2. Reject localhost, loopback, preview placeholders, or blank target.
3. Load routes only from the machine-readable manifest.
4. Use exactly:
   - desktop: `1280x800`;
   - mobile: `375x667`.
5. For authenticated lanes:
   - run `auth:status` first;
   - refuse missing, malformed, wrong-domain, or expired state;
   - load `.auth/playwright-storage-state.json`.
6. For each route:
   - navigate through real application navigation where available;
   - verify final URL;
   - verify page identity using heading, landmark, or route-specific data marker;
   - exercise only manifest-approved safe controls;
   - verify focus/keyboard operation for sampled controls;
   - assert no horizontal overflow;
   - assert no raw HTML, replacement characters, JSON dumps, or crash surfaces;
   - hard-fail on page errors, unhandled exceptions, console errors, and unexpected 4xx/5xx requests;
   - record skipped external resources only through an explicit allowlist with reason.
7. Write evidence under:
   - `artifacts/diagnostics/click-audit/<run_id>/`
8. Produce:
   - desktop screenshot per route;
   - mobile screenshot per route;
   - `summary.json`;
   - `route-results.json`;
   - console log;
   - failed-request log;
   - manifest coverage report;
   - N/A ledger;
   - final verdict.
9. Exit nonzero if any critical route is unvisited, any required viewport is missing, auth fails, route identity fails, or console/network defects occur.

### Important boundary

This click audit proves deployed navigation and visual/runtime integrity. It does not replace mutation/persistence gauntlets, live-provider proof, cleanup proof, or human Hallmark review.

---

## Phase 3 — Auth and environment contract alignment

### Network OS

1. Keep all four auth-vault commands.
2. Add exact `.gitignore` rules:
   - `.auth/`
   - `playwright-storage-state.json`
   - `*.gpg`
3. Validate external vault path and domain binding.
4. Admit `auth:status`, `auth:restore`, and the authenticated audit into the validation matrix.

### Agency Event OS

1. Keep auth-vault commands.
2. Add exact `.gitignore` rules.
3. Support either:
   - one role-appropriate canonical state plus deterministic role switching; or
   - separate encrypted role states under the external vault.
4. Validate that public audit runs with a clean browser context and never silently inherits authenticated state.
5. Validate that authenticated routes do not pass through public preview behavior.

### Pitch Lab

1. Remove auth-vault requirements from:
   - testing architecture;
   - runbook;
   - proof matrix;
   - update contract;
   - completion criteria.
2. Mark Section 9 as `NOT APPLICABLE — PUBLIC PRODUCT, NO AUTHENTICATED ROUTES`.
3. Keep environment/provider vault handling because API keys and deployment variables still exist.
4. Remove or rename misleading `AUTH_STATE_VAULT.md` if it describes browser authentication. If it is retained as historical governance, label it N/A and non-operational.

### Shared environment work

1. Align actual `.mjs` implementation names with the contract or update repo-local authority to explicitly declare equivalent implementations.
2. Ensure each repo provides:
   - env validation;
   - parity tracing;
   - temporary isolated environment run;
   - cleanup/restoration in `finally`/trap semantics.
3. Register every env command in the validator matrix.

---

## Phase 4 — Canonical release command wiring

Every repo must expose and wire these commands where applicable:

- `deep-validation`
- `release:prepush`
- `release:postpush`
- `release:cleanup`
- `postdeploy:click-audit:all`

### `release:prepush`

Must run only local-safe gates:

1. repo identity;
2. clean environment isolation;
3. install/lockfile verification;
4. typecheck;
5. lint;
6. unit/integration;
7. route-manifest parity;
8. secret scan;
9. build;
10. generated-artifact hygiene;
11. validator-admission check.

It must not claim deployment, auth, provider, or browser proof.

### `release:postpush`

Must orchestrate or print deterministic commands for:

1. GitHub Actions status;
2. deployed smoke;
3. public click audit;
4. authenticated/role audit where applicable;
5. provider proof lanes;
6. cleanup;
7. post-cleanup audit;
8. final proof matrix generation.

### `release:cleanup`

Must be the canonical cleanup router:

- exact-run fixture cleanup;
- provider resource cleanup;
- expired fixture cleanup;
- verification of zero leftovers;
- nonzero exit on partial cleanup.

Pitch Lab cleanup applies to founder submissions, generated packets, provider artifacts, and cross-repo handoff fixtures—not auth sessions.

### `release:self-heal`

Must be the canonical autonomous repair orchestrator. It may modify application source, tests, auth, persistence, providers, framework compatibility, rendering, scripts, and configuration under the Class A/Class B proof rules. It must:

- orchestrate independent, observable stages rather than hide all logic in one opaque file;
- use three passes per strategy;
- rotate strategy after a budget is exhausted;
- checkpoint before high-risk Class B changes;
- rebuild after material repairs;
- run risk-triggered regression depth;
- regenerate browser and Hallmark evidence when relevant;
- emit a structured remediation report;
- block deployment while defects remain.

### `release:postdeploy-remediate`

Must autonomously respond to deployed failures:

1. ingest audit diagnostics;
2. classify severity and root cause;
3. roll back or contain first for auth, data, tenant, or widespread SEV-1 failures;
4. patch source for eligible product defects;
5. run the full container validation, self-heal, predeploy Hallmark, and prepush sequence;
6. package a new baseline;
7. redeploy through the authorized updater;
8. rerun all applicable deployed audits;
9. continue with a new repair strategy when a strategy budget is exhausted;
10. interrupt the owner only under Section 1A.

It must never modify deployed files directly.


## Phase 5 — Validator admission and complexity-budget repair

### Work

1. Register every active package command in `_repo_validation_matrix.json`.
2. Add hard-fail rows for:
   - route-manifest parity;
   - deployed target validation;
   - public click audit;
   - authenticated click audit where applicable;
   - role audit for Agency;
   - auth-state validation where applicable;
   - secret scan;
   - cleanup completeness;
   - final proof matrix completeness;
   - ZIP root/integrity.
3. Add explicit N/A rows for Pitch Lab authentication.
4. Remove duplicate or obsolete validators after consolidating older postdeploy scripts into the canonical harness.
5. Update `VALIDATOR_ADMISSION_REGISTER.md` and complexity ledger with cost and production-risk justification.

### Exit gate

No release command exists outside formal admission, and no document claims a gate that package scripts cannot execute.

---

## Phase 6 — Updater contract v3.1 completion

Each `_repo_update_contract.json` must declare:

- package manager;
- Node version;
- install command;
- `deep-validation`;
- `release:self-heal`;
- `release:validate:container`;
- `release:prepush`;
- `release:postpush`;
- `release:postdeploy-remediate`;
- public click-audit command;
- authenticated click-audit command or N/A reason;
- cleanup command;
- auth restore/status hooks where applicable;
- environment restore/remove hooks;
- expected deployment hostname;
- artifact exclusions;
- maximum self-heal pass count;
- approved auto-fix catalog version;
- postdeploy remediation budget;
- Hallmark predeploy gate command;
- completion status ceiling before Tier 4.

### Repo-specific rule

- Pitch Lab must not list authentication hooks.
- Agency must list both public and authenticated/role lanes.
- Network OS must list authenticated lane and any public lane separately.

---
\n## Phase 6A — Terminal Mode scripted operations\n\n### Required operator experience\n\n1. Juniper confirms repo identity before commands.\n2. Juniper supplies one command at a time.\n3. Prefer `release:self-heal`, `release:validate:container`, `release:prepush`, `release:hallmark`, `release:postpush`, `release:cleanup`, `release:postdeploy-remediate`, and `release:report`.\n4. Every long-running command writes a log.\n5. Juniper interprets output and determines the next command.\n6. The owner is never asked to select a technical repair or interpret a stack trace.\n7. Juniper may create a temporary diagnostic or repair script when repo tooling is insufficient, then either formalize or remove it.\n8. Routine failures are fixed and rerun automatically through the Terminal sequence.\n\n### Required reports\n\nTerminal operations must produce machine-readable and Markdown reports covering commands, failures, fixes, evidence, cleanup, rollback state, remaining gaps, and final status.\n
## Phase 7 — Mutation, persistence, and cleanup proof alignment

Section 13 cannot stand alone. The final proof architecture must connect click audit to the anti-theater and fixture laws.

### Work

1. Ensure every critical durable control has a separate mutation test that proves:
   - request;
   - response;
   - durable readback;
   - refresh;
   - re-entry;
   - related count/summary update;
   - cleanup or restoration.
2. Register every created fixture with:
   - `proof_run_id`;
   - `proof_test_id`;
   - `proof_fixture`;
   - `proof_created_at`;
   - `proof_cleanup_policy`;
   - `proof_expires_at`.
3. Ensure cleanup runs in `finally` semantics.
4. Run post-cleanup public and authenticated click audits to prove cleanup did not damage product usability.

### Repo-specific emphasis

- **Network OS:** contacts, events, attendees, touches, approvals, notifications, intake, AI suggestions.
- **Agency Event OS:** events, roles, crew, speakers, sponsors, attendees, agenda, run of show, approvals, incidents, provider rooms/ingress.
- **Pitch Lab:** founder state, practice state, story card, consent, share packet, signed Network OS handoff, replay protection, deletion request.

---

## Phase 8 — Diagnostics standard enforcement

Every Tier 3 and Tier 4 run must write:

`artifacts/diagnostics/<run_id>/<test_id>/summary.json`

Required fields:

- run ID;
- test ID;
- repo;
- persona;
- auth mode;
- target URL;
- route;
- viewport;
- expected identity;
- actual identity;
- navigation steps;
- console errors;
- network failures;
- mutation/readback status;
- fixtures created;
- cleanup result;
- evidence paths;
- verdict;
- blocked/N/A reason.

Add stable error codes for auth, provider, persistence, cleanup, maintenance, and UI normalization failures.

---

## Phase 9 — Predeploy Hallmark, self-heal closure, and final proof

### Predeploy Hallmark gate

1. Generate route-complete local Hallmark evidence before packaging or deployment.
2. Cover every applicable route and state in desktop and mobile viewports.
3. Run hostile expert UX review separately from automated checks.
4. Record per-route verdicts in `HALLMARK_ROUTE_COVERAGE.md`.
5. Apply approved source remediation.
6. Rerun `release:self-heal`, local browser audit, and Hallmark delta capture.
7. Deployment is blocked while any critical Hallmark defect remains open.

### Postdeploy verification and remediation

1. Run the deployed click-audit lanes after deployment.
2. Classify each failure as:
   - deterministic auto-fix eligible;
   - manual product/security review required;
   - environment/provider failure;
   - false positive requiring test correction.
3. Eligible defects may trigger an automated source patch, but the workflow must then rerun the complete predeploy sequence, repackage, redeploy, and rerun the deployed audit.
4. Production code must never be modified in place.
\n### Production containment and rollback\n\n- Auth bypass, cross-tenant exposure, data loss/corruption, widespread route failure, or severe event-day impairment requires rollback or containment before source diagnosis.\n- Localized noncritical defects may remain live only when the failure is contained and does not violate an acceptance criterion.\n- Provider outages use documented fallbacks and do not automatically trigger unnecessary source changes.\n- Cleanup failures block completion and preserve the exact fixture ledger for repair.\n- After containment, Juniper repairs source and reruns the full lifecycle without transferring routine engineering decisions to the owner.\n
### Final proof matrix

Populate every row of `FINAL_PROOF_COVERAGE_MATRIX.md` with:

- predeploy Hallmark status;
- deployed visual status;
- network status;
- persistence status;
- refresh/re-entry status;
- mobile status;
- cleanup status;
- remediation-loop count;
- final status.

Blank cells are forbidden. Final verdicts must distinguish PASS, FAIL, UNPROVEN, NOT APPLICABLE, and BLOCKED.

---

## 6. Repo-specific implementation plans

## 6.1 West Peek Network OS

### Current strengths

- Exact authenticated command already exists.
- Auth-vault scripts exist.
- Deep Validation and prepush scripts exist.
- Diagnostics and lifecycle governance are mature.

### Required changes

1. Replace hardcoded audit routes with manifest consumption.
2. Correct viewport sizes to contract values.
3. Write evidence to canonical click-audit directory.
4. Add a formal public route lane if public surfaces exist.
5. Add exact `.gitignore` auth exclusions.
6. Add `release:cleanup` router.
7. Admit auth, prepush, cleanup, deep validation, and click-audit commands into validation matrix.
8. Add Section 13 hooks to updater contract.
9. Generate final proof matrix programmatically.
10. Preserve the stronger existing checks for route identity, console, failed requests, and fresh Sheets readback.
11. Add authenticated/local `release:self-heal` orchestration and approved rendering auto-fixes.
12. Make predeploy Hallmark a hard release gate before packaging.
13. Add controlled postdeploy source-remediation and redeploy orchestration for eligible deterministic failures.

### Acceptance gate

A newly added critical manifest route must automatically fail the audit until tested in both viewports.

---

## 6.2 Agency Event OS

### Current strengths

- Large route estate and mature role/provider tests.
- Auth-vault commands exist.
- Public and protected surfaces already exist.
- Several postdeploy scripts already prove partial behavior.

### Required changes

1. Build one canonical Section 13 harness instead of relying on fragmented legacy scripts.
2. Split manifest into public, authenticated, and role-specific lanes.
3. Implement exact public and authenticated commands.
4. Add role-specific audit orchestration.
5. Resolve dynamic event routes with a newly created proof event, never a seeded fallback.
6. Validate public preview with a clean unauthenticated browser context.
7. Validate authenticated command center and role portals with proper states.
8. Add exact `.gitignore` auth exclusions.
9. Add `release:prepush`, `release:postpush`, and `release:cleanup`.
10. Register all new and retained commands in validation matrix.
11. Retire duplicate legacy postdeploy scripts only after parity is proven.
12. Include provider/fallback truthfulness and cross-event denial in separate Tier 4 lanes.
13. Add dual-lane self-heal: public-preview plus authenticated/role route audits.
14. Make route-complete public and authenticated Hallmark review mandatory before packaging.
15. Add controlled postdeploy source-remediation and redeploy orchestration; never patch live files.

### Acceptance gate

The audit must prove both:

- public preview works without authentication;
- protected routes cannot be treated as proven through that preview route.

---

## 6.3 West Peek Pitch Lab

### Current strengths

- Mature public founder journey and postdeploy gauntlet.
- Strong consent, no-scoring, signed-handoff, and provider contracts.
- Environment/provider vault tooling exists.

### Required changes

1. Remove authentication from the target architecture.
2. Rename the inaccurate authenticated route manifest.
3. Implement `postdeploy:public-click-audit` from the public route manifest.
4. Mark Section 9 and authenticated Section 13 steps N/A with reason.
5. Remove auth-vault requirements from runbooks, proof matrices, and updater contract.
6. Add `release:prepush`, `release:postpush`, and `release:cleanup`.
7. Register public audit and N/A auth rows in validation matrix.
8. Prove public routes in both required viewports.
9. Exercise founder controls safely: profile/practice flow, story card, consent, share, delete-my-info, and truthful handoff states.
10. Keep signed Network OS handoff as a separate mutation/provider proof lane.
11. Add public-only `release:self-heal`; no auth machinery may be introduced.
12. Make public route-complete Hallmark mandatory before packaging.
13. Add controlled postdeploy source-remediation and redeploy orchestration for eligible public UI/runtime failures.

### Acceptance gate

No test, report, or completion rule may imply Pitch Lab has or needs authentication.

---

## 7. Implementation order

1. **Shared route-manifest schema and validator.**
2. **Shared bounded self-heal engine and approved auto-fix catalog.**
3. **Network OS Section 13 hardening** because it already has the closest implementation.
4. **Agency public/auth/role split and canonical harness.**
5. **Pitch Lab public-only harness and auth-governance cleanup.**
6. Shared release command wiring.
7. Validator admission and updater-contract updates.
8. Cleanup router and fixture lifecycle proof.
9. Run local self-heal and route-complete browser audits per repo.
10. Run mandatory predeploy Hallmark review and remediation per repo.
11. Run Deep Validation and builds per repo.
12. Package each repo separately.
13. Apply locally through the contract-driven updater.
14. Verify GitHub Actions and deployments.
15. Run public/auth/role deployed click audits as applicable.
16. Run controlled source-remediation and redeploy loops for eligible failures.
17. Run provider and mutation proof lanes.
18. Cleanup exact fixtures.
19. Run post-cleanup deployed audits.
20. Complete final proof matrices and assign honest statuses.

---

## 8. Required implementation artifacts per repo

- machine-readable deployed route manifest;
- generated/validated Markdown route manifest;
- public click-audit harness;
- authenticated click-audit harness where applicable;
- role-audit orchestrator for Agency;
- click-audit config and allowlist;
- evidence schema;
- route-manifest validator;
- final-proof matrix generator;
- `release:self-heal`;
- `release:validate:container`;
- `release:prepush`;
- `release:postpush`;
- `release:postdeploy-remediate`;
- `release:cleanup`;
- updated `_repo_validation_matrix.json`;
- updated `_repo_update_contract.json`;
- updated `.gitignore`;
- updated runbook;
- canonical autonomous remediation report generator;
- Terminal Mode command/report runbook;
- rollback/containment runbook;
- implementation report;
- full baseline ZIP.

---

## 9. Validation matrix

### Structural and local gates

- ZIP root and integrity;
- lockfile install;
- typecheck;
- lint;
- unit/integration;
- route-manifest parity;
- validator admission;
- secret scan;
- env isolation;
- production build;
- bounded self-heal pass;
- local route-complete browser audit;
- predeploy Hallmark evidence and hostile review;
- OpenNext/Cloudflare build where applicable;
- browserless contract fallback where Chromium is unavailable;
- risk-triggered depth: auth denial matrix, persistence readback, provider fallback/live proof, dependency full build, cleanup zero-leftover, and cross-repo producer/consumer proof as applicable;
- hostile review after nominal green, followed by final regression after hostile repairs.

### Local browser gates

- headed Playwright by default;
- public routes;
- authenticated routes where applicable;
- role boundaries;
- mobile and desktop;
- hostile payload rendering;
- safe control clicks;
- mutation/readback lanes.

### Deployed gates

- GitHub Actions;
- deployed hostname smoke;
- public click audit;
- authenticated click audit where applicable;
- Agency role audits;
- provider lanes;
- exact cleanup;
- post-cleanup click audit;
- postdeploy remediation-loop report;
- final proof closure.

Hallmark expert review occurs before deployment; postdeploy audits verify the deployed runtime and may trigger a new predeploy remediation cycle.

---

## 10. Completion law

`COMPLETE` is forbidden until all applicable proof layers pass. A repository cannot deploy while a blocking Hallmark, security, data, auth, cleanup, or runtime defect remains. Juniper owns routine remediation through clean validation; owner approval is required only under Section 1A. Postdeploy remediation cannot bypass rollback/containment when required or the full rebuild, Hallmark, packaging, updater, and redeploy sequence.

### Maximum pre-deployment status

`STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED`

### Maximum after deployment but before route-complete audit

`PARTIAL — DEPLOYED; FULL PRODUCT CLICK-AUDIT AND FINAL PROOF NOT COMPLETE`

### Pitch Lab N/A rule

Authentication may not block Pitch Lab completion because it is not part of the product. The final proof matrix must contain an explicit N/A reason rather than a blank or false pass.

---
\n## 10A. Autonomous execution laws\n\n- A failed script creates engineering work for Juniper; it does not turn the owner into the developer.\n- Bounded loops prevent repeated tactics; they do not cap Juniper's responsibility to diagnose and repair.\n- Container capabilities must be exhausted before Terminal handoff.\n- Terminal Mode must maximize repo-owned scripts, validators, audits, cleanup, reports, and remediation.\n- High-risk engineering changes require stronger proof, not routine owner code review.\n- The owner is consulted only for external authority, material cost, irreversible production risk, or irreducible business/legal/brand decisions.\n- No fake green, no silent assertion weakening, no direct live-file patching, and no fuzzy production deletion.\n
## 11. Artifact status

- Source code changed: **NO**
- Repo validation run: **NO**
- Browser proof run: **NO**
- Deployment proof run: **NO**
- Final baseline ZIPs produced: **NO**
- Plan status: **COMPLETE — REVISED CUMULATIVE IMPLEMENTATION PLAN ONLY**
