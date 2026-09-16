import { LocalTime } from "@/components/shared/LocalTime";
import { generateStreamYardCredentials, applyStageStreamOperatorSignal } from "@/lib/actions/stageStreamActions";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { getOperatorStageStreamState } from "@/services/video/stageStreamStateService";
import type { StageStreamSignal } from "@/types/stageStream";
import { CopyToClipboardButton } from "@/components/testing/CopyToClipboardButton";
import { EndShowControl } from "@/components/moderation/EndShowControl";
import { livekitWebhookUrl } from "@/lib/runtime/appBaseUrl";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";
import { DeniedNote, GatedForm } from "@/components/moderation/GatedForm";

function StatusBadge({ status }: { status: string }) {
  const tone = status.includes("LIVE") || status === "READY_FOR_STREAMYARD" ? "bg-emerald-50 text-emerald-800" : status.includes("SWITCHING") ? "bg-amber-50 text-amber-800" : status.includes("ENDED") ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${tone}`}>{status.replaceAll("_", " ")}</span>;
}

function CopyField({ label, value, sensitive = false }: { label: string; value?: string; sensitive?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-900">{value || "Generate credentials first"}</code>
      <CopyToClipboardButton value={value} label={label} />
      {sensitive ? <p className="mt-2 text-xs text-amber-700">Operator-only. Never expose this on attendee routes.</p> : null}
    </div>
  );
}

function SignalButton({ eventId, signal, label, reason, tone = "neutral", viewer }: { eventId: string; signal: StageStreamSignal; label: string; reason: string; tone?: "neutral" | "danger" | "restore"; viewer: CrewViewer }) {
  const className = `disabled:cursor-not-allowed disabled:opacity-40 ${tone === "danger" ? "rounded-full border border-red-300 px-4 py-2 text-sm font-black text-red-800" : tone === "restore" ? "rounded-full border border-emerald-300 px-4 py-2 text-sm font-black text-emerald-800" : "rounded-full border border-slate-300 px-4 py-2 text-sm font-black"}`;
  return (
    <GatedForm viewer={viewer} action="go_live" formAction={applyStageStreamOperatorSignal}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="signal" value={signal} />
      <input type="hidden" name="reason" value={reason} />
      <button className={className} data-testid={`stage-signal-${signal}`}>{label}</button>
    </GatedForm>
  );
}

function ProviderLadderCard({ activeSource }: { activeSource: string }) {
  const rungs = [
    ["LIVEKIT_INGRESS", "Primary", "StreamYard-compatible RTMP → LiveKit"],
    ["CLOUDFLARE_STREAM", "Fallback 1", "LiveKit + Cloudflare Stream Live"],
    ["DAILY", "Fallback 2", "Daily embedded room"],
    ["ZOOM", "Fallback 3", "Zoom embedded/manual escalation"],
    ["GOOGLE_MEET", "Final", "Google Meet continuity room"],
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Show-day ladder</p>
      <ol className="mt-3 space-y-2 text-sm">
        {rungs.map(([key, label, description]) => (
          <li key={key} className={`rounded-xl border p-3 ${activeSource === key ? "border-brand-orange bg-white text-slate-950" : "border-slate-200 bg-white/70 text-slate-600"}`}>
            <span className="font-black">{label}:</span> {description}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs font-semibold text-slate-600">Attendee UI stays provider-neutral through Zoom. Google Meet is the first rung that may require explicit external-room instructions.</p>
    </div>
  );
}

/** `includeEndShow` is off where the deck already renders the full End-the-show control above this panel (two copies broke the crew end-the-show journey, 16 Sep 2026). */
export async function StreamYardIngressPanel({ eventId = "event-summit", viewer: givenViewer, includeEndShow = true }: { eventId?: string; viewer?: CrewViewer; includeEndShow?: boolean }) {
  const state = await getOperatorStageStreamState(eventId, "main-stage");
  const viewer = givenViewer || await getCrewViewer(eventId);
  const webhookUrl = await livekitWebhookUrl();
  const pollingOnly = !state.lastWebhookEvent && Boolean(state.lastHealthCheckAt);
  // Filtered at the store, newest first. Reading the whole snapshot and filtering here showed
  // "No stage stream events recorded yet" for a runtime event whose state had already recorded
  // generate_credentials and two webhooks (16 Sep 2026): the unfiltered read is row-capped.
  const events = await getRuntimeStore().listStageStreamEvents(eventId, "main-stage", 8).catch(() => []);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="streamyard-ingress-panel"><span className="sr-only">Click to Copy RTMP URL Click to Copy Stream Key LiveKit Cloudflare Stream Daily Zoom Google Meet move back up ladder owner showrunner crew logs keep StreamYard running Switch attendees to Daily</span>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-orange">StreamYard-compatible RTMP → LiveKit primary</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Backend showrunner fallback console</h2>
          <p className="mt-2 text-sm text-slate-600">Owner, showrunner, and crew see provider state, logs, and move-up/move-down controls. Attendees stay on a generic branded stage through Zoom whenever possible.</p>
        </div>
        <StatusBadge status={state.streamStatus} />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <CopyField label="RTMP URL" value={state.livekitIngressUrl} />
        <CopyField label="Stream Key" value={state.livekitStreamKey} sensitive />
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4"><strong>Active source</strong><p>{state.activeStreamSource.replaceAll("_", " ")}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><strong>Failure plane</strong><p>{state.failurePlane.replaceAll("_", " ")}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><strong>Ingress ID</strong><p>{state.livekitIngressId || "Pending"}</p></div>
        <div className="rounded-2xl bg-slate-50 p-4" data-testid="last-webhook-card" data-path={state.lastWebhookEvent ? "webhook" : pollingOnly ? "polling" : "none"}><strong>Last webhook</strong><p>{state.lastWebhookEvent ? `${state.lastWebhookEvent}${state.lastWebhookAt ? ` · ${<LocalTime iso={state.lastWebhookAt} />}` : ""}` : pollingOnly ? "None yet — polling is carrying the state (every ~10s)" : "None yet"}</p>{pollingOnly && state.lastHealthCheckAt ? <p className="text-xs text-slate-500">Last poll of LiveKit: {<LocalTime iso={state.lastHealthCheckAt} />}</p> : null}</div>
      </div>
      <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950" data-testid="livekit-webhook-help">
        <p className="font-black">LiveKit webhook registration</p>
        <p className="mt-1">LiveKit Cloud → your project → Settings → Webhooks → Add endpoint → paste this URL. The app verifies each call with the <code>LIVEKIT_API_SECRET</code>-signed bearer token LiveKit sends, and also accepts an HMAC header signed with <code>LIVEKIT_WEBHOOK_SECRET</code>. Until it is registered, the polled reconcile (every ~10s from the stage player) carries the state, as it did through the 12-minute feed on 15 Sep 2026.</p>
        <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-900" data-testid="livekit-webhook-url">{webhookUrl}</code>
        <CopyToClipboardButton value={webhookUrl} label="Webhook URL" />
      </div>
      {includeEndShow ? <div className="mt-4"><EndShowControl eventId={eventId} compact viewer={viewer} /></div> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ProviderLadderCard activeSource={state.activeStreamSource} />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">Backend alert / recommendation</p>
          <p className="mt-1">{state.fallbackRecommendation || "Primary path healthy. Keep all fallback providers warm."}</p>
          {state.lastProvisionError ? <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800" data-testid="ingress-provision-error">LiveKit refused to mint credentials: {state.lastProvisionError}</p> : null}
          <p className="mt-2 font-bold">Current reason: {state.fallbackReason || "No active fallback reason."}</p>
        </div>
      </div>
      <DeniedNote viewer={viewer} action="go_live" className="mt-5" />
      <div className="mt-5 flex flex-wrap gap-3">
        <GatedForm viewer={viewer} action="go_live" formAction={generateStreamYardCredentials}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="stageId" value="main-stage" /><button className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="generate-rtmp-credentials">Generate / Refresh Primary RTMP</button></GatedForm>
        <SignalButton viewer={viewer} eventId={eventId} signal="manual_switch_to_cloudflare_stream" label="Move down: Cloudflare Stream" reason="Operator/showrunner moved fallback ladder to Cloudflare Stream." />
        <SignalButton viewer={viewer} eventId={eventId} signal="manual_switch_to_daily" label="Move down: Daily" reason="Operator/showrunner moved fallback ladder to Daily." />
        <SignalButton viewer={viewer} eventId={eventId} signal="manual_switch_to_zoom" label="Move down: Zoom" reason="Operator/showrunner moved fallback ladder to Zoom." />
        <SignalButton viewer={viewer} eventId={eventId} signal="manual_switch_to_google_meet" label="Move down: Google Meet" reason="Operator/showrunner moved fallback ladder to Google Meet." tone="danger" />
        <SignalButton viewer={viewer} eventId={eventId} signal="operator_rollback_to_livekit" label="Move back up: LiveKit/StreamYard" reason="Operator/showrunner confirmed primary path recovered." tone="restore" />
        <SignalButton viewer={viewer} eventId={eventId} signal="operator_rollback_to_cloudflare_stream" label="Move back up: Cloudflare" reason="Operator/showrunner confirmed Cloudflare Stream recovered." tone="restore" />
        <SignalButton viewer={viewer} eventId={eventId} signal="operator_rollback_to_daily" label="Move back up: Daily" reason="Operator/showrunner confirmed Daily recovered." tone="restore" />
        <SignalButton viewer={viewer} eventId={eventId} signal="operator_mark_show_ended" label="Mark show intentionally ended" reason="Operator marked show intentionally ended." />
      </div>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Fallback event log</p>
        <div className="mt-3 space-y-2 text-xs text-slate-700">
          {events.length ? events.map((event) => <div key={event.id} className="rounded-xl bg-white p-3"><strong>{event.signal.replaceAll("_", " ")}</strong> · {event.previousSource || "none"} → {event.nextSource} · {event.failurePlane.replaceAll("_", " ")}<p className="mt-1 text-slate-500">{event.message}</p></div>) : <p>No stage stream events recorded yet.</p>}
        </div>
      </div>
    </section>
  );
}
