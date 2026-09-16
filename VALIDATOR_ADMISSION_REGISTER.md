# Validator Admission Register — agency-event-os

Status: ACTIVE

## Simplified Validation Authority

Every validation/test/smoke/audit/deploy package script is assigned below. Advisory severity states are retired. Each row is either `HARD FAIL`, `INFO / NO VALIDATION`, or a Tier 3 `BLOCKED UNTIL ...` prerequisite state. `BLOCKED` is not a warning; it is missing external deployed/provider/operator evidence.

| Script | Admission | Severity | Owner | Category | Parent / Matrix Authority | Blocker policy |
|---|---|---|---|---|---|---|
| `audit:cloudflare-secrets` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `audit:speed-networking:e2e` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `audit:warnings` | registered_proof_lane | INFO / NO VALIDATION | Repo owner / release operator | audit_quality | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cf:build` | direct_matrix_row | HARD FAIL | Repo owner / release operator | deployment | `cf:build` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cf:build:recoverable` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cf:deploy` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cf:preview` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cf:secrets:audit` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cf:secrets:sync` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cf:upload` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cloudflare:secrets:audit` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `cloudflare:secrets:sync` | registered_proof_lane | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `deploy:doctor` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `deploy:production:safe` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `gauntlet:playwright:local` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:browser` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:click-audit` | registered_proof_lane | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:full` | direct_matrix_row | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `postdeploy:full` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:full:legacy` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:role-flow` | registered_proof_lane | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:role-flow-e2e` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:smoke` | direct_matrix_row | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `postdeploy:smoke` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `postdeploy:video-provider` | registered_proof_lane | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `predeploy:hard` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | deployment | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `probe:streamyard-livekit:mock` | direct_matrix_row | HARD FAIL | Repo owner / release operator | provider_runtime | `probe:streamyard-livekit:mock` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `smoke:post-deploy` | registered_proof_lane | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `smoke:streamyard-livekit:real` | direct_matrix_row | HARD FAIL | Repo owner / release operator | postdeploy_runtime | `smoke:streamyard-livekit:real` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test` | direct_matrix_row | HARD FAIL | Repo owner / release operator | unit_integration | `test` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:coverage-required` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:coverage-required` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:day1-operator` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:day1-showtime-master-gauntlet` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:day1-showtime-master-gauntlet` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:deployed` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:deployed-outcome` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:legal-brand` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:local-diagnostics` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:local-diagnostics:outcome` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:local-diagnostics:surface` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:local-diagnostics:transactional` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:local-headed` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:master-contract-edge` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:master-contract-edge` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:mobile-critical` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:mobile-critical` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:operator-crew-preview` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:operator-event-creation` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:outcome` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:postdeploy-critical` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:postdeploy-critical` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:predeploy` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:predeploy:headed` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:predeploy:headless` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:predeploy:outcome` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:predeploy:surface` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:predeploy:transactional` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:provider-webhook-security` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:provider-webhook-security` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:real-streamyard-livekit` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:real-streamyard-livekit` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:route-cta-inventory` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:route-cta-inventory` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:scope-isolation` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `test:e2e:scope-isolation` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:snapshots` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:surface` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:transactional` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything` | orchestrator_entrypoint | HARD FAIL | Repo owner / release operator | unit_integration | `test:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:watch` | registered_support_lane | INFO / NO VALIDATION | Repo owner / release operator | unit_integration | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:access-boundaries` | registered_support_lane | HARD FAIL | Repo owner / release operator | auth_permissions | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:assets` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:attendee-live-controls` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:attendee-registration-contract` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:auth` | registered_support_lane | HARD FAIL | Repo owner / release operator | auth_permissions | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:backend-foundation` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:brand` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:browser-diagnostics` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:cta-promise-registry-contract` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:daily-fallback` | registered_support_lane | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:daily-static` | registered_support_lane | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:day1-streamyard-model` | direct_matrix_row | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:day1-streamyard-model` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:deploy-parity` | direct_matrix_row | HARD FAIL | Repo owner / release operator | deployment | `validate:deploy-parity` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:docs-consolidation` | direct_matrix_row | HARD FAIL | Repo owner / release operator | governance | `validate:docs-consolidation` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:e2e-coverage` | direct_matrix_row | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:e2e-coverage` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:e2e-outcome-contract` | registered_support_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:email-workflows` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:env` | direct_matrix_row | HARD FAIL | Repo owner / release operator | environment_secrets | `validate:env` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:env-access-gates` | registered_support_lane | HARD FAIL | Repo owner / release operator | environment_secrets | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:event-config-package` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:everything` | orchestrator_entrypoint | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:global-logo-stage` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:hostile-master-addendum` | direct_matrix_row | HARD FAIL | Repo owner / release operator | static_validation | `validate:hostile-master-addendum` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:legal-brand` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:live-chat` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:livekit-provider` | registered_support_lane | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:livekit-room-ui` | registered_support_lane | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:no-generated-artifacts` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:no-node-crypto-public` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:persistence` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:phase12` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:phase13` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:phase14` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:phase15` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:phase16` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:phase17` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:phase2d2e2f` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:production-config` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:production-ops-persistence` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:production-workflow` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:public-frontdoor-contract` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:reports-exports` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:required-env-registry` | registered_support_lane | HARD FAIL | Repo owner / release operator | environment_secrets | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:role-journey-e2e` | registered_support_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:speaker-sponsor-persistence` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:speed-networking-engine` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:stage-player-ux` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:stage-stream` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:streamyard-ingress` | direct_matrix_row | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:streamyard-ingress` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:structure` | direct_matrix_row | HARD FAIL | Repo owner / release operator | static_validation | `validate:structure` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:supabase-schema` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:testing-console` | registered_support_lane | HARD FAIL | Repo owner / release operator | unit_integration | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:transactional-e2e-contract` | registered_support_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v4` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v4-access` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | auth_permissions | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v4-event-config` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v4-front-door` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v4-publishing` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5-access-security` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | auth_permissions | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5-event-config-schema` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5-hard` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5-no-secrets` | direct_matrix_row | HARD FAIL | Repo owner / release operator | environment_secrets | `validate:v5-no-secrets` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5-publishing` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5-route-authorization` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | auth_permissions | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v5-runtime-boundaries` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v6` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v6-audit` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | audit_quality | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v6-completion` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v6-hard` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v6-strong-warnings` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v6-warnings` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v7` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v7-day1-packet` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v7-frontdoor-labels` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:runtime-events-contract` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:deploy-parity` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:live-chat-moderation-contract` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:deploy-parity` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v7-operator-launchpad` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v7-route-safety` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:v7-ux-brand-demo` | umbrella_or_legacy_chain | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:validation-proof-matrix-contract` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:validator-admission` | direct_matrix_row | HARD FAIL | Repo owner / release operator | governance | `validate:validator-admission` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:venue-persistence` | registered_support_lane | HARD FAIL | Repo owner / release operator | static_validation | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:video-provider` | registered_support_lane | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:whitelabel-video` | registered_support_lane | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:final-tier-contract` | registered_proof_lane | HARD FAIL | Repo owner / release operator | governance | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:final-tier` | registered_proof_lane | HARD FAIL | Repo owner / release operator | final release gate | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:tier1` | registered_proof_lane | HARD FAIL | Repo owner / release operator | validation orchestration | `test:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:tier2` | registered_proof_lane | HARD FAIL | Repo owner / release operator | validation orchestration | `test:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:tier3` | registered_proof_lane | HARD FAIL | Repo owner / release operator | validation orchestration | `test:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:unmatrixed` | registered_proof_lane | HARD FAIL | Repo owner / release operator | validation orchestration | `test:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:with-env` | orchestrator_entrypoint | HARD FAIL | Repo owner / release operator | temporary env full failure harvest | `test:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:tier1:with-env` | orchestrator_entrypoint | HARD FAIL | Repo owner / release operator | temporary env tier1 failure harvest | `test:everything:tier1` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:tier2:with-env` | orchestrator_entrypoint | HARD FAIL | Repo owner / release operator | temporary env predeploy failure harvest | `test:everything:tier2` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:everything:tier3:with-env` | orchestrator_entrypoint | HARD FAIL | Repo owner / release operator | temporary env final provider failure harvest | `test:everything:tier3` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:final-tier:with-env` | registered_proof_lane | HARD FAIL | Repo owner / release operator | temporary env final release gate | `validate:final-tier` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |

