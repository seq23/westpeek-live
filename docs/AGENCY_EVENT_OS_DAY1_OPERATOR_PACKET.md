# West Peek Live — Private Day 1 Owner / Operator Packet

**Audience:** Scooter / private owner-level operator  
**System:** West Peek Live  
**Canonical production domain:** https://westpeek.live  
**Worker fallback URL:** https://west-peek-live.seq-taylor.workers.dev  
**Repo commit pushed:** `f967934`  
**Cloudflare Worker version deployed:** `827bb322-1669-4603-bf58-bbf83a4829ee`  
**Current status:** local validation passed, headed Playwright passed, Cloudflare build passed, Cloudflare deploy passed, worker postdeploy smoke passed  
**Canonical-domain note:** use the canonical domain operationally. The worker URL is retained only as a fallback/technical verification URL.

> **Owner packet. Raw secrets must not be committed.**  
> Do not paste this file into public tickets, public docs, Slack channels, or email threads unless the recipient is explicitly owner-approved.

---

## Quick retrieval index

| Need | Go here |
|---|---|
| Owner/boss access | [Owner / Boss Master Gate](#2-owner--boss-master-gate) |
| Operator launchpad password | [Operator access](#3-operator-access) |
| Crew password | [Crew access](#4-crew-access) |
| Speaker/sponsor/client/VIP codes | [Access code matrices](#7-access-code-matrices) |
| Which gate to use | [Access gate matrix](#6-access-gate-matrix) |
| What each role can access | [Role boundary matrix](#8-role-boundary-matrix) |
| Day 1 show flow | [Day 1 workflow matrix](#9-day-1-workflow-matrix) |
| Video/fallback model | [Video provider and failure-plane matrix](#11-video-provider-and-failure-plane-matrix) |
| What has been tested | [Validation proof matrix](#13-validation-proof-matrix) |
| What is not proven | [Known proof limits](#14-known-proof-limits) |

---

## 1. Rules of use

| Rule | Meaning |
|---|---|
| Treat this as private owner material | It contains access routing, env key names, and operational instructions. Raw password values belong only in private env backup / Cloudflare secrets. |
| Use canonical domain for operations | Use `https://westpeek.live` for owner/operator/crew/guest/public paths. |
| Keep worker URL as fallback only | Use `https://west-peek-live.seq-taylor.workers.dev` only if canonical routing/DNS needs troubleshooting. |
| Do not email/post this packet publicly | Share only with owner-approved operators. |
| Do not commit raw secrets | This repo copy is sanitized; private owner storage holds the actual secret values. |
| Do not paste raw passwords into public tickets | Reference the role/code/env key name instead. |

---

## 2. Owner / Boss Master Gate

Use this only for owner-level control, settings, billing, admin testing, and full workspace access. This is the canonical Owner / Boss Master Gate for Day 1 operations.

| Item | Value |
|---|---|
| Gate | `https://westpeek.live/production-access/owner` |
| Password key | `OWNER_MASTER_ACCESS_PASSWORD` |
| Password source | Private env backup / Cloudflare secret value for `OWNER_MASTER_ACCESS_PASSWORD`; do not store raw password in repo docs. |
| Use when | Owner settings, billing, admin testing, full workspace access |
| Do not use for | Regular crew/speaker/sponsor/client/VIP access |

---

## 3. Operator access

Use this for Day 1 show operation, launchpad, event creation, setup, preview, run-of-show, crew manager, video health, incidents, approval queue, and change control.

| Item | Value |
|---|---|
| Gate | `https://westpeek.live/production-access/operator` |
| Password key | `OPERATOR_LAUNCHPAD_PASSWORD` |
| Password source | Private env backup / Cloudflare secret value for `OPERATOR_LAUNCHPAD_PASSWORD`; do not store raw password in repo docs. |
| Main destination | Operator Launchpad |
| Use when | Creating events, managing setup, testing routes, preparing show ops |
| Do not use for | Speaker/sponsor/client role testing unless intentionally validating boundaries |

---

## 4. Crew access

Use this for show-day crew surfaces: crew home, call sheet, run-of-show, tasks, fallback, escalation, and show instructions.

| Item | Value |
|---|---|
| Gate | `https://westpeek.live/production-access/crew` |
| Password key | `CREW_ACCESS_PASSWORD` |
| Password source | Private env backup / Cloudflare secret value for `CREW_ACCESS_PASSWORD`; do not store raw password in repo docs. |
| Main destination | Crew event workspace |
| Use when | Crew needs call sheet, run-of-show, tasks, fallback instructions |
| Boundary | Crew does not get operator launchpad powers |

---

## 5. Special guest access model

Special guests use the Special Guest Gate plus the event-specific code for their role.

| Item | Value |
|---|---|
| Gate | `https://westpeek.live/production-access/special-guest` |
| Required field 1 | Event code |
| Required field 2 | Role-specific password |
| Roles | Client, Speaker, Sponsor, VIP, Crew Lite |
| Important rule | Role codes route guests to role-scoped surfaces only |

---

## 6. Access gate matrix

| Person / job | Gate URL | Credential to use | Lands on | Boundary |
|---|---|---|---|---|
| Owner / boss | `https://westpeek.live/production-access/owner` | `OWNER_MASTER_ACCESS_PASSWORD` | Owner/full workspace access | Highest trust; private only |
| Operator / producer | `https://westpeek.live/production-access/operator` | `OPERATOR_LAUNCHPAD_PASSWORD` | Operator Launchpad | Production access, not generic public access |
| Crew | `https://westpeek.live/production-access/crew` | `CREW_ACCESS_PASSWORD` | Crew workspace | No operator launchpad powers |
| Speaker | `https://westpeek.live/production-access/special-guest` | Event speaker code | Speaker portal | Speaker-only surfaces |
| Sponsor | `https://westpeek.live/production-access/special-guest` | Event sponsor code | Sponsor portal | Sponsor-only surfaces |
| Client | `https://westpeek.live/production-access/special-guest` | Event client code | Client portal | Client-only review surfaces |
| VIP | `https://westpeek.live/production-access/special-guest` | Event VIP code | Venue/lobby | Attendee/VIP experience only |
| Crew Lite | `https://westpeek.live/production-access/special-guest` | Event crew-lite code | Crew instruction surfaces | Not full operator access |
| Public attendee | `https://westpeek.live/join` or event page | Registration/event code flow | Public event/venue | No role/admin access |

---

## 7. Access code matrices

### 7A. Global owner/operator/crew passwords

| Scope | Key | Password | Gate |
|---|---|---|---|
| Owner / boss | `OWNER_MASTER_ACCESS_PASSWORD` | `set in Cloudflare (vault: WESTPEEK_LIVE_OWNER_MASTER_ACCESS_PASSWORD)` | `https://westpeek.live/production-access/owner` |
| Operator | `OPERATOR_LAUNCHPAD_PASSWORD` | `set in Cloudflare (vault: WESTPEEK_LIVE_OPERATOR_LAUNCHPAD_PASSWORD)` | `https://westpeek.live/production-access/operator` |
| Crew | `CREW_ACCESS_PASSWORD` | `set in Cloudflare (vault: WESTPEEK_LIVE_CREW_ACCESS_PASSWORD)` | `https://westpeek.live/production-access/crew` |

### 7B. Demo event codes

Use event code `demo`.

| Role | Key | Code | Destination |
|---|---|---|---|
| Client | `EVENT_DEMO_CLIENT_CODE` | `Demo-Client-2026!` | Client portal |
| Crew Lite | `EVENT_DEMO_CREW_LITE_CODE` | `Demo-CrewLite-2026!` | Crew instruction surfaces |
| Speaker | `EVENT_DEMO_SPEAKER_CODE` | `Demo-Speaker-2026!` | Speaker portal |
| Sponsor | `EVENT_DEMO_SPONSOR_CODE` | `Demo-Sponsor-2026!` | Sponsor portal |
| VIP | `EVENT_DEMO_VIP_CODE` | `Demo-VIP-2026!` | Venue/lobby |

### 7C. Leadership Reset Webinar codes

Use event code `leadership-reset-webinar`.

| Role | Key | Code | Destination |
|---|---|---|---|
| Client | `EVENT_LEADERSHIP_RESET_WEBINAR_CLIENT_CODE` | `Leadership-Client-2026!` | Client portal |
| Crew Lite | `EVENT_LEADERSHIP_RESET_WEBINAR_CREW_LITE_CODE` | `Leadership-CrewLite-2026!` | Crew instruction surfaces |
| Speaker | `EVENT_LEADERSHIP_RESET_WEBINAR_SPEAKER_CODE` | `Leadership-Speaker-2026!` | Speaker portal |
| Sponsor | `EVENT_LEADERSHIP_RESET_WEBINAR_SPONSOR_CODE` | `Leadership-Sponsor-2026!` | Sponsor portal |
| VIP | `EVENT_LEADERSHIP_RESET_WEBINAR_VIP_CODE` | `Leadership-VIP-2026!` | Venue/lobby |

### 7D. Premium Workshop Intensive codes

Use event code `premium-workshop-intensive`.

| Role | Key | Code | Destination |
|---|---|---|---|
| Client | `EVENT_PREMIUM_WORKSHOP_INTENSIVE_CLIENT_CODE` | `Workshop-Client-2026!` | Client portal |
| Crew Lite | `EVENT_PREMIUM_WORKSHOP_INTENSIVE_CREW_LITE_CODE` | `Workshop-CrewLite-2026!` | Crew instruction surfaces |
| Speaker | `EVENT_PREMIUM_WORKSHOP_INTENSIVE_SPEAKER_CODE` | `Workshop-Speaker-2026!` | Speaker portal |
| Sponsor | `EVENT_PREMIUM_WORKSHOP_INTENSIVE_SPONSOR_CODE` | `Workshop-Sponsor-2026!` | Sponsor portal |
| VIP | `EVENT_PREMIUM_WORKSHOP_INTENSIVE_VIP_CODE` | `Workshop-VIP-2026!` | Venue/lobby |

### 7E. Provider Innovation Expo codes

Use event code `provider-innovation-expo`.

| Role | Key | Code | Destination |
|---|---|---|---|
| Client | `EVENT_PROVIDER_INNOVATION_EXPO_CLIENT_CODE` | `Expo-Client-2026!` | Client portal |
| Crew Lite | `EVENT_PROVIDER_INNOVATION_EXPO_CREW_LITE_CODE` | `Expo-CrewLite-2026!` | Crew instruction surfaces |
| Speaker | `EVENT_PROVIDER_INNOVATION_EXPO_SPEAKER_CODE` | `Expo-Speaker-2026!` | Speaker portal |
| Sponsor | `EVENT_PROVIDER_INNOVATION_EXPO_SPONSOR_CODE` | `Expo-Sponsor-2026!` | Sponsor portal |
| VIP | `EVENT_PROVIDER_INNOVATION_EXPO_VIP_CODE` | `Expo-VIP-2026!` | Venue/lobby |

### 7F. Seed Demo Day codes

Use event code `seed-demo-day`.

| Role | Key | Code | Destination |
|---|---|---|---|
| Client | `EVENT_SEED_DEMO_DAY_CLIENT_CODE` | `SeedDemo-Client-2026!` | Client portal |
| Crew Lite | `EVENT_SEED_DEMO_DAY_CREW_LITE_CODE` | `SeedDemo-CrewLite-2026!` | Crew instruction surfaces |
| Speaker | `EVENT_SEED_DEMO_DAY_SPEAKER_CODE` | `SeedDemo-Speaker-2026!` | Speaker portal |
| Sponsor | `EVENT_SEED_DEMO_DAY_SPONSOR_CODE` | `SeedDemo-Sponsor-2026!` | Sponsor portal |
| VIP | `EVENT_SEED_DEMO_DAY_VIP_CODE` | `SeedDemo-VIP-2026!` | Venue/lobby |

---

## 8. Role boundary matrix

| Role | Can access | Cannot access |
|---|---|---|
| Owner / boss | Owner gate, app workspace, billing, settings, admin/testing, protected workspaces | Nothing lower-trust should need this password |
| Operator | Launchpad, event creation, setup, preview, run-of-show, crew console, admin/testing, video health, incident/change-control surfaces | Owner-only billing/settings unless owner gate is used |
| Crew | Crew event home, call sheet, run-of-show, tasks, fallback/escalation instructions | Operator Launchpad, owner settings, billing |
| Crew Lite | Crew instruction surfaces via Special Guest Gate | Full crew/operator/admin powers |
| Speaker | Speaker event portal, onboarding, tech check, green room, backstage, teleprompter | Sponsor/client/crew/operator/admin surfaces |
| Sponsor | Sponsor event portal, setup, booth, leads, ready room, report | Speaker/client/crew/operator/admin surfaces |
| Client | Client event review, approvals, assets, reports, run-of-show, timeline | Speaker/sponsor/crew/operator/admin surfaces |
| VIP | Venue/lobby experience | Role portals, crew/operator/admin surfaces |
| Attendee | Public event registration and venue surfaces | Role portals, crew/operator/admin surfaces |

---

## 9. Day 1 workflow matrix

| Step | Owner/operator action | URL / surface | Pass condition |
|---:|---|---|---|
| 1 | Open Production Access Hub | `https://westpeek.live/production-access` | Hub loads without exposing passwords |
| 2 | Enter Operator Gate | `https://westpeek.live/production-access/operator` | Launchpad opens |
| 3 | Create event draft | Launchpad → Create Event in Admin Workspace | Setup draft page opens |
| 4 | Confirm setup draft | `/app/events/[eventId]/setup` | Event name, code, date, audience, providers visible |
| 5 | Preview attendee venue | Setup page → Preview event | Lobby/stage/sessions surfaces load |
| 6 | Review run-of-show | `/app/events/[eventId]/run-of-show` | Run-of-show is visible and actionable |
| 7 | Review crew briefing | `/app/events/[eventId]/crew` and crew route | Crew instructions are visible |
| 8 | Review video health | `/app/events/[eventId]/video-health` | Provider/fallback status is visible |
| 9 | Test crew gate | `https://westpeek.live/production-access/crew` | Crew route opens without operator powers |
| 10 | Test speaker gate | `https://westpeek.live/production-access/special-guest` | Speaker portal opens using speaker code |
| 11 | Test sponsor gate | `https://westpeek.live/production-access/special-guest` | Sponsor portal opens using sponsor code |
| 12 | Test client gate | `https://westpeek.live/production-access/special-guest` | Client portal opens using client code |
| 13 | Keep incidents/change-control available | App event surfaces | Issues can be logged during show |

---

## 10. Fast URL matrix

| Surface | Canonical URL |
|---|---|
| Production Access Hub | `https://westpeek.live/production-access` |
| Owner Gate | `https://westpeek.live/production-access/owner` |
| Operator Gate | `https://westpeek.live/production-access/operator` |
| Operator Launchpad | `https://westpeek.live/production-access/launchpad` |
| Crew Gate | `https://westpeek.live/production-access/crew` |
| Special Guest Gate | `https://westpeek.live/production-access/special-guest` |
| Public Join | `https://westpeek.live/join` |
| Demo Event Public Page | `https://westpeek.live/events/demo` |
| Demo Register | `https://westpeek.live/events/demo/register` |
| Demo Venue Lobby | `https://westpeek.live/venue/demo/lobby` |
| Demo Stage | `https://westpeek.live/venue/demo/stage` |
| Demo Sessions | `https://westpeek.live/venue/demo/sessions` |
| Demo Breakouts | `https://westpeek.live/venue/demo/breakouts` |
| Demo Networking | `https://westpeek.live/venue/demo/networking` |
| Demo Expo | `https://westpeek.live/venue/demo/expo` |
| Demo People | `https://westpeek.live/venue/demo/people` |
| Demo Replay | `https://westpeek.live/venue/demo/replay` |
| Demo Help | `https://westpeek.live/venue/demo/help` |
| Event Summit Lobby | `https://westpeek.live/venue/event-summit/lobby` |
| Testing Console | `https://westpeek.live/admin/testing` |
| Demo Testing Console | `https://westpeek.live/admin/testing/demo` |
| Operator Packet Route | `https://westpeek.live/operator-packet` |
| Privacy | `https://westpeek.live/privacy` |
| Terms | `https://westpeek.live/terms` |

---

## 11. Video provider and failure-plane matrix

| Layer | Provider / tool | Purpose | Failure plane | Operator rule |
|---|---|---|---|---|
| Production feed/source | StreamYard | Host/producer feed source | Production-feed failure | Keep StreamYard conceptually separate from LiveKit |
| Primary embedded event engine/distribution | LiveKit | Main embedded attendee experience | Distribution/runtime failure | Primary viewer layer |
| Secondary embedded fallback | Daily | Embedded backup when primary distribution has trouble | Fallback distribution failure | Use when LiveKit distribution is unhealthy |
| White-label backup rooms | Zoom + Google Meet | Last-resort continuity links | External-room continuity | Backup links only; not core event engine |
| Attendee stage/player | West Peek Live app | Attendee-facing stage shell | App/player UX | Should show branded states, not raw technical failure |
| Operator testing console | Admin/testing | Provider decisioning and route/runtime checks | Ops visibility | Use to diagnose before switching |

**Do not collapse these concepts:**  
StreamYard is the production feed/source. LiveKit is the embedded event distribution layer. Daily is the embedded fallback. Zoom/Google Meet are backup continuity links.

---

## 12. Speaker materials and teleprompter intake

Speaker materials have one producer review queue. Intake path can vary; destination must not vary.

| Intake path | Who uses it | What happens | Show-day rule |
|---|---|---|---|
| Speaker self-serve | Speaker | Speaker opens `/speaker/events/[eventId]/teleprompter` and submits teleprompter notes, deck links, or supporting document links. | Preferred path. Nothing goes live until producer review. |
| hello@ email fallback | Speaker or assistant | Operator/crew copies the email summary or file link into the speaker material intake panel on the event approval queue. | Email is not the system of record; the producer queue is. |
| Crew/operator upload or handoff | Crew, operator, producer | Crew/operator records the handoff in the same speaker material intake panel. | Use when a speaker sends a file by text, Drive, Slack, or live handoff. |

Operational rule: materials may arrive through self-serve, hello@ email, or crew/operator handoff, but they must end in the event-specific producer review queue before teleprompter/deck/show materials are changed. Speakers cannot directly publish script, slide, or teleprompter changes to the live show.

---

## 13. Validation proof matrix

| Proof layer | Latest result | What it proves | What it does not prove |
|---|---|---|---|
| TypeScript typecheck | PASS | Type contracts compile | Does not prove browser behavior |
| Lint | PASS | No lint errors/warnings | Does not prove runtime behavior |
| Unit tests | PASS — 61 files / 138 tests | Core service/rule behavior passed | Does not prove full browser journeys |
| v5 hard validators | PASS | Static/security/route/env contracts passed | Does not prove user behavior by itself |
| v7 validators | PASS | Day 1 route/UX/operator packet contracts passed | Does not prove live manual usability |
| Deploy parity validators | PASS | Static deploy/runtime contracts passed | Does not prove DNS/canonical manually |
| Headed Playwright | PASS — 49 passed / 1 skipped / 0 failed | Local headed browser journeys passed for covered flows | Does not equal human exploratory QA |
| Cloudflare/OpenNext build | PASS | Production worker bundle builds | Does not prove all external providers work |
| Cloudflare deploy | PASS | Worker deployed successfully | Does not prove canonical DNS if not smoked separately |
| Worker postdeploy smoke | PASS | Worker URL responds through postdeploy smoke | Does not prove every live route manually |
| GitHub push | PASS — `8e7a3a9..f967934` | GitHub main updated | Does not prove CI, because no push workflow exists |

---

## 14. Known proof limits

| Limit | Current status | Practical meaning |
|---|---|---|
| Manual exploratory QA | Not performed in latest pass | A human has not manually clicked every live flow and judged visual/copy quality. |
| Canonical-domain smoke | Not separately logged in latest pass | Use canonical domain operationally; worker smoke is the logged postdeploy proof. |
| Real provider sessions with live secrets | Not proven by this packet | Tests prove safe failure/provider decisioning, not full LiveKit/Daily/Zoom/Google Meet live sessions. |
| Push-triggered GitHub Actions | Not available | Repo currently has only manual `workflow_dispatch` event-config workflow. |
| Secret values | Not printed/read by validators | Validators prove names/contracts, not secret value correctness. |

---

## 15. Troubleshooting matrix

| Symptom | Likely cause | First action |
|---|---|---|
| Canonical domain does not load | DNS/custom domain issue | Try worker fallback `https://west-peek-live.seq-taylor.workers.dev` |
| Worker works but canonical does not | Domain routing issue | Check Cloudflare route/custom domain binding |
| Operator gate loops to launchpad | Normal after successful login | Use Launchpad links or go directly to desired protected path |
| Special guest sees gate instead of portal | Wrong event code/code mismatch/expired cookie | Re-enter event code and role-specific password |
| Speaker/sponsor/client reaches wrong portal | Wrong role code | Use the correct role-specific code from the matrix |
| Crew can see crew pages but not operator pages | Expected boundary | Use Operator Gate only for operator-level actions |
| Video token routes return 403 without secrets | Safe failure | Confirm provider secrets if live provider session is required |
| Postdeploy smoke fails | Deployment or runtime route issue | Re-run worker URL smoke and inspect first failing route |
| GitHub Actions shows no runs | No push workflow exists | This is expected unless a push workflow is added later |

---

## 16. Worker fallback reference

Use this only for technical fallback or deployment verification.

| Purpose | Worker URL |
|---|---|
| Worker base | `https://west-peek-live.seq-taylor.workers.dev` |
| Production Access Hub | `https://west-peek-live.seq-taylor.workers.dev/production-access` |
| Owner Gate | `https://west-peek-live.seq-taylor.workers.dev/production-access/owner` |
| Operator Gate | `https://west-peek-live.seq-taylor.workers.dev/production-access/operator` |
| Crew Gate | `https://west-peek-live.seq-taylor.workers.dev/production-access/crew` |
| Special Guest Gate | `https://west-peek-live.seq-taylor.workers.dev/production-access/special-guest` |
| Demo Event | `https://west-peek-live.seq-taylor.workers.dev/events/demo` |
| Demo Venue Lobby | `https://west-peek-live.seq-taylor.workers.dev/venue/demo/lobby` |
| Demo Testing Console | `https://west-peek-live.seq-taylor.workers.dev/admin/testing/demo` |

---

## 17. Private environment reference

The companion file `west-peek-live-private-owner-env-vars.txt` contains the environment reference for off-repo owner storage.

Do not commit that file to GitHub. If using it locally, copy values into `.env.local` only temporarily, then remove local/generated artifacts before validation/deploy.

Local use:

```bash
cp /secure/path/west-peek-live-private-owner-env-vars.txt .env.local
```

Before validation/deploy:

```bash
rm -f .env.local
rm -rf .open-next .next .wrangler .runtime-data test-results playwright-report
```

---

## 18. Final Day 1 rule

Use the packet like this:

1. **Operator runs the show from the Operator Gate and Launchpad.**
2. **Crew uses Crew Gate only.**
3. **Speakers/sponsors/clients/VIPs use Special Guest Gate only.**
4. **Public attendees use public event/join/registration routes only.**
5. **Use canonical domain first.**
6. **Use worker URL only as fallback/technical proof.**
7. **Do not publish or commit this private packet.**


## StreamYard / LiveKit Model Lock

Production feed/source: StreamYard

Primary embedded event engine/distribution: LiveKit

Do not collapse StreamYard and LiveKit into the same failure plane. StreamYard feed loss, LiveKit distribution loss, and Daily fallback must remain separately named in operator status and validation reports.
