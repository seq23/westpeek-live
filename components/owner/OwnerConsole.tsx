import Link from "next/link";
import { LocalTime } from "@/components/shared/LocalTime";
import { ConsoleSection, ConsoleToc } from "@/components/owner/ConsoleSection";
import { SafeSection } from "@/components/system/SafeSection";
import { EndShowControl } from "@/components/moderation/EndShowControl";
import { StageRequestsToggle } from "@/components/moderation/StageRequestsToggle";
import { HostPanel } from "@/components/events/HostPanel";
import { GuestPreviewList } from "@/components/guests/GuestPreviewLinks";
import { ContactsAcrossEvents } from "@/components/people/ContactsAcrossEvents";
import { CopyButton } from "@/components/shared/CopyButton";
import { displayCode, guestGatePath } from "@/lib/access/accessCodes";
import { CURRENT_BUILD_ID } from "@/lib/runtime/buildVersion";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { getCrewAccessPassword, getEnv, getOperatorLaunchpadPassword } from "@/lib/env";
import { getRuntimeSchemaStatus, listEventRecords } from "@/services/events/eventRepository";
import { getHostLinkState, hostLinkPath } from "@/services/events/hostLinkService";
import { listGuestProfiles } from "@/services/guests/guestIdentityService";
import { listSpeakerStageStates } from "@/services/guests/guestStateService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { crewNetworkingSummary } from "@/services/speed-networking/speedNetworkingService";
import { buildVirtualVenueModel } from "@/services/venue";
import { getLiveChatModerationQueue } from "@/services/venue/liveChatService";
import { getAttendeeLiveControlState } from "@/services/venue/attendeeLivePermissionService";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * The Owner Console: one organised home for the owner master password. Every section is a fold
 * with a count, a one-line "what you do here", and a sticky table of contents; only "Live now"
 * opens by default. Every card inside is the existing control (deck cards, HostPanel, access
 * codes, End the show) rendered fail-soft — no second implementation of any control. Reads
 * runtime rows; honest empty states.
 */
const SECTIONS = [
  { id: "live-now", label: "Live now" },
  { id: "events", label: "Events" },
  { id: "crews", label: "Crews" },
  { id: "operators", label: "Operators" },
  { id: "guests", label: "Guests" },
  { id: "networking", label: "Networking" },
  { id: "replays", label: "Replays" },
  { id: "settings", label: "Settings" },
] as const;

function isLive(event: RuntimeEventRecord) { return event.status === "live"; }
function isEnded(event: RuntimeEventRecord) { return event.status === "ended" || event.status === "replay_available"; }
function isDraft(event: RuntimeEventRecord) { return event.status === "draft"; }
function isUpcoming(event: RuntimeEventRecord) { return event.status === "published" || event.status === "registration_open" || event.status === "pre_event"; }

function EventRow({ event, children }: { event: RuntimeEventRecord; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line p-3" data-testid={`console-event-${event.id}`} data-status={event.status}>
      <div>
        <p className="font-black text-brand-black">{event.name} <span className="ml-2 rounded-full bg-brand-ash px-2 py-0.5 text-[11px] font-black uppercase text-brand-muted">{event.status.replaceAll("_", " ")}</span></p>
        <p className="text-xs text-brand-muted">{displayCode(event.joinCode)} · {event.clientName} · <LocalTime iso={event.startAt} mode="datetime" /></p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-black">
        <Link href={`/app/events/${event.id}`} className="rounded-full border border-brand-black px-3 py-1 hover:border-brand-orange hover:text-brand-orange">Open</Link>
        <Link href={`/app/events/${event.id}/access`} className="rounded-full border border-brand-black px-3 py-1 hover:border-brand-orange hover:text-brand-orange">Access page</Link>
        {children}
      </div>
    </li>
  );
}

