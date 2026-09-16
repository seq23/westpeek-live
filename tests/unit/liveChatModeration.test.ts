import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Crew chat moderation. Before this existed, moderationStatus was a field
 * nothing set, the command page's "Chat moderation queue" was a sentence, and
 * the attendee chat promised "Crew can moderate or lock this room" with no
 * crew control anywhere. The contract under test: hide removes a message from
 * the attendee listing but not the crew listing; silence and lock are enforced
 * on the WRITE PATH (a stale form cannot get past them); every crew action is
 * refused without a crew/operator/owner cookie.
 */

const control = vi.fn<(eventId?: string) => Promise<{ ok: true; actorRole: "crew" | "operator" | "owner" } | { ok: false; error: string }>>();
vi.mock("@/lib/auth/liveControlRequestGuard", () => ({ requireLiveEventControlAccessForRequest: (eventId?: string) => control(eventId) }));
const identity = vi.fn<() => Promise<{ attendeeId: string; displayName: string; company: string; title: string; role: "attendee" } | undefined>>();
vi.mock("@/services/attendees/attendeeSessionService", () => ({ getCurrentAttendeeIdentity: () => identity() }));
const revalidated: string[] = [];
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => { revalidated.push(p); } }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { getLiveChatAttendeeModeration, getLiveChatModerationQueue, getLiveChatRoomModeration, listLiveRoomChatMessages, postLiveRoomChatMessage } from "@/services/venue/liveChatService";
import { lockLiveChatRoom, moderateLiveChatMessage, sendLiveRoomChatMessage, silenceLiveChatAttendee } from "@/lib/actions/liveChatActions";
import { LIVE_CHAT_LOCKED_MESSAGE, LIVE_CHAT_SILENCED_MESSAGE } from "@/types/liveChat";

const EVENT = "event-mod-test";
const sam = { attendeeId: "attendee-sam", displayName: "Sam Rivera", company: "Rivera Co", title: "Founder", role: "attendee" as const };
const kai = { attendeeId: "attendee-kai", displayName: "Kai Osei", company: "Osei Ltd", title: "CTO", role: "attendee" as const };

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

async function post(who: typeof sam, message: string, roomKind = "main_stage", roomId = "main-stage") {
  return postLiveRoomChatMessage({ eventId: EVENT, roomKind: roomKind as "main_stage", roomId, attendeeId: who.attendeeId, displayName: who.displayName, company: who.company, message });
}

