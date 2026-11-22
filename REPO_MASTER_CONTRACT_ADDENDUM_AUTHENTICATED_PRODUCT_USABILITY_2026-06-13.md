# Repo and Project Instructions Master Operating Contract
## Separate Addendum — Authenticated Product Usability, Production-Shaped Data, Route-Complete Hallmark, and Lifecycle Closure

**Date:** 2026-06-13  
**Revision:** v1.0  
**Status:** LOCKED ADDENDUM — GENERIC / CROSS-REPO  
**Applies to:** `Repo_and_Project_Instructions_Master_Operating_Contract.md` and `REPO_MASTER_CONTRACT_EXTENDED_ADDENDUM_TESTING_HALLMARK_RELEASE_2026-06-13_v3.md`  
**Scope:** All browser-rendered authenticated applications, operational dashboards, provider-integrated systems, multi-route internal tools, admin products, and any app whose production data can materially differ from mocked or normalized fixtures.  
**Supersession rule:** This addendum is additive. It does not replace the Extended Master Addendum. Where an earlier process permits lifecycle closure without authenticated route-complete usability and persistence proof, this addendum governs.

---

# 1. Purpose

This addendum closes a proof failure class exposed during the West Peek Network OS lifecycle:

A repository may pass build, typecheck, static validators, mocked Playwright, provider integration, authenticated session proof, persistence proof, cleanup proof, postdeploy smoke, and Hallmark evidence collection while the actual authenticated product remains materially unusable.

The missed defects included:

- raw HTML rendered directly into operator interfaces
- serialized JSON and diagnostic payloads shown as user-facing copy
- malformed character encoding
- oversized provider payloads destroying page layout
- missing archive, restore, dismiss, revoke, or remove controls
- false confidence from homepage-only authenticated evidence
- authenticated workflows not tested route by route
- success states not verified after refresh and re-entry
- maintenance logic that passed on small fixtures but exceeded deployment subrequest limits on production-scale data
- cleanup that proved one fixture run was removed but did not prove the remaining product was usable
- lifecycle closure declared before operator-facing usability was proven

This addendum makes those proof gaps explicit and non-optional.

---

# 2. Core law

A product is not proven because its routes exist, APIs respond, providers write data, or screenshots were generated.

For authenticated browser products, final proof must establish:

1. the operator can reach every required route
2. the route renders safely with production-shaped data
3. every visible critical control performs its promised action
4. the authenticated network request succeeds
5. the durable state change is verified
6. refresh and re-entry preserve the correct result
7. failure states are understandable
8. mobile and desktop remain usable
9. no critical route remains uninspected
10. lifecycle cleanup does not become a substitute for product usability

No combination of narrower proofs may be inferred to equal this result.

---

# 3. Proof-layer non-substitution law

The following proofs are valid but non-substitutable:

| Proof layer | What it may prove | What it may not prove |
|---|---|---|
| Static validation | source shape, contracts, file presence, policy tokens | authenticated usability, real rendering, durable mutations |
| Typecheck/build | compilation and bundle generation | correct operator workflow |
| Mocked browser tests | deterministic UI logic with controlled data | real provider payload behavior |
| Provider integration | ingestion, classification, write/readback | readable or usable presentation |
| Auth boundary test | unauthorized users are denied | authenticated users can complete work |
| Postdeploy smoke | deployment responds and key routes are alive | protected route usability |
| Hallmark evidence pack | screenshots/evidence were generated | expert review, route completeness, workflow correctness |
| Cleanup verification | fixtures are inactive or removed | remaining product is usable |
| Success toast | client believes action succeeded | durable persisted state |
| Route capture | page loaded | every control and state on that route works |

Passing one layer never upgrades another layer automatically.

---

# 4. Authenticated route-complete audit law

Every authenticated browser product must maintain an explicit route inventory.

Required fields:

| Route | Persona | Purpose | Production Data Dependency | Critical Controls | Desktop | Mobile | Network Verified | Persistence Verified | Status |
|---|---|---|---|---|---|---|---|---|---|

A final authenticated audit must:

- visit every required route
- use the approved production or production-equivalent authenticated state
- capture desktop and mobile evidence for every critical route
- identify all visible critical controls
- exercise every safe destructive or lifecycle action
- record network responses
- verify persistence/readback
- refresh and re-enter
- record console and failed network errors
- identify any route not inspected

Homepage-only capture is invalid for a multi-route product.

An authenticated evidence pack must include a route coverage manifest. If any required route is absent, final Hallmark status is incomplete.

Required result labels:

- `ROUTE VISUALLY INSPECTED`
- `CONTROL NETWORK VERIFIED`
- `PERSISTENCE VERIFIED`
- `REFRESH / RE-ENTRY VERIFIED`
- `UNPROVEN`
- `FAILED`

---

