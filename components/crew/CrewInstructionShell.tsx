import type { ReactNode } from "react";
import Link from "next/link";
import { crewBriefing, crewCallTimesFor, normalizeCrewEventId } from "@/lib/crew/crewBriefing";
import { getEvent } from "@/lib/runtime/getRuntimeData";
import { peekOverlayEvent } from "@/services/events/runtimeEventOverlay";
import { getCrewViewer, type CrewViewer } from "@/lib/auth/crewViewer";

const nav = [
  ["Crew Home", ""],
  ["Call Sheet", "call-sheet"],
  ["Run of Show", "run-of-show"],
  ["Tasks", "tasks"],
];

export async function CrewInstructionShell({
  eventId,
  active,
  title,
  eyebrow,
  children,
}: {
  eventId: string;
  active: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const canonicalEventId = normalizeCrewEventId(eventId);
  const event = getEvent(canonicalEventId);
  const overlay = peekOverlayEvent(canonicalEventId);
  const callTimes = crewCallTimesFor(overlay);
  const viewer = await getCrewViewer(canonicalEventId);
  const eventName = event.name || crewBriefing.eventName;

  return (
    <main className="min-h-screen bg-brand-ash px-5 py-8 text-brand-black sm:px-8">
      <section className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-brand-line bg-white p-6 shadow-brand sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-brand-orange">{eyebrow}</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-brand-muted">
                {eventName} · Event ID: {canonicalEventId} · <span data-testid="crew-call-times" data-source={callTimes.source}>Call time: {callTimes.callTime} · Show start: {callTimes.showStart}</span>
              </p>
            </div>
            <a className="rounded-full border border-brand-black px-5 py-3 text-sm font-bold" href={`mailto:${crewBriefing.escalationEmail}`}>
              Escalate to support
            </a>
          </div>

          <CrewRoleBadge viewer={viewer} eventName={eventName} eventCode={overlay?.joinCode || canonicalEventId} />

          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Crew show-day navigation">
            {nav.map(([label, suffix]) => {
              const href = suffix ? `/crew/events/${canonicalEventId}/${suffix}` : `/crew/events/${canonicalEventId}`;
              const selected = active === suffix || (!suffix && active === "home");
              return (
                <Link
                  key={label}
                  href={href}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    selected ? "bg-brand-black text-white" : "border border-brand-line bg-white text-brand-black hover:border-brand-orange hover:text-brand-orange"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {children}
      </section>
    </main>
  );
}

/**
 * "You are in as Technical Director · Final e2e Room", what that role may do, and the way back
 * to the crew gate with the event code prefilled to switch role. Owner and operator cookies read
 * as such. On every crew page through the shell.
 */
export function CrewRoleBadge({ viewer, eventName, eventCode }: { viewer: CrewViewer; eventName: string; eventCode: string }) {
  const switchHref = `/production-access/crew?event=${encodeURIComponent(eventCode)}${viewer.role ? `&role=${encodeURIComponent(viewer.role)}` : ""}`;
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-brand-line bg-brand-ash p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="crew-role-badge" data-viewer-kind={viewer.kind} data-viewer-role={viewer.role || viewer.kind} data-is-host={viewer.isHost ? "true" : "false"}>
      <div>
        <p className="text-sm font-black text-brand-black"><span data-testid="crew-role-label">You are in as {viewer.label}</span> · {eventName}{viewer.isHost ? <span className="ml-2 rounded-full bg-brand-orange px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white" data-testid="crew-host-pill">Host</span> : null}</p>
        <p className="mt-1 text-xs leading-5 text-brand-muted" data-testid="crew-role-description">{viewer.description}</p>
      </div>
      {viewer.kind === "crew" || viewer.kind === "none" ? <Link href={switchHref} className="shrink-0 rounded-full border border-brand-black px-4 py-2 text-xs font-bold hover:border-brand-orange hover:text-brand-orange" data-testid="crew-switch-role">Switch role</Link> : null}
    </div>
  );
}

export function CrewBriefingPanel() {
  return (
    <section className="grid gap-4 lg:grid-cols-2" data-testid="crew-briefing-panel">
      {crewBriefing.sections.map((section) => (
        <article key={section.title} className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black tracking-tight">{section.title}</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-brand-muted">
            {section.items.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </article>
      ))}
    </section>
  );
}
