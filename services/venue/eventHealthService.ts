import { CURRENT_BUILD_ID } from "@/lib/runtime/buildVersion";
import { ladderReadiness } from "@/lib/video/fallbackReadiness";
import { HEALTH_SIGNAL_LABELS, logHeadline, settleAll, worstLevel, type HealthLogEntry, type HealthSignal, type HealthSignalKey } from "@/lib/venue/eventHealth";
import { findEventRecord } from "@/services/events/eventRepository";
import { isDemonstrationEvent } from "@/services/events/eventConfigRepository";
import { probeCrewPageReads } from "@/services/events/crewPageReadsProbe";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { getAttendeeRoster } from "@/services/venue/attendeeRosterService";
import { listLiveRoomChatMessages, getLiveChatRoomModeration } from "@/services/venue/liveChatService";
import { reconcileIngressWithLiveKit } from "@/services/video/livekitIngressService";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";
import type { StageStreamEvent } from "@/types/stageStream";

/**
 * Every health probe for one event, run once, in ONE pass — the bar polls `/api/venue/tick` and
 * gets all nine signals plus the show log back together. One request per signal would be nine
 * round trips from every open owner page during a show.
 *
 * Each probe is independently caught. A dead probe returns a signal with NO `checkedAt`, which
 * `settleAll` forces to grey/unknown — it must never fall through to green, and it must never take
 * the other eight down with it.
 */

export interface EventHealthReport {
  eventId: string;
  stageId: string;
  status: string | null;
  live: boolean;
  /**
   * This event is a sample shown to people, with no real stream behind it. The panel says so, and
   * the probes below read it to tell a fiction apart from a failure. It is NOT a way to silence a
   * signal: every probe still runs, every signal is still reported, and a real event is unaffected.
   */
  demonstration: boolean;
  signals: HealthSignal[];
  level: ReturnType<typeof worstLevel>;
  log: HealthLogEntry[];
  generatedAt: string;
}

function signal(key: HealthSignalKey, level: HealthSignal["level"], detail: string, source: string, checkedAt?: string, action?: HealthSignal["action"]): HealthSignal {
  return { key, label: HEALTH_SIGNAL_LABELS[key], level, detail, source, checkedAt, action };
}

/** A probe that threw is grey with its reason, never a missing row and never green. */
function unmeasured(key: HealthSignalKey, source: string, why: string): HealthSignal {
  return signal(key, "unknown", why, source);
}

function minutesAgo(iso: string | undefined, now: number) {
  if (!iso) return undefined;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return undefined;
  return (now - at) / 60_000;
}

/** A restart inside two minutes is a reconnect, not a clean start — the table calls that yellow. */
function reconnectedRecently(events: readonly StageStreamEvent[], now: number) {
  const started = events.find((item) => item.signal === "ingress_started");
  if (!started) return false;
  const ended = events.find((item) => item.signal === "ingress_ended" && item.createdAt < started.createdAt);
  if (!ended) return false;
  const since = minutesAgo(started.createdAt, now);
  return since !== undefined && since <= 2;
}