async function LiveNowRow({ event }: { event: RuntimeEventRecord }) {
  const [stage, speakers, chat, control] = await Promise.all([
    getOperatorStageStreamState(event.id, "main-stage").catch(() => undefined),
    listSpeakerStageStates(event.id).catch(() => []),
    getLiveChatModerationQueue(event.id, 1).catch(() => undefined),
    getAttendeeLiveControlState(event.id, "main_stage", "main-stage").catch(() => undefined),
  ]);
  const feed = stage?.streamStatus === "ENDED" ? "ended" : stage?.activeStreamSource && stage.activeStreamSource !== "LIVEKIT_INGRESS" ? `backup · ${stage.activeStreamSource.replaceAll("_", " ").toLowerCase()}` : stage?.streamStatus?.includes("LIVE") ? "live" : (stage?.streamStatus || "not started").replaceAll("_", " ").toLowerCase();
  const onStage = speakers.filter((item) => item.state.status === "on_stage").length;
  const locked = chat?.lockedRooms.some((room) => room.roomKind === "main_stage") ?? false;
  return (
    <li className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4" data-testid={`console-live-${event.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-brand-black">{event.name}</p>
          <p className="text-sm text-brand-muted">Join code <strong>{displayCode(event.joinCode)}</strong> · feed <strong data-testid={`console-live-feed-${event.id}`}>{feed}</strong> · <strong>{onStage}</strong> on stage · chat <strong>{locked ? "locked" : "open"}</strong> · stage requests <strong>{control && (control.globalCameraEnabled || control.globalMicrophoneEnabled) ? "open" : "closed"}</strong></p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <Link href={`/crew/events/${event.id}`} className="rounded-full bg-brand-black px-3 py-2 text-white hover:bg-brand-orange" data-testid={`console-open-crew-${event.id}`}>Open crew console</Link>
          <Link href={`/app/events/${event.id}`} className="rounded-full border border-brand-black px-3 py-2 hover:border-brand-orange hover:text-brand-orange">Command page</Link>
          <Link href={`/venue/${event.id}/stage`} className="rounded-full border border-brand-black px-3 py-2 hover:border-brand-orange hover:text-brand-orange">Stage</Link>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <SafeSection label="Stage requests" compact render={() => StageRequestsToggle({ eventId: event.id, compact: true })} />
        <SafeSection label="End of show" compact render={() => EndShowControl({ eventId: event.id, compact: true })} />
      </div>
    </li>
  );
}

async function CrewRow({ event, crewSessions, base }: { event: RuntimeEventRecord; crewSessions: Array<{ role?: string; createdAt: string }>; base: string }) {
  const host = await getHostLinkState(event.id).catch(() => ({ codeVersion: 0, links: [] }));
  const activeLinks = host.links.filter((link) => !link.revokedAt).length;
  return (
    <li className="rounded-2xl border border-brand-line p-4" data-testid={`console-crew-${event.id}`}>
      <p className="font-black text-brand-black">{event.name}</p>
      <p className="mt-1 text-xs text-brand-muted">Crew code <code className="font-mono font-bold text-brand-black">{displayCode(event.accessCodes.crew)}</code> · {activeLinks} active host link{activeLinks === 1 ? "" : "s"} · {crewSessions.length ? `crew sessions in the last 8h: ${crewSessions.map((session) => session.role || "crew").join(", ")}` : "no crew session in the last 8h"}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton value={displayCode(event.accessCodes.crew)} label="Copy crew code" />
        <CopyButton value={`${base}${hostLinkPath(event)}`} label="Copy host link" />
        <Link href={`/crew/events/${event.id}`} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black hover:border-brand-orange hover:text-brand-orange">Crew deck</Link>
      </div>
      <div className="mt-3"><SafeSection label="Host" compact render={() => HostPanel({ eventId: event.id, compact: true })} /></div>
    </li>
  );
}

