# Autonomous Terminal Runbook

**Repo:** `agency-event-os`

Terminal Mode is Juniper-directed remote engineering. The owner copies one command and returns output; Juniper selects and interprets every technical step.

## Canonical order

1. Six-step repo identity check.
2. `npm run release:validate:container`
3. `npm run release:self-heal`
4. `npm run release:hallmark`
5. `npm run release:prepush`
6. Apply baseline through the authorized v3.1 updater.
7. Inspect GitHub Actions and deployment.
8. `npm run release:postpush`
9. `npm run release:cleanup`
10. `npm run release:report`

Every long command captures logs. Routine failures remain Juniper's work queue.
