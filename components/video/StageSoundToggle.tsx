"use client";

/**
 * Sound is an icon on the picture, not a labelled button: a speaker means sound is on, the same
 * speaker with a slash through it means muted (the owner's spec, 16 Sep 2026). The words only
 * appear in the one case where the browser will not let us start audio on its own — then "Tap for
 * sound" sits beside the icon, because the tap really is the only thing that will fix it. It never
 * promises sound will start by itself.
 */
export function StageSoundToggle({ soundOff, needsGesture, onToggle }: { soundOff: boolean; needsGesture: boolean; onToggle: () => void }) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={soundOff ? "Unmute" : "Mute"}
        aria-pressed={soundOff}
        data-testid="stage-sound-toggle"
        data-sound-state={soundOff ? "off" : "on"}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" />
          {soundOff ? <path d="M3 3 21 21" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19.5 5.5a9 9 0 0 1 0 13" /></>}
        </svg>
      </button>
      {needsGesture ? <span className="rounded-full bg-black/65 px-3 py-1 text-xs font-black text-white backdrop-blur" data-testid="stage-sound-hint">Tap for sound</span> : null}
    </div>
  );
}