export async function getEventHealthReport(input: { eventId: string; stageId?: string; clientBuildId?: string }): Promise<EventHealthReport> {
  const eventId = input.eventId;
  const stageId = input.stageId || "main-stage";
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const [event, state, events, reconcile, dbProbe, roster, chat, chatLock] = await Promise.all([
    findEventRecord(eventId).catch(() => undefined),
    getOperatorStageStreamState(eventId, stageId).catch(() => undefined),
    getRuntimeStore().listStageStreamEvents(eventId, stageId, 20).catch(() => undefined),
    // The only probe that leaves the Worker: asks LiveKit whether the ingress is actually
    // publishing. `checked: false` means it could not ask — grey, not green.
    reconcileIngressWithLiveKit(eventId, stageId).catch(() => undefined),
    probeCrewPageReads().catch(() => undefined),
    getAttendeeRoster({ eventId, roomKind: "main_stage", roomId: stageId }).catch(() => undefined),
    listLiveRoomChatMessages(eventId, "main_stage", stageId, "crew").catch(() => undefined),
    getLiveChatRoomModeration(eventId, "main_stage", stageId).catch(() => undefined),
  ]);

  const status = event?.status || null;
  const live = status === "live";
  /**
   * The Nova Founder Summit demo is marked LIVE so the venue looks like a real show to whoever is
   * being shown it — but nothing is publishing to it, because there is nothing to publish. Before
   * 17 Sep 2026 the owner's command bar therefore read "1 failing: webhook" through every demo:
   * the probe was right, and what it was right about was a fiction.
   *
   * So the question the feed, stage and webhook probes actually ask is not "is this event live"
   * but "is a stream EXPECTED right now" — live AND not a declared demonstration. A real live
   * event still goes red for exactly this condition; a demonstration says out loud, in the signal
   * itself, that there is no stream because there is no show. Nothing is suppressed: all nine
   * signals are still probed, still listed, and still name their source.
   */
  const demonstration = isDemonstrationEvent(eventId);
  const feedExpected = live && !demonstration;
  const DEMO_WHY = "this is a demonstration event, shown live so the venue looks like a real show, with no stream behind it";
  const signals: HealthSignal[] = [];

  // Feed — is anything actually arriving from StreamYard.
  if (!state) {
    signals.push(unmeasured("feed", "stage_stream_states + LiveKit Ingress/ListIngress", "The stage stream state could not be read, so nothing is known about the feed."));
  } else if (reconcile?.checked && reconcile.publishing === true) {
    const yellow = events ? reconnectedRecently(events, now) : false;
    signals.push(signal("feed", yellow ? "yellow" : "green", yellow ? "Publishing, but the ingress reconnected in the last two minutes. Bitrate is not measured on this deployment." : "The ingress is publishing. Bitrate is not measured on this deployment.", "LiveKit Ingress/ListIngress", nowIso));
  } else if (reconcile?.checked && reconcile.publishing === false) {
    signals.push(feedExpected
      ? signal("feed", "red", "The event is live and nothing is publishing. Get the stream credentials, paste them into the existing StreamYard Custom RTMP destination, and go live there.", "LiveKit Ingress/ListIngress", nowIso, { label: "Get stream credentials", kind: "get-credentials" })
      : signal("feed", "green", `Nothing is publishing, and nothing is expected to: ${demonstration ? DEMO_WHY : "the event is not live"}.`, "LiveKit Ingress/ListIngress", nowIso));
  } else if (feedExpected) {
    signals.push(unmeasured("feed", "LiveKit Ingress/ListIngress", "LiveKit could not be asked whether the ingress is publishing — no credentials on this Worker, no ingress to check, or LiveKit is unreachable. The event is live, so check StreamYard directly."));
  } else if (demonstration) {
    // Measured, and what was measured is the event's own declaration — not an assumption, and not
    // a claim about LiveKit, which is exactly why the source names the config file.
    signals.push(signal("feed", "green", `No ingress to ask about, and none expected: ${DEMO_WHY}.`, "data/events/demo/event.json (demonstration) + LiveKit Ingress/ListIngress", nowIso));
  } else {
    signals.push(signal("feed", "green", `Not live yet — stage reads ${state.streamStatus.replaceAll("_", " ").toLowerCase()}.`, "stage_stream_states.streamStatus", state.updatedAt));
  }

  // Stage — is there a room, and is anyone on it.
  if (!state) {
    signals.push(unmeasured("stage", "stage_stream_states", "The stage stream state could not be read."));
  } else {
    const hasRoom = Boolean(state.livekitRoomName && state.livekitIngressId);
    const attendees = roster?.total ?? 0;
    if (state.streamStatus === "LIVEKIT_INGRESS_LIVE") signals.push(signal("stage", "green", "The room is active and a publisher is on it.", "stage_stream_states.streamStatus", state.updatedAt));
    else if (!hasRoom && attendees > 0 && feedExpected) signals.push(signal("stage", "red", `${attendees} registered and there is no room to put them in. Get stream credentials — that creates the LiveKit room.`, "stage_stream_states + attendee_profiles", state.updatedAt, { label: "Get stream credentials", kind: "get-credentials" }));
    else if (hasRoom) signals.push(signal("stage", "yellow", "The room exists but no publisher has arrived yet.", "stage_stream_states.streamStatus", state.updatedAt, { label: "Get stream credentials", kind: "get-credentials" }));
    else signals.push(signal("stage", "green", "No room yet, and nobody is waiting for one.", "stage_stream_states + attendee_profiles", state.updatedAt));
  }

  // Webhook — is LiveKit telling us things, or are we only finding out by polling.
  if (!state) {
    signals.push(unmeasured("webhook", "stage_stream_states.lastWebhookAt", "The stage stream state could not be read."));
  } else {
    const webhookAge = minutesAgo(state.lastWebhookAt, now);
    const pollAge = minutesAgo(state.lastHealthCheckAt, now);
    if (webhookAge !== undefined && webhookAge <= 5) signals.push(signal("webhook", "green", `A LiveKit webhook arrived ${Math.round(webhookAge)} min ago (${state.lastWebhookEvent || "event"}).`, "stage_stream_states.lastWebhookAt", state.updatedAt));
    else if (pollAge !== undefined && pollAge <= 5) signals.push(signal("webhook", "yellow", "No webhook in the last five minutes; the poll is carrying the stage state instead. Check the LiveKit project webhook points at /api/video/livekit-webhook.", "stage_stream_states.lastWebhookAt + lastHealthCheckAt", state.updatedAt));
    else if (feedExpected) signals.push(signal("webhook", "red", "No webhook and no successful poll in the last five minutes — nothing is telling us what the feed is doing. Open the crew deck and watch the stage directly.", "stage_stream_states.lastWebhookAt + lastHealthCheckAt", state.updatedAt, { label: "Crew deck", kind: "crew-deck" }));
    else if (demonstration) signals.push(signal("webhook", "green", `No webhook, and none expected: ${DEMO_WHY}. A real event live with this reading is failing and reads red here.`, "data/events/demo/event.json (demonstration) + stage_stream_states.lastWebhookAt", state.updatedAt));
    else signals.push(signal("webhook", "green", "Nothing to report: no webhook expected before the show.", "stage_stream_states.lastWebhookAt", state.updatedAt));
  }

  // Fallback — is rung 1 real, and has anyone proved it this show.
  const cloudflare = ladderReadiness().find((rung) => rung.source === "CLOUDFLARE_STREAM");
  const testedThisShow = Boolean(events?.some((item) => item.signal === "cloudflare_stream_live" || item.signal === "manual_switch_to_cloudflare_stream"));
  if (!cloudflare) signals.push(unmeasured("fallback", "lib/video/fallbackReadiness", "The ladder could not be read."));
  else if (cloudflare.ready && testedThisShow) signals.push(signal("fallback", "green", "Cloudflare Stream is configured and has carried the room this show.", "environment + stage_stream_events", nowIso));
  else if (cloudflare.ready) signals.push(signal("fallback", "yellow", "Cloudflare Stream is configured but untested this show. Add it as a SECOND Custom RTMP destination in StreamYard before you need it.", "environment (CLOUDFLARE_STREAM_FALLBACK_*)", nowIso, { label: "Fallback setup on the crew deck", kind: "fallback" }));
  else signals.push(signal("fallback", feedExpected ? "red" : "yellow", cloudflare.reason, "environment (CLOUDFLARE_STREAM_FALLBACK_*)", nowIso, { label: "Fallback setup on the crew deck", kind: "fallback" }));

  // Database — the reads the live surfaces actually make, against the real store.
  if (!dbProbe) {
    signals.push(unmeasured("database", "services/events/crewPageReadsProbe", "The runtime read probe could not be run."));
  } else {
    const failed = dbProbe.reads.filter((read) => !read.ok);
    const critical = failed.filter((read) => /chat|attendee/.test(read.name));
    if (!failed.length) signals.push(signal("database", "green", `${dbProbe.reads.length} runtime reads ok.`, "services/events/crewPageReadsProbe", nowIso));
    else if (critical.length) signals.push(signal("database", "red", `Chat or roster reads are failing: ${critical.map((read) => read.name).join(", ")}. The migration behind them has not been applied to this store.`, "services/events/crewPageReadsProbe", nowIso, { label: "Crew deck", kind: "crew-deck" }));
    else signals.push(signal("database", "yellow", `Failing soft: ${failed.map((read) => read.name).join(", ")}. The live surfaces still render.`, "services/events/crewPageReadsProbe", nowIso));
  }

  // Chat — can people post, and is the room locked.
  if (!chat) signals.push(unmeasured("chat", "live_chat_messages", "The chat read failed, so nothing is known about chat. Attendees may be seeing a dead panel."));
  else if (chatLock?.locked) signals.push(signal("chat", "yellow", "Chat is locked: attendees cannot post. Unlock it from the crew deck when you want the room talking.", "live_chat_moderation_states", nowIso, { label: "Crew deck", kind: "crew-deck" }));
  else signals.push(signal("chat", "green", `${chat.length} message${chat.length === 1 ? "" : "s"} in the main stage room; posting is open.`, "live_chat_messages", nowIso));

  // Attendees — registered is a real number; who is CONNECTED needs per-participant telemetry,
  // which is the Diagnose panel's probe, not ours. Grey rather than a green we did not earn.
  if (!roster) signals.push(unmeasured("attendees", "attendee_profiles", "The roster read failed."));
  else if (!live) signals.push(signal("attendees", "green", `${roster.total} registered; nobody is expected in the room before the show.`, "attendee_profiles", nowIso));
  else signals.push(unmeasured("attendees", "LiveKit participant telemetry", `${roster.total} registered. How many are actually CONNECTED is not probed here — the per-attendee Diagnose panel on the roster is what reads LiveKit participant state.`));

  // Build — a real comparison for the page that asked, which is at least one real client.
  if (!input.clientBuildId) signals.push(unmeasured("build", "NEXT_PUBLIC_BUILD_ID", "This poll did not say which bundle it loaded with, so nothing is known about client builds."));
  else if (input.clientBuildId === CURRENT_BUILD_ID) signals.push(signal("build", "green", `This page is on the current build (${CURRENT_BUILD_ID}).`, "NEXT_PUBLIC_BUILD_ID", nowIso));
  else signals.push(signal("build", "yellow", `This page loaded with ${input.clientBuildId} and the Worker is serving ${CURRENT_BUILD_ID}. Reload before you touch anything on show day.`, "NEXT_PUBLIC_BUILD_ID", nowIso));

  // Capacity — LiveKit publishes no usage figure to this Worker. Saying "under 60%" without one
  // would be the exact assumption the plan forbids.
  signals.push(unmeasured("capacity", "LiveKit project usage API", "LiveKit tier usage and transcode minutes are not exposed to this Worker, so capacity is not measured. Read it in the LiveKit dashboard before a large show."));

  const settled = settleAll(signals);
  return {
    eventId,
    stageId,
    status,
    live,
    demonstration,
    signals: settled,
    level: worstLevel(settled),
    log: (events || []).slice(0, 12).map((item) => ({ id: item.id, at: item.createdAt, headline: logHeadline(item.signal), detail: item.message })),
    generatedAt: nowIso,
  };
}
