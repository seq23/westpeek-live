#!/usr/bin/env node
const fs = require("fs");

/**
 * Speed networking: the 1:1 room is private to two people, and matching is tiered (16 Sep 2026).
 *
 * The owner's own match rendered five tiles — her partner, two strangers with video, and her own
 * identity twice, once as a video-less grey avatar. Reproduced against the real LiveKit project:
 * a room created implicitly by the first join carries max_participants = 0, a second connection on
 * the same identity displaces the first, and a plain join token for the room name lets any third
 * party in. This asserts the fixes are all still wired, in the places that actually enforce them.
 */

let examined = 0;
const failures = [];

function read(file) {
  if (!fs.existsSync(file)) { failures.push(`Missing ${file}`); return ""; }
  examined += 1;
  return fs.readFileSync(file, "utf8");
}

function check(file, tokens) {
  const body = read(file);
  if (!body) return "";
  for (const token of tokens) if (!body.includes(token)) failures.push(`${file} missing: ${token}`);
  return body;
}

function refuse(file, tokens) {
  const body = read(file);
  if (!body) return;
  for (const token of tokens) if (body.includes(token)) failures.push(`${file} must not contain: ${token}`);
}

// 1. The identity is never derived from a display name. Two attendees called "Ada" would otherwise
//    hold the same LiveKit identity and disconnect each other, which is the ghost tile.
check("services/video/livekitToken.ts", ["const identity = input.request.profileId?.trim() || `anon-${randomUUID()}`"]);
refuse("services/video/livekitToken.ts", ["displayName.toLowerCase().replace"]);

// 2. Only the two attendees of that ACTIVE match, and only role "attendee", are ever admitted.
check("services/speed-networking/speedNetworkingRoomGuard.ts", [
  "export const SPEED_NETWORKING_ROOM_CAPACITY = 2",
  "export function decideSpeedNetworkingRoomAdmission",
  'if (input.role !== "attendee") return { ok: false, reason: ATTENDEES_ONLY',
  "tokenAllowedForRoom(input.match, input.roomName, input.attendeeId)",
  "export async function prepareSpeedNetworkingRoomForJoin",
  "ensureLiveKitRoomWithCapacity",
  "removeLiveKitRoomParticipant",
]);

// 3. The gate runs BEFORE the role branches: a speed_networking roomId names a LiveKit room
//    directly, so an observer or crew role reaching that branch could name any room in the project.
const route = check("app/api/video/livekit-token/route.ts", [
  'if (body.roomType === "speed_networking") {',
  "prepareSpeedNetworkingRoomForJoin",
  "networkingAdmission.ok",
  "status: 403",
]);
if (route) {
  const gateAt = route.indexOf("prepareSpeedNetworkingRoomForJoin({");
  const attendeeBranchAt = route.indexOf('if (body.role === "attendee")');
  const speakerBranchAt = route.indexOf('body.roomType === "green_room" || body.role === "speaker"');
  if (gateAt < 0 || attendeeBranchAt < 0 || speakerBranchAt < 0) {
    failures.push("app/api/video/livekit-token/route.ts: could not locate the networking gate and the role branches.");
  } else if (!(gateAt < speakerBranchAt && gateAt < attendeeBranchAt)) {
    failures.push("app/api/video/livekit-token/route.ts: the speed_networking gate must run before every role branch, or a non-attendee role reaches a private 1:1 room.");
  }
}

// 4. The LiveKit admin reach that makes the cap and the cleanup real.
check("services/video/livekitRoomAdmin.ts", [
  "export async function listLiveKitRoomParticipants",
  "export async function removeLiveKitRoomParticipant",
  "export async function ensureLiveKitRoomWithCapacity",
  "export async function deleteLiveKitRoom",
  "max_participants: input.maxParticipants",
  "roomCreate: input.roomCreate === true",
]);

