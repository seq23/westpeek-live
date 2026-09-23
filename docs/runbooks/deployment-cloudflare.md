# Cloudflare Deployment Runbook — Agency Event OS

Status: ACTIVE  
Date: 2026-06-11

Deployment target: Cloudflare Worker through OpenNext.

## Automatic push deploy path

Production deploys through **Cloudflare Workers Builds** (the Git integration on the `west-peek-live`
Worker): every push to `main` is built and deployed, and reported as the check-run
"Workers Builds: west-peek-live" on that commit. Pull requests get a Workers Builds preview URL.
Nothing needs to be run by hand. (Corrected 23 Sep 2026: this section used to say the GitHub
Actions workflow below ran on push; it has been `workflow_dispatch`-only since the move to Workers Builds.)

`.github/workflows/deploy-cloudflare-worker.yml` is a **manual fallback** (`workflow_dispatch` only). When
dispatched it installs with `npm ci`, runs `npm run release:prepush:container`, builds with
`npm run cf:build:recoverable`, deploys with `npm run cf:deploy -- --keep-vars`, and runs the postdeploy smoke.
Do not dispatch it while Workers Builds is healthy.

The fallback needs these GitHub Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Required Cloudflare Worker secrets are listed in `_env_contract.json` and `deployment/cloudflare-required-secrets.json`.

## Manual deploy

```bash
npm run deploy:doctor
NODE_OPTIONS="--max-old-space-size=3072" npm run cf:build
npm run cf:deploy
POSTDEPLOY_BASE_URL="https://westpeek.live" npm run postdeploy:full
```

Local success is not deployed proof.

## Cloudflare dashboard command rule

Cloudflare deploys must not run plain `next build` followed by `npx wrangler deploy`. The repo default `npm run build` is now Cloudflare-aware and emits `.open-next` output for dashboard builds. Manual operators may still run `npm run cf:build` followed by `npm run cf:deploy`.

`postdeploy:browser` is scoped to deployed-safe browser proof only. Local credentialed/operator journey gauntlets remain local validation lanes unless matching deployed test credentials and real provider proof are intentionally supplied.