# 5. Production-shaped data law

Mocked and local fixtures must represent the hostile shapes of real production inputs.

For provider-integrated apps, the fixture corpus must include, where applicable:

- complete HTML email bodies
- nested forwarded email threads
- quoted replies
- HTML entities
- tracking pixels and invisible elements
- malformed or mixed character encodings
- extremely long subject, body, name, company, and note values
- serialized JSON objects and arrays
- OCR output
- voice transcripts
- provider error payloads
- low-confidence extraction
- duplicate content
- missing fields
- null values
- unexpected booleans and numbers
- signed packets
- stale and replayed packets
- large metadata objects
- long URLs
- unusual Unicode characters
- values with no whitespace
- provider-generated diagnostics

Clean five-line fixtures are insufficient when production providers return hostile payloads.

Every app must define a production-shaped fixture corpus and identify which routes consume each fixture class.

---

# 6. Safe presentation law

All provider, user, imported, or externally generated content must pass through an explicit presentation boundary before display.

The boundary must define:

- HTML treatment
- entity decoding
- script/style removal
- whitespace normalization
- encoding repair strategy
- maximum inline length
- expansion behavior
- source-detail behavior
- long-token wrapping
- line clamping
- accessibility behavior
- safe links
- JSON formatting or field extraction
- fallback for malformed content

Raw provider payloads must not be dumped into dashboard cards.

Recommended pattern:

```text
raw source payload
        ↓
stored source record
        ↓
normalized display model
        ↓
short operator summary
        ↓
explicit “View source details” surface
```

The UI may preserve raw source data for auditability, but the default operator view must remain readable.

No use of `dangerouslySetInnerHTML` is permitted for untrusted payloads without a documented sanitizer and security review.

Safe text rendering alone is not enough if literal HTML tags, entities, and serialized objects remain visually destructive.

---

# 7. Render-safety acceptance criteria

Every production data card or row must prove:

- no horizontal page overflow
- no action controls pushed off-screen
- no unbounded vertical expansion by default
- no raw HTML tags in default display
- no raw serialized diagnostic object in primary copy
- no malformed replacement characters where repair is possible
- long tokens wrap safely
- source details are available separately
- truncation is disclosed
- important identity fields remain visible
- controls remain keyboard accessible
- mobile tap targets remain usable
- empty and malformed states are intentional

A route fails product validation if a single realistic provider payload makes the critical workflow unusable.

---

# 8. Entity lifecycle matrix law

Every durable entity must have an explicit lifecycle definition.

Required matrix:

| Entity | Create | View | Edit/Update | Approve/Reject | Archive/Delete/Revoke | Restore | Readback | Refresh/Re-entry | Permission Owner |
|---|---|---|---|---|---|---|---|---|---|

For every entity, the repo must state:

- whether hard delete is allowed
- whether append-only status versions are required
- whether archive/revoke is the canonical removal action
- whether history must remain visible
- who may mutate it
- what dependent records are affected
- what happens after refresh
- what error state is shown
- how the action is tested
- how proof fixtures are cleaned

If an entity exists in production but has no operator lifecycle path, the gap must be classified as either:

- intentional immutable history, documented and approved
- product defect
- deferred feature with owner acceptance

Silence is not a valid lifecycle design.

---

# 9. Visible-control inventory law

Every visible critical control must map to a complete behavior contract.

Required fields:

| Route | Control | Persona | API/Action | Expected State Change | Persistence Readback | Refresh Proof | Failure UX | Test |
|---|---|---|---|---|---|---|---|---|

Examples include:

- create
- edit
- attach
- approve
- reject
- dismiss
- archive
- restore
- revoke
- delete
- mark read
- fulfill
- sync
- refresh
- maintain
- publish
- unpublish
- retry
- export
- connect provider
- disconnect provider

A button existing in source is not proof.

A mocked click is not production proof.

A successful response without readback is not completion proof.

---

# 10. Authenticated mutation gauntlet law

For Level 4+ authenticated apps, the Master Gauntlet must include an authenticated mutation lane.

For every critical entity type:

1. locate the record through the real UI
2. execute the real control
3. capture the request
4. assert the response
5. read back durable state through API or persistence
6. refresh the page
7. re-enter the route
8. verify the state remains correct
9. verify related counts and summaries update
10. restore or clean the test record when required

At least one negative case must also be tested:

- unauthorized user
- malformed request
- stale record
- duplicate action
- already archived record
- missing identifier
- provider failure
- persistence failure

Success toast only is forbidden as the sole assertion.

---

# 11. Authenticated postdeploy click audit law

Unauthenticated postdeploy smoke and authenticated product click audit are separate commands and separate reports.

The authenticated click audit must:

