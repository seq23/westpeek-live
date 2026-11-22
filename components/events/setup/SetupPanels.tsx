import type { ReactNode } from "react";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function BasicsSetupPanel({ event }: { event: { id: string; slug: string; name: string; client: string; timezone: string; state: string; publicCode: string } }) {
  return <div className="grid gap-4 md:grid-cols-2"><Row label="Event" value={event.name} /><Row label="Client" value={event.client} /><Row label="Timezone" value={event.timezone} /><Row label="Public code" value={event.publicCode} /><Row label="Slug" value={event.slug} /><Row label="State" value={event.state} /></div>;
}

export function BrandingSetupPanel({ branding }: { branding: { logo: string; hero: string; theme: string } }) {
  return <div className="grid gap-4 md:grid-cols-3"><Row label="Logo" value={branding.logo} /><Row label="Hero" value={branding.hero} /><Row label="Theme" value={branding.theme} /></div>;
}

export function AttendeeFlowSetupPanel({ attendee }: { attendee: { joinStates: string[]; defaultDestination: string; supportEnabled: boolean } }) {
  return <div className="space-y-4"><Row label="Default destination" value={attendee.defaultDestination} /><Row label="Support enabled" value={attendee.supportEnabled ? "Yes" : "No"} /><div className="grid gap-2 md:grid-cols-3">{attendee.joinStates.map((state) => <span key={state} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{state.replaceAll("_", " ")}</span>)}</div></div>;
}

export function VenueModulesSetupPanel() {
  const modules = ["Lobby", "Main stage", "Sessions", "Expo", "Networking", "Replay", "Help center"];
  return <div className="grid gap-3 md:grid-cols-2">{modules.map((module) => <Row key={module} label={module} value="Enabled in venue route family" />)}</div>;
}

export function AgendaSetupPanel({ sessions }: { sessions: Array<Record<string, string>> }) {
  return <div className="space-y-3">{sessions.map((session) => <Row key={session.id} label={session.title || session.id} value={`${session.room || "room pending"} · ${session.startsAt || "time pending"}`} />)}</div>;
}

export function AccessSetupPanel({ crewKey, roles }: { crewKey: string; roles: Array<{ role: string; envKey: string; destinationTemplate: string }> }) {
  return <div className="space-y-4"><Row label="Crew password env key" value={crewKey} /><div className="grid gap-3 md:grid-cols-2">{roles.map((role) => <Row key={role.role} label={role.role.replaceAll("_", " ")} value={`${role.envKey} → ${role.destinationTemplate}`} />)}</div></div>;
}

export function EventPreviewPanel({ paths }: { paths: string[] }) {
  return <div className="grid gap-3 md:grid-cols-2">{paths.map((path) => <a key={path} href={path} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-brand-orange hover:border-brand-orange">{path}</a>)}</div>;
}
