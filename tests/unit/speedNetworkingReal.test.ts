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
import { getMyNetworkingState, joinNetworkingQueue, leaveNetworkingQueue, nextNetworkingMatch, runNetworkingMatcher, setNetworkingSettings, tokenAllowedForRoom, findActiveMatchForRoom, crewNetworkingSummary } from "@/services/speed-networking/speedNetworkingService";
import { speedNetworkingRoomName } from "@/types/speedNetworking";

const EVENT = "net-test-event";
const A = { attendeeId: "att-a", displayName: "Ada", company: "Engines", title: "Founder" };
const B = { attendeeId: "att-b", displayName: "Grace", company: "Navy", title: "Admiral" };
const C = { attendeeId: "att-c", displayName: "Linus", company: "Kernel", title: "BDFL" };

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
    const a = await getMyNetworkingState(EVENT, A.attendeeId);
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
    const states = await Promise.all([A, B, C].map((who) => getMyNetworkingState(EVENT, who.attendeeId)));
    const matched = states.filter((state) => state.status === "matched");
    expect(matched).toHaveLength(2);
    const pair = matched.map((state) => state.match!.partner.attendeeId).sort();
    expect(pair).not.toEqual(["att-a", "att-b"]);
    expect(afterNext.status === "matched" || afterNext.status === "waiting").toBe(true);
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
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    expect((await getMyNetworkingState(EVENT, A.attendeeId)).status).toBe("closed");
    await setNetworkingSettings(EVENT, { open: true, matchMinutes: 2 }, "owner");
    const a = await getMyNetworkingState(EVENT, A.attendeeId);
    expect(a.status).toBe("matched");
    expect(new Date(a.match!.expiresAt).getTime() - new Date(a.match!.startsAt).getTime()).toBe(2 * 60_000);
    await leaveNetworkingQueue(EVENT, A.attendeeId, "ended");
    expect((await getMyNetworkingState(EVENT, A.attendeeId)).status).toBe("idle");
    expect((await getMyNetworkingState(EVENT, B.attendeeId)).status).toBe("waiting");
  });

  it("a room token goes only to the two matched attendees of that active match", async () => {
    await joinNetworkingQueue(EVENT, A);
    await joinNetworkingQueue(EVENT, B);
    await joinNetworkingQueue(EVENT, C);
    const a = await getMyNetworkingState(EVENT, A.attendeeId);
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
