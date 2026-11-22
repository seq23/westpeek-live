<!-- ARCHIVED: superseded by active runbooks / ledgers. See docs/archive/ARCHIVE_INDEX.md and docs/DOCS_CONSOLIDATION_MAP.md. -->

# Master Plan V7 — UX, Brand, Demo, Access, Route Safety, Operator Launchpad

V7 repairs the product experience after over-hardening. Intentional demo/sales/onboarding theatre is allowed and required. Fake production services silently pretending to work are forbidden.

## Non-negotiables

- Homepage CTAs stay as-is.
- Production Gate leads to Operator Launchpad.
- Operator Launchpad includes Core Production, Demo Event Actions, Event Operations, Backend/Admin Testing, Live Production Controls, Role Entry Testing, and Operator Documentation.
- West Peek Productions logo is authoritative and appears on homepage, production gates, launchpad, demo surfaces, and packet.
- Demo venue is a 1:1 mirror of the actual real event attendee experience. The only difference is source data: demo uses seeded demo event data; real events use real event config/runtime data.
- No front-door route may render a generic server-side exception digest page. Missing config renders a branded internal setup error naming the missing variable and where to set it.
- Password failures render in-app validation messages.

## Day 1 passwords

- Crew: set in Cloudflare (vault: WESTPEEK_LIVE_CREW_ACCESS_PASSWORD)
- Speaker: Demo-Speaker-2026!
- Sponsor: Demo-Sponsor-2026!
- VIP / Client Preview: Demo-VIP-2026!

## Video fallback ladder

- Primary: LiveKit
- Secondary: Daily
- Manual backups: Zoom and Google Meet

## Required spines

- Setup spine: Basics → Branding → Attendee Flow → Venue → Agenda → Access → Communications → Preview → Publish.
- Access spine: Public guests → Crew → Speakers → Sponsors → Clients/VIPs.
- Run-of-show spine: Agenda → Run of Show → Call Sheet → Show Caller View → Live Cues → Incidents → Post-Event Report.
- Venue spine: Lobby → Stage/Sessions → Networking → Expo/Sponsor Booths → Help → Replay.
- Fallback spine: LiveKit → Daily → Zoom → Google Meet → Incident Log → Post-Event Report.
- Communications spine: Segments → Templates → Sends → Logs → Resend/Recovery.
- Testing/admin spine: Testing Console → Route Health → Access Gates → Supabase Runtime → Event Config Package → Video Providers → Post-Deploy Smoke → Security Smoke.
