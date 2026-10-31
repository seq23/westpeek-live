# Agency Event OS — Local Env Restore Policy

Status: ACTIVE

## Why this exists

`Agency Event OS` needs real provider credentials for Tier 3 proof, but real secret values and plaintext `.env.local` files must never be committed to the repository.

The repo therefore does **not** require `secrets/agency-event-os.env.local.gpg` to be present in the repository. That old repo-local assumption has been removed.

## Approved restore model

`npm run env:restore` and `npm run test:everything:*:with-env` now look for a private env source in this order:

1. `AGENCY_EVENT_OS_ENV_GPG_PATH=/absolute/path/to/agency-event-os.env.local.gpg`
2. `AGENCY_EVENT_OS_ENV_LOCAL_PATH=/absolute/path/to/.env.local.backup`
3. `AGENCY_EVENT_OS_ENV_BACKUP=/absolute/path/to/.env.local.backup`
4. `~/.config/agency-event-os/agency-event-os.env.local.gpg`
5. `~/agency-event-os.env.local.gpg`
6. `~/agency-event-os.env.local.backup`

The repo may include `secrets/README.md`, but it must not include plaintext real secrets.

## Standard local commands

Predeploy local proof with temporary env:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:tier2:with-env
```

Postdeploy / final provider proof with temporary env:

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
NODE_OPTIONS="--max-old-space-size=3072" \
npm run test:everything:tier3:with-env
```

Full failure harvest with temporary env:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:with-env
```

## Cleanup rule

`run-with-temp-env.mjs` removes `.env.local` after the command when the wrapper created it.

If `.env.local` already exists, the wrapper refuses to overwrite or remove it unless the operator uses `--allow-existing`.

## Completion impact

If no private env source exists locally, Tier 3 is BLOCKED by missing operator secret material. That is a real blocker, not a repository defect.