async function GuestRow({ event, base }: { event: RuntimeEventRecord; base: string }) {
  const guests = await listGuestProfiles(event.id).catch(() => []);
  return (
    <li className="rounded-2xl border border-brand-line p-4" data-testid={`console-guests-${event.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-brand-black">{event.name} <span className="text-xs font-bold text-brand-muted">· {guests.length} guest{guests.length === 1 ? "" : "s"} named</span></p>
        <Link href={`/production-access/special-guest/preview?event=${encodeURIComponent(event.joinCode)}`} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black hover:border-brand-orange hover:text-brand-orange">Preview a guest</Link>
      </div>
      <dl className="mt-2 flex flex-wrap gap-2 text-xs">
        {(["speaker", "sponsor", "vip", "client"] as const).map((role) => (
          <div key={role} className="flex items-center gap-1 rounded-full bg-brand-ash px-2 py-1"><dt className="font-black uppercase text-brand-muted">{role}</dt><dd><code className="font-mono">{displayCode(event.accessCodes[role])}</code></dd><CopyButton value={`${base}${guestGatePath(event, role)}`} label="Copy link" className="!px-2 !py-0.5 !text-[10px]" /></div>
        ))}
      </dl>
      <div className="mt-3"><SafeSection label="Guests" compact render={() => GuestPreviewList({ eventId: event.id, clientSlug: event.clientSlug, emptyHref: `/app/events/${event.id}/access` })} /></div>
    </li>
  );
}

async function NetworkingRow({ event }: { event: RuntimeEventRecord }) {
  const summary = await crewNetworkingSummary(event.id);
  return <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-line p-3 text-sm" data-testid={`console-networking-${event.id}`}><span className="font-black text-brand-black">{event.name}</span><span className="text-brand-muted">{summary.queueSize} in the queue · {summary.matchesInProgress} in progress · {summary.settings.open ? "open" : "closed"} · {summary.settings.matchMinutes} min</span><Link href={`/crew/events/${event.id}#networking`} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black">Manage</Link></li>;
}

export async function OwnerConsole() {
  const events = (await listEventRecords().catch(() => [])).filter((event) => event.source !== "seed");
  const live = events.filter(isLive);
  const upcoming = events.filter(isUpcoming);
  const drafts = events.filter(isDraft);
  const ended = events.filter(isEnded);
  const archived = events.filter((event) => event.status === "archived");
  const active = events.filter((event) => event.status !== "archived");
  const base = await appBaseUrl();
  // Who holds sessions right now: access-audit rows granted in the last 8 hours (the cookie's life). Diagnostic; fail-soft.
  const since = Date.now() - 8 * 60 * 60 * 1000;
  const attempts = (await getRuntimeStore().readSnapshot().then((snapshot) => snapshot.accessAttempts).catch(() => []))
    .filter((row) => row.status === "access_granted" && new Date(row.createdAt).getTime() >= since);
  const crewByEvent = new Map<string, Array<{ role?: string; createdAt: string }>>();
  for (const row of attempts.filter((item) => item.accessKind === "crew" && item.eventId)) crewByEvent.set(row.eventId!, [...(crewByEvent.get(row.eventId!) || []), { role: row.role, createdAt: row.createdAt }]);
  const operatorSessions = attempts.filter((item) => item.accessKind === "operator").length;
  let env: ReturnType<typeof getEnv> | undefined;
  try { env = getEnv(); } catch { env = undefined; }
  const crewPasswordSet = Boolean(env && getCrewAccessPassword(env));
  const operatorPasswordSet = Boolean(env && getOperatorLaunchpadPassword(env));
  const resendSet = Boolean(env?.RESEND_API_KEY);
  const schema = await getRuntimeSchemaStatus().catch((error) => ({ ok: false, store: "unknown", missingTables: [], migrationFile: "", detail: error instanceof Error ? error.message : String(error) }));
  const newestLive = live[0] || active[0];
  const stage = newestLive ? await getOperatorStageStreamState(newestLive.id, "main-stage").catch(() => undefined) : undefined;
  const replays = ended.map((event) => ({ event, count: buildVirtualVenueModel(event.id).replays.length }));
  const toc = SECTIONS.map((section) => ({ ...section, count: section.id === "live-now" ? live.length : section.id === "events" ? events.length : section.id === "crews" ? active.length : section.id === "operators" ? operatorSessions : section.id === "guests" ? active.length : section.id === "networking" ? active.length : section.id === "replays" ? ended.length : undefined }));

  return (
    <div className="space-y-4" data-testid="owner-console">
      <ConsoleToc items={toc} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">Owner console</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Everything, in order</h1>
          <p className="mt-1 text-sm text-brand-muted">{events.length} event{events.length === 1 ? "" : "s"} on the books · {live.length} live now. Every section folds; the table of contents above scrolls to it.</p>
        </div>
        <Link href="/app/events/new" className="rounded-full bg-brand-black px-5 py-3 text-sm font-black text-white hover:bg-brand-orange" data-testid="console-new-event">New event</Link>
      </div>

      <ConsoleSection id="live-now" title="Live now" count={live.length} blurb="Every event with a live stage: feed, who is on stage, chat, stage requests, and the way into the crew console." defaultOpen>
        {live.length ? <ul className="space-y-3">{live.map((event) => <SafeSection key={event.id} label={event.name} render={() => LiveNowRow({ event })} />)}</ul> : <p className="text-sm text-brand-muted" data-testid="console-live-empty">Nothing is live right now. Start a Room with New event → Now, or Go live on a planned event.</p>}
      </ConsoleSection>

      <ConsoleSection id="events" title="Events" count={events.length} blurb="Upcoming, drafts, ended, archived. Open one, hand out its codes, or start a new one.">
        {[["Upcoming", upcoming], ["Drafts", drafts], ["Ended", ended], ["Archived", archived]].map(([label, list]) => (
          <details key={String(label)} className="mb-2 rounded-2xl bg-brand-ash p-3" open={String(label) !== "Archived" && (list as RuntimeEventRecord[]).length > 0} data-testid={`console-events-${String(label).toLowerCase()}`}>
            <summary className="cursor-pointer text-sm font-black">{String(label)} · {(list as RuntimeEventRecord[]).length}</summary>
            {(list as RuntimeEventRecord[]).length ? <ul className="mt-2 space-y-2">{(list as RuntimeEventRecord[]).map((event) => <EventRow key={event.id} event={event}><CopyButton value={`${base}${hostLinkPath(event)}`} label="Copy host link" className="!px-3 !py-1 !text-xs" /></EventRow>)}</ul> : <p className="mt-2 text-xs text-brand-muted">None.</p>}
          </details>
        ))}
      </ConsoleSection>

      <ConsoleSection id="crews" title="Crews" count={active.length} blurb="Per event: who holds a crew role right now, the host link, the crew code, and Rotate. The global crew password is a Cloudflare secret.">
        <p className="mb-3 rounded-2xl bg-brand-ash p-3 text-xs text-brand-muted" data-testid="console-crew-password-status">Global crew password: <strong>{crewPasswordSet ? "set" : "not set"}</strong> (opens every event; the value is never shown here).</p>
        {active.length ? <ul className="space-y-3">{active.map((event) => <SafeSection key={event.id} label={event.name} render={() => CrewRow({ event, crewSessions: crewByEvent.get(event.id) || [], base })} />)}</ul> : <p className="text-sm text-brand-muted">No events yet.</p>}
      </ConsoleSection>

      <ConsoleSection id="operators" title="Operators" count={operatorSessions} blurb="West Peek's own control room: the launchpad, who has an operator session, the operator password, and the testing console per event.">
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <Link href="/production-access/launchpad" className="rounded-full bg-brand-black px-3 py-2 text-white">Operator launchpad</Link>
          <Link href="/admin/testing" className="rounded-full border border-brand-black px-3 py-2">Testing console</Link>
        </div>
        <p className="mt-3 text-sm text-brand-muted" data-testid="console-operator-status">Operator sessions granted in the last 8h: <strong>{operatorSessions}</strong> · operator password: <strong>{operatorPasswordSet ? "set" : "not set"}</strong>.</p>
        {active.length ? <ul className="mt-3 flex flex-wrap gap-2 text-xs">{active.map((event) => <li key={event.id}><Link href={`/admin/testing/${event.id}`} className="rounded-full border border-brand-line px-3 py-1 font-bold hover:border-brand-orange">Testing console · {event.name}</Link></li>)}</ul> : null}
      </ConsoleSection>

      <ConsoleSection id="guests" title="Speakers & special guests" count={active.length} blurb="Per event: speakers (tech check, cue deck, stage), sponsors, VIPs, clients — open their real pages as them; the role codes with copy links; Preview a guest.">
        {active.length ? <ul className="space-y-3">{active.map((event) => <SafeSection key={event.id} label={event.name} render={() => GuestRow({ event, base })} />)}</ul> : <p className="text-sm text-brand-muted">No events yet.</p>}
      </ConsoleSection>

      <ConsoleSection id="networking" title="Networking" count={active.length} blurb="Per event: queue size, matches in progress, open or closed.">
        {active.length ? <ul className="space-y-2">{active.map((event) => <SafeSection key={event.id} label={event.name} compact render={() => NetworkingRow({ event })} />)}</ul> : <p className="text-sm text-brand-muted">No events yet.</p>}
      </ConsoleSection>

      <ConsoleSection id="replays" title="Recordings & replays" count={ended.length} blurb="Per ended event: whether a replay is ready.">
        {replays.length ? <ul className="space-y-2">{replays.map(({ event, count }) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-line p-3 text-sm"><span className="font-black">{event.name}</span><span className="text-brand-muted">{count ? `${count} replay${count === 1 ? "" : "s"} listed` : "no replay yet — production publishes it when processing completes"}</span><Link href={`/venue/${event.id}/replay`} className="rounded-full border border-brand-black px-3 py-1 text-xs font-black">Replay center</Link></li>)}</ul> : <p className="text-sm text-brand-muted">No ended events yet.</p>}
      </ConsoleSection>

      <ConsoleSection id="settings" title="Settings & integrations" blurb="Agency settings, LiveKit webhook, email, Supabase health, the build that is live.">
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li className="rounded-2xl border border-brand-line p-3"><Link href="/app/settings" className="font-black underline">Agency settings</Link><p className="text-xs text-brand-muted">Name, colours, members.</p></li>
          <li className="rounded-2xl border border-brand-line p-3" data-testid="console-livekit-status"><p className="font-black">LiveKit webhook</p><p className="text-xs text-brand-muted">{stage?.lastWebhookEvent ? <>Last webhook: {stage.lastWebhookEvent}{stage.lastWebhookAt ? <> · <LocalTime iso={stage.lastWebhookAt} mode="datetime" /></> : null}</> : stage?.lastHealthCheckAt ? "No webhook yet — polling is carrying the state" : "No stage activity yet"}{newestLive ? ` (${newestLive.name})` : ""}</p></li>
          <li className="rounded-2xl border border-brand-line p-3" data-testid="console-resend-status"><p className="font-black">Email (Resend)</p><p className="text-xs text-brand-muted">{resendSet ? "Configured" : "Not configured — emails are recorded, not sent"}</p></li>
          <li className="rounded-2xl border border-brand-line p-3" data-testid="console-supabase-status" data-ok={schema.ok ? "true" : "false"}><p className="font-black">Supabase</p><p className="text-xs text-brand-muted">{schema.ok ? `Healthy · store ${schema.store}` : `Problem: ${schema.missingTables.length ? `missing ${schema.missingTables.join(", ")}` : schema.detail || "unknown"}`}</p></li>
          <li className="rounded-2xl border border-brand-line p-3" data-testid="console-build"><p className="font-black">Build</p><p className="text-xs text-brand-muted"><code>{CURRENT_BUILD_ID}</code></p></li>
          <li className="rounded-2xl border border-brand-line p-3"><Link href="/app/people" className="font-black underline">People across events</Link><p className="text-xs text-brand-muted">Every registered person, once, with CSV export.</p></li>
        </ul>
        <div className="mt-4"><SafeSection label="People across events" render={() => ContactsAcrossEvents({ compact: true })} /></div>
      </ConsoleSection>
    </div>
  );
}
