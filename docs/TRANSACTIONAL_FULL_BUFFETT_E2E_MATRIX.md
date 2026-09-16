# Transactional Full Buffett E2E Matrix

Status: ACTIVE

This matrix exists to prevent false confidence from route-only browser tests. A role journey is not considered complete unless the suite proves at least one meaningful action, persistence signal, or safe-failure boundary for that role.

## Required coverage

| Area | Transactional expectation |
|---|---|
| Producer setup | Create a real event from `/app/events/new` (LATER) and verify the local runtime store (`.runtime-data/local-playwright-runtime.json` → `runtimeEvents`) contains the row with its join code. |
| Producer run of show | Click a producer run-of-show control and verify `runOfShowEvents` records the action. |
| Crew / producer testing console | Open `/admin/testing/demo` with scoped test access and verify showtime readiness, livestream, matchmaking, route health, debug/fix, and Zoom/Google Meet fallback decisioning. |
| Visitor registration | Submit rich registration fields and verify local runtime registration data persists without writing production data. |
| Attendee venue | Enter lobby/stage/help/networking and verify analytics/support/networking runtime signals. |
| Matchmaking | Prove queue join analytics, no-repeat pair selection, second-match selection, and exhausted-pair null result. |
| Video | Verify LiveKit/Daily/Zoom token routes fail safely without secrets and do not leak generic digest/server errors. |
| Production boundary | Local E2E may use explicit file runtime store and local auth harness; trusted deploy validation must still reject file-store production posture. |

## Non-negotiable rule

Do not call E2E complete when only static pages render. The suite must prove clicks, submissions, redirects, local persistence, safe failures, and showtime fallback decisioning.
