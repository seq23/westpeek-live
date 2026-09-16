const fs = require("fs");
/**
 * Going live is ONE action, in ONE card, in every place it is offered (the owner, 16 Sep 2026: "i
 * dont understand why i have to go 2 places"). Pressing Go live flips the event AND leaves the
 * producer holding credentials; the credentials sit right there with copy buttons and the
 * StreamYard steps; and the state after End the show explains itself — the key was released on
 * purpose, and one button gets a new one.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

const actions = check("lib/actions/goLiveActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "go_live")', "provisionStreamYardLiveKitIngress", 'setEventStatus(eventId, "live"', "getStreamCredentialsAction"]);
if (!actions.includes("if (!state?.livekitStreamKey)")) throw new Error("Go live must reuse an existing key and mint only when there is none.");

const card = check("components/stage/GoLiveCard.tsx", ["go-live-card", "go-live-button", "StreamCredentials", "EndShowControl", "goLiveAction", "ladderReadiness"]);
if (!card.includes('data-has-credentials')) throw new Error("The card must say whether credentials exist.");
const credentials = check("components/stage/StreamCredentials.tsx", ["Get stream credentials", "New stream key", "Copy both for StreamYard", "stream-key", "reveal-stream-key", "stream key was released", "do not add a second one"]);
if (credentials.includes("Generate / Refresh Primary RTMP")) throw new Error("The old jargon label must be gone.");
if (/console\.(log|error|warn)/.test(credentials)) throw new Error("A stream key must never be logged.");
if (!credentials.includes("window.confirm")) throw new Error("Replacing a working key must warn first.");

for (const surface of ["app/app/events/[eventId]/publish/page.tsx", "components/owner/OwnerConsole.tsx", "components/moderation/CrewLiveModerationDeck.tsx"]) check(surface, ["GoLiveCard"]);
check("components/owner/OwnerConsole.tsx", ["console-go-live-", "GoLiveRowControl"]);
// The unconfigured case must be named, not blank.
check("services/video/livekitIngressService.ts", ["lastProvisionError: message"]);
check("tests/unit/goLiveOneClick.test.ts", ["flips the event live and provisions credentials in the same click", "reuses the credentials it already has"]);
check("tests/e2e/one-click-go-live.spec.ts", ["one click on the Publish page goes live AND hands over credentials", "stream key was released"]);
if (examined < 8) throw new Error(`validate_one_click_go_live examined only ${examined} files`);
console.log(`validate_one_click_go_live: PASS — ${examined} files examined; one card, one click, credentials in hand, and an empty state that explains itself.`);
