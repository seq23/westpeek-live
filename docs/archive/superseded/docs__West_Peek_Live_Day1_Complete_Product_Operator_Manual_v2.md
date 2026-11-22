<!-- ARCHIVED: superseded by active runbooks / ledgers. See docs/archive/ARCHIVE_INDEX.md and docs/DOCS_CONSOLIDATION_MAP.md. -->

# West Peek Live / Agency Event OS — Complete Day 1 Product + Operator Manual

Private owner/operator document. Do not commit to GitHub. Canonical-domain-first.

| Field | Value |
| --- | --- |
| Canonical operational domain | https://westpeek.live |
| Technical worker fallback URL | https://west-peek-live.seq-taylor.workers.dev |
| Repo commit pushed | f967934 |
| Cloudflare worker version deployed | 827bb322-1669-4603-bf58-bbf83a4829ee |
| Status | Local validation passed, headed Playwright passed, Cloudflare build/deploy passed, worker postdeploy smoke passed, GitHub pushed. |

## 1. What This Product Is, in Human Terms

West Peek Live is a complete virtual event operating system. It is designed so an owner/operator can create and run a client-facing virtual event without dumping every person into one generic Zoom link or one admin dashboard.

The system separates users by role: attendees attend, crew executes, speakers prepare and appear, sponsors manage sponsor surfaces, clients review, VIPs enter the venue, and operators run the show. Each role gets a different door and a different level of power.

The video model is layered on purpose. StreamYard is the production feed/source. LiveKit is the primary embedded attendee distribution layer. Daily is the secondary embedded fallback. Zoom and Google Meet are backup continuity rooms. These are not interchangeable; a failure in one layer means something specific.

## 2. Product Capability Inventory

| Capability | Plain-English explanation | Who uses it |
| --- | --- | --- |
| Public event site | Public-facing event pages explain what the event is, who it is for, agenda, speakers, sponsors, and how to register. | Public visitor, attendee |
| Registration and attendee identity | Registration creates an event-scoped attendee identity/session intent. It is not the same as full admin or Supabase account access. | Attendee |
| Virtual venue | The attendee venue contains lobby, stage, sessions, breakouts, networking, expo, people, replay, help, and support surfaces. | Attendee, VIP |
| Operator launchpad | The internal command center after operator login. It links to event creation, demo venue, operator packet, crew instructions, event operations, testing, video health, role-gate testing, and docs. | Operator, owner |
| Guided event setup | Operators can create an event setup draft and review the event spine: basics, branding, attendee flow, venue, agenda, access, communications, preview, publish. | Operator |
| Crew operations | Crew can see event instructions without getting operator powers: call sheet, run-of-show, tasks, fallback instructions, escalation paths. | Crew, crew-lite |
| Speaker operations | Speakers get a speaker portal, onboarding, tech check, green room, backstage, and teleprompter/materials path. | Speaker |
| Sponsor operations | Sponsors get setup, booth, leads, ready room, and report surfaces. | Sponsor |
| Client review | Clients get approvals, assets, reports, run-of-show, and timeline surfaces. | Client |
| Testing console | Internal readiness cockpit for showtime checks, route health, provider/fallback decisioning, debugging, and system health. | Operator, internal tester |
| Video provider safety | Provider token endpoints fail safely when secrets are absent; they should not throw generic server errors or leak secret values. | System, operator |
| Legal/support/footer model | Privacy, terms, and support links stay present where needed without cluttering the player/header experience. | Public, attendee, operator |

## 3. Canonical Front Doors

