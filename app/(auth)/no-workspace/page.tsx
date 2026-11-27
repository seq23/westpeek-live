import Link from "next/link";
import { logout } from "@/lib/auth/actions";

/**
 * Where a signed-in account with no agency membership lands (lib/auth/workspaceMembership.ts). It
 * shows nothing of any workspace: no names, no events, no counts. Public by design, so it is outside
 * the middleware matcher and safe to open with no cookie at all.
 */
export const metadata = { title: "Ask to be added to a workspace · West Peek Live!", robots: { index: false } };

export default function NoWorkspacePage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="no-workspace">
        <p className="text-sm font-medium text-slate-500">West Peek Live!</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Ask to be added to a workspace</h1>
        <p className="mt-2 text-slate-600">You are signed in, but your account is not part of an agency&apos;s workspace yet. Ask the West Peek team or the agency running your event to add you. Once you are added, log in again to open the workspace.</p>
        <form action={logout} className="mt-6">
          <button type="submit" className="min-h-11 w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Log out</button>
        </form>
        <Link className="mt-4 block text-sm text-slate-500" href="/">Back to West Peek Live!</Link>
      </div>
    </main>
  );
}
