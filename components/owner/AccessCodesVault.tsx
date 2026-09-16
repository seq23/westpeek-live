import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { AccessCodesVaultTable, type VaultEvent } from "@/components/owner/AccessCodesVaultTable";
import { GlobalGatesPanel } from "@/components/owner/GlobalGatesPanel";
import { displayCode, guestGatePath } from "@/lib/access/accessCodes";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { getEnv } from "@/lib/env";
import { listEventRecords } from "@/services/events/eventRepository";

/**
 * The access-codes vault: every code for every event, behind the owner gate, so nobody has to keep
 * them in a document again. The four global gates are Cloudflare secrets — this page says SET or
 * NOT SET and names the command to change them; the Worker never echoes their value.
 */
/**
 * The three gate passwords the owner needs to hand out or type again, and the spare, which stays
 * unrevealed on purpose. The owner cookie is the only thing that reaches this component at all:
 * the values are never serialised into a page a non-owner can load.
 */
const SHOWN_GATES = [
  ["OWNER_MASTER_ACCESS_PASSWORD", "Owner master password", "Opens everything, every event."],
  ["OPERATOR_LAUNCHPAD_PASSWORD", "Operator launchpad password", "West Peek's own producers and staff."],
  ["CREW_ACCESS_PASSWORD", "Global crew password", "Opens the crew gate for any event when an event's own crew code is not used."],
] as const;

const SPARE_GATE = ["OWNER_MASTER_ACCESS_PASSWORD_2", "Owner master password — spare key", "Held separately; the value is not shown here."] as const;

export async function AccessCodesVault() {
  const actor = await getWorkspaceActor();
  if (actor?.kind !== "owner") {
    return <p className="text-sm text-brand-muted" data-testid="vault-owner-only">The codes vault is behind the owner master key. An operator or crew session does not open it.</p>;
  }
  let env: ReturnType<typeof getEnv> | undefined;
  try { env = getEnv(); } catch { env = undefined; }
  const value = (key: string) => String((env as unknown as Record<string, string | undefined> | undefined)?.[key] || "").trim();
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
  const gates = SHOWN_GATES.map(([key, label, blurb]) => ({ key, label, blurb, value: value(key) }));
  const spareSet = Boolean(value(SPARE_GATE[0]));
  return (
    <div className="space-y-4">
      <GlobalGatesPanel gates={gates} spare={{ key: SPARE_GATE[0], label: SPARE_GATE[1], blurb: SPARE_GATE[2], set: spareSet }} />
      {rows.length ? <AccessCodesVaultTable events={rows} /> : <p className="text-sm text-brand-muted" data-testid="vault-empty">No events yet — codes appear the moment you create one.</p>}
    </div>
  );
}