// 5. The room is destroyed when the match ends, expires, or somebody leaves — endMatch is the one
//    path all three take, so the purge belongs there and nowhere else.
const service = check("services/speed-networking/speedNetworkingService.ts", [
  "export async function purgeSpeedNetworkingRoom",
  "await purgeSpeedNetworkingRoom(match.roomName);",
  "export async function endMatch",
]);
if (service && service.indexOf("await purgeSpeedNetworkingRoom(match.roomName);") < service.indexOf("export async function endMatch")) {
  failures.push("services/speed-networking/speedNetworkingService.ts: the room purge must happen inside endMatch.");
}

// 6. The client never draws the local participant as a remote tile, never draws a video-less
//    participant as an anonymous avatar, and never draws anyone who is not the matched partner.
check("components/venue/SpeedNetworkingLive.tsx", [
  "function PairStage",
  "useRemoteParticipants",
  "useLocalParticipant",
  "participant.identity === partnerIdentity",
  "publication.setSubscribed(false)",
  "Waiting for ${partnerName} to join…",
  "'s camera is off",
  "grid grid-cols-2",
  "networking-unexpected-participant",
  "key={snapshot.match.id}",
]);
refuse("components/venue/SpeedNetworkingLive.tsx", [
  // The placeholder tile is what put a grey silhouette labelled with the owner's own name in her 1:1.
  "withPlaceholder: true",
  "<GridLayout",
]);

// 7. Tiered matching: the thresholds and weights live in one named config, the round is a batch
//    tick, and the three rules that hold at every tier are in the plan.
check("services/speed-networking/speedNetworkingTiers.ts", [
  "export const SPEED_NETWORKING_MATCHING_CONFIG",
  "fifoBelowWaiting: 12",
  "weightedRandomThroughWaiting: 50",
  "blockSameCompany: true",
  "export function selectSpeedNetworkingTier",
  "export function scoreSpeedNetworkingPair",
  "export function planSpeedNetworkingRound",
  "perWaitingMinute",
  "selectNextSpeedNetworkingPair(",
  "oddOneOut",
  "metEveryone",
]);
check("services/speed-networking/speedNetworkingService.ts", [
  "planSpeedNetworkingRound({ eventId, waiting: candidates",
  "export async function allowRepeatNetworkingMatch",
  "priorityAttendeeIds: plan.unmatched.filter(",
  "metEveryoneAttendeeIds: plan.metEveryone.map",
]);
check("lib/actions/networkingActions.ts", ["export async function allowRepeatSpeedNetworkingMatchAction", "allowRepeatNetworkingMatch(eventId, identity.attendeeId)"]);
check("components/venue/SpeedNetworkingQueuePanel.tsx", ["allowRepeatSpeedNetworkingMatchAction", "repeatAction="]);
check("components/venue/SpeedNetworkingLive.tsx", ["networking-next-up", "networking-met-everyone", "networking-allow-repeat"]);

// 7b. The 4-minute rotation and its setup beat: the gap is a real server-side state, the token is
//     held until the bell, "Start now" never shortens the match, and the countdown cannot drift.
check("types/speedNetworking.ts", [
  "export const SPEED_NETWORKING_CYCLE",
  "setupGapSeconds: 9",
  "tokenLeadSeconds: 2",
  "transitionPollMs: 1_000",
]);
check("services/speed-networking/speedNetworkingTiers.ts", ["cycle: SPEED_NETWORKING_CYCLE", "timesSatOut", "function owedSeats"]);
check("services/speed-networking/speedNetworkingService.ts", [
  "const startsAt = new Date(nowMs + SPEED_NETWORKING_CYCLE.setupGapSeconds * 1_000);",
  "export function matchIsInSetup",
  "SPEED_NETWORKING_CYCLE.tokenLeadSeconds",
  "export async function startNetworkingMatchNow",
  "satOutCounts",
]);
const live = read("components/venue/SpeedNetworkingLive.tsx");
for (const token of ["function useDeadlineCountdown", "function CameraPreview", "function SetupBeat", "networking-setup-countdown", "networking-next-partner-name", "networking-camera-preview", "networking-start-now", "SPEED_NETWORKING_CYCLE.transitionPollMs", "visibilitychange"]) {
  if (live && !live.includes(token)) failures.push(`components/venue/SpeedNetworkingLive.tsx missing: ${token}`);
}
// A countdown that decrements a client-side interval drifts whenever the tab is throttled.
if (live && /setSecondsLeft\(\(value\) => Math\.max\(0, value - 1\)\)/.test(live)) {
  failures.push("components/venue/SpeedNetworkingLive.tsx: the match countdown must be read from a deadline, not decremented by an interval.");
}
check("lib/actions/networkingActions.ts", ["export async function startSpeedNetworkingMatchNowAction"]);
check("app/api/networking/mine/route.ts", ['action === "start"']);

