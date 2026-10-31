# Postdeploy Deployment Patch Summary — 2026-06-11

## Repo

agency-event-os

## Failure addressed

Cloudflare ran `npm run build` and then `npx wrangler deploy`. The plain Next build completed, but deploy failed because Wrangler/OpenNext could not find compiled OpenNext output.

## Change

- `npm run build` now executes a Cloudflare-aware build wrapper.
- Top-level `npm run build` emits deployable `.open-next` output by running `opennextjs-cloudflare build`.
- When OpenNext internally calls `npm run build`, the wrapper detects the OpenNext parent and runs plain `next build` only, preventing recursion.
- `build:next` remains available for explicit plain Next builds.

## Postdeploy browser scope correction

`postdeploy:browser` now runs only deployed-safe browser proof:

- `deployed-outcome-smoke.spec.ts`
- `postdeploy-role-provider-critical.spec.ts`

The previous command ran the entire local Playwright suite against the deployed Worker. That incorrectly hard-failed local-only credentialed/operator journeys when deployed worker secrets did not match local demo defaults.

Full deployed-browser exploratory execution remains available through:

`npm run postdeploy:browser:full`

## Remaining real-provider proof boundary

Real StreamYard/LiveKit media proof is still an operator-controlled lane and remains blocked until a real provider broadcast is intentionally initiated with required proof env flags.
