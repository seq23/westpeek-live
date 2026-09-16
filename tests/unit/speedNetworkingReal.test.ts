import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real speed networking against the runtime store:
 *   two waiting attendees are paired on the next read (longest-waiting first), each match has
 *   its own room <eventId>-net-<matchId> and a window of the crew-set minutes; a pair never meets
 *   twice (a third attendee gets the next match instead); the timer expiry returns both to
 *   waiting automatically; Next match ends the match for both; closed networking stops matching;
 *   and a room token goes only to the two attendees of that ACTIVE match — never to a third
 *   attendee, never for another pair's room, never after it ended.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { getNetworkingRoundState, getMyNetworkingState, joinNetworkingQueue, leaveNetworkingQueue, nextNetworkingMatch, runNetworkingMatcher, setNetworkingSettings, startNetworkingMatchNow, tokenAllowedForRoom, findActiveMatchForRoom, crewNetworkingSummary } from "@/services/speed-networking/speedNetworkingService";
import { SPEED_NETWORKING_CYCLE, SPEED_NETWORKING_DEFAULT_MINUTES, speedNetworkingRoomName } from "@/types/speedNetworking";

const EVENT = "net-test-event";
const A = { attendeeId: "att-a", displayName: "Ada", company: "Engines", title: "Founder" };
const B = { attendeeId: "att-b", displayName: "Grace", company: "Navy", title: "Admiral" };
const C = { attendeeId: "att-c", displayName: "Linus", company: "Kernel", title: "BDFL" };

/**
 * A new match opens after the setup beat (16 Sep 2026), so a test that wants the live match rather
 * than the beat skips the rest of the gap the same way the attendee's "Start now" does.
 */
async function openMatchNow(attendeeId: string) {
  // The read is what runs the matcher and decides the pair; "Start now" then skips the rest of the beat.
  await getMyNetworkingState(EVENT, attendeeId);
  return startNetworkingMatchNow(EVENT, attendeeId);
}

