import { readViewAsViewer } from "@/lib/auth/viewAs";
import { isPreviewMirrorId, isPreviewPersonaId, mirroredAttendeeId, previewPersona, type PreviewPersona } from "@/lib/auth/previewIdentity";
import { recordPreviewAudit } from "@/services/venue/previewAuditService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { getAttendeeLiveCapability } from "@/services/venue/attendeeLivePermissionService";
import { getLiveChatAttendeeModeration } from "@/services/venue/liveChatService";
import { vipStandingFor } from "@/services/guests/vipGrantService";
import type { ViewAsViewer } from "@/lib/auth/viewAsGuard";
import type { AttendeeLiveCapability } from "@/types/attendeeLive";

export interface PreviewView {
  /** The `?viewAs=` value exactly as it arrived. */
  id: string;
  kind: "persona" | "mirror";
  persona?: PreviewPersona;
  /** For a mirror: the real attendee whose state this page is rendering. */
  subject?: { attendeeId: string; name: string; company: string };
  /** "an attendee", "a VIP", "Dana Rivers" — what the banner says you are seeing this as. */
  label: string;
  /** The room state the page should render with: real for a mirror, plain-attendee for a persona. */
  state: { vip: boolean; silenced: boolean; capability?: AttendeeLiveCapability };
  viewer: Extract<ViewAsViewer, { ok: true }>;
}

/**
 * The `/venue/` side of "view as": a synthetic persona, or a read-only mirror of a real attendee
 * ("See their view" from the roster). Both are gated by the same `canViewAsGuest` rule as the guest
 * surfaces — same people, more surfaces — and both are refused at every write path by
 * `refusePreviewWrite`, so nothing rendered here can be saved or seen by anybody else.
 *
 * A mirror is a producer looking at a named person's state, so it is audited. A persona is nobody,
 * so it is not.
 */
export async function resolvePreviewView(eventId: string, viewAs: string | undefined, options: { roomKind?: "main_stage"; roomId?: string } = {}): Promise<PreviewView | undefined> {
  const id = String(viewAs || "").trim();
  if (!id || (!isPreviewPersonaId(id) && !isPreviewMirrorId(id))) return undefined;
  const viewer = await readViewAsViewer(eventId);
  if (!viewer.ok) return undefined;

  if (isPreviewPersonaId(id)) {
    const persona = previewPersona(id);
    if (!persona) return undefined;
    return { id, kind: "persona", persona, label: persona.bannerRole, state: { vip: persona.vip, silenced: false }, viewer };
  }

  const attendeeId = mirroredAttendeeId(id) as string;
  const roomKind = options.roomKind || "main_stage";
  const roomId = options.roomId || "main-stage";
  const profile = await getRuntimeStore().getAttendeeProfile(eventId, attendeeId).catch(() => undefined);
  if (!profile) return undefined;
  // Their REAL state, not a guess: the permit flag nobody set, the VIP standing, the silence.
  const [capability, moderation, vip] = await Promise.all([
    getAttendeeLiveCapability(eventId, roomKind, roomId, attendeeId).catch(() => undefined),
    getLiveChatAttendeeModeration(eventId, roomKind, roomId, attendeeId).catch(() => ({ silenced: false })),
    vipStandingFor(eventId, attendeeId).catch(() => undefined),
  ]);
  await recordPreviewAudit({ eventId, attendeeId, viewerRole: viewer.kind, action: "attendee_view_mirrored" });
  return {
    id,
    kind: "mirror",
    subject: { attendeeId, name: profile.name, company: profile.company },
    label: profile.name,
    state: { vip: Boolean(vip?.current), silenced: Boolean(moderation.silenced), capability },
    viewer,
  };
}
