# Pre-Updater Baseline ZIP Checklist

**Status:** Canonical operational checklist  
**Purpose:** Prevent updater failures caused by incomplete, unsafe, or wrongly packaged baseline ZIPs.  
**Use:** Run this checklist before delivering or applying any snapshot ZIP.

## 1. Identity and naming

- [ ] ZIP filename matches `<repo>-main_BASELINE_MM-DD-YY_<sha>.zip`.
- [ ] ZIP belongs to the target repository named in `REPO_IDENTITY.md`.
- [ ] `_repo_update_contract.json` contains the same `repo_name`.
- [ ] Target branch and package manager match the repo contract.

## 2. True-root packaging

The ZIP must open directly to the repository root. It must not contain a duplicate wrapper folder.

Required root files:

- [ ] `.gitignore`
- [ ] `README.md`
- [ ] `REPO_IDENTITY.md`
- [ ] `package.json`
- [ ] exactly one supported lockfile
- [ ] `_repo_update_contract.json`
- [ ] `_repo_validation_matrix.json`
- [ ] `REPO_UPDATE_LIFECYCLE.md`
- [ ] `DOCUMENTATION_AUTHORITY_INDEX.md`
- [ ] `WEST_PEEK_BRAND_SYSTEM.md`

Required safe environment documentation:

- [ ] `.env.example`
- [ ] `.env.local.example`
- [ ] `.env.preview.example`
- [ ] `.env.production.example`
- [ ] `_env_contract.json` or the repo-authorized environment registry/documentation

## 3. Required source and lifecycle surfaces

- [ ] application source directories are present;
- [ ] `scripts/` is present;
- [ ] route manifest is present;
- [ ] lifecycle scripts referenced by `package.json` exist;
- [ ] `release:prepush` exists;
- [ ] `release:self-heal` exists;
- [ ] `release:hallmark` exists;
- [ ] `release:close-lifecycle` exists;
- [ ] deployment configuration is present.

## 4. Files that must not be packaged

- [ ] no `.git/`;
- [ ] no `node_modules/`;
- [ ] no active `.env` or `.env.*` secret-bearing files;
- [ ] no decrypted `.auth/` state;
- [ ] no plaintext credentials, keys, or certificates;
- [ ] no `dist/`, `build/`, `out/`, `.next/`, or `.open-next/`;
- [ ] no `.runtime-data/`;
- [ ] no `coverage/`, `playwright-report/`, `test-results/`, or generated diagnostics;
- [ ] no `tsconfig.tsbuildinfo` or local caches;
- [ ] no updater temporary directories or logs.

Encrypted repo-authorized vault artifacts may be packaged only when the repo contract explicitly identifies them. Decrypted values are never allowed.

### Repo-specific encrypted continuity rule

- [ ] no encrypted repo-local vault is required by the current Agency contract.
- [ ] no decrypted Agency environment or auth state is packaged.

## 5. Integrity and safety checks

Run before handoff:

    unzip -t "<ZIP_PATH>"
    unzip -Z1 "<ZIP_PATH>" | sort

Verify:

- [ ] ZIP integrity passes;
- [ ] no absolute or parent-traversal paths;
- [ ] no unexpected symlinks;
- [ ] no forbidden secret-bearing filenames;
- [ ] no duplicate wrapper root;
- [ ] required files remain present after reopening.

## 6. Updater preflight

Before applying:

- [ ] active v3.1 updater path has been verified;
- [ ] updater `--help` has been reviewed;
- [ ] local repository is clean;
- [ ] repository identity and origin are confirmed;
- [ ] ZIP and repository names match;
- [ ] updater dry-run deletion count is within its safety threshold;
- [ ] auth and local environment restoration requirements are understood;
- [ ] rollback/safety-tag behavior is available.

## 7. Localhost-before-push lane

When a localhost preview is required before deployment:

- [ ] run the updater with `PAUSE_BEFORE_PUSH=1`;
- [ ] allow installation, validation, and local commit to complete;
- [ ] start the repo-authorized local preview command;
- [ ] run applicable local browser and Hallmark checks;
- [ ] do not push until preview and remediation are complete.

## 8. Final evidence

Record:

- ZIP path and SHA-256;
- reopened root path;
- required-file check result;
- forbidden-file check result;
- updater evidence directory;
- pre-update safety tag;
- local validation result;
- localhost/Hallmark result;
- remaining live-only proof gaps.

A failed checklist item blocks updater execution until the baseline ZIP is rebuilt correctly.

## Executable Packaging Contract

The authoritative file list is `_baseline_packaging_contract.json`, enforced by:

`npm run validate:baseline-package-contract`

The checklist must be derived from executable updater, environment-doctor, prepush, and repo-specific vault requirements. A documentation-only checklist is not sufficient proof.