- use real restored browser state
- target the deployed URL
- traverse the route manifest
- click real navigation
- exercise critical safe actions
- inspect console errors
- inspect failed network requests
- record final URLs
- verify persistence
- refresh and re-enter
- generate route-scoped evidence

Required command pattern:

```text
postdeploy:authenticated-click-audit
```

or a repo-specific equivalent.

The word “click audit” must not be used for a script that only performs HTTP status checks.

---

# 12. Route-complete Hallmark law

Hallmark evidence collection for authenticated multi-route apps must be route-complete.

The evidence pack must contain:

- route manifest
- desktop screenshot per critical route
- mobile screenshot per critical route
- route title and URL
- authenticated persona
- visible critical controls
- console-error summary
- failed-network summary
- data-shape summary
- known unproven interactions

Hallmark review must evaluate:

- hierarchy
- trust
- density
- readability
- data presentation
- action clarity
- destructive action clarity
- empty states
- error states
- mobile behavior
- overflow
- truncation
- raw payload leakage
- operator cognitive load

The evidence runner does not determine pass/fail by itself.

The expert review must issue one of:

- `APPROVED`
- `APPROVED WITH WARNINGS`
- `REDESIGN REQUIRED`
- `INCOMPLETE — ROUTE COVERAGE MISSING`
- `BLOCKED — AUTHENTICATED ACCESS FAILED`

A homepage-only pack cannot receive `APPROVED` for the whole authenticated product.

---

# 13. Maintenance and platform-budget law

Any maintenance, migration, normalization, cleanup, or repair workflow must be tested against realistic production volume and deployment limits.

The repo must define:

- expected row count
- expected dirty-cell count
- provider requests per invocation
- platform subrequest limit
- batch size
- timeout budget
- retry policy
- idempotency behavior
- partial-progress behavior
- resume behavior
- no-progress abort
- final verification
- operator diagnostics

Per-record or per-cell remote writes are prohibited when a batch API exists and realistic data volume could exceed platform limits.

Maintenance tests must include:

- zero work
- small work
- production-shaped work
- maximum admitted batch
- partial failure
- retry
- resumed execution
- stale readback
- no-progress detection
- platform limit simulation

Generic failure labels such as `UNKNOWN_MAINTENANCE_FAILURE` are prohibited when a more precise category can be produced.

---

# 14. Realistic scale fixture law

Every production-scale maintenance or cleanup path must have a deterministic scale fixture.

Required properties:

- realistic row count
- realistic field width
- realistic dirty-record distribution
- worst-case remote operation count
- deterministic expected batches
- deterministic final state
- no real customer data
- safe cleanup

A path that passes only on one or two records is not scale-proven.

---

# 15. Cleanup non-substitution law

Cleanup proves only cleanup.

It does not prove:

- route usability
- data presentation
- lifecycle completeness
- mutation controls
- maintenance correctness
- remaining production data quality
- post-cleanup refresh behavior
- Hallmark quality

After live cleanup, the required closure sequence is:

1. fresh authenticated snapshot
2. route-complete visual inspection
3. counts and summaries verified
4. no stale fixtures visible
5. critical controls still present
6. console/network check
7. final route-complete Hallmark evidence when required

A verified `remaining_total: 0` cannot close the product lifecycle by itself.

---

# 16. Lifecycle closure gate

For authenticated Level 4+ applications, lifecycle completion requires all applicable gates:

1. source/build/static validation
2. Tier 2 behavior
3. production-shaped fixture proof
4. local browser proof
5. deployment/postpush proof
6. authenticated session proof
7. live provider/persistence proof
8. authenticated route-complete click audit
9. lifecycle action proof for every critical entity
10. cleanup verification
11. post-cleanup authenticated route audit
12. route-complete Hallmark expert review
13. no critical unproven route
14. no critical unproven control
15. no unresolved production-data rendering defect
16. evidence report with exact proof labels

If any critical gate is missing, the maximum status is:

`PARTIAL — DEPLOYMENT AND LIVE PROVIDER PROOF MAY HAVE PASSED; AUTHENTICATED FULL-PRODUCT USABILITY NOT PROVEN`

The status `COMPLETE` is forbidden.

---

# 17. Proof coverage matrix law

Every final release report for an authenticated multi-route app must include:

| Route / Workflow | Visually Inspected | Network Verified | Persistence Verified | Refresh/Re-entry | Mobile | Cleanup Verified | Status |
|---|---|---|---|---|---|---|---|

No aggregate statement may hide route-level gaps.

The report must distinguish:

- `PASS`
- `FAIL`
- `UNPROVEN`
- `NOT APPLICABLE`
- `BLOCKED`

Blank cells are forbidden.

---

# 18. Production error observability law

User-visible generic errors must map to actionable internal diagnostics.

Every critical failure must identify:

- category
- route/action
- provider
- operation
- retryability
- safe operator message
- correlation/run ID
- redacted technical detail
- completion impact

