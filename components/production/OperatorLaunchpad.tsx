import Link from "next/link";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { WestPeekProductionsLogo } from "@/components/brand/WestPeekProductionsLogo";
import { LaunchpadCard } from "@/components/production/LaunchpadCard";
import { LaunchpadSection } from "@/components/production/LaunchpadSection";

const demoEventId = "event-summit";

export function OperatorLaunchpad() {
  return (
    <>
      <main className="min-h-screen bg-brand-ash px-5 py-8 text-brand-black sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <WestPeekProductionsLogo size="md" />
              <p className="mt-5 text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Operator Launchpad</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Everything internal starts here.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-brand-muted">This is the post-operator-gate command center for owners, producers, VAs, backend testers, and show-day crew. Use the demo event for training when no real client conference is set up yet.</p>
            </div>
            <Link href="/production-access/logout" className="rounded-full border border-brand-black px-5 py-3 text-center text-sm font-bold hover:border-brand-orange hover:text-brand-orange">Log out access</Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-orange">No configured events yet?</p>
          <h2 className="mt-2 text-2xl font-black">Recommended Day 1 path</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Link className="rounded-2xl bg-brand-black p-4 text-sm font-bold text-white" href="/app/events/new">Create Event in Admin Workspace</Link>
            <Link className="rounded-2xl border border-brand-line p-4 text-sm font-bold" href="/venue/demo/lobby">Preview Demo Venue</Link>
            <Link className="rounded-2xl border border-brand-line p-4 text-sm font-bold" href="/operator-packet">Open Operator Packet</Link>
            <Link className="rounded-2xl border border-brand-line p-4 text-sm font-bold" href={`/app/events/${demoEventId}/crew`}>Crew Briefing & Instructions</Link>
            <Link className="rounded-2xl border border-brand-line p-4 text-sm font-bold" href="/production-access/crew">Test Crew Login</Link>
            <Link className="rounded-2xl border border-brand-line p-4 text-sm font-bold" href="/production-access/special-guest">Test Speaker/Sponsor Login</Link>
          </div>
          <div className="mt-6 rounded-2xl bg-brand-ash p-5">
            <p className="text-sm font-black">Demo event available: Leadership Reset Webinar</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link className="rounded-full bg-white px-4 py-2 text-sm font-bold" href={`/app/events/${demoEventId}/setup`}>Open setup preview</Link>
              <Link className="rounded-full bg-white px-4 py-2 text-sm font-bold" href="/venue/demo/lobby">Open guest venue</Link>
              <Link className="rounded-full bg-white px-4 py-2 text-sm font-bold" href={`/app/events/${demoEventId}/crew`}>Open crew console</Link>
            </div>
          </div>
        </section>

        <LaunchpadSection eyebrow="Core production" title="Run the agency cockpit">
          <LaunchpadCard title="Open Admin Workspace" href="/app">Supabase-authenticated dashboard, event portfolio, and admin onboarding.</LaunchpadCard>
          <LaunchpadCard title="Create Event in Admin Workspace" href="/app/events/new">Available after operator access; starts the guided Day 1 production setup spine.</LaunchpadCard>
          <LaunchpadCard title="Manage Events" href="/app/events">View existing events and choose the active event to operate.</LaunchpadCard>
          <LaunchpadCard title="Preview Demo Venue" href="/venue/demo/lobby" badge="1:1 mirror">Open the attendee-facing demo venue powered by real venue components and demo data.</LaunchpadCard>
        </LaunchpadSection>

        <LaunchpadSection eyebrow="Demo event actions" title="Train without risking a client event">
          <LaunchpadCard title="Demo Lobby" href="/venue/demo/lobby">The real guest lobby shell with agenda, help, sponsors, fallback banners, and navigation.</LaunchpadCard>
          <LaunchpadCard title="Demo Stage" href="/venue/demo/stage">The same stage/session surface attendees see during a real event.</LaunchpadCard>
          <LaunchpadCard title="Demo Sessions" href="/venue/demo/sessions">The real agenda/session directory and session navigation surface.</LaunchpadCard>
          <LaunchpadCard title="Demo Networking" href="/venue/demo/networking">Networking lobby behavior and empty/active states.</LaunchpadCard>
          <LaunchpadCard title="Demo Expo" href="/venue/demo/expo">Sponsor listing and booth paths.</LaunchpadCard>
          <LaunchpadCard title="Demo Sponsor Booth" href="/venue/demo/expo/booth-clarity">A real booth page with sponsor content and lead-capture context.</LaunchpadCard>
          <LaunchpadCard title="Demo People" href="/venue/demo/people">Speaker/attendee directory-style people surface.</LaunchpadCard>
          <LaunchpadCard title="Demo Replay" href="/venue/demo/replay">Replay/archive state.</LaunchpadCard>
          <LaunchpadCard title="Demo Help" href="/venue/demo/help">Attendee support flow.</LaunchpadCard>
        </LaunchpadSection>

        <LaunchpadSection eyebrow="Event operations" title="Setup, run, preview, publish">
          <LaunchpadCard title="Run of Show" href={`/app/events/${demoEventId}/run-of-show`}>Show caller spine and live cues.</LaunchpadCard>
          <LaunchpadCard title="Agenda" href={`/app/events/${demoEventId}/agenda`}>Session timing and sequencing.</LaunchpadCard>
          <LaunchpadCard title="Venue Setup" href={`/app/events/${demoEventId}/venue`}>Lobby, stage, expo, networking, replay, and help configuration.</LaunchpadCard>
          <LaunchpadCard title="Communications" href={`/app/events/${demoEventId}/communications`}>Email and audience comms spine.</LaunchpadCard>
          <LaunchpadCard title="Access" href={`/app/events/${demoEventId}/access`}>Crew, speaker, sponsor, VIP, and client access setup.</LaunchpadCard>
          <LaunchpadCard title="Crew Briefing & Instructions" href={`/app/events/${demoEventId}/crew`}>Operator-owned crew briefing, call sheet, run of show, task list, fallback instructions, and escalation package.</LaunchpadCard>
          <LaunchpadCard title="Preview" href={`/app/events/${demoEventId}/preview`}>Internal preflight preview before publishing.</LaunchpadCard>
          <LaunchpadCard title="Publish" href={`/app/events/${demoEventId}/publish`}>Publish readiness and package flow.</LaunchpadCard>
        </LaunchpadSection>

        <LaunchpadSection eyebrow="Backend / testing / admin" title="Diagnostics are first-class internal tools">
          <LaunchpadCard title="Testing Console" href="/admin/testing">Backend/admin test dashboard.</LaunchpadCard>
          <LaunchpadCard title="Demo Testing Console" href="/admin/testing/event-summit">Event-scoped route, access, and runtime tests.</LaunchpadCard>
          <LaunchpadCard title="Route Health" href="/admin/testing/event-summit">Verify route coverage for public, crew, special guest, and app surfaces.</LaunchpadCard>
          <LaunchpadCard title="Supabase Runtime" href="/admin/testing/event-summit">Verify database-backed runtime table readiness.</LaunchpadCard>
          <LaunchpadCard title="Event Config Package" href="/admin/testing/event-summit">Build, import, and export event config packages.</LaunchpadCard>
          <LaunchpadCard title="Security Smoke Tests" href="/admin/testing/event-summit">Access, cookie, role boundary, and route safety checks.</LaunchpadCard>
          <LaunchpadCard title="Post-Deploy Smoke Test" href="/admin/testing/event-summit">Verify deployed app after Cloudflare deploy.</LaunchpadCard>
          <LaunchpadCard title="Email Resend / Logs" href="/admin/testing/event-summit">Email workflow checks, resend verification, and delivery log review.</LaunchpadCard>
          <LaunchpadCard title="Video Provider Tests" href="/admin/testing/event-summit">LiveKit, Daily, Zoom, and Google Meet readiness.</LaunchpadCard>
          <LaunchpadCard title="Access Gate Tests" href="/admin/testing/event-summit">Crew, special guest, and public access checks.</LaunchpadCard>
        </LaunchpadSection>

        <LaunchpadSection eyebrow="Live production controls" title="Show-day command surfaces">
          <LaunchpadCard title="Video Health" href={`/app/events/${demoEventId}/video-health`}>LiveKit, Daily, Zoom, and Google Meet status.</LaunchpadCard>
          <LaunchpadCard title="Incidents" href={`/app/events/${demoEventId}/incidents`}>Log and resolve production issues.</LaunchpadCard>
          <LaunchpadCard title="Approval Queue" href={`/app/events/${demoEventId}/approval-queue`}>Approvals and checkpoints.</LaunchpadCard>
          <LaunchpadCard title="Change Control" href={`/app/events/${demoEventId}/change-control`}>Track controlled changes.</LaunchpadCard>
        </LaunchpadSection>

        <LaunchpadSection eyebrow="Operator Documentation" title="Open the Day 1 docs">
          <LaunchpadCard title="Day 1 Operator Packet" href="/operator-packet">Open the nontechnical operator guide covering passwords, spines, fallback structure, testing, show-day workflow, and V2 roadmap.</LaunchpadCard>
          <LaunchpadCard title="Video Fallback Operations" href="/operator-packet">LiveKit, Daily, Zoom, and Google Meet fallback structure.</LaunchpadCard>
          <LaunchpadCard title="Run of Show Operations" href="/operator-packet">Agenda, call sheet, show caller view, live cues, incidents, and reports.</LaunchpadCard>
        </LaunchpadSection>

        <LaunchpadSection eyebrow="Role entry testing" title="Test each front door">
          <LaunchpadCard title="Crew Gate" href="/production-access/crew">Test crew password and limited crew workspace access.</LaunchpadCard>
          <LaunchpadCard title="Operator Gate" href="/production-access/operator">Test separate operator password and launchpad access.</LaunchpadCard>
          <LaunchpadCard title="Special Guest Gate" href="/production-access/special-guest">Test speaker, sponsor, client, and VIP access.</LaunchpadCard>
          <LaunchpadCard title="Public Join" href="/join">Test attendee event-code flow.</LaunchpadCard>
          <LaunchpadCard title="Speaker Portal" href="/speaker">Speaker-side entry.</LaunchpadCard>
          <LaunchpadCard title="Sponsor Portal" href="/sponsor">Sponsor-side entry.</LaunchpadCard>
          <LaunchpadCard title="Client Portal" href="/client/acme-health">Client-facing event review.</LaunchpadCard>
        </LaunchpadSection>
      </div>
      </main>
      <LegalFooter variant="compact" />
    </>
  );
}
