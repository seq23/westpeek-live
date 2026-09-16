import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { refusePreviewWrite } from "@/lib/auth/previewIdentity";
import type { AttendeeSession } from "@/types/attendeeSession";

export interface AttendeeClientReport {
  buildId?: string;
  connectionQuality?: AttendeeSession["clientConnectionQuality"];
  subscribedTracks?: number;
  surface?: string;
  chatPolled?: boolean;
  /** The raw UA from the request; reduced to a label here and never stored whole. */
  userAgent?: string;
}

const QUALITIES = new Set(["excellent", "good", "poor", "lost", "unknown"]);

/**
 * "Chrome 140 on macOS" — enough to answer "is it their browser?", and nothing that identifies a
 * person. The raw user-agent string is a fingerprint, so it is reduced here, at the edge, and the
 * reduced label is the only thing that reaches the store or the screen.
 */
export function describeClient(userAgent: string | undefined): string | undefined {
  const ua = String(userAgent || "");
  if (!ua) return undefined;
  const browser =
    /Edg\/(\d+)/.exec(ua) ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}` :
    /OPR\/(\d+)/.exec(ua) ? `Opera ${/OPR\/(\d+)/.exec(ua)![1]}` :
    /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}` :
    /Chrome\/(\d+)/.exec(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}` :
    /Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+).*Safari/.exec(ua)![1]}` :
    "Unknown browser";
  const platform =
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Windows/.test(ua) ? "Windows" :
    /Linux|X11|CrOS/.test(ua) ? (/CrOS/.test(ua) ? "ChromeOS" : "Linux") :
    "unknown device";
  return `${browser} on ${platform}`;
}

/**
 * One attendee's browser reporting what only it can know — the bundle it is running, the connection
 * quality LiveKit gives it, and how many stage tracks it is actually subscribed to. The Diagnose
 * panel reads it beside the LiveKit participant row; between them, "never connected", "connected
 * and receiving nothing" and "receiving it badly" stop looking identical.
 *
 * Fail-soft and cheap: a heartbeat that cannot be written must never break a page an attendee is
 * watching a show on.
 */
export async function recordAttendeeClientHeartbeat(input: { eventId: string; sessionId: string; report: AttendeeClientReport }): Promise<AttendeeSession | undefined> {
  const store = getRuntimeStore();
  const session = await store.getAttendeeSession(input.eventId, input.sessionId).catch(() => undefined);
  if (!session || session.status !== "active") return undefined;
  // A preview has no session of its own, but nothing that writes is exempt from the rule.
  refusePreviewWrite(session.attendeeId, "report a client heartbeat");
  const now = new Date().toISOString();
  const quality = input.report.connectionQuality && QUALITIES.has(input.report.connectionQuality) ? input.report.connectionQuality : session.clientConnectionQuality;
  const updated: AttendeeSession = {
    ...session,
    lastSeenAt: now,
    clientBuildId: input.report.buildId || session.clientBuildId,
    clientBrowser: describeClient(input.report.userAgent) || session.clientBrowser,
    clientConnectionQuality: quality,
    clientSubscribedTracks: typeof input.report.subscribedTracks === "number" ? Math.max(0, Math.trunc(input.report.subscribedTracks)) : session.clientSubscribedTracks,
    clientSurface: input.report.surface || session.clientSurface,
    lastChatPollAt: input.report.chatPolled ? now : session.lastChatPollAt,
  };
  return store.upsertAttendeeSession(updated).catch(() => undefined);
}

/** The newest heartbeat per attendee for an event: one read behind the whole roster. */
export async function latestSessionsByAttendee(eventId: string): Promise<Map<string, AttendeeSession>> {
  const sessions = await getRuntimeStore().listAttendeeSessions(eventId).catch(() => [] as AttendeeSession[]);
  const latest = new Map<string, AttendeeSession>();
  for (const session of sessions) {
    const held = latest.get(session.attendeeId);
    if (!held || String(session.lastSeenAt || session.issuedAt) > String(held.lastSeenAt || held.issuedAt)) latest.set(session.attendeeId, session);
  }
  return latest;
}