| `tier4:real-provider-journey-probe` | registered_proof_lane | HARD FAIL | Repo owner / release operator | provider_runtime | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `test:e2e:tier4-real-provider-journeys` | registered_proof_lane | HARD FAIL | Repo owner / release operator | browser_e2e | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |
| `validate:tier4-hostile-coverage` | registered_proof_lane | HARD FAIL | Repo owner / release operator | governance | `validate:everything` | HARD FAIL blocks only when the script is selected by the active tier/profile; INFO rows are diagnostic. |

## Simplification Pass — 2026-06-12

- Advisory severity states are retired. Validators are now either `HARD FAIL` or `INFO / NO VALIDATION`.
- Every package-level validation/test/smoke/audit/deploy script has an assigned owner and blocker policy in `_validator_admission_register.json`.
- Validators that only check copy labels or doc phrasing must be `INFO / NO VALIDATION` unless the matrix names a real operational risk.
- Generated artifacts are checked by `validate:no-generated-artifacts`; secret scanning does not fail merely because build output exists.
- Docs consolidation is enforced through `docs/ACTIVE_DOCS.md`, `docs/DOCS_CONSOLIDATION_MAP.md`, and `docs/archive/ARCHIVE_INDEX.md`.


## Tier 3 blocked prerequisite policy

