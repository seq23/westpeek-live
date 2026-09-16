# Speed networking: the 1:1 room, and tiered matching

16 September 2026. Notes for the operator manual; the manual itself is not edited here.

## What the owner saw

A 1:1 speed-networking match, two people expected, rendered four or five tiles stacked down the
page: her partner with video, **her own name under a grey silhouette**, and **two people who were
never matched with her, with live video**. Her partner could not see her. The match data was
correct throughout — the page named the right partner and counted the right two people.

## What was actually wrong

Reproduced against the live LiveKit project before anything was changed, using
`RoomService/ListRooms` and `RoomService/ListParticipants`, and by connecting real participants to
a scratch room:

| Finding | How it was proved |
| --- | --- |
| A networking room is created implicitly by the first person to join, with **`max_participants: 0`** — no cap at all | `ListRooms` on the live project showed `maxParticipants: 0` on a real match room |
| A **third party who knows the room name gets in and publishes video** | Connected a third participant to a two-person room; `ListParticipants` then reported three |
| **A second connection on the same identity displaces the first**, and the displaced one can be left on other screens as a video-less tile with the right name | Connected the same identity twice; the first received LiveKit disconnect reason 2 (duplicate identity), and the partner saw a disconnect followed by a reconnect for the same name |

Three defects in our own code produced that:

1. **`services/video/livekitToken.ts` built the LiveKit identity from the display name**
   (`profileId ?? slugify(displayName)`). Two people called "Ada", or one person in two tabs, share
   an identity and disconnect each other. The `?? randomUUID()` fallback was unreachable — the
   slug of an empty name is `""`, not `undefined`.
2. **The `speed_networking` branch of `/api/video/livekit-token` lived inside
   `if (body.role === "attendee")`.** A speed-networking `roomId` is used verbatim as the LiveKit
   room name, so **any request with a non-attendee role skipped the match check entirely and could
   name any room in the project** — including another pair's 1:1, and the green room.
   `authorizeVideoTokenRequest` returns `ok` for `role: "observer"` **with no session at all**.
3. **Nothing ever removed anyone from a networking room.** A match that ended left the room and its
   occupants in place; the room name is unique per match, but a room outlives its match and keeps
   whoever is in it.

### The privacy consequence, stated plainly

**People who were never matched with each other could see and hear each other in a room the product
advertises as a private 1:1.** An unauthenticated request naming `role: "observer"` and a
speed-networking room could be handed a subscribe token for that room — silent, invisible to the
two people in it. That is what was exposed. Nothing suggests it was used; the room names are
random UUIDs and are not published. It is closed as of this change.

## What now prevents it

Enforcement is in three places on purpose, because any one of them can be wrong:

1. **The grant.** `services/speed-networking/speedNetworkingRoomGuard.ts` refuses every role that is
   not `attendee`, and every attendee who is not one of the two in that **active** match. The check
   runs before any role branch in the route, so no role can reach the room-naming path.
2. **The LiveKit room.** It is created ahead of the first token with **`max_participants: 2`** and a
   60-second empty timeout, so the server itself refuses a third body.
3. **The join.** Before a token is minted, anyone in the room who is not one of the two is removed,
   and so is the joiner's own earlier connection — a rejoin replaces it cleanly instead of relying
   on LiveKit's duplicate-identity displacement, which is what left the ghost tile.

**Cleanup.** `endMatch` — the single path taken when a match ends, expires, or somebody leaves —
deletes the LiveKit room. The next match, and any rejoin, starts empty.

**Identity.** The LiveKit identity is the attendee id and never anything derived from a name.
It is deliberately **stable rather than per-connection**: a networking room seats exactly two, so a
person's second tab must replace their first, not take the other person's seat. A request with no
stable id at all gets a fresh random identity, which can only displace itself.

**The room on screen.** The 1:1 renders exactly two tiles, two-up at every width including a phone,
each bounded so nothing runs off the page. The local participant is only ever the local tile. A
participant with no video is never drawn as an anonymous grey avatar with a name under it — the
tile says `Waiting for <name> to join…` or `<name>'s camera is off`. Anyone who is not the matched
partner is unsubscribed on sight and never drawn, with a visible note that it happened.

## Tiered matching

Longest-waiting-first is right for a small room and wrong for a big one, so the method follows the
size of the queue. Thresholds and weights are all in `SPEED_NETWORKING_MATCHING_CONFIG`
(`services/speed-networking/speedNetworkingTiers.ts`) — one object, tunable without hunting.

| Waiting | Tier | How pairs are chosen |
| --- | --- | --- |
| under 12 | `fifo` | Longest-waiting first, through the existing pure engine. With few people, fairness is the algorithm. |
| 12 – 50 | `weighted_random` | A partner drawn from the longest-waiting half, weighted by wait. Stops the same two cycling back to each other. |
| over 50 | `scored` | Shared topics (strongest), complementary goals, never the same company, plus wait time. |

**The score** is built only from data already held on `attendee_profiles`: topics of interest,
networking goals, company, title. Affinity tops out at 36 (three shared topics plus a complementary
goal); wait time is worth 4 a minute, so **nine minutes of waiting outweighs the best possible
affinity** and nobody starves waiting for a perfect match. Two people at the same organisation are
never paired, at any tier.

**At every tier:** a pair never meets twice; the round is formed as **one batch tick** for the whole
queue rather than as people poll, so whoever refreshes first does not take the best partner; and the
round is deterministic given the queue, the history and the random source.

**Nobody waits in silence.** The odd person out is told *"You are next"* and leads the following
round. Somebody who has met — or cannot be paired with — everyone else waiting is told so, and
offered *"Meet someone again"*; a repeat only happens when **both** people have asked for it.

## Guards

- `npm run validate:speed-networking-room-privacy` — the contract above, including that the gate
  runs before every role branch.
- `tests/unit/speedNetworkingRoomPrivacy.test.ts`, `tests/unit/speedNetworkingTiers.test.ts`.
