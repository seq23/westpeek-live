import { NextResponse } from "next/server";
import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { contactsCsv } from "@/services/attendees/contactsService";
import { peopleDirectory } from "@/services/attendees/peopleDirectoryService";

export const dynamic = "force-dynamic";

/** CSV of people across events. Owner cookie only: emails are personal data. */
export async function GET(request: Request) {
  const actor = await getWorkspaceActor();
  if (actor?.kind !== "owner") return NextResponse.json({ ok: false, error: "Owner access required." }, { status: 403 });
  // Real people by default — our own test fixtures only with ?includeTest=1. Contacts first, then
  // the people whose registration predates the raw email (blank email column, never left out).
  const includeTest = new URL(request.url).searchParams.get("includeTest") === "1";
  const directory = await peopleDirectory().catch(() => undefined);
  const contacts = [...(directory?.real.contacts || []), ...(includeTest ? directory?.test.contacts || [] : [])];
  const hashOnly = [...(directory?.real.hashOnly || []), ...(includeTest ? directory?.test.hashOnly || [] : [])];
  const csv = contactsCsv(contacts, hashOnly);
  return new NextResponse(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="west-peek-people-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" } });
}
