"use client";

import { useState } from "react";
import {
  ConnectionStateToast,
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

interface LiveKitRoomClientProps {
  serverUrl: string;
  token: string;
  canPublishAudio: boolean;
  canPublishVideo: boolean;
  canShareScreen: boolean;
}

function ParticipantGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout tracks={tracks} className="min-h-[420px] rounded-2xl bg-slate-950/70 p-3">
      <ParticipantTile />
    </GridLayout>
  );
}

export function LiveKitRoomClient({
  serverUrl,
  token,
  canPublishAudio,
  canPublishVideo,
  canShareScreen,
}: LiveKitRoomClientProps) {
  const [connect, setConnect] = useState(false);
  const [connectionNote, setConnectionNote] = useState("Ready to connect");

  return (
    <div className="wpl-as-authored rounded-3xl border border-white/10 bg-black/40 p-6">
      {!connect ? (
        <div className="wpl-as-authored flex aspect-video flex-col items-center justify-center rounded-2xl border border-brand-orange/30 bg-slate-900 p-6 text-center">
          <p className="text-lg font-semibold">LiveKit room is ready</p>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            A server-issued LiveKit token is available. Join when the producer is ready to start the room session.
          </p>
          <button
            type="button"
            onClick={() => setConnect(true)}
            className="mt-5 rounded-full bg-brand-orange px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#d94d13]"
          >
            Join LiveKit room
          </button>
        </div>
      ) : (
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect={connect}
          audio={canPublishAudio}
          video={canPublishVideo}
          screen={canShareScreen}
          onConnected={() => setConnectionNote("Connected")}
          onDisconnected={() => setConnectionNote("Disconnected")}
          onError={(error) => setConnectionNote(error.message)}
          className="space-y-4"
        >
          <ConnectionStateToast />
          <ParticipantGrid />
          <RoomAudioRenderer />
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-3">
            <p className="mb-3 text-sm text-slate-300">Status: {connectionNote}</p>
            <ControlBar controls={{ screenShare: canShareScreen }} />
          </div>
        </LiveKitRoom>
      )}
    </div>
  );
}