Postdeploy and real-provider validators must not fake failure against localhost when the required deployed URL or operator-confirmed provider proof is absent. They report `BLOCKED` until the required external proof inputs are present. After those inputs are present, any command failure is a hard blocker.

## LiveKit Twirp URL Contract — 2026-06-12

- Validator: `npm run validate:livekit-twirp-url-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: prevent both deployed app code and Tier 4 proof harnesses from using a `wss://` LiveKit client URL for server-side Twirp `fetch()` calls.
- Required trace: Tier 4 controlled proof reports classify failures as harness/env/provider/deployed-app failures and retain sanitized phase trace.


## Tier 4 cleanup validator admission

- `validate:tier4-cleanup-contract` is admitted as the static guard for LiveKit ingress cleanup proof.
- `tier4:cleanup-livekit-ingress` is admitted as the approved stale-ingress cleanup utility.
- The cleanup validator must be present in both `validate:tier4-contract` and `validate:deploy-parity` so cleanup proof cannot regress outside the Tier 4 command path.

## Tier 4 Expanded Provider Ladder Data Trace — 2026-06-12

Tier 4 is not only StreamYard/LiveKit. The live-provider proof must trace the full production fallback ladder:

1. LiveKit-only deployed app ingress creation and cleanup via `Ingress/DeleteIngress`.
2. StreamYard-compatible controlled RTMP path through LiveKit ingress, with cleanup.
3. Daily fallback room creation, token issuance, and mandatory room deletion.
4. Zoom fallback authorization proof through the deployed signature route; no provider resource is created, so cleanup status must be `not_required_stateless_signature`.
5. Google Meet manual continuity proof through `GOOGLE_MEET_MANAGED_FALLBACK_URL` or `GOOGLE_MEET_EMERGENCY_URL`; if intentionally out of scope, `TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON` must be explicit.

A Tier 4 report that omits Daily, Zoom, or Google Meet is incomplete for this product promise. Cleanup must be machine-readable, not narrative-only.

## Validator Admission — Tier 4 Provider Ladder Contract

- `validate:tier4-provider-ladder-contract` is admitted as a hard validator.
- It proves the Tier 4 data trace includes LiveKit-only, StreamYard/LiveKit, Daily, Zoom, and Google Meet fallback lanes.
- It proves cleanup semantics are explicit: LiveKit and Daily must delete created provider resources; Zoom is stateless; Google Meet is manual continuity or explicit not-applicable.


## Tier 4 fallback ladder expansion — 2026-06-12

Show-day ladder order is now explicit and must be exercised in Tier 4:

1. StreamYard-compatible Custom RTMP path into LiveKit, proven by controlled ffmpeg RTMP broadcaster. StreamYard itself remains a manual/operator provider because automated StreamYard API access is enterprise-only.
2. LiveKit + Cloudflare Stream Live fallback, proven through the Cloudflare Stream Live Inputs API, controlled RTMP media push, and live input cleanup.
3. Daily real fallback provider, proven by room create, meeting token create, and room delete cleanup. Daily API keys are normalized so pasted `Bearer ...` values do not create `Bearer Bearer ...` authentication failures; a 401 after normalization is a real Daily key/domain/provider auth failure.
4. Zoom fallback, proven by denied unauthenticated access and authorized SDK signature generation; no provider cleanup is required because the proof is stateless.
5. Google Meet fallback, proven by valid HTTPS Meet continuity URL or explicit not-applicable disposition; no provider cleanup is required because it is a manual/static continuity link.

Tier 4 must attempt every configured rung and fail only after the full ladder trace is written.

## Validator Admission: Tier 4 Attendee Live Consumption

Admitted validator: `validate:tier4-attendee-live-consumption-contract`

This validator is admitted because it prevents the prior class of failure where provider/operator proof could pass while the final attendee consumption and live access-control outcome remained unproven.

## 2026-06-12 hostile attendee live-consumption review addendum

- Added same-room LiveKit ingress/attendee token proof.
- Added browser-stage proof to Tier 4 attendee consumption gauntlet.
- Added explicit generated-evidence run id matching.
- Added owner/showrunner/crew authorization and backend logging for permit/revoke/re-permit controls.
- Added best-effort LiveKit participant removal during revocation.
- Added hostile review artifact: `HOSTILE_CODE_REVIEW_TIER4_ATTENDEE_LIVE_CONSUMPTION_2026-06-12.md`.

