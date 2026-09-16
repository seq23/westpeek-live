const fs = require("fs");

/**
 * Preview personas, "Enter the room as…", Diagnose and "See their view" (16 Sep 2026).
 *
 * The four rules this enforces statically, each of which failed silently before it existed:
 *   1. WRITES — every service that writes something another human could see calls
 *      `refusePreviewWrite` at its top. A new write path that forgets is the only way a preview
 *      could leave a trace, so the list below is checked by name and the count is floored.
 *   2. INVISIBILITY — every list a person reads (roster, count, People directory, networking,
 *      venue model) runs through `excludePreviewIdentities`.
 *   3. PERMISSION — `/venue/` is a view-as surface, and the rule that guards it is still
 *      `canViewAsGuest`: more surfaces, the same people, so nothing here may name a crew role.
 *   4. HONESTY — the Diagnose panel names its source per field, prints "this is their state, not
 *      their screen", and never renders an IP or a location.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) {
  const body = read(file); examined += 1;
  const missing = tokens.filter((token) => !body.includes(token));
  if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`);
  return body;
}

// ---- 1. The rule itself ------------------------------------------------------------------
const identity = check("lib/auth/previewIdentity.ts", [
  'export const PREVIEW_PERSONA_PREFIX = "preview-"',
  'export const PREVIEW_MIRROR_PREFIX = "mirror-"',
  "export function refusePreviewWrite",
  "export function excludePreviewIdentities",
  "export function isPreviewIdentity",
  "export class PreviewWriteRefused",
]);
for (const id of ["preview-attendee", "preview-vip", "preview-speaker", "preview-sponsor", "preview-client"]) {
  if (!identity.includes(`id: "${id}"`)) throw new Error(`lib/auth/previewIdentity.ts does not define the ${id} persona.`);
}
// Throwing, not a boolean: a caller that ignores a returned flag writes anyway.
if (!/export function refusePreviewWrite[^}]*throw new PreviewWriteRefused/s.test(identity)) throw new Error("refusePreviewWrite must THROW; returning a flag lets a forgetful caller write anyway.");

// ---- 2. Every write path refuses --------------------------------------------------------
const WRITE_PATHS = [
  ["services/venue/liveChatService.ts", "post a chat message"],
  ["services/venue/attendeeLivePermissionService.ts", "raise a hand for the stage"],
  ["services/venue/attendeeLivePermissionService.ts", "hold a live capability"],
  ["services/attendees/attendeeRegistrationService.ts", "register for the event"],
  ["services/attendees/attendeeAgendaIntentService.ts", "save an agenda"],
  ["services/speed-networking/speedNetworkingService.ts", "join the networking queue"],
  ["services/venue/helpRequestService.ts", "raise a help request"],
  ["services/guests/guestIdentityService.ts", "become a stored guest"],
  ["services/venue/attendeeClientHeartbeatService.ts", "report a client heartbeat"],
];
for (const [file, attempted] of WRITE_PATHS) check(file, ['from "@/lib/auth/previewIdentity"', `refusePreviewWrite(`, `"${attempted}"`]);
if (WRITE_PATHS.length < 9) throw new Error(`validate_preview_personas_contract checked only ${WRITE_PATHS.length} write paths; the rule would pass on an empty loop.`);

// ---- 3. Every list a person reads excludes previews --------------------------------------
const EXCLUSIONS = [
  ["services/venue/attendeeRosterService.ts", ["excludePreviewIdentities(profiles", "excludePreviewIdentities(capabilities", "total: visible.length"]],
  ["services/venue/peopleDirectoryService.ts", ["excludePreviewIdentities(people"]],
  ["services/venue/virtualVenueService.ts", ["excludePreviewIdentities(["]],
  ["services/attendees/peopleDirectoryService.ts", ["excludePreviewIdentities(await listContacts()", "excludePreviewIdentities(await listHashOnlyPeople"]],
];
for (const [file, tokens] of EXCLUSIONS) check(file, tokens);

// ---- 4. The surface widened; the permission did not --------------------------------------
const guard = check("lib/auth/viewAsGuard.ts", ['export const VIEW_AS_PATH_PREFIXES = ["/venue/", "/speaker/events/", "/sponsor/events/", "/client/"]', "export function canViewAsGuest"]);
const rule = guard.slice(guard.indexOf("export function canViewAsGuest"), guard.indexOf("export const VIEW_AS_PATH_PREFIXES"));
if (/moderator|show_caller|technical_director|support|"va"/.test(rule)) throw new Error("Adding /venue/ must not widen WHO may preview: canViewAsGuest still admits only owner, operator, producer / executive_producer.");
check("lib/auth/viewAs.ts", ["export async function readViewAsViewer", "isPreviewPersonaId(guestId)", "if (!viewer.ok) return undefined"]);
check("lib/auth/previewView.ts", ["readViewAsViewer(eventId)", "if (!viewer.ok) return undefined", "recordPreviewAudit(", 'kind: "mirror"']);

// ---- 5. The banner, the way out, and the menu --------------------------------------------
check("components/preview/PreviewBanner.tsx", ["Nothing you do here is saved.", 'data-testid="leave-preview"', 'data-testid="preview-banner"']);
check("components/guests/ViewAsBanner.tsx", ["viewAs.preview", "Nothing you do here is saved.", "Leave preview"]);
const menu = check("components/preview/EnterTheRoomMenu.tsx", [
  "readViewAsViewer(eventId)", "if (!viewer.ok) return null",
  'data-testid="enter-as-host"', "Myself (host)", "No code, no registration.",
  'data-testid="enter-the-room-divider"', "Real guests", "listGuestProfiles(", "guestPreviewLinks(",
]);
for (const id of ["preview-attendee", "preview-vip", "preview-speaker", "preview-sponsor", "preview-client"]) {
  if (!menu.includes("PREVIEW_PERSONAS.map")) throw new Error("The menu must render every persona from the one catalogue, not a hand-kept second list.");
  break;
}
if (!/\/venue\/\$\{eventId\}\/stage/.test(menu)) throw new Error("Myself (host) must open /venue/{id}/stage.");

// ---- 6. The venue pages honour it ---------------------------------------------------------
check("app/venue/[eventId]/lobby/page.tsx", ["resolvePreviewView(resolvedParams.eventId, resolvedSearchParams?.viewAs)", "<PreviewBanner", "preview?.state.vip"]);
check("app/venue/[eventId]/stage/page.tsx", ["resolvePreviewView(resolvedParams.eventId, query?.viewAs)", "<PreviewBanner"]);

// ---- 7. Diagnose: two sources, named, and never green on a probe that did not run ---------
const diagnostics = check("services/venue/attendeeDiagnosticsService.ts", [
  '"never_connected"', '"receiving_nothing"', '"poor_connection"', '"nothing_on_air"', '"unknown"',
  "listStageParticipants(", "latestSessionsByAttendee(", "CURRENT_BUILD_ID",
]);
if (!/if \(!room\.reachable\) return \{ \.\.\.base, verdict: "unknown"/.test(diagnostics)) throw new Error("An unreachable LiveKit must read unknown, never a green verdict.");
check("services/video/livekitParticipantService.ts", ['method: "RoomService/ListParticipants"', "livekitTwirp", "createLiveKitServerToken", "reachable: false"]);
check("services/video/livekitIngressService.ts", ["export async function livekitTwirp", "export function createLiveKitServerToken"]);
const panel = check("components/moderation/AttendeeDiagnosePanel.tsx", [
  "This is their reported state, not their screen.",
  "Connection quality", "Subscribed to", "Their app build", "Browser and device", "Our roster state",
  "LiveKit RoomService", "the raw string is never stored", 'data-testid={`see-their-view-', "previewMirrorId(row.attendeeId)",
]);
// The privacy line is not a preference: the panel must not be able to print either.
if (/\bip\s*address|geoip|\blocation\b|latitude|longitude/i.test(panel)) throw new Error("The Diagnose panel must never display an IP or a location.");
if (/user_agent|userAgent/.test(panel)) throw new Error("The panel shows the DERIVED browser label; the raw user agent must not reach it.");
const heartbeat = check("services/venue/attendeeClientHeartbeatService.ts", ["export function describeClient", "clientSubscribedTracks", "clientConnectionQuality", "clientBuildId"]);
if (/ip\b|remoteAddr|cf-connecting-ip/i.test(heartbeat.replace(/description|descrip/gi, ""))) throw new Error("The heartbeat must not capture an IP.");
check("components/video/StageClientHeartbeat.tsx", ["useRoomContext", "isSubscribed", "connectionQuality", "/api/venue/client-heartbeat"]);
check("components/video/LiveKitIngressStagePlayer.tsx", ["<StageClientHeartbeat eventId={eventId} />"]);
check("app/api/venue/client-heartbeat/route.ts", ["ATTENDEE_SESSION_COOKIE", "recordAttendeeClientHeartbeat("]);
check("components/moderation/AttendeeLiveRoster.tsx", ["<AttendeeDiagnosePanel", "diagnoseRoster(", 'action: "attendee_diagnosed"']);

// ---- 8. Audited, and the columns exist in both copies of the migration --------------------
check("services/venue/previewAuditService.ts", ['"attendee_diagnosed"', '"attendee_view_mirrored"', "NEVER an IP"]);
check("services/audit/auditTypes.ts", ['| "attendee_diagnosed"', '| "attendee_view_mirrored"']);
for (const file of ["db/migrations/0037_attendee_client_telemetry.sql", "supabase/migrations/20260917050000_attendee_client_telemetry.sql"]) {
  const sql = check(file, ["client_build_id", "client_browser", "client_connection_quality", "client_subscribed_tracks", "last_chat_poll_at"]);
  if (/\bip_address\b|\bgeo\b|\blatitude\b/.test(sql)) throw new Error(`${file} must not add an IP or location column.`);
}
check("services/runtime/runtimeStore.ts", ["listAttendeeSessions(eventId: string"]);
check("services/runtime/fileRuntimeStore.ts", ["async listAttendeeSessions("]);
check("services/runtime/supabaseRuntimeStore.ts", ["async listAttendeeSessions(", "client_subscribed_tracks"]);

// ---- 9. The proofs exist ------------------------------------------------------------------
check("tests/unit/previewPersonas.test.ts", [
  "all refuse a persona",
  "a mirror of a REAL attendee is refused too",
  "a planted preview row is still absent from the roster",
  "?viewAs=preview-vip on /venue/ is refused",
  "connected but subscribed to nothing is OURS",
  "a probe that did not run reads unknown, NEVER green",
]);
check("docs/manual-notes/preview-personas.md", ["§2.2", "Leave preview", "state, not their screen"]);

if (examined < 28) throw new Error(`validate_preview_personas_contract examined only ${examined} files; the rule would pass on an empty loop.`);
console.log(`validate_preview_personas_contract: PASS — ${examined} files examined, ${WRITE_PATHS.length} write paths refusing previews, ${EXCLUSIONS.length} lists excluding them. The refusal itself is proven by tests/unit/previewPersonas.test.ts.`);