Examples:

- `SHEETS_BATCH_UPDATE_FAILED`
- `SHEETS_READBACK_STALE`
- `CLOUDFLARE_SUBREQUEST_LIMIT`
- `AUTH_SESSION_EXPIRED`
- `PROVIDER_RATE_LIMIT`
- `PERSISTENCE_WRITE_FAILED`
- `MAINTENANCE_NO_PROGRESS`
- `CLEANUP_PARTIAL`
- `UI_DISPLAY_NORMALIZATION_FAILED`

`UNKNOWN_*` may exist only as a true final fallback and must preserve the underlying classified cause in diagnostics.

---

# 19. Test-data realism and privacy law

Production-shaped fixtures must be synthetic or safely redacted.

Do not copy real customer/private provider data into committed fixtures.

Fixtures may reproduce:

- length
- shape
- nesting
- encoding problems
- HTML structure
- metadata complexity
- provider response structure

Fixtures must not reproduce unnecessary PII, credentials, private message content, or confidential deal details.

---

# 20. Validator admission update

The validation matrix must include separate rows for:

- production-shaped fixture contract
- display normalization (React escapes text by default; the postdeploy click audit fails on raw payload markers and horizontal overflow; see `DISPLAY_NORMALIZATION_CONTRACT.md`)
- route coverage manifest
- authenticated click audit
- entity lifecycle matrix consistency
- maintenance scale test
- cleanup verification
- post-cleanup route audit
- Hallmark route-completeness check
- final proof coverage matrix

Static validators must not claim these runtime behaviors passed.

---

# 21. Required repo-owned artifacts

For applicable repos, create or align:

- `AUTHENTICATED_PRODUCT_AUDIT.md`
- `AUTHENTICATED_ROUTE_MANIFEST.md`
- `ENTITY_LIFECYCLE_MATRIX.md`
- `VISIBLE_CONTROL_INVENTORY.md`
- `PRODUCTION_SHAPED_FIXTURES.md`
- `DISPLAY_NORMALIZATION_CONTRACT.md`
- `MAINTENANCE_SCALE_AND_PLATFORM_LIMITS.md`
- `HALLMARK_ROUTE_COVERAGE.md`
- `FINAL_PROOF_COVERAGE_MATRIX.md`

These may be consolidated into existing canonical documents when duplication would result.

Do not create documentation sprawl.

---

# 22. Hostile review questions

Before lifecycle closure, the hostile review must answer:

1. What happens with the longest real provider payload?
2. What happens with literal HTML?
3. What happens with serialized JSON?
4. What happens with malformed encoding?
5. Can every durable entity leave the active workspace?
6. Can every lifecycle action be restored or audited?
7. Does every action persist after refresh?
8. Is every critical route captured?
9. Are all controls reachable on mobile?
10. Does maintenance stay within platform limits?
11. Does cleanup preserve legitimate records?
12. Does post-cleanup UI remain correct?
13. Are mocked fixtures materially easier than production data?
14. Is any green result being interpreted beyond its proof boundary?
15. Is any completion claim based on inference rather than evidence?

Any unresolved critical answer blocks `COMPLETE`.

---

# 23. Migration rule for existing repos

For existing authenticated apps:

1. inventory routes
2. inventory entities
3. inventory controls
4. inspect real provider payload shapes
5. create production-shaped fixtures
6. identify raw-payload display surfaces
7. implement presentation boundaries
8. add missing lifecycle controls
9. add mutation/readback tests
10. add authenticated deployed click audit
11. make Hallmark route-complete
12. test maintenance at scale
13. run cleanup
14. audit after cleanup
15. update proof matrices
16. only then reconsider completion status

Existing green tests do not grandfather a repo out of this migration.

---

# 24. Acceptance criteria

This addendum is active when:

1. authenticated route inventory exists
2. critical routes are captured and reviewed
3. production-shaped fixtures exist
4. display normalization is explicit and tested
5. entity lifecycle matrix is complete
6. visible controls map to persistence outcomes
7. authenticated mutation gauntlet exists
8. maintenance paths are scale-tested
9. postdeploy authenticated click audit exists
10. cleanup is followed by post-cleanup audit
11. Hallmark evidence is route-complete
12. final proof is reported route by route
13. narrow proofs are not combined into unsupported completion claims
14. `COMPLETE` is blocked when authenticated usability remains unproven

---

# 25. Final laws

A provider write is not a usable product.  
A clean mock is not hostile production data.  
A homepage screenshot is not a product audit.  
An auth denial test is not authenticated workflow proof.  
A success toast is not persistence.  
A cleanup result is not usability.  
A green validator is not a route-complete operator journey.  
A route is not proven until its controls, network, persistence, refresh, and human usability are proven.  
No inferred COMPLETE.
