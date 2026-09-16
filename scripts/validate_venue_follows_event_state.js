const fs = require("fs");
/**
 * The venue follows the event's state (16 Sep 2026): one pure gate (ended / archived / draft /
 * open) applied by the shell every venue page renders through, a poller that refreshes the page
 * when the gate changes, and the state route the poller reads. No venue page may render outside
 * the shell.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }
check("services/venue/venueStateGate.ts", ["export function venueGateFor", 'if (publicState === "archived") return "archived"', 'if (publicState === "ended" || stageEnded) return surface === "replay" ? "open" : "ended"', 'if (publicState === "draft") return isHost ? "open" : "draft"', "Event ended. Replay access is available."]);
check("components/venue/VenuePageShell.tsx", ["venueGateFor({ status: event?.status, stageEnded: stage?.streamStatus === \"ENDED\", isHost, surface })", '{gate === "open" ? children : <VenueStateNotice', "<VenueStatePoller", "data-venue-gate={gate}"]);
check("components/venue/VenueStateNotice.tsx", ["VENUE_GATE_MESSAGE[gate]", "<ReplayCenter", 'data-testid="venue-state-notice"']);
check("components/venue/VenueStatePoller.tsx", ["/api/venue/state?eventId=", "router.refresh()"]);
check("app/api/venue/state/route.ts", ["venueGateFor({ status: event?.status, stageEnded, isHost: Boolean(actor) || viewer.isHost, surface })"]);
check("app/venue/[eventId]/replay/page.tsx", ['surface="replay"']);
// Every venue page renders through the shell.
const pages = [];
(function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = `${dir}/${entry.name}`; if (entry.isDirectory()) walk(full); else if (entry.name === "page.tsx") pages.push(full); } })("app/venue/[eventId]");
for (const page of pages) { examined += 1; const body = read(page); if (page === "app/venue/[eventId]/page.tsx") { if (!body.includes("redirect(`/venue/${eventId}/lobby`)")) throw new Error(`${page} must redirect to the lobby`); continue; } if (!body.includes("<VenuePageShell")) throw new Error(`${page} renders outside VenuePageShell; the event-state gate would not apply.`); }
if (pages.length < 12) throw new Error(`Only ${pages.length} venue pages found; expected the full venue.`);
check("tests/unit/venueStateGate.test.ts", ["a stage marked ENDED ends the venue even before the event row says so", "draft is not open unless you are the host"]);
check("tests/e2e/venue-follows-event-state.spec.ts", ['toHaveAttribute("data-gate", "ended", { timeout: 15_000 })', 'toHaveAttribute("data-gate", "archived")', 'toHaveAttribute("data-gate", "draft")']);
console.log(`validate_venue_follows_event_state: PASS — ${examined} files examined (${pages.length} venue pages through the shell).`);