| Purpose | Canonical URL | Human use |
| --- | --- | --- |
| Production Access Hub | https://westpeek.live/production-access | Start here when someone does not know which door to use. |
| Owner / Boss Master Gate | https://westpeek.live/production-access/owner | Full owner-level access for settings, billing, admin testing, and override control. |
| Operator Gate | https://westpeek.live/production-access/operator | Day 1 show runner and producer command center. |
| Crew Gate | https://westpeek.live/production-access/crew | Crew call sheet, run-of-show, tasks, fallback instructions, escalation. |
| Special Guest Gate | https://westpeek.live/production-access/special-guest | Speaker, sponsor, client, VIP, and crew-lite entry. |
| Public Join | https://westpeek.live/join | Public attendee event-code entry. |
| Demo Event Public Page | https://westpeek.live/events/demo | Safe public demo event page. |
| Demo Venue Lobby | https://westpeek.live/venue/demo/lobby | Demo attendee lobby. |
| Event Summit Venue Lobby | https://westpeek.live/venue/event-summit/lobby | Seeded event-summit attendee lobby. |
| Operator Packet Route | https://westpeek.live/operator-packet | In-app operator packet route. |
| Testing Console | https://westpeek.live/admin/testing | Internal testing and readiness dashboard. |

## 4. Access Codes / Private Retrieval Tables

### Owner / Boss Master

| Key | Value |
| --- | --- |
| OWNER_MASTER_ACCESS_PASSWORD | set in Cloudflare (vault: WESTPEEK_LIVE_OWNER_MASTER_ACCESS_PASSWORD) |

### Operator

| Key | Value |
| --- | --- |
| OPERATOR_LAUNCHPAD_PASSWORD | set in Cloudflare (vault: WESTPEEK_LIVE_OPERATOR_LAUNCHPAD_PASSWORD) |

### Crew

| Key | Value |
| --- | --- |
| CREW_ACCESS_PASSWORD | set in Cloudflare (vault: WESTPEEK_LIVE_CREW_ACCESS_PASSWORD) |

### Demo Event

| Key | Value |
| --- | --- |
| EVENT_DEMO_CLIENT_CODE | Demo-Client-2026! |
| EVENT_DEMO_CREW_LITE_CODE | Demo-CrewLite-2026! |
| EVENT_DEMO_SPEAKER_CODE | Demo-Speaker-2026! |
| EVENT_DEMO_SPONSOR_CODE | Demo-Sponsor-2026! |
| EVENT_DEMO_VIP_CODE | Demo-VIP-2026! |

### Leadership Reset Webinar

| Key | Value |
| --- | --- |
| EVENT_LEADERSHIP_RESET_WEBINAR_CLIENT_CODE | Leadership-Client-2026! |
| EVENT_LEADERSHIP_RESET_WEBINAR_CREW_LITE_CODE | Leadership-CrewLite-2026! |
| EVENT_LEADERSHIP_RESET_WEBINAR_SPEAKER_CODE | Leadership-Speaker-2026! |
| EVENT_LEADERSHIP_RESET_WEBINAR_SPONSOR_CODE | Leadership-Sponsor-2026! |
| EVENT_LEADERSHIP_RESET_WEBINAR_VIP_CODE | Leadership-VIP-2026! |

### Premium Workshop Intensive

| Key | Value |
| --- | --- |
| EVENT_PREMIUM_WORKSHOP_INTENSIVE_CLIENT_CODE | Workshop-Client-2026! |
| EVENT_PREMIUM_WORKSHOP_INTENSIVE_CREW_LITE_CODE | Workshop-CrewLite-2026! |
| EVENT_PREMIUM_WORKSHOP_INTENSIVE_SPEAKER_CODE | Workshop-Speaker-2026! |
| EVENT_PREMIUM_WORKSHOP_INTENSIVE_SPONSOR_CODE | Workshop-Sponsor-2026! |
| EVENT_PREMIUM_WORKSHOP_INTENSIVE_VIP_CODE | Workshop-VIP-2026! |

### Provider Innovation Expo

