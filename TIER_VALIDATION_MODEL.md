# Tier Validation Model — agency-event-os

Authority: `Repo_and_Project_Instructions_Master_Operating_Contract_v5.3.md`.

## Canonical tiers

### Tier 1 — Static/source/contract proof
Structure, types, lint, source security, route and environment contracts. It does not prove runtime behavior.

### Tier 2 — Local behavioral and integration proof
Unit and integration behavior, API contracts, authorization logic, persistence adapters, serialization, and failure mapping without browser dependence.

### Tier 3A — Controlled local browser proof
Desktop and mobile browser journeys using deterministic fixtures or mocked external providers.

### Tier 3B — Provider-independent full-stack local browser proof
Real local application routes, real local authentication, and production-shaped persistence. Mutations require readback, reload/re-entry, cross-context observation, and negative authorization.

### Tier 4A — Deployed safe-runtime proof
GitHub Actions, deployed commit identity, Cloudflare runtime, public/authenticated/role click audits, deployed authorization, mutation/readback, and isolation.

### Tier 4B — Real-provider operational proof
StreamYard, LiveKit, Cloudflare Stream, Daily, Zoom, Google Meet fallback, production Supabase, transactional delivery, attendee consumption, revoke/restore, and exact cleanup / teardown. LiveKit ingress cleanup is mandatory evidence, not an optional note.

### Tier 4C — Human/expert approval
Route- and state-complete Hallmark review, brand review, and operational signoff. Screenshots do not prove approval.

## Truth boundaries

- Route rendering is not journey completion.
- Local mocks do not prove production providers.
- Documentation presence does not prove execution.
- Every mutation requires state change, persistence readback, reload/re-entry, and negative authorization.
- Completion is forbidden while a required row is UNPROVEN or BLOCKED.

