"use client";

import { useMemo, useState } from "react";
import type { WhiteLabelVideoRoomConfig } from "@/types/whiteLabelVideo";

type ZoomEmbeddedRoomProps = {
  config: WhiteLabelVideoRoomConfig;
  eventId: string;
  userName?: string;
  userEmail?: string;
};

type ZoomEmbeddedClient = {
  init: (args: Record<string, unknown>) => Promise<void>;
  join: (args: Record<string, unknown>) => Promise<void>;
};

declare global {
  interface Window {
    ZoomMtgEmbedded?: {
      createClient: () => ZoomEmbeddedClient;
    };
  }
}

const ZOOM_EMBEDDED_CDN = "https://source.zoom.us/zoom-meeting-embedded-3.11.0.min.js";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Embedded room script could not load."));
    document.body.appendChild(script);
  });
}

export function ZoomEmbeddedRoom({ config, eventId, userName = "Guest", userEmail }: ZoomEmbeddedRoomProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "joined" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const meetingNumber = useMemo(() => config.zoomMeetingNumber?.replace(/\s/g, ""), [config.zoomMeetingNumber]);

  async function joinRoom() {
    if (!meetingNumber) {
      setStatus("error");
      setMessage("This room is not ready yet. Please return to the lobby or ask the production team for help.");
      return;
    }

    setStatus("loading");
    setMessage("Opening your West Peek Live! room…");

    try {
      await loadScript(ZOOM_EMBEDDED_CDN);

      if (!window.ZoomMtgEmbedded) {
        throw new Error("Embedded room client is unavailable.");
      }

      const response = await fetch("/api/video/zoom-signature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId, meetingNumber, zoomRole: 0, videoRole: "attendee" }),
      });

      if (!response.ok) {
        throw new Error("Room authorization could not be prepared.");
      }

      const json = await response.json();
      const sdkKey = json.result?.sdkKey || json.sdkKey;
      const signature = json.result?.signature || json.signature;
      if (!sdkKey || !signature) throw new Error("Room authorization could not be completed.");
      const client = window.ZoomMtgEmbedded.createClient();
      const root = document.getElementById("west-peek-zoom-room");

      if (!root) {
        throw new Error("Room container is unavailable.");
      }

      // White-labelled as far as Zoom's own SDK allows. `meetingInfo: []` removes Zoom's meeting
      // information panel — the topic, the meeting number and the passcode — so the only name on
      // this page is the event's, in our header above. `toolbar.buttons: []` drops Zoom's extra
      // toolbar apps. What the SDK gives us NO way to suppress: the Zoom logo on the joining and
      // reconnecting screens, the "powered by Zoom" mark in the video footer, Zoom's own error and
      // permission dialogs, and the meeting topic as it was typed in Zoom (only the account that
      // created the meeting can change that, so name the meeting after the event there).
      await client.init({
        zoomAppRoot: root,
        language: "en-US",
        patchJsMedia: true,
        leaveOnPageUnload: true,
        customize: {
          meetingInfo: [],
          toolbar: { buttons: [] },
          video: {
            isResizable: true,
            viewSizes: {
              default: {
                width: 960,
                height: 540,
              },
            },
          },
        },
      });

      await client.join({
        sdkKey,
        signature,
        meetingNumber,
        password: config.zoomMeetingPassword ?? "",
        userName,
        userEmail,
      });

      setStatus("joined");
      setMessage("Room open.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "This room could not open. Please ask the production team for help."
      );
    }
  }

  return (
    <section className="rounded-[2rem] border border-brand-line bg-white p-4 shadow-brand sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-orange">West Peek Live! room</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-brand-black">{config.roomLabel}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
            This room opens inside West Peek Live! so attendees stay inside the event venue, with the chat, the attendee list and networking still on this page. Nobody can be brought onto the West Peek stage from here.
          </p>
        </div>
        {status !== "joined" ? (
          <button
            type="button"
            onClick={joinRoom}
            disabled={status === "loading"}
            className="rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white hover:bg-brand-charcoal disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "Opening room…" : "Enter room"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${status === "error" ? "bg-red-50 text-red-700" : "bg-brand-orangeSoft text-brand-black"}`}>
          {message}
        </p>
      ) : null}

      <div
        id="west-peek-zoom-room"
        className="mt-5 min-h-[420px] overflow-hidden rounded-3xl border border-brand-line bg-brand-black/95"
      />
    </section>
  );
}
