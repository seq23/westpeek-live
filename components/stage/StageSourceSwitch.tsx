"use client";

import { useActionState, useState } from "react";
import { switchStageSourceAction } from "@/lib/actions/goLiveActions";
import type { StageSourceSwitchResult } from "@/services/video/stageSourceSwitch";
import type { StageSourceChoice } from "@/types/stageStream";

const CHOICES: { value: StageSourceChoice; label: string }[] = [
  { value: "STREAMYARD", label: "StreamYard" },
  { value: "CAMERAS", label: "My camera" },
];

/** The sentence shown before a switch that takes a live StreamYard picture off the stage. */
export const TAKES_STREAMYARD_OFF = "StreamYard is live right now: switching takes its picture off the stage (StreamYard itself keeps running until you stop it there).";

/**
 * THE source switch, on the Go-live card (crew deck, Owner Console, Publish) and on the stage page
 * for hosts: "StreamYard" or "My camera", the current one marked, one tap to change, mid-show,
 * either way. The tapped button names its target, so a double tap asks for the same thing twice.
 */
export function StageSourceSwitch({ eventId, current, cameraLive, label, streamYardLive, deniedReason, testId = "stage-source-switch" }: {
  eventId: string;
  current: StageSourceChoice;
  /** The stage is live on cameras now (a chosen "My camera" after the show ended still goes live again). */
  cameraLive: boolean;
  /** stageSourceLabel() of the stage, the same words every other reader shows. */
  label: string;
  /** StreamYard's picture is on the stage right now (switching away needs the one sentence). */
  streamYardLive: boolean;
  deniedReason?: string;
  testId?: string;
}) {
  const [result, formAction, pending] = useActionState<StageSourceSwitchResult | null, FormData>(switchStageSourceAction, null);
  const [confirming, setConfirming] = useState(false);
  // The action revalidates this page, so `current` already carries the switch once it lands.
  const chosen = current;
  const disabled = pending || Boolean(deniedReason);
  return (
    <form action={formAction} className="mt-4 rounded-2xl border border-brand-line p-3" data-testid={testId} data-source={chosen} title={deniedReason}>
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-muted" id={`${testId}-heading`}>What the stage shows</p>
        <p className="text-xs font-bold text-brand-black" data-testid={`${testId}-label`}>{label}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-labelledby={`${testId}-heading`}>
        {CHOICES.map((choice) => {
          const on = chosen === choice.value;
          const inert = on && (choice.value === "STREAMYARD" || cameraLive);
          const needsSentence = choice.value === "CAMERAS" && !on && streamYardLive && !confirming;
          return (
            <button
              key={choice.value}
              type={needsSentence || inert ? "button" : "submit"}
              name="source"
              value={choice.value}
              aria-pressed={on}
              disabled={disabled}
              onClick={needsSentence ? () => setConfirming(true) : undefined}
              className={`min-h-11 rounded-full px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-brand-black text-white" : "border border-brand-line bg-white text-brand-black hover:border-brand-orange"}`}
              data-testid={`${testId}-${choice.value.toLowerCase()}`}
            >
              {on ? "✓ " : ""}{choice.label}
            </button>
          );
        })}
      </div>
      {confirming && chosen !== "CAMERAS" ? (
        <div className="mt-2 rounded-2xl bg-brand-ash p-3 text-sm" data-testid={`${testId}-confirm`}>
          <p>{TAKES_STREAMYARD_OFF}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" name="source" value="CAMERAS" disabled={disabled} onClick={() => setConfirming(false)} className="min-h-11 rounded-full bg-brand-black px-4 text-sm font-black text-white disabled:opacity-50" data-testid={`${testId}-confirm-cameras`}>Switch to my camera</button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-full border border-brand-line px-4 text-sm font-black">Keep StreamYard</button>
          </div>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-brand-muted" role="status" aria-live="polite" data-testid={`${testId}-message`} data-ok={result ? String(result.ok) : undefined}>
        {deniedReason || (pending ? "Switching…" : result?.message || (chosen === "CAMERAS" ? "The host and approved speakers are on the stage from their own cameras." : "My camera goes live at once from your own device; no StreamYard needed."))}
      </p>
    </form>
  );
}
