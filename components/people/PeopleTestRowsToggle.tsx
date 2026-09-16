"use client";
import { useEffect, useState } from "react";

/**
 * "Show test rows": remembered per browser, off by default. The owner's real network is the page;
 * our fixtures are a drawer she opens when she wants to see what the suites left behind.
 */
export function PeopleTestRowsToggle({ testCount, children }: { testCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { setOpen(window.localStorage.getItem("wpl-people-show-test-rows") === "1"); } catch { /* private window */ }
    setHydrated(true);
  }, []);
  function toggle() {
    setOpen((value) => {
      const next = !value;
      try { window.localStorage.setItem("wpl-people-show-test-rows", next ? "1" : "0"); } catch { /* private window */ }
      return next;
    });
  }
  if (!testCount) return null;
  return (
    <div className="mt-6" data-testid="people-test-rows" data-open={open ? "true" : "false"} data-hydrated={hydrated ? "true" : "false"} data-count={testCount}>
      <button type="button" onClick={toggle} className="rounded-full border border-slate-300 px-4 py-2 text-xs font-black text-slate-800" data-testid="people-test-rows-toggle">
        {open ? `Hide test rows (${testCount})` : `Show test rows (${testCount})`}
      </button>
      <p className="mt-2 text-xs text-slate-500">These are our own Playwright and Tier-4 fixtures — test addresses and seed events. They are never part of the count above.</p>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
