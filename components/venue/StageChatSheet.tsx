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
  // ONE mount of the chat, whatever the width: the same element is the rail on a wide screen and
  // the sheet's body on a phone. It used to render the chat twice once the sheet opened (the hidden
  // rail and the sheet), so a phone ran two chat polls and every chat control existed twice.
  return (
    <>
      <div className="xl:hidden">
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-950" data-testid="stage-chat-open" aria-expanded={open}>
          <span>Chat with everyone watching</span>
          <span className="text-xs font-bold text-slate-500">{unreadHint || "Open"}</span>
        </button>
      </div>
      <div
        className={open ? "fixed inset-0 z-40 flex flex-col bg-black/40 xl:static xl:z-auto xl:block xl:bg-transparent" : "hidden xl:block"}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Live chat" : undefined}
        data-testid={open ? "stage-chat-sheet" : "stage-chat-rail"}
      >
        {open ? <button type="button" className="flex-1 xl:hidden" aria-label="Close chat" onClick={() => setOpen(false)} /> : null}
        <div className={open ? "max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-3 xl:max-h-none xl:overflow-visible xl:rounded-none xl:bg-transparent xl:p-0" : undefined}>
          {open ? (
            <div className="mb-2 flex items-center justify-between xl:hidden">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-orange">Live chat</span>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full px-4 text-sm font-black text-slate-700" data-testid="stage-chat-close">Close</button>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </>
  );
}
