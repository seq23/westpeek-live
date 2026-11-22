import { LiveKitRoomClient } from "@/components/video/LiveKitRoomClient";
import { DailyVideoRoom } from "@/components/video/DailyVideoRoom";
import { buildResilientVideoJoinResult } from "@/services/video/livekitRoomUiService";
import { buildDefaultTokenPermissions } from "@/services/video";
import type { LiveKitRoomSurface } from "@/types/livekitRoomUi";
import type { VideoParticipantRole } from "@/types/video";

interface LiveKitRoomShellProps {
  eventId: string;
  roomId: string;
  roomType: LiveKitRoomSurface;
  role: VideoParticipantRole;
  title: string;
  description: string;
}

export async function LiveKitRoomShell({ eventId, roomId, roomType, role, title, description }: LiveKitRoomShellProps) {
  const permissions = buildDefaultTokenPermissions(role);
  let joinResult: Awaited<ReturnType<typeof buildResilientVideoJoinResult>> | null = null;
  let setupError: string | null = null;

  try {
    joinResult = await buildResilientVideoJoinResult({
      eventId,
      roomId,
      roomType,
      role,
      displayName: `${role}-${eventId}`,
    });
  } catch (error) {
    setupError = error instanceof Error ? error.message : "LiveKit token setup failed.";
  }

  return (
    <main className="wpl-as-authored min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">LiveKit room</p>
          <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
          {joinResult?.room.provider === "daily" ? (
            <DailyVideoRoom
              roomUrl={joinResult.dailyUrl}
              title={title}
              description="Automatic in-platform backup room is active."
            />
          ) : joinResult?.livekitUrl ? (
            <LiveKitRoomClient
              serverUrl={joinResult.livekitUrl}
              token={joinResult.token.token}
              canPublishAudio={permissions.canPublishAudio}
              canPublishVideo={permissions.canPublishVideo}
              canShareScreen={permissions.canShareScreen}
            />
          ) : (
            <div className="rounded-3xl border border-amber-300/30 bg-amber-950/30 p-6">
              <p className="text-lg font-semibold text-amber-100">Video room is not ready.</p>
              <p className="mt-2 text-sm text-amber-50/80">
                {setupError ?? "Missing provider URL or token. Check LiveKit and Daily fallback configuration."}
              </p>
            </div>
          )}

          <aside className="rounded-3xl border border-white/10 bg-white/10 p-5">
            <h2 className="text-lg font-semibold">Connection plan</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Event</dt>
                <dd className="font-medium">{eventId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Room</dt>
                <dd className="font-medium">{joinResult?.room.providerRoomId ?? roomId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Provider</dt>
                <dd className="font-medium">{joinResult?.room.provider ?? "pending"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Surface</dt>
                <dd className="font-medium">{roomType.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Role</dt>
                <dd className="font-medium">{role}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-2xl bg-slate-950/70 p-4 text-sm">
              <p className="font-semibold text-white/80">Permissions</p>
              <ul className="mt-2 space-y-1 text-slate-300">
                <li>Audio: {permissions.canPublishAudio ? "publish" : "listen only"}</li>
                <li>Video: {permissions.canPublishVideo ? "publish" : "view only"}</li>
                <li>Screen share: {permissions.canShareScreen ? "allowed" : "disabled"}</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
