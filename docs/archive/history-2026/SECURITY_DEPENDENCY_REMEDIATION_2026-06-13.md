# Agency Event OS — High/Critical Dependency Remediation

**Date:** 2026-06-13  
**Scope:** Targeted remediation of npm audit findings rated HIGH or CRITICAL  
**Source baseline:** `agency-event-os-main_BASELINE_06-14-26_ac9df45c.zip`  
**Status:** STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED

## Outcome

The dependency tree moved from **10 high / 2 critical** advisories to **0 high / 0 critical** advisories.

Residual audit findings are **7 moderate / 2 low** and were outside the approved high/critical scope. They remain visible and must not be represented as zero total vulnerabilities.

## Targeted dependency changes

| Dependency | Previous | Remediated | Reason |
|---|---:|---:|---|
| `next` | 14.2.35 | 15.5.18 | Removes production-reachable Next.js high-severity advisory chain |
| `eslint-config-next` | 14.2.35 | 15.5.18 | Keeps lint/runtime framework alignment |
| `@opennextjs/cloudflare` | 1.13.1 | 1.19.11 | Supports patched Next 15 and current Cloudflare adapter path |
| `@playwright/test` | 1.48.2 | 1.60.0 | Removes high-severity browser download/integrity advisory path |
| `vitest` | 2.1.9 | 4.1.8 | Removes critical local UI-server advisory |
| `esbuild` override | vulnerable nested versions | 0.28.1 | Removes high-severity nested build-tool advisory chain |
| `@types/node` | 20.16.11 | 20.19.0 | Resolves upgraded Vitest/Vite type compatibility |

## Framework compatibility remediation

The Next.js 15 upgrade required application-source changes. The following were migrated instead of suppressing checks:

- asynchronous `cookies()` access in authentication and role/session paths;
- asynchronous page `params` and `searchParams` across dynamic and access routes;
- auth-cookie helper call propagation;
- internal navigation migrated from raw anchors where required by Next lint;
- Vitest worker options migrated to supported Vitest 4 arguments.

## Validation evidence

- Clean `npm ci`: PASS
- `npm audit --audit-level=high`: PASS — 0 high / 0 critical
- TypeScript: PASS
- ESLint: PASS
- Unit tests: PASS — 148 tests
- Full repo `npm run validate`: PASS
- Next.js 15 production build: PASS
- OpenNext Cloudflare build: PASS
- Auth, role, event-scope, provider, cleanup, deployment-parity, Tier 4 static contracts: PASS

## Proof boundary

This remediation proves local dependency resolution, source compatibility, unit/static contracts, Next production compilation, and OpenNext bundle generation. It does not prove GitHub Actions, deployed Cloudflare runtime, authenticated route-complete browser behavior, or live provider behavior.
