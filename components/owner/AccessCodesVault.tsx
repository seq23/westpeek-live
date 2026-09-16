import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { AccessCodesVaultTable, type VaultEvent } from "@/components/owner/AccessCodesVaultTable";
import { displayCode, guestGatePath } from "@/lib/access/accessCodes";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { getEnv } from "@/lib/env";
import { listEventRecords } from "@/services/events/eventRepository";

/**
 * The access-codes vault: every code for every event, behind the owner gate, so nobody has to keep
 * them in a document again. The four global gates are Cloudflare secrets — this page says SET or
 * NOT SET and names the command to change them; the Worker never echoes their value.
 */
const GLOBAL_GATES = [
  ["OWNER_MASTER_ACCESS_PASSWORD", "Owner master password", "Opens everything, every event."],
  ["OWNER_MASTER_ACCESS_PASSWORD_2", "Owner master password (second)", "The spare — Scooter's, or a rotation in progress."],
  ["OPERATOR_LAUNCHPAD_PASSWORD", "Operator launchpad password", "West Peek's own producers and staff."],
  ["CREW_ACCESS_PASSWORD", "Global crew password", "Opens the crew gate for any event when an event's own crew code is not used."],
] as const;

export async function AccessCodesVault() {
  const actor = await getWorkspaceActor();
  if (actor?.kind !== "owner") {
    return <p className="text-sm text-brand-muted" data-testid="vault-owner-only">The codes vault is behind the owner master key. An operator or crew session does not open it.</p>;
  }
  let env: ReturnType<typeof getEnv> | undefined;
  try { env = getEnv(); } catch { env = undefined; }
  const base = await appBaseUrl();
  const events = await listEventRecords({ includeArchived: true, includeSeed: false }).catch(() => []);
  const rows: VaultEvent[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    status: event.status,
    codes: [
      { field: "join", label: "Join code (attendees)", code: displayCode(event.joinCode), link: `${base}/events/${event.id}/register` },
      { field: "crew", label: "Crew", code: displayCode(event.accessCodes.crew), link: `${base}${guestGatePath(event, "crew")}` },
      { field: "speaker", label: "Speaker", code: displayCode(event.accessCodes.speaker), link: `${base}${guestGatePath(event, "speaker")}` },
      { field: "sponsor", label: "Sponsor", code: displayCode(event.accessCodes.sponsor), link: `${base}${guestGatePath(event, "sponsor")}` },
      { field: "vip", label: "VIP", code: displayCode(event.accessCodes.vip), link: `${base}${guestGatePath(event, "vip")}` },
      { field: "client", label: "Client", code: displayCode(event.accessCodes.client), link: `${base}${guestGatePath(event, "client")}` },
    ].filter((code) => Boolean(code.code)),
  }));
  return (
    <div className="space-y-4">
      <ul className="grid gap-2 text-sm md:grid-cols-2" data-testid="vault-global-gates">
        {GLOBAL_GATES.map(([key, label, blurb]) => {
          const set = Boolean(env && String((env as unknown as Record<string, string | undefined>)[key] || "").trim());
          return (
            <li key={key} className="rounded-2xl border border-brand-line p-3" data-testid={`vault-gate-${key}`} data-set={set ? "true" : "false"}>
              <p className="font-black">{label} <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${set ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{set ? "set" : "not set"}</span></p>
              <p className="mt-1 text-xs text-brand-muted">{blurb} The value is a Cloudflare secret and is never shown here.</p>
              <code className="mt-2 block break-all rounded-xl bg-brand-ash p-2 text-[11px]">npx wrangler secret put {key}</code>
            </li>
          );
        })}
      </ul>
      {rows.length ? <AccessCodesVaultTable events={rows} /> : <p className="text-sm text-brand-muted" data-testid="vault-empty">No events yet — codes appear the moment you create one.</p>}
    </div>
  );
}
