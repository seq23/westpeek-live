"use client";
import { useState } from "react";
import { BrowserDiagnosticsPanel } from "@/components/testing/BrowserDiagnosticsPanel";
import { recordSpeakerTechCheckAction } from "@/lib/actions/guestActions";
import type { BrowserDiagnosticResult, BrowserReadinessSummary } from "@/types/browserDiagnostics";
import type { SpeakerTechCheckState } from "@/types/specialGuest";

function toRecord(summary: BrowserReadinessSummary, results: BrowserDiagnosticResult[]) {
  const status: SpeakerTechCheckState["status"] = summary.status === "ready" ? "ready" : summary.status === "monitor" ? "warnings" : "not_ready";
  return JSON.stringify({ status, score: summary.score, checks: results.map((result) => ({ kind: result.kind, status: result.status, summary: result.summary })) });
}

/**
 * The speaker's tech check: the same camera / microphone / speaker / browser diagnostics the crew
 * use on the testing console, plus one button that records the outcome on the speaker's roster row.
 */
export function SpeakerTechCheckLive({ eventId, previous, recorded }: { eventId: string; previous?: SpeakerTechCheckState; recorded?: boolean }) {
  const [snapshot, setSnapshot] = useState<{ summary: BrowserReadinessSummary; results: BrowserDiagnosticResult[] } | null>(null);
  return (
    <div className="space-y-4" data-testid="speaker-tech-check">
      {recorded ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900" data-testid="speaker-tech-check-recorded">Your tech check is recorded. The crew can see it on your roster row.</p> : null}
      {previous ? <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700" data-testid="speaker-tech-check-previous" data-status={previous.status}>Last recorded: <strong>{previous.status.replaceAll("_", " ")}</strong> ({previous.score}/100) at {new Date(previous.recordedAt).toLocaleString()}.</p> : null}
      <BrowserDiagnosticsPanel eventId={eventId} onResultsChange={(summary, results) => setSnapshot({ summary, results })} />
      <form action={recordSpeakerTechCheckAction} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="results" value={snapshot ? toRecord(snapshot.summary, snapshot.results) : JSON.stringify({ status: "not_ready", score: 0, checks: [] })} />
        <p className="text-sm font-black text-slate-950">Record my tech check</p>
        <p className="mt-1 text-sm text-slate-600">{snapshot ? `${snapshot.results.length} check${snapshot.results.length === 1 ? "" : "s"} run · readiness ${snapshot.summary.status.replaceAll("_", " ")} (${snapshot.summary.score}/100).` : "Run the checks above first; the result is what the crew will see."}</p>
        <button className="mt-3 rounded-full bg-brand-black px-5 py-3 text-sm font-bold text-white hover:bg-brand-orange" data-testid="record-tech-check">Record my tech check</button>
      </form>
    </div>
  );
}
