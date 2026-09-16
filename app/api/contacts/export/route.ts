import { NextResponse } from "next/server";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { contactsCsv, listContacts, listHashOnlyPeople } from "@/services/attendees/contactsService";

export const dynamic = "force-dynamic";

/** CSV of people across events. Owner cookie only: emails are personal data. */
export async function GET() {
  const actor = await getWorkspaceActor();
  if (actor?.kind !== "owner") return NextResponse.json({ ok: false, error: "Owner access required." }, { status: 403 });
  // Contacts first, then people whose registration predates the raw email (blank email column, never left out).
  const csv = contactsCsv(await listContacts().catch(() => []), await listHashOnlyPeople().catch(() => []));
  return new NextResponse(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="west-peek-people-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