| Key | Value |
| --- | --- |
| EVENT_PROVIDER_INNOVATION_EXPO_CLIENT_CODE | Expo-Client-2026! |
| EVENT_PROVIDER_INNOVATION_EXPO_CREW_LITE_CODE | Expo-CrewLite-2026! |
| EVENT_PROVIDER_INNOVATION_EXPO_SPEAKER_CODE | Expo-Speaker-2026! |
| EVENT_PROVIDER_INNOVATION_EXPO_SPONSOR_CODE | Expo-Sponsor-2026! |
| EVENT_PROVIDER_INNOVATION_EXPO_VIP_CODE | Expo-VIP-2026! |

### Seed Demo Day

| Key | Value |
| --- | --- |
| EVENT_SEED_DEMO_DAY_CLIENT_CODE | SeedDemo-Client-2026! |
| EVENT_SEED_DEMO_DAY_CREW_LITE_CODE | SeedDemo-CrewLite-2026! |
| EVENT_SEED_DEMO_DAY_SPEAKER_CODE | SeedDemo-Speaker-2026! |
| EVENT_SEED_DEMO_DAY_SPONSOR_CODE | SeedDemo-Sponsor-2026! |
| EVENT_SEED_DEMO_DAY_VIP_CODE | SeedDemo-VIP-2026! |

## 5. Role Boundaries

| Role | Entry door | Can do | Must not do |
| --- | --- | --- | --- |
| Owner / Boss | Owner gate | Full owner-level access: settings, billing, admin, workspace, override. | Use sparingly. This is highest privilege. |
| Operator | Operator gate | Launchpad, event creation, setup, preview, run-of-show, crew manager, video health, incidents, approvals, testing console. | Does not automatically mean owner billing/settings. |
| Crew | Crew gate | Crew instructions, call sheet, run-of-show, task list, fallback instructions. | No operator launchpad. |
| Crew Lite | Special guest gate | Crew instruction surfaces only. | No operator launchpad. |
| Speaker | Special guest gate | Speaker portal, onboarding, tech check, green room, backstage, teleprompter. | No sponsor/client/operator/admin access. |
| Sponsor | Special guest gate | Sponsor setup, booth, leads, ready room, report. | No broad attendee data dump by default. |
| Client | Special guest gate | Client event review, approvals, assets, reports, run-of-show, timeline. | Client-scoped. No internal operator controls. |
| VIP | Special guest gate | Venue/lobby experience. | No internal powers. |
| Attendee | Public registration / join | Register, enter venue, attend sessions, network, use help/support. | No role portal/admin/crew/operator powers. |

## 6. End-to-End User Journeys

### Attendee

- Finds the public event page or receives a link.
- Reviews event details, agenda, speakers, and sponsors.
- Clicks register and submits required attendee identity fields.
- Gets routed into the event venue/lobby.
- Uses lobby navigation to reach stage, sessions, breakouts, networking, expo, people, replay, and help.
- Can submit help/support or networking actions depending on event state.
- Must not receive camera/mic publishing, speaker/sponsor/crew/operator/admin access.

### Operator

- Opens the operator gate and enters the operator launchpad password.
- Lands on the operator launchpad.
- Creates a new event in the admin workspace or opens an existing/demo event.
- Reviews setup spine, preview, run-of-show, crew instructions, access, communications, video health, testing console, incidents, and change control.
- During the show, keeps run-of-show, testing console, video health, and incident paths available.
- If a failure occurs, decides whether the issue is source/feed, primary distribution, fallback distribution, or backup-room continuity.

### Crew

- Opens crew gate and enters crew password.
- Lands on crew event instructions.
- Uses call sheet, run-of-show, and task surfaces.
- Follows fallback and escalation instructions from operator/producer.
- Cannot enter operator launchpad or owner settings.

### Speaker

- Opens special guest gate.
- Enters event code plus speaker access password.
- Lands in speaker portal.
- Uses onboarding, tech check, green room, backstage, and teleprompter/materials flow.
- Speaker materials may be submitted, but nothing should bypass producer review before live changes.

### Sponsor

