import { NextResponse } from "next/server";
import { readUnsubscribeToken, recordUnsubscribe } from "@/services/email/emailSuppressionService";

export const dynamic = "force-dynamic";

/**
 * Gmail's and Apple Mail's own unsubscribe button.
 *
 * Those clients POST here with `List-Unsubscribe=One-Click` and no cookies, no session and no human
 * looking at a page — RFC 8058. It must therefore work unauthenticated, must not require a
 * confirmation click, and must answer 200 quickly. The token is the whole authorisation: it is
 * signed, it carries the address, and it cannot be replayed for anybody else.
 *
 * The page at /unsubscribe is the same thing for a human, with a plain confirmation and a way back.
 */
async function unsubscribeFromToken(token: string | null) {
  if (!token) return NextResponse.json({ ok: false, error: "No token." }, { status: 400 });
  const email = await readUnsubscribeToken(token);
  if (!email) return NextResponse.json({ ok: false, error: "That unsubscribe link is not valid." }, { status: 400 });
  await recordUnsubscribe({ email, source: "one_click" });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token");
  if (!token) {
    // Some clients put the pair in the body instead of keeping the query string.
    const body = await request.text().catch(() => "");
    token = new URLSearchParams(body).get("token");
  }
  return unsubscribeFromToken(token);
}

/** A mail client that follows the link with a GET rather than posting still gets the person off the list. */
export async function GET(request: Request) {
  return unsubscribeFromToken(new URL(request.url).searchParams.get("token"));
}