describe("real speed networking", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-net-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); vi.useRealTimers(); });

  it("pairs the two longest-waiting attendees with their own room and a 4-minute window; a third waits", async () => {
    await joinNetworkingQueue(EVENT, A);
    expect((await getMyNetworkingState(EVENT, A.attendeeId)).status).toBe("waiting");
    await joinNetworkingQueue(EVENT, B);
    await joinNetworkingQueue(EVENT, C);
    // The pair is decided at once but the match opens after the setup beat: first "setup", then live.
    expect((await getMyNetworkingState(EVENT, A.attendeeId)).status).toBe("setup");
    const a = await openMatchNow(A.attendeeId);
    const b = await getMyNetworkingState(EVENT, B.attendeeId);
    const c = await getMyNetworkingState(EVENT, C.attendeeId);
    expect(a.status).toBe("matched");
    expect(b.status).toBe("matched");
    expect(a.match!.id).toBe(b.match!.id);
    expect(a.match!.partner).toMatchObject({ attendeeId: "att-b", name: "Grace", company: "Navy", title: "Admiral" });
    expect(b.match!.partner.name).toBe("Ada");
    expect(a.match!.roomName).toBe(speedNetworkingRoomName(EVENT, a.match!.id));
    expect(a.match!.roomName).toMatch(new RegExp(`^${EVENT}-net-`));
    expect(new Date(a.match!.expiresAt).getTime() - new Date(a.match!.startsAt).getTime()).toBe(4 * 60_000);
    expect(a.match!.secondsLeft).toBeGreaterThan(200);
    expect(c).toMatchObject({ status: "waiting", queueSize: 1, matchesInProgress: 1 });
  });

  it("a pair never meets twice: after Next match, Ada is paired with Linus, not Grace again; expiry returns both to waiting", async () => {
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    const first = await getMyNetworkingState(EVENT, A.attendeeId);
    expect(first.match!.partner.attendeeId).toBe("att-b");
    await joinNetworkingQueue(EVENT, C);
    const afterNext = await nextNetworkingMatch(EVENT, A.attendeeId);
    // Ada, Grace, and Linus are all waiting; Ada + Grace have met, so Ada ↔ Linus (or Grace ↔ Linus) — never Ada ↔ Grace.
    for (const who of [A, B, C]) await openMatchNow(who.attendeeId);
    const states = await Promise.all([A, B, C].map((who) => getMyNetworkingState(EVENT, who.attendeeId)));
    const matched = states.filter((state) => state.status === "matched");
    expect(matched).toHaveLength(2);
    const pair = matched.map((state) => state.match!.partner.attendeeId).sort();
    expect(pair).not.toEqual(["att-a", "att-b"]);
    expect(afterNext.status === "setup" || afterNext.status === "matched" || afterNext.status === "waiting").toBe(true);
    const history = await getRuntimeStore().listSpeedNetworkingMatches(EVENT);
    expect(history.find((match) => match.id === first.match!.id)).toMatchObject({ status: "ended", endedReason: "next" });

    // Expiry: the active match's window passes; the next read returns both to waiting, counted as completed.
    const active = history.find((match) => match.status === "active")!;
    await getRuntimeStore().upsertSpeedNetworkingMatch({ ...active, expiresAt: new Date(Date.now() - 1_000).toISOString() });
    await runNetworkingMatcher(EVENT);
    const expired = (await getRuntimeStore().listSpeedNetworkingMatches(EVENT)).find((match) => match.id === active.id)!;
    expect(expired).toMatchObject({ status: "expired", endedReason: "expired" });
    const entries = await getRuntimeStore().listSpeedNetworkingEntries(EVENT);
    for (const attendeeId of [active.attendeeAId, active.attendeeBId]) expect(entries.find((entry) => entry.attendeeId === attendeeId)!.matchesCompleted).toBeGreaterThanOrEqual(1);
    // Everyone has now met everyone they can: three people, three possible pairs, two used → the third pair forms, then exhaustion.
    const summary = await crewNetworkingSummary(EVENT);
    expect(summary.matchesInProgress * 2 + summary.queueSize).toBe(3);
    expect(summary.matchesInProgress).toBe(1);
  });

  it("closed networking stops pairing; leaving ends the match for both", async () => {
    await setNetworkingSettings(EVENT, { open: false, matchMinutes: 2 }, "owner");
    // Closed takes no joins at all (16 Sep 2026): the queue an ended event leaves behind is what
    // kept the venue nav advertising "Networking OPEN" after the show.
    expect(await joinNetworkingQueue(EVENT, A)).toBeUndefined();
    expect((await getMyNetworkingState(EVENT, A.attendeeId)).status).toBe("closed");
    await setNetworkingSettings(EVENT, { open: true, matchMinutes: 2 }, "owner");
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    const a = await openMatchNow(A.attendeeId);
    expect(a.status).toBe("matched");
    // Skipping the rest of the beat never shortens the conversation.
    expect(new Date(a.match!.expiresAt).getTime() - new Date(a.match!.startsAt).getTime()).toBe(2 * 60_000);
    await leaveNetworkingQueue(EVENT, A.attendeeId, "ended");
    expect((await getMyNetworkingState(EVENT, A.attendeeId)).status).toBe("idle");
    expect((await getMyNetworkingState(EVENT, B.attendeeId)).status).toBe("waiting");
  });

  it("a room token goes only to the two matched attendees of that active match", async () => {
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    await joinNetworkingQueue(EVENT, C);
    const beat = await getMyNetworkingState(EVENT, A.attendeeId);
    // No token while the match is still in its setup beat, for either of the two.
    expect(tokenAllowedForRoom(await findActiveMatchForRoom(EVENT, beat.match!.roomName), beat.match!.roomName, "att-a")).toBe(false);
    const a = await openMatchNow(A.attendeeId);
    const room = a.match!.roomName;
    const match = await findActiveMatchForRoom(EVENT, room);
    expect(tokenAllowedForRoom(match, room, "att-a")).toBe(true);
    expect(tokenAllowedForRoom(match, room, "att-b")).toBe(true);
    expect(tokenAllowedForRoom(match, room, "att-c")).toBe(false);
    expect(tokenAllowedForRoom(match, `${EVENT}-net-other`, "att-a")).toBe(false);
    expect(tokenAllowedForRoom(undefined, room, "att-a")).toBe(false);
    await nextNetworkingMatch(EVENT, B.attendeeId);
    expect(tokenAllowedForRoom(await findActiveMatchForRoom(EVENT, room), room, "att-a")).toBe(false);
    expect(tokenAllowedForRoom({ ...match!, expiresAt: new Date(Date.now() - 1).toISOString() }, room, "att-a")).toBe(false);
  });
});

/**
 * The 4-minute cycle and its setup beat (16 Sep 2026). A match that runs out puts both people
 * straight back in the queue and pairs them again — but the next one opens a few seconds later, so
 * nobody is cut from one stranger's face to the next. The beat is a real server-side state: no
 * token is issued until it is over.
 */
