# Hallmark Route and State Coverage

Expert Hallmark approval is required for every applicable route, persona, viewport, and material state in `_hallmark_route_state_contract.json`. Evidence capture alone does not constitute approval. Completion is blocked while any required row is `UNPROVEN` or `BLOCKED`.

## Runtime-first events (ADM-2026-09-15-RUNTIME-EVENTS)

The `/app/events/new`, `/app/events`, `/app/events/[eventId]`, `/app/events/[eventId]/access`, `/app/events/[eventId]/publish`, `/app/clients`, `/app/clients/[clientId]`, `/app/settings`, `/join`, `/events/[slug]`, and `/venue/[eventId]/lobby` rows now have a runtime-created event as a material state in addition to the compiled seed state. `/production-access` gained the Owner Access card and `/production-access/owner` accepts either owner master password. Browser evidence for these states is captured by `tests/e2e/owner-real-events-journey.spec.ts`; the rows stay `UNPROVEN` in `_hallmark_route_state_contract.json` until an expert Hallmark pass records evidence, as for every other row.