- Opens special guest gate.
- Enters event code plus sponsor access password.
- Lands in sponsor portal.
- Uses setup, booth, leads, ready room, and report surfaces.
- Sponsor receives sponsor-specific views; attendee data should require intentional opt-in/engagement product flow.

### Client

- Opens special guest gate.
- Enters event code plus client access password.
- Lands in client portal.
- Reviews approvals, assets, reports, run-of-show, and timeline.
- Client can review/approve, but should not receive internal operator controls.

### VIP

- Opens special guest gate.
- Enters event code plus VIP access password.
- Gets routed to venue/lobby experience.
- Can attend as VIP but does not get internal role powers.

## 7. Video Provider Model

| Provider | Layer | Plain-English job | Default use | Failure meaning |
| --- | --- | --- | --- | --- |
| StreamYard | Production feed/source | Where the produced broadcast/source feed originates. | Use as show production source. | If this fails, fix the source/feed. Switching LiveKit/Daily may not solve source failure. |
| LiveKit | Primary embedded event distribution | Main in-app video/event engine layer inside West Peek Live. | Default attendee embedded distribution. | If this fails, switch attendees to Daily while keeping the source feed alive if possible. |
| Daily | Secondary embedded fallback | Fallback embedded room/distribution layer. | First fallback when primary distribution is degraded. | If this fails, move to Zoom or Google Meet continuity. |
| Zoom | White-label backup room | Emergency continuity room; not the core event engine. | Use when embedded layers are unavailable or unsafe. | Do not treat as primary product path. |
| Google Meet | White-label backup room | Second emergency continuity room. | Use as additional backup continuity. | Do not expose reusable private links casually. |

## 8. Fallback Stage Matrix

| Stage | What is happening | Default path | Operator rule |
| --- | --- | --- | --- |
| Planning/setup | Operator records source/feed, primary distribution, fallback distribution, and backup-room plan. | StreamYard source; LiveKit primary; Daily fallback; Zoom/Google Meet backup. | Confirm setup and testing console show the right plan. |
| Pre-show tech check | Speakers/crew validate camera, mic, browser permissions, and readiness. | Speaker tech check + operator testing console. | Resolve before showtime; do not wait until live audience is present. |
| Healthy live show | Attendees watch through the venue/stage normally. | LiveKit distribution with planned source feed. | Monitor only. Do not switch unless needed. |
| LiveKit issue | The in-app primary distribution is degraded, but source may still be healthy. | Switch attendees to Daily. | Use branded switching language. Keep StreamYard running if source is healthy. |
| Daily issue | Secondary embedded fallback is also degraded. | Move to Zoom or Google Meet. | Communicate clearly and avoid leaking reusable private room links broadly. |
| StreamYard issue | The production feed/source itself is failing. | Fix/restart source feed. | Do not confuse source failure with LiveKit failure. |
| Total video failure | Source and/or all distribution layers are unusable. | Backup room + incidents + support comms. | Operator owns communication; crew follows fallback instructions. |

## 9. Day 1 Operator Runbook

| Step | Action | Route | Success condition |
| --- | --- | --- | --- |
| 1 | Open operator gate | https://westpeek.live/production-access/operator | Enter operator password and reach launchpad. |
| 2 | Open/create event | /app/events/new or existing event route | Create setup draft or choose event. |
| 3 | Confirm setup | /app/events/[eventId]/setup | Event name, slug, date, client, provider plan, next actions. |
| 4 | Preview public event | /events/[eventId] | Public event does not crash and has expected content. |
| 5 | Preview venue | /venue/[eventId]/lobby | Lobby/stage/sessions/breakouts/networking/expo/people/help/replay reachable. |
| 6 | Check crew | /crew/events/[eventId] | Crew call sheet/run-of-show/tasks available. |
| 7 | Check speakers | /speaker/events/[eventId]/tech-check | Speaker tech/camera/mic/check page available. |
| 8 | Check testing console | /admin/testing/[eventId] | Provider/fallback/readiness decisioning visible. |
| 9 | Showtime | Run-of-show + testing console + video health + incidents | Operate show and use fallback only if needed. |
| 10 | After show | Reports/replay/support/incident review | Package lessons and client follow-up. |

