import Link from "next/link";
import { SectionCard } from "@/components/shared/SectionCard";
import { HouseDefaultsPanel } from "@/components/settings/HouseDefaultsPanel";
import { RuntimeSchemaStop } from "@/components/system/RuntimeSchemaStop";
import { saveAgencySettingsAction } from "@/lib/actions/agencySettingsActions";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { getAgencySettings } from "@/services/agencies/agencySettingsService";
import { getRuntimeSchemaStatus } from "@/services/events/eventRepository";

export const dynamic = "force-dynamic";

const MEMBER_ROWS = 6;

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ saved?: string; savedDefaults?: string; error?: string }> }) {
  const search = searchParams ? await searchParams : undefined;
  const [settings, schema, actor] = await Promise.all([getAgencySettings(), getRuntimeSchemaStatus(), getWorkspaceActor()]);
  const rows = Array.from({ length: MEMBER_ROWS }, (_, index) => settings.members[index] || { name: "", email: "", role: "" });
  const ownerOnly = actor?.kind !== "owner" && actor?.kind !== "user";
  return (
    <div className="space-y-6">
      {!schema.ok ? <RuntimeSchemaStop status={schema} /> : null}
      {search?.saved ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="settings-saved">Settings saved by {settings.updatedByLabel}.</p> : null}
      {search?.savedDefaults ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" data-testid="house-defaults-saved">House defaults saved.</p> : null}
      {search?.error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800" data-testid="settings-error">{search.error}</p> : null}
      <SectionCard title="Agency settings" eyebrow="Configuration">
        <p className="text-sm text-slate-600">The name on the door, the two brand colours, and who is on the team. Stored on the agency settings row and read by the workspace. What we pay for — LiveKit Ship, Workers Paid, Cloudflare Stream by the minute — is not a panel here; the readout at <Link href="/app/capacity" className="font-black underline">/app/capacity</Link> is where you see what those plans include and how close a show is to the edge of one.</p>
        <form action={saveAgencySettingsAction} className="mt-5 space-y-6" data-testid="agency-settings-form">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Agency name
              <input name="agencyName" defaultValue={settings.agencyName} required className="mt-1 w-full rounded-xl border border-slate-200 p-2" data-testid="settings-agency-name" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Primary colour
              <span className="mt-1 flex items-center gap-2"><input name="primaryColor" defaultValue={settings.primaryColor} pattern="^#[0-9a-fA-F]{6}$" required className="w-full rounded-xl border border-slate-200 p-2" /><span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: settings.primaryColor }} aria-hidden /></span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Accent colour
              <span className="mt-1 flex items-center gap-2"><input name="accentColor" defaultValue={settings.accentColor} pattern="^#[0-9a-fA-F]{6}$" required className="w-full rounded-xl border border-slate-200 p-2" /><span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: settings.accentColor }} aria-hidden /></span>
            </label>
          </div>
          <div>
            <p className="text-sm font-black text-slate-950">Members</p>
            <p className="mt-1 text-xs text-slate-500">Names, emails, and roles for the people who run West Peek Live. This is a roster, not a login list: the owner enters with the owner master password and staff logins remain Supabase Auth.</p>
            <div className="mt-3 space-y-2">
              {rows.map((member, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-3">
                  <input name={`member-${index}-name`} defaultValue={member.name} placeholder="Name" aria-label={`Member ${index + 1} name`} className="rounded-xl border border-slate-200 p-2 text-sm" />
                  <input name={`member-${index}-email`} defaultValue={member.email} placeholder="Email" type="email" aria-label={`Member ${index + 1} email`} className="rounded-xl border border-slate-200 p-2 text-sm" />
                  <input name={`member-${index}-role`} defaultValue={member.role} placeholder="Role (owner, producer, VA…)" aria-label={`Member ${index + 1} role`} className="rounded-xl border border-slate-200 p-2 text-sm" />
                </div>
              ))}
            </div>
          </div>
          <button type="submit" disabled={!schema.ok || ownerOnly} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" data-testid="settings-save">Save settings</button>
          {ownerOnly ? <p className="text-xs text-slate-500">Only the owner (or a signed-in staff member) can change settings.</p> : null}
        </form>
      </SectionCard>
      <HouseDefaultsPanel disabled={!schema.ok || ownerOnly} />
    </div>
  );
}
