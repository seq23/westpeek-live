# WEST PEEK SUITE — LOCKED RELEASE LIFECYCLE CONTRACT

**Status:** LOCKED / CANONICAL
**Applies to:** Network OS, Agency Event OS, Pitch Lab

*Updated 31 Oct 2026: baseline ZIPs are retired. A change is a pull request; `land <pr>` merges and
deploys it. The ZIP-era steps (package, reopen, apply ZIP) are history in `docs/archive/history-2026/`.*

## Universal lifecycle

1. Container structural proof (`npm run release:validate:container`, also CI's `Repository validation`).
2. Run the exact repository `release:prepush` contract on the branch before opening the PR.
3. Run local real-browser visual proof when the change touches what it covers, and preserve evidence externally.
4. Push, open the PR, and merge only on green, with `land <pr>`.
5. Verify `main` and the deploy workflow reach green for the merge commit.
6. Run `release:postpush`.
7. Run repo-specific `release:live-proof`.
8. Run the populated deployed click-audit lanes applicable to the repo.
9. Run exact fixture cleanup.
10. Run the repo-specific post-cleanup integrity check.
11. Generate `release:report`.

## First-command-green delivery law

The PR's CI run is a confirmation gate, not a discovery environment. Before pushing, the exact repo-owned `release:prepush` command runs on the branch with dependencies installed from the lockfile. Any failure is repaired in source before the push.

When the environment cannot execute a real browser, it must run the registered structural/snapshot fallback and label real-browser proof as local-required. It may not claim screenshots or browser geometry. The post-merge browser suite on `main` then executes the real-browser lane.

## Evidence preservation

Browser screenshots, traces, geometry maps, and reports must be copied outside the repo before cleanup or snapshot replacement:

`~/repo-validation-evidence/<repo>/<run-id>/`

Generated run evidence is never committed.

## Non-substitution law

Container structural proof does not replace local browser proof. Local browser proof does not replace deployed click audits. Deployed click audits do not replace live mutation/readback or cleanup proof.

## Repository profile: agency-event-os

- Applicable deployed surface: public + authenticated + role
- Live proof command: `npm run release:live-proof`
- Populated audit command: `npm run postdeploy:click-audit:all`
- Post-cleanup integrity command: `npm run postcleanup:integrity`
- Local visual proof command: `npm run release:local-visual-proof`
- Notes: Event system with public preview, authenticated control surfaces, and role isolation. Tier 4 must preserve event isolation and provider semantics.