## 10. Speaker Materials and Teleprompter Intake

| Intake path | What happens | When to use | Rule |
| --- | --- | --- | --- |
| Speaker self-serve | Speaker submits notes/deck/script info through the speaker portal/teleprompter path. | Preferred path. | Producer review before live changes. |
| hello@ email fallback | Speaker or assistant emails material; operator/crew copies summary or file link into the event review queue. | When the speaker cannot use self-serve. | Email is not the system of record. |
| Crew/operator handoff | Crew/operator receives file/link/text and records it in producer review. | Live handoff or emergency. | Still must end in producer review. |

## 11. Proof Matrix and Known Limits

| Area | Status | Meaning |
| --- | --- | --- |
| Local headed Playwright | PASS: 49 passed / 1 skipped / 0 failed | Browser-level proof for covered routes, role journeys, transactional flows, and safe failures. |
| npm run validate | PASS | Typecheck, lint, unit tests, v5 hard, v7, deploy parity. |
| Unit tests | PASS: 61 files / 138 tests | Business rules, permissions, access, provider helpers, runtime/service logic. |
| Cloudflare/OpenNext build | PASS | Production worker bundle builds. |
| Cloudflare deploy | PASS: 827bb322-1669-4603-bf58-bbf83a4829ee | Worker deployed successfully. |
| Postdeploy smoke | PASS on worker URL | Deployed worker responded to smoke test. |
| GitHub push | PASS: f967934 | Source control updated. |
| GitHub Actions | Not applicable | Only manual workflow_dispatch event-config workflow exists. No push-to-main validation workflow. |
| Canonical domain smoke | Not separately logged in final terminal pass | Use canonical in operator docs, but keep worker URL as technical fallback/proof endpoint. |
| Real live provider credentials | Not fully proven in this pass | Tests prove safe failure and decisioning; real provider rooms require credentialed provider smoke. |

## 12. Troubleshooting

| Problem | Likely cause | What to do |
| --- | --- | --- |
| Someone is on the wrong page/gate | Wrong URL, wrong role, missing/expired access cookie. | Send them to the right canonical gate and re-enter the correct code. |
| Operator lands on launchpad instead of target route | Login succeeded, but target route needs direct navigation. | Open the target route after login. |
| Speaker cannot reach tech check | Wrong event code/password or wrong role. | Use Special Guest Gate with speaker code, then open speaker tech-check route. |
| Sponsor/client sees special guest gate again | Access code did not create correct role cookie or wrong event/client route. | Re-enter special guest gate with correct event code and role code. |
| Attendee cannot enter venue | Missing registration/session or wrong slug. | Use public event register flow or Public Join. |
| LiveKit fails | Primary embedded distribution problem. | Switch to Daily if source is healthy. |
| StreamYard fails | Production feed/source problem. | Fix source; distribution fallback alone may not solve it. |
| Daily fails | Secondary embedded fallback problem. | Move to Zoom/Google Meet continuity. |
| Zoom/Meet link concern | Backup room link may be sensitive/reusable. | Share through controlled operator/crew comms only. |
| Provider API returns 403/400 with no secrets | Expected safe failure when secrets are absent. | Verify no generic server error or secret leak. |
| No GitHub Actions run after push | No push workflow exists. | Expected unless a push validation workflow is added. |

## 13. Private Handling Rules

- Do not commit this manual to GitHub.
- Do not paste this manual into public channels.
- Passwords and event codes are operational secrets.
- Rotate any code that may have been exposed.
- Canonical domain is used operationally; worker URL remains fallback/debug/proof endpoint.