describe("the networking cycle", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-net-cycle-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("opens a new match one setup beat after it is decided, and says who is coming during it", async () => {
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    const beat = await getMyNetworkingState(EVENT, A.attendeeId);
    expect(beat.status).toBe("setup");
    expect(beat.setupGapSeconds).toBe(SPEED_NETWORKING_CYCLE.setupGapSeconds);
    // The partner is already known during the beat — that is the point of deciding the pair early.
    expect(beat.match!.partner).toMatchObject({ attendeeId: B.attendeeId, name: "Grace" });
    expect(beat.match!.secondsUntilStart).toBeGreaterThan(0);
    expect(beat.match!.secondsUntilStart).toBeLessThanOrEqual(SPEED_NETWORKING_CYCLE.setupGapSeconds);
    // The full match length is measured from the bell, not from when the pair was decided.
    expect(Date.parse(beat.match!.expiresAt) - Date.parse(beat.match!.startsAt)).toBe(SPEED_NETWORKING_DEFAULT_MINUTES * 60_000);
    expect(tokenAllowedForRoom(await findActiveMatchForRoom(EVENT, beat.match!.roomName), beat.match!.roomName, A.attendeeId)).toBe(false);
  });

  it("releases the token just before the bell so the connection is up when the match starts", async () => {
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    const beat = await getMyNetworkingState(EVENT, A.attendeeId);
    const match = (await findActiveMatchForRoom(EVENT, beat.match!.roomName))!;
    const bell = Date.parse(match.startsAt);
    const lead = SPEED_NETWORKING_CYCLE.tokenLeadSeconds * 1_000;
    expect(tokenAllowedForRoom(match, match.roomName, A.attendeeId, bell - lead - 1_000)).toBe(false);
    expect(tokenAllowedForRoom(match, match.roomName, A.attendeeId, bell - lead + 100)).toBe(true);
    expect(tokenAllowedForRoom(match, match.roomName, A.attendeeId, bell)).toBe(true);
  });

  it("Start now skips the rest of the beat without shortening the match or adding another gap", async () => {
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    await getMyNetworkingState(EVENT, A.attendeeId);
    const started = await startNetworkingMatchNow(EVENT, A.attendeeId);
    expect(started.status).toBe("matched");
    expect(started.match!.secondsUntilStart).toBe(0);
    expect(Date.parse(started.match!.expiresAt) - Date.parse(started.match!.startsAt)).toBe(SPEED_NETWORKING_DEFAULT_MINUTES * 60_000);
    // It opens for BOTH of them, not just whoever pressed it.
    expect((await getMyNetworkingState(EVENT, B.attendeeId)).status).toBe("matched");
    // Pressing it again is a no-op, never a second gap and never a second clock.
    const again = await startNetworkingMatchNow(EVENT, A.attendeeId);
    expect(again.match!.startsAt).toBe(started.match!.startsAt);
  });

  it("rotates who sits out through the real matcher, not just in the planner", async () => {
    for (const who of [A, B, C]) await joinNetworkingQueue(EVENT, who);
    const store = getRuntimeStore();
    const satOut: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      await runNetworkingMatcher(EVENT);
      const entries = await store.listSpeedNetworkingEntries(EVENT);
      const waiting = entries.filter((entry) => entry.status === "waiting");
      if (waiting.length === 1) satOut.push(waiting[0].attendeeId);
      // The debt is persisted, not recomputed from the queue order — that is what makes it rotate.
      const roundState = await getNetworkingRoundState(EVENT);
      expect(Object.keys(roundState.satOutCounts).length).toBeLessThanOrEqual(1);
      for (const match of await store.listSpeedNetworkingMatches(EVENT)) {
        if (match.status === "active") await store.upsertSpeedNetworkingMatch({ ...match, expiresAt: new Date(Date.now() - 1_000).toISOString() });
      }
    }
    expect(satOut).toHaveLength(3);
    expect(new Set(satOut).size, `the same person sat out more than once: ${satOut.join(", ")}`).toBe(3);
  });

  it("rolls straight into the next person when the timer runs out, with a fresh beat and a new partner", async () => {
    for (const who of [A, B, C]) await joinNetworkingQueue(EVENT, who);
    await getMyNetworkingState(EVENT, A.attendeeId);
    const first = await startNetworkingMatchNow(EVENT, A.attendeeId);
    expect(first.status).toBe("matched");
    const firstPartner = first.match!.partner.attendeeId;

    // The clock runs out. The very next read expires it, requeues both and pairs the next round —
    // nothing else has to happen, and the other person's device does not have to be awake.
    const store = getRuntimeStore();
    const active = (await store.listSpeedNetworkingMatches(EVENT)).find((match) => match.status === "active")!;
    await store.upsertSpeedNetworkingMatch({ ...active, expiresAt: new Date(Date.now() - 1_000).toISOString() });

    const next = await getMyNetworkingState(EVENT, A.attendeeId);
    expect(next.status).toBe("setup");
    expect(next.match!.partner.attendeeId).not.toBe(firstPartner);
    expect(next.justFinishedWith).toBe(firstPartner === B.attendeeId ? "Grace" : "Linus");
    expect(next.match!.secondsUntilStart).toBeGreaterThan(0);
  });
});