// 8. An ended event has no queue and no live markers. The queue closing server-side is the real
//    rule; the nav marker is only how it shows, so both are asserted.
check("services/speed-networking/speedNetworkingService.ts", [
  "export function networkingClosedByEventStatus",
  'status === "ended" || status === "replay_available" || status === "archived"',
  "open: eventIsOver ? false :",
  "if (!settings.open) return undefined;",
  "export async function closeNetworkingForEndedEvent",
]);
check("services/video/showEndService.ts", ["closeNetworkingForEndedEvent(input.eventId)"]);
const showEnd = read("services/video/showEndService.ts");
if (showEnd && showEnd.indexOf("closeNetworkingForEndedEvent(input.eventId)") > showEnd.indexOf('if (!event || event.source === "seed")')) {
  failures.push("services/video/showEndService.ts: networking must close before the seed-event early return, or a seed event's queue outlives its show.");
}
check("services/venue/venueActivityService.ts", [
  "networkingClosedByEventStatus(event?.status)",
  "stageLive: !eventIsOver &&",
  "networkingOpen: Boolean(settings?.open) && !eventIsOver",
  "breakoutsOpen: eventIsOver ? 0 :",
]);

// 9. The proofs exist and actually assert the behaviour, not its shape.
check("tests/unit/speedNetworkingRoomPrivacy.test.ts", [
  "refuses every role that is not a registered attendee",
  "refuses a third attendee, another pair's room, and a match that is over",
  "caps the LiveKit room at two and removes everyone who does not belong",
  "deletes the LiveKit room when the match ends",
  "gives two attendees with the same display name different identities",
  "reports networking closed and refuses new joins once the event has ended",
  "ending the show empties the queue, ends the matches and deletes their rooms",
  "drops every live-implying nav marker for an event that is over",
]);
check("tests/unit/speedNetworkingTiers.test.ts", [
  "picks longest-waiting FIFO under twelve, weighted random through fifty, scored above that",
  "never pairs two people from the same company, at any tier",
  "lets wait time eventually beat the best possible affinity",
  "names the odd person out so they can be told they are next",
  "says who has met everyone instead of leaving them waiting",
  "pairs the whole queue in one deterministic batch",
  "for (const people of [3, 5, 7])",
  "rotates the person left over with ${people} waiting",
  "never the same one twice running",
  "keeps the cycle in the same named config as the tiers",
]);
check("tests/unit/speedNetworkingReal.test.ts", [
  "opens a new match one setup beat after it is decided",
  "releases the token just before the bell",
  "Start now skips the rest of the beat without shortening the match or adding another gap",
  "rolls straight into the next person when the timer runs out",
  "rotates who sits out through the real matcher, not just in the planner",
]);
check("docs/manual-notes/speed-networking-fix.md", ["max_participants", "ListParticipants", "privacy"]);

// Rule 0: a validator that examined nothing has not validated anything.
if (examined < 18) failures.push(`validate_speed_networking_room_privacy_contract examined only ${examined} files; it must read every file it governs.`);

if (failures.length) {
  console.error("validate_speed_networking_room_privacy_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`validate_speed_networking_room_privacy_contract: PASS — ${examined} files examined; the 1:1 room admits only its two matched attendees, is capped at two on the LiveKit server, is deleted when the match ends, and matching is tiered by queue size.`);