describe("live chat moderation", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-chat-mod-"));
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    control.mockReset();
    identity.mockReset();
    revalidated.length = 0;
    control.mockResolvedValue({ ok: true, actorRole: "crew" });
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("hide removes a message from the attendee listing, keeps it for crew with the moderator role, and restore brings it back", async () => {
    const first = await post(sam, "hello everyone");
    const second = await post(kai, "something rude");
    expect(first.ok && second.ok).toBe(true);
    const rudeId = second.ok ? second.message.id : "";

    await moderateLiveChatMessage(form({ eventId: EVENT, messageId: rudeId, roomKind: "main_stage", roomId: "main-stage", action: "hide" }));

    const attendeeView = await listLiveRoomChatMessages(EVENT, "main_stage", "main-stage", "attendee");
    expect(attendeeView.map((m) => m.message)).toEqual(["hello everyone"]);
    const crewView = await listLiveRoomChatMessages(EVENT, "main_stage", "main-stage", "crew");
    expect(crewView.map((m) => m.message)).toEqual(["hello everyone", "something rude"]);
    const hidden = crewView.find((m) => m.id === rudeId);
    expect(hidden).toMatchObject({ moderationStatus: "hidden", moderatedBy: "crew" });
    expect(hidden?.moderatedAt).toBeTruthy();

    const queue = await getLiveChatModerationQueue(EVENT);
    expect(queue.messages.find((m) => m.id === rudeId)?.moderationStatus).toBe("hidden");

    await moderateLiveChatMessage(form({ eventId: EVENT, messageId: rudeId, roomKind: "main_stage", roomId: "main-stage", action: "restore" }));
    const restored = await listLiveRoomChatMessages(EVENT, "main_stage", "main-stage", "attendee");
    expect(restored.map((m) => m.message)).toEqual(["hello everyone", "something rude"]);
  });

  it("silence rejects the attendee's post server-side with the exact message, is room-scoped, and unsilence lifts it", async () => {
    control.mockResolvedValue({ ok: true, actorRole: "operator" });
    await silenceLiveChatAttendee(form({ eventId: EVENT, attendeeId: kai.attendeeId, roomKind: "main_stage", roomId: "main-stage", silenced: "true", reason: "spam" }));

    expect(await getLiveChatAttendeeModeration(EVENT, "main_stage", "main-stage", kai.attendeeId)).toMatchObject({ silenced: true, silencedBy: "operator", reason: "spam" });
    const rejected = await post(kai, "still here");
    expect(rejected).toEqual({ ok: false, rejection: "silenced", reason: LIVE_CHAT_SILENCED_MESSAGE });
    expect(await listLiveRoomChatMessages(EVENT, "main_stage", "main-stage", "crew")).toHaveLength(0);

    // Other attendees and other rooms are untouched.
    expect((await post(sam, "unaffected")).ok).toBe(true);
    expect((await post(kai, "breakout is fine", "breakout", "general-breakout")).ok).toBe(true);

    const queue = await getLiveChatModerationQueue(EVENT);
    expect(queue.silencedAttendeeIds.has(kai.attendeeId)).toBe(true);

    await silenceLiveChatAttendee(form({ eventId: EVENT, attendeeId: kai.attendeeId, roomKind: "main_stage", roomId: "main-stage", silenced: "false" }));
    expect((await post(kai, "back again")).ok).toBe(true);
    expect((await getLiveChatModerationQueue(EVENT)).silencedAttendees).toHaveLength(0);
  });

  it("lock rejects every attendee post in that room with the exact message and unlock reopens it", async () => {
    control.mockResolvedValue({ ok: true, actorRole: "owner" });
    await lockLiveChatRoom(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", locked: "true" }));
    expect(await getLiveChatRoomModeration(EVENT, "main_stage", "main-stage")).toMatchObject({ locked: true, lockedBy: "owner" });

    expect(await post(sam, "locked out")).toEqual({ ok: false, rejection: "locked", reason: LIVE_CHAT_LOCKED_MESSAGE });
    expect(await post(kai, "me too")).toMatchObject({ ok: false, rejection: "locked" });
    expect((await post(sam, "breakout still open", "breakout", "general-breakout")).ok).toBe(true);
    expect((await getLiveChatModerationQueue(EVENT)).lockedRooms.map((r) => r.roomId)).toEqual(["main-stage"]);

    await lockLiveChatRoom(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", locked: "false" }));
    expect(await getLiveChatRoomModeration(EVENT, "main_stage", "main-stage")).toEqual({ locked: false });
    expect((await post(sam, "open again")).ok).toBe(true);
  });

  it("the attendee send action goes through the same rules: a silenced attendee's form submit stores nothing", async () => {
    identity.mockResolvedValue(kai);
    await sendLiveRoomChatMessage(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", message: "first" }));
    await silenceLiveChatAttendee(form({ eventId: EVENT, attendeeId: kai.attendeeId, roomKind: "main_stage", roomId: "main-stage", silenced: "true" }));
    await sendLiveRoomChatMessage(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", message: "second" }));
    expect((await listLiveRoomChatMessages(EVENT, "main_stage", "main-stage", "crew")).map((m) => m.message)).toEqual(["first"]);
    // The room re-renders so the attendee sees the silenced notice in place of the input.
    expect(revalidated).toContain(`/venue/${EVENT}/stage`);
  });

  it("every crew action is refused without a crew, operator, or owner cookie and changes nothing", async () => {
    const posted = await post(kai, "keep me");
    const id = posted.ok ? posted.message.id : "";
    control.mockResolvedValue({ ok: false, error: "Owner, showrunner/operator, or crew access required." });
    await expect(moderateLiveChatMessage(form({ eventId: EVENT, messageId: id, action: "hide" }))).rejects.toThrow(/crew access required/);
    await expect(silenceLiveChatAttendee(form({ eventId: EVENT, attendeeId: kai.attendeeId, silenced: "true" }))).rejects.toThrow(/crew access required/);
    await expect(lockLiveChatRoom(form({ eventId: EVENT, roomKind: "main_stage", roomId: "main-stage", locked: "true" }))).rejects.toThrow(/crew access required/);
    expect((await listLiveRoomChatMessages(EVENT, "main_stage", "main-stage", "attendee")).map((m) => m.message)).toEqual(["keep me"]);
    expect(await getLiveChatAttendeeModeration(EVENT, "main_stage", "main-stage", kai.attendeeId)).toEqual({ silenced: false });
    expect(await getLiveChatRoomModeration(EVENT, "main_stage", "main-stage")).toEqual({ locked: false });
  });

  it("the queue is newest first, bounded, and spans every room of the event only", async () => {
    for (let index = 0; index < 5; index += 1) await post(sam, `main ${index}`);
    await post(kai, "breakout msg", "breakout", "general-breakout");
    await postLiveRoomChatMessage({ eventId: "other-event", roomKind: "main_stage", roomId: "main-stage", attendeeId: "x", displayName: "X", message: "not mine" });
    const queue = await getLiveChatModerationQueue(EVENT, 3);
    expect(queue.messages).toHaveLength(3);
    expect(queue.messages.every((m) => m.eventId === EVENT)).toBe(true);
    expect(queue.messages[0].message).toBe("breakout msg");
  });
});
