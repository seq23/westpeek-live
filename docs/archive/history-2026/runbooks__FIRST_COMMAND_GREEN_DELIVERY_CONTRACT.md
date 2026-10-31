# FIRST-COMMAND-GREEN DELIVERY CONTRACT

**Repo:** agency-event-os
**Status:** LOCKED

## Mandatory pre-delivery sequence

1. Build or repair source in a clean workspace.
2. Install dependencies strictly from the committed lockfile.
3. Run `npm run release:prepush`.
4. Repair every failure; do not weaken assertions or downgrade real blockers.
5. Repeat until green.
6. Remove generated artifacts and secrets.
7. Package a complete baseline ZIP from the true repo root.
8. Reopen the ZIP into a fresh directory.
9. Run artifact packaging validation before dependency installation.
10. Install dependencies from the reopened artifact lockfile.
11. Run the exact `npm run release:prepush` command from the reopened artifact.
12. Run `npm run release:local-visual-proof` when a real browser is available; otherwise run the registered structural fallback and label local browser proof required.
13. Deliver only after the report records all executed layers and remaining environment gaps.

The updater must not be the first environment to discover stale tests, missing files, broken builds, or invalid package scripts.
