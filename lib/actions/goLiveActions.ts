"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveEventControlAccessForRequest, type LiveControlAuthorization } from "@/lib/auth/liveControlRequestGuard";
import { setEventStatus } from "@/services/events/eventRepository";
import { getWorkspaceActor, type WorkspaceActor } from "@/lib/auth/workspaceActor";
import { provisionStreamYardLiveKitIngress } from "@/services/video/livekitIngressService";
import { applyStageStreamSignal, getOperatorStageStreamState } from "@/services/video/stageStreamStateService";
import { stageSourceChoice } from "@/lib/video/stageLiveState";
import { switchStageSource, type StageSourceSwitchResult } from "@/services/video/stageSourceSwitch";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function revalidateGoLiveSurfaces(eventId: string) {
  for (const path of [`/app/events/${eventId}/publish`, `/app/events/${eventId}`, `/crew/events/${eventId}`, "/app/owner", `/venue/${eventId}/lobby`, `/venue/${eventId}/stage`]) revalidatePath(path);
}

/**
 * Going live is ONE action. It used to be two pages: set the status on Publish, then find the RTMP
 * credentials on the crew deck. Now pressing Go live flips the event to live AND leaves the
 * producer holding credentials — minting them only when the event has none, because ending a show
 * releases the key and a restart needs a fresh one.
 */
/**
 * Who flips the event live. Owner, operator and signed-in users are workspace actors; crew whose
 * role holds go_live (already checked) are named by role, so a crew Go live makes the event read
 * live everywhere too instead of leaving the venue on its pre-event status.
 */
async function liveActor(auth: Extract<LiveControlAuthorization, { ok: true }>): Promise<WorkspaceActor | null> {
  const actor = await getWorkspaceActor();
  if (actor || auth.actorRole !== "crew") return actor;
  const role = auth.crewRole || "crew";
  return { kind: "user", id: `crew:${role}`, label: `Crew (${role.replaceAll("_", " ")})`, role };
}

export async function goLiveAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const stageId = clean(formData.get("stageId")) || "main-stage";
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "go_live");
  if (!auth.ok) throw new Error(auth.error);
  const actor = await liveActor(auth);
  const state = await getOperatorStageStreamState(eventId, stageId).catch(() => undefined);
  if (!state?.livekitStreamKey) {
    await provisionStreamYardLiveKitIngress({ eventId, stageId, actorRole: auth.actorRole });
  }
  // Go live is the StreamYard path: a stage last left on cameras goes back to waiting for the feed.
  if (stageSourceChoice(state) === "CAMERAS") await applyStageStreamSignal({ eventId, stageId, signal: "operator_switch_to_streamyard", reason: "Go live (StreamYard) pressed." });
  if (actor) await setEventStatus(eventId, "live", actor).catch(() => undefined);
  revalidateGoLiveSurfaces(eventId);
  const back = clean(formData.get("returnTo"));
  if (back) redirect(back);
}

/**
 * "Get stream credentials" when there are none, "New stream key" when replacing a working one.
 * Same server work either way; the card does the naming and the confirm.
 */
export async function getStreamCredentialsAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const stageId = clean(formData.get("stageId")) || "main-stage";
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "go_live");
  if (!auth.ok) throw new Error(auth.error);
  await provisionStreamYardLiveKitIngress({ eventId, stageId, actorRole: auth.actorRole });
  revalidateGoLiveSurfaces(eventId);
  const back = clean(formData.get("returnTo"));
  if (back) redirect(back);
}

/**
 * THE SOURCE SWITCH: "StreamYard" or "My camera", one tap, mid-show, either way. Used with
 * useActionState so the card can say what happened without a page change. Refused before any
 * read or write for anyone who may not go live (attendees, other crew roles, revoked crew links).
 */
export async function switchStageSourceAction(_previous: StageSourceSwitchResult | null, formData: FormData): Promise<StageSourceSwitchResult> {
  const eventId = clean(formData.get("eventId"));
  const stageId = clean(formData.get("stageId")) || "main-stage";
  const target = clean(formData.get("source"));
  if (!eventId || (target !== "CAMERAS" && target !== "STREAMYARD")) return { ok: false, message: "Pick StreamYard or My camera." };
  const auth = await requireLiveEventControlAccessForRequest(eventId, "go_live");
  if (!auth.ok) return { ok: false, message: auth.error };
  const result = await switchStageSource({ eventId, stageId, target, actorRole: auth.actorRole });
  if (result.ok) {
    // Going live on cameras is going live: the event reads live everywhere, as Go live does.
    const actor = target === "CAMERAS" ? await liveActor(auth) : undefined;
    if (actor) await setEventStatus(eventId, "live", actor).catch(() => undefined);
    revalidateGoLiveSurfaces(eventId);
  }
  return result;
}
