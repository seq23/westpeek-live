import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Chat at scale. Moderation (0025) gave the crew hide, silence, and lock — all-or-nothing tools
 * that do nothing about pace. A room of five hundred needs four more things, and every one of them
 * has to hold on the WRITE path, because the only client that matters in a flood is the one that
 * has stopped obeying the UI:
 *
 *   slow mode   — a crew pace per room, with crew, the host, and speakers exempt;
 *   rate limit  — always on, per person, burst then cooldown, refused server-side with a sentence;
 *   delta poll  — only what changed since the caller's cursor, and a hide or a clear propagates;
 *   clear chat  — archives the room for everyone, and archives rather than deletes.
 */

const control = vi.fn<(eventId?: string) => Promise<{ ok: true; actorRole: "crew" | "operator" | "owner" } | { ok: false; error: string }>>();
vi.mock("@/lib/auth/liveControlRequestGuard", () => ({ requireLiveEventControlAccessForRequest: (eventId?: string) => control(eventId) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { LIVE_CHAT_RATE_BURST, LIVE_CHAT_RATE_COOLDOWN_MS } from "@/services/venue/liveChatRateLimit";
import {
  clearLiveChatRoom,
  countLiveChatRoomMessages,
  getLiveChatPostWindow,
  getLiveChatRoomModeration,
  liveChatCursorOf,
  listLiveRoomChatDelta,
  listLiveRoomChatMessages,
  postLiveRoomChatMessage,
  setLiveChatMessageVisibility,
  setLiveChatRoomLock,
  setLiveChatSlowMode,
} from "@/services/venue/liveChatService";

const EVENT = "event-chat-scale";
const ROOM = { roomKind: "main_stage" as const, roomId: "main-stage" };
const sam = { attendeeId: "attendee-sam", displayName: "Sam Rivera", company: "Rivera Co" };
const kai = { attendeeId: "attendee-kai", displayName: "Kai Osei", company: "Osei Ltd" };

/** A fixed clock in the past, so a real-clock moderation stamp always sorts after these posts. */
const T0 = Date.parse("2026-09-01T12:00:00.000Z");
function at(offsetMs: number) {
  return new Date(T0 + offsetMs);
}

async function post(who: typeof sam, message: string, options: { now?: Date; posterClass?: "crew" | "speaker" | "attendee" } = {}) {
  return postLiveRoomChatMessage({ eventId: EVENT, ...ROOM, attendeeId: who.attendeeId, displayName: who.displayName, company: who.company, message, now: options.now, posterClass: options.posterClass });
}

describe("live chat at scale", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-chat-scale-"));
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    control.mockReset();
    control.mockResolvedValue({ ok: true, actorRole: "crew" });
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // 1. Slow mode -----------------------------------------------------------

  it("slow mode blocks a second post inside the window and allows it once the window has passed", async () => {
    await setLiveChatSlowMode({ eventId: EVENT, ...ROOM, slowModeSeconds: 10, actorRole: "operator" });
    expect((await getLiveChatRoomModeration(EVENT, ROOM.roomKind, ROOM.roomId)).slowModeSeconds).toBe(10);

    expect((await post(sam, "first", { now: at(0) })).ok).toBe(true);

    const tooSoon = await post(sam, "second", { now: at(4_000) });
    expect(tooSoon.ok).toBe(false);
    if (tooSoon.ok) throw new Error("unreachable");
    expect(tooSoon.rejection).toBe("slow_mode");
    expect(tooSoon.reason).toContain("Slow mode is on");
    expect(tooSoon.retryAfterSeconds).toBe(6);
    // Never a silent drop: the refused message is not in the room.
    expect((await listLiveRoomChatMessages(EVENT, ROOM.roomKind, ROOM.roomId, "crew")).map((m) => m.message)).toEqual(["first"]);

    expect((await post(sam, "second", { now: at(10_001) })).ok).toBe(true);
    expect((await listLiveRoomChatMessages(EVENT, ROOM.roomKind, ROOM.roomId, "crew")).map((m) => m.message)).toEqual(["first", "second"]);
  });

  it("slow mode is per person and per room: another attendee is not made to wait", async () => {
    await setLiveChatSlowMode({ eventId: EVENT, ...ROOM, slowModeSeconds: 30, actorRole: "operator" });
    expect((await post(sam, "sam one", { now: at(0) })).ok).toBe(true);
    expect((await post(kai, "kai one", { now: at(1_000) })).ok).toBe(true);
    expect((await post(sam, "sam two", { now: at(2_000) })).ok).toBe(false);
  });

  it("crew, the host, and speakers are exempt from slow mode; an ordinary attendee is not", async () => {
    await setLiveChatSlowMode({ eventId: EVENT, ...ROOM, slowModeSeconds: 30, actorRole: "owner" });
    expect((await post(sam, "crew one", { now: at(0), posterClass: "crew" })).ok).toBe(true);
    expect((await post(sam, "crew two", { now: at(1_000), posterClass: "crew" })).ok).toBe(true);
    expect((await post(kai, "speaker one", { now: at(2_000), posterClass: "speaker" })).ok).toBe(true);
    expect((await post(kai, "speaker two", { now: at(3_000), posterClass: "speaker" })).ok).toBe(true);
    // Same room, same seconds, no cookie: refused.
    const attendee = { attendeeId: "attendee-lee", displayName: "Lee", company: "Lee Co" };
    expect((await post(attendee, "attendee one", { now: at(4_000) })).ok).toBe(true);
    expect((await post(attendee, "attendee two", { now: at(5_000) })).ok).toBe(false);
    // And the composer is told, so it does not offer a Send the write path will refuse.
    const exempt = await getLiveChatPostWindow({ eventId: EVENT, ...ROOM, attendeeId: sam.attendeeId, posterClass: "crew", slowModeSeconds: 30 });
    expect(exempt.exempt).toBe(true);
    expect(exempt.nextPostAllowedAt).toBeUndefined();
    const held = await getLiveChatPostWindow({ eventId: EVENT, ...ROOM, attendeeId: attendee.attendeeId, posterClass: "attendee", slowModeSeconds: 30 });
    expect(held.exempt).toBe(false);
    expect(held.nextPostAllowedAt).toBe(at(4_000 + 30_000).toISOString());
  });

  it("slow mode and the lock are the same row and do not overwrite each other", async () => {
    await setLiveChatRoomLock({ eventId: EVENT, ...ROOM, locked: true, actorRole: "operator" });
    await setLiveChatSlowMode({ eventId: EVENT, ...ROOM, slowModeSeconds: 5, actorRole: "operator" });
    const room = await getLiveChatRoomModeration(EVENT, ROOM.roomKind, ROOM.roomId);
    expect(room.locked).toBe(true);
    expect(room.slowModeSeconds).toBe(5);
    await setLiveChatRoomLock({ eventId: EVENT, ...ROOM, locked: false, actorRole: "operator" });
    const reopened = await getLiveChatRoomModeration(EVENT, ROOM.roomKind, ROOM.roomId);
    expect(reopened.locked).toBe(false);
    expect(reopened.slowModeSeconds).toBe(5);
  });

  // 2. The per-person rate limit -------------------------------------------

  it("the rate limit refuses server-side with a sentence, with slow mode off and the UI bypassed", async () => {
    // No slow mode, and every call here goes straight at the service — exactly what a replayed
    // form or a script does. The limit still holds.
    for (let index = 0; index < LIVE_CHAT_RATE_BURST; index += 1) {
      expect((await post(sam, `burst ${index}`, { now: at(index * 100) })).ok).toBe(true);
    }
    const refused = await post(sam, "one too many", { now: at(600) });
    expect(refused.ok).toBe(false);
    if (refused.ok) throw new Error("unreachable");
    expect(refused.rejection).toBe("rate_limited");
    expect(refused.reason).toContain("too quickly");
    expect(refused.reason).toMatch(/\d+ seconds/);
    expect(refused.retryAfterSeconds).toBe(LIVE_CHAT_RATE_COOLDOWN_MS / 1000);
    // Refused, not dropped: the room holds exactly the accepted posts.
    expect(await countLiveChatRoomMessages(EVENT, ROOM.roomKind, ROOM.roomId)).toBe(LIVE_CHAT_RATE_BURST);
    // Still refused inside the cooldown, and posting again once it has passed.
    expect((await post(sam, "still too soon", { now: at(5_000) })).ok).toBe(false);
    expect((await post(sam, "after the cooldown", { now: at(LIVE_CHAT_RATE_COOLDOWN_MS + 1_000) })).ok).toBe(true);
    // One person's flood never gags the room.
    expect((await post(kai, "unaffected", { now: at(700) })).ok).toBe(true);
  });

  // 3. Delta polling -------------------------------------------------------

  it("the delta returns only what is new, and a hide comes back as a removal so it disappears everywhere", async () => {
    const first = await post(sam, "first", { now: at(0) });
    const second = await post(kai, "second", { now: at(1_000) });
    if (!first.ok || !second.ok) throw new Error("setup posts must be accepted");
    const cursor = liveChatCursorOf([first.message, second.message]);

    // Nothing new: an empty delta, not the window again.
    const quiet = await listLiveRoomChatDelta({ eventId: EVENT, ...ROOM, since: cursor, viewer: "attendee", attendeeId: sam.attendeeId });
    expect(quiet.messages).toEqual([]);
    expect(quiet.removedIds).toEqual([]);

    const third = await post(sam, "third", { now: at(12_000) });
    if (!third.ok) throw new Error("third post must be accepted");
    const fresh = await listLiveRoomChatDelta({ eventId: EVENT, ...ROOM, since: cursor, viewer: "attendee", attendeeId: sam.attendeeId });
    expect(fresh.messages.map((m) => m.message)).toEqual(["third"]);

    // A hide reaches an open page as a removal, and the crew still receives the row, tagged.
    await setLiveChatMessageVisibility({ eventId: EVENT, messageId: first.message.id, hidden: true, actorRole: "operator" });
    const afterHide = await listLiveRoomChatDelta({ eventId: EVENT, ...ROOM, since: fresh.cursor, viewer: "attendee", attendeeId: sam.attendeeId });
    expect(afterHide.removedIds).toContain(first.message.id);
    expect(afterHide.messages.map((m) => m.id)).not.toContain(first.message.id);
    const crewDelta = await listLiveRoomChatDelta({ eventId: EVENT, ...ROOM, since: fresh.cursor, viewer: "crew" });
    expect(crewDelta.messages.map((m) => m.id)).toContain(first.message.id);
    expect(crewDelta.removedIds).not.toContain(first.message.id);
  });

  it("the delta carries the standing state, so a silence, a lock, or slow mode reaches an open page", async () => {
    const posted = await post(sam, "hello", { now: at(0) });
    if (!posted.ok) throw new Error("setup post must be accepted");
    await setLiveChatSlowMode({ eventId: EVENT, ...ROOM, slowModeSeconds: 30, actorRole: "operator" });
    await setLiveChatRoomLock({ eventId: EVENT, ...ROOM, locked: true, actorRole: "operator" });
    const delta = await listLiveRoomChatDelta({ eventId: EVENT, ...ROOM, since: liveChatCursorOf([posted.message]), viewer: "attendee", attendeeId: sam.attendeeId });
    expect(delta.locked).toBe(true);
    expect(delta.slowModeSeconds).toBe(30);
    expect(delta.you.nextPostAllowedAt).toBe(at(30_000).toISOString());
  });

  // 4. Clear chat ----------------------------------------------------------

  it("clear chat empties the room for a second viewer, archives rather than deletes, and says how many", async () => {
    const first = await post(sam, "one", { now: at(0) });
    await post(kai, "two", { now: at(1_000) });
    await post(sam, "three", { now: at(12_000) });
    if (!first.ok) throw new Error("setup post must be accepted");
    expect(await countLiveChatRoomMessages(EVENT, ROOM.roomKind, ROOM.roomId)).toBe(3);

    const cleared = await clearLiveChatRoom({ eventId: EVENT, ...ROOM, actorRole: "operator" });
    expect(cleared.clearedCount).toBe(3);

    // Gone for the attendee AND for the crew — a cleared room is cleared for everyone.
    expect(await listLiveRoomChatMessages(EVENT, ROOM.roomKind, ROOM.roomId, "attendee")).toEqual([]);
    expect(await listLiveRoomChatMessages(EVENT, ROOM.roomKind, ROOM.roomId, "crew")).toEqual([]);
    // A second viewer polling with an old cursor is told to drop them, and sees the clear stamp.
    const delta = await listLiveRoomChatDelta({ eventId: EVENT, ...ROOM, since: liveChatCursorOf([first.message]), viewer: "attendee", attendeeId: kai.attendeeId });
    expect(delta.messages).toEqual([]);
    expect(delta.removedIds).toHaveLength(3);
    expect(delta.clearedAt).toBe(cleared.clearedAt);

    // Archived, not deleted: every row is still there, stamped with who cleared it.
    const rows = await getRuntimeStore().listLiveChatMessagesSince(EVENT, ROOM.roomKind, ROOM.roomId, new Date(0).toISOString());
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.archivedAt && row.archivedBy === "operator")).toBe(true);
    // And the room carries the clear so the crew card can name it.
    const room = await getLiveChatRoomModeration(EVENT, ROOM.roomKind, ROOM.roomId);
    expect(room.clearedCount).toBe(3);
    expect(room.clearedBy).toBe("operator");
    // A cleared room still takes new messages.
    expect((await post(kai, "after the clear", { now: at(30_000) })).ok).toBe(true);
    expect((await listLiveRoomChatMessages(EVENT, ROOM.roomKind, ROOM.roomId, "attendee")).map((m) => m.message)).toEqual(["after the clear"]);
  });
});
