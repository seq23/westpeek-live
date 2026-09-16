import { NextResponse } from "next/server";
import { requireOperatorAccessForRequest } from "@/lib/auth/operatorRequestGuard";
import { getOperatorStageStreamState, getPublicStageStreamState } from "@/services/video/stageStreamStateService";
import { reconcileIngressWithLiveKit } from "@/services/video/livekitIngressService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId") || "event-summit";
  const stageId = url.searchParams.get("stageId") || "main-stage";
  const view = url.searchParams.get("view") || "attendee";
  // Ask LiveKit what the ingress is doing before answering; a webhook that never arrives must not
  // keep a live show on "getting ready" (15 Sep 2026).
  await reconcileIngressWithLiveKit(eventId, stageId).catch(() => undefined);
  if (view === "operator") {
    const operator = await requireOperatorAccessForRequest();
    if (!operator.ok) return NextResponse.json({ ok: false, error: operator.error }, { status: 401 });
    const state = await getOperatorStageStreamState(eventId, stageId);
    return NextResponse.json({ ok: true, state });
  }
  const state = await getPublicStageStreamState(eventId, stageId);
  return NextResponse.json({ ok: true, state });
}
