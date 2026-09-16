const fs = require("fs");

/**
 * View-as for special guests and the owner's Preview-a-guest landing (16 Sep 2026). Static contract:
 *   one pure rule (canViewAsGuest: owner, operator for the event, producer / executive_producer crew
 *   for the event; nobody else) shared by the middleware and the page resolver; the resolver checks
 *   the guest's role; every guest surface resolves ?viewAs and renders the banner with the guest's
 *   actions disabled; the special-guest gate's owner override lands on the preview page; the
 *   preview route is registered in every ledger; the proofs exist.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) {
  const body = read(file); examined += 1;
  const missing = tokens.filter((token) => !body.includes(token));
  if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`);
  return body;
}
const guard = check("lib/auth/viewAsGuard.ts", ["export function canViewAsGuest", 'crew.role === "producer" || crew.role === "executive_producer"', "export function isViewAsPath", "export function withViewAs"]);
if (/moderator|show_caller|technical_director|support|va"/.test(guard.slice(guard.indexOf("export function canViewAsGuest"), guard.indexOf("export const VIEW_AS_PATH_PREFIXES")))) throw new Error("canViewAsGuest must admit only producer / executive_producer crew roles.");
check("lib/auth/viewAs.ts", ["canViewAsGuest({ owner, operator, crew }, eventId)", "if (!viewer.ok) return undefined", "guest.role !== role) return undefined"]);
check("lib/auth/v5RouteAuthorization.ts", ["export function canViewAsAccessPath", "canViewAsGuest(payloads, pathEventId).ok"]);
check("middleware.ts", ['canViewAsAccessPath(pathname, request.nextUrl.searchParams.get("viewAs")']);
// The banner carries a second wording for a PREVIEW persona ("there is no them to hide it from"); both testids stay.
check("components/guests/ViewAsBanner.tsx", ["Viewing as {guest.name} — you are {viewer.label}; they can&rsquo;t see this banner.", '? "preview-banner" : "view-as-banner"', "Leave preview"]);
for (const page of ["app/speaker/events/[eventId]/page.tsx", "app/speaker/events/[eventId]/green-room/page.tsx", "app/speaker/events/[eventId]/teleprompter/page.tsx", "app/speaker/events/[eventId]/tech-check/page.tsx", "app/speaker/events/[eventId]/backstage/page.tsx"]) check(page, ['resolveViewAs(eventId, query?.viewAs, "speaker")', "viewAs={viewAs}"]);
check("app/sponsor/events/[eventId]/booth/page.tsx", ['resolveViewAs(eventId, query?.viewAs, "sponsor")', "viewAs={viewAs}"]);
check("app/venue/[eventId]/lobby/page.tsx", ['resolveViewAs(resolvedParams.eventId, resolvedSearchParams?.viewAs, "vip")', "<ViewAsBanner"]);
check("app/client/[clientSlug]/events/[eventId]/page.tsx", ['resolveViewAs(resolvedParams.eventId, query?.viewAs, "client")', "<ViewAsBanner"]);
// The guest's actions are disabled in preview.
check("components/speakers/SpeakerGreenRoomLive.tsx", ["disabled={readOnly}", "guest-room-video-preview-placeholder", "run-tech-check-disabled", "speakerId={viewAs}"]);
check("components/speakers/SpeakerCuePastePanel.tsx", ["<fieldset disabled={readOnly}", 'action={readOnly ? undefined : submitSpeakerCueDeckAction}']);
check("components/sponsors/SponsorPortalLive.tsx", ["<fieldset disabled={readOnly}", "<ViewAsBanner"]);
check("components/guests/GuestIdentityForm.tsx", ["<fieldset disabled={readOnly}"]);
check("components/speakers/SpeakerPortalShell.tsx", ["<ViewAsBanner", "withViewAs("]);
// The links, on the deck and the Access page; the preview landing; the gate's owner override.
check("components/guests/GuestPreviewLinks.tsx", ["Open their green room", "Open their teleprompter", "Open their booth", "Open their lobby", "Open their overview", "export async function GuestPreviewList", "guest-preview-empty"]);
check("components/moderation/SpeakerRosterPanel.tsx", ["<GuestPreviewLinkRow", 'viewer.role === "producer" || viewer.role === "executive_producer"']);
check("app/app/events/[eventId]/access/page.tsx", ["<GuestPreviewList"]);
check("app/production-access/special-guest/preview/page.tsx", ['if (owner?.kind !== "owner") redirect(`/production-access/owner?next=', "<GuestPreviewList", "preview-role-codes", "emptyHref={accessHref}"]);
check("app/production-access/special-guest/page.tsx", ["next: `/production-access/special-guest/preview?event=${encodeURIComponent(eventCode)}`"]);
check("app/api/production-access/special-guest/route.ts", ["next: `/production-access/special-guest/preview?event=${encodeURIComponent(eventCode)}`"]);
// Ledgers.
for (const [file, token] of [["config/deployed-route-manifest.json", '"id": "production-access-special-guest-preview"'], ["RUNTIME_ACTION_INVENTORY.json", '"id": "production-access-special-guest-preview"'], ["_hallmark_route_state_contract.json", '"id": "production-access-special-guest-preview"'], ["AUTHENTICATED_ROUTE_MANIFEST.md", "`production-access-special-guest-preview`"], ["VISIBLE_CONTROL_INVENTORY.md", "Open their green room / teleprompter / booth / lobby / overview (view as)"]]) check(file, [token]);
// Proofs.
check("tests/unit/viewAsGuard.test.ts", ["owner, operator, producer and executive producer may; every other role and cookie may not", "canViewAsAccessPath("]);
check("tests/e2e/view-as-and-preview.spec.ts", ["Viewing as Sam Speaker — you are the owner", 'toHaveURL(/\\/production-access\\/special-guest/)', "preview-guest-page", "guest-preview-empty"]);
if (examined < 25) throw new Error(`validate_view_as_contract examined only ${examined} files`);
console.log(`validate_view_as_contract: PASS — ${examined} files examined; static contract, the rule itself is proven by tests/unit/viewAsGuard.test.ts and tests/e2e/view-as-and-preview.spec.ts.`);
