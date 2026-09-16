"use client";
import { useEffect, useState, type ReactNode } from "react";

/**
 * On a wide screen the chat is the rail beside the video. On a phone it is a bottom sheet behind
 * one button, because a column stacked under the player put the conversation a thousand pixels
 * below the show and nobody scrolled that far (the owner, 16 Sep 2026). Same server-rendered chat
 * either way, mounted once, so opening the sheet is not a reload.
 */
export function StageChatSheet({ children, unreadHint }: { children: ReactNode; unreadHint?: string }) {
  const [open, setOpen] = useState(false);
  // The sheet takes the screen, so the page behind it must not scroll under it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return (
    <>
      <div className="hidden xl:block">{children}</div>
      <div className="xl:hidden">
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-950" data-testid="stage-chat-open">
          <span>Chat with everyone watching</span>
          <span className="text-xs font-bold text-slate-500">{unreadHint || "Open"}</span>
        </button>
        {open ? (
          <div className="fixed inset-0 z-40 flex flex-col bg-black/40" role="dialog" aria-modal="true" aria-label="Live chat" data-testid="stage-chat-sheet">
            <button type="button" className="flex-1" aria-label="Close chat" onClick={() => setOpen(false)} />
            <div className="max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-orange">Live chat</span>
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full px-4 text-sm font-black text-slate-700" data-testid="stage-chat-close">Close</button>
              </div>
              {children}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
