import { NextResponse } from "next/server";
import { getCrewViewer } from "@/lib/auth/crewViewer";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { findEventRecord } from "@/services/events/eventRepository";
import { ensureRuntimeEvent } from "@/services/events/runtimeEventOverlay";
import { venueGateFor } from "@/services/venue/venueStateGate";
import { getPublicStageStreamState } from "@/services/video/stageStreamStateService";

export const dynamic = "force-dynamic";

/**
 * The venue's gate for THIS caller, polled (~10s) by every venue page: when End the show (or
 * Archive, or Publish) changes the event, the open page refreshes itself into the ended /
 * archived / open state without a manual reload. Public read; nothing here is secret.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "";
  const surface = url.searchParams.get("surface") === "replay" ? "replay" : "other";
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId is required." }, { status: 400 });
  await ensureRuntimeEvent(eventId);
  const [event, stage, actor, viewer] = await Promise.all([
    findEventRecord(eventId).catch(() => undefined),
    getPublicStageStreamState(eventId, "main-stage").catch(() => undefined),
    getWorkspaceActor(),
    getCrewViewer(eventId),
  ]);
  const stageEnded = stage?.streamStatus === "ENDED";
  const gate = venueGateFor({ status: event?.status, stageEnded, isHost: Boolean(actor) || viewer.isHost, surface });
  return NextResponse.json({ ok: true, eventId, status: event?.status || null, stageStatus: stage?.streamStatus || null, gate }, { headers: { "cache-control": "no-store" } });
}
