import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real special-guest flow. Under test: LiveKit grants (a speaker gets the green room only
 * until brought to the stage; an attendee never gets a green-room token; send-backstage revokes),
 * the bring / go-on-stage / send-backstage ordering, cue-deck versioning (producer saves are
 * approved, speaker pastes are pending until approved, in order), that a speaker only ever reads
 * their own cards through the polling route, and that every crew action is refused without a
 * crew/operator/owner cookie.
 */

const control = vi.fn<(eventId?: string) => Promise<{ ok: true; actorRole: "crew" | "operator" | "owner" } | { ok: false; error: string }>>();
vi.mock("@/lib/auth/liveControlRequestGuard", () => ({ requireLiveEventControlAccessForRequest: (eventId?: string) => control(eventId) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const removed: string[] = [];
vi.mock("@/services/video/livekitParticipantAdmin", () => ({ removeLiveKitParticipantFromMainStage: async (input: { attendeeId: string }) => { removed.push(input.attendeeId); return { status: "removed" }; } }));
// A tiny cookie jar standing in for next/headers so identity registration and reads are real.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));
// The special-guest cookie itself is signed; stand in for its read with a role the test controls.
const guestAccess = vi.fn<() => Promise<{ role: "speaker" | "sponsor" | "vip" | "client"; eventId: string } | undefined>>();
vi.mock("@/services/guests/guestIdentityService", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/guests/guestIdentityService")>();
  return { ...original, getCurrentSpecialGuestAccess: () => guestAccess() };
});

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { decideGuestVideoGrant } from "@/services/guests/guestVideoGrants";
import { getCurrentGuestIdentity, GUEST_IDENTITY_COOKIE, listGuestProfiles, registerGuestIdentity } from "@/services/guests/guestIdentityService";
import { approvePendingCueDeck, bringSpeakerToStage, discardPendingCueDeck, getSpeakerCueDeck, getSpeakerStageState, markSpeakerOnStage, parseCueCardLines, saveCueDeckVersion, sendSpeakerBackstage, submitCueDeckVersion } from "@/services/guests/guestStateService";
import { approveSpeakerCueDeckAction, bringSpeakerToStageAction, pushLiveCueAction, saveProducerCueDeckAction, saveProducerNotesAction, sendSpeakerBackstageAction, setVipRoomAction } from "@/lib/actions/speakerStageActions";
import { GET as cueDeckGet } from "@/app/api/speaker/cue-deck/route";
import type { SpeakerCueDeckState } from "@/types/specialGuest";

const EVENT = "event-green-room-test";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("LiveKit grants for guests (pure)", () => {
  it("a speaker gets the green room always, the stage only once brought up; attendees never get the green room", () => {
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "green_room" })).toMatchObject({ ok: true, canPublish: true });
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "main_stage" })).toMatchObject({ ok: false });
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "main_stage", stageState: { status: "backstage", updatedBy: "crew", updatedAt: "" } })).toMatchObject({ ok: false });
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "main_stage", stageState: { status: "invited", updatedBy: "crew", updatedAt: "" } })).toMatchObject({ ok: true, canPublish: true });
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "main_stage", stageState: { status: "on_stage", updatedBy: "crew", updatedAt: "" } })).toMatchObject({ ok: true, canPublish: true });
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "breakout", stageState: { status: "on_stage", updatedBy: "crew", updatedAt: "" } })).toMatchObject({ ok: false });
    expect(decideGuestVideoGrant({ role: "attendee", roomType: "green_room" })).toMatchObject({ ok: false });
    expect(decideGuestVideoGrant({ role: "observer", roomType: "green_room" })).toMatchObject({ ok: false });
    expect(decideGuestVideoGrant({ role: "sponsor", roomType: "green_room" })).toMatchObject({ ok: false });
    expect(decideGuestVideoGrant({ role: "producer", roomType: "green_room" })).toMatchObject({ ok: true, canPublish: true });
    expect(decideGuestVideoGrant({ role: "host", roomType: "main_stage" })).toMatchObject({ ok: true, canPublish: true });
  });
});

describe("cue deck versioning (pure)", () => {
  it("producer saves are approved on save, speaker pastes are pending until approved, versions count up in order", () => {
    let deck: SpeakerCueDeckState = { nextVersionNumber: 1 };
    deck = submitCueDeckVersion(deck, { cards: parseCueCardLines("Open | Thank the host\nStory | The outage\nClose | Invite Q&A"), talkingPoints: ["Pain first"], author: "producer", authorLabel: "crew" });
    expect(deck.approved).toMatchObject({ versionNumber: 1, status: "approved", author: "producer", approvedBy: "crew" });
    expect(deck.approved?.cards.map((card) => card.title)).toEqual(["Open", "Story", "Close"]);
    expect(deck.pending).toBeUndefined();

    deck = submitCueDeckVersion(deck, { cards: [{ title: "My opener", body: "Start with the joke" }], talkingPoints: [], author: "speaker", authorLabel: "Ada" });
    expect(deck.approved?.versionNumber).toBe(1);
    expect(deck.pending).toMatchObject({ versionNumber: 2, status: "pending", author: "speaker", authorLabel: "Ada" });

    const approved = approvePendingCueDeck(deck, "operator");
    expect(approved.approved).toMatchObject({ versionNumber: 2, status: "approved", approvedBy: "operator" });
    expect(approved.pending).toBeUndefined();
    expect(approved.nextVersionNumber).toBe(3);

    const again = submitCueDeckVersion(approved, { cards: [{ title: "Another", body: "" }], talkingPoints: [], author: "speaker", authorLabel: "Ada" });
    expect(again.pending?.versionNumber).toBe(3);
    const discarded = discardPendingCueDeck(again);
    expect(discarded.approved?.versionNumber).toBe(2);
    expect(discarded.pending).toBeUndefined();

    // A producer save while a speaker version is pending keeps the pending one waiting.
    const withPending = submitCueDeckVersion(again, { cards: [{ title: "Producer v4", body: "" }], talkingPoints: [], author: "producer", authorLabel: "crew" });
    expect(withPending.approved?.versionNumber).toBe(4);
    expect(withPending.pending?.versionNumber).toBe(3);
    expect(approvePendingCueDeck({ nextVersionNumber: 1 }, "crew")).toEqual({ nextVersionNumber: 1 });
  });
});

describe("speaker stage flow, identity, own-cards-only, and guards (store-backed)", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-green-room-"));
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    control.mockReset();
    guestAccess.mockReset();
    jar.clear();
    removed.length = 0;
    control.mockResolvedValue({ ok: true, actorRole: "crew" });
  });
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("identity from the code: registered once, bound to the browser, scoped to the event and role, listed for the roster", async () => {
    const ada = await registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "  Ada   Lovelace ", company: "Analytical", title: "Founder" });
    expect(ada).toMatchObject({ name: "Ada Lovelace", role: "speaker", eventId: EVENT });
    expect(jar.get(GUEST_IDENTITY_COOKIE)).toBe(`${EVENT}.${ada.guestId}`);
    expect(await getCurrentGuestIdentity(EVENT, "speaker")).toMatchObject({ guestId: ada.guestId });
    expect(await getCurrentGuestIdentity(EVENT, "sponsor")).toBeUndefined();
    expect(await getCurrentGuestIdentity("other-event", "speaker")).toBeUndefined();
    const corrected = await registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "Ada L.", existingGuestId: ada.guestId });
    expect(corrected.guestId).toBe(ada.guestId);
    expect((await listGuestProfiles(EVENT, "speaker")).map((item) => item.name)).toEqual(["Ada L."]);
    await expect(registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "   " })).rejects.toThrow(/name is required/);
  });

  it("bring to stage → invited; the speaker goes on stage; send backstage revokes and drops them from the stage room; a speaker cannot self-grant", async () => {
    const ada = await registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "Ada" });
    expect((await getSpeakerStageState(EVENT, ada.guestId)).status).toBe("backstage");
    expect((await markSpeakerOnStage(EVENT, ada.guestId)).status).toBe("backstage");

    await bringSpeakerToStageAction(form({ eventId: EVENT, speakerId: ada.guestId }));
    expect(await getSpeakerStageState(EVENT, ada.guestId)).toMatchObject({ status: "invited", updatedBy: "crew" });
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "main_stage", stageState: await getSpeakerStageState(EVENT, ada.guestId) })).toMatchObject({ ok: true });

    expect((await markSpeakerOnStage(EVENT, ada.guestId)).status).toBe("on_stage");

    await sendSpeakerBackstageAction(form({ eventId: EVENT, speakerId: ada.guestId }));
    expect((await getSpeakerStageState(EVENT, ada.guestId)).status).toBe("backstage");
    expect(removed).toEqual([ada.guestId]);
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "main_stage", stageState: await getSpeakerStageState(EVENT, ada.guestId) })).toMatchObject({ ok: false });
    // The green room grant never depended on the stage state.
    expect(decideGuestVideoGrant({ role: "speaker", roomType: "green_room", stageState: await getSpeakerStageState(EVENT, ada.guestId) })).toMatchObject({ ok: true });
  });

  it("a speaker only ever reads their own approved cards through the polling route; crew may read any; anonymous is refused", async () => {
    const ada = await registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "Ada" });
    const adaCookie = jar.get(GUEST_IDENTITY_COOKIE) as string;
    const grace = await registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "Grace" });
    const graceCookie = jar.get(GUEST_IDENTITY_COOKIE) as string;
    await saveCueDeckVersion(EVENT, ada.guestId, { cards: [{ title: "Ada only", body: "" }], talkingPoints: [], author: "producer", authorLabel: "crew" });
    await saveCueDeckVersion(EVENT, grace.guestId, { cards: [{ title: "Grace only", body: "" }], talkingPoints: [], author: "producer", authorLabel: "crew" });

    jar.set(GUEST_IDENTITY_COOKIE, adaCookie);
    const adaView = await (await cueDeckGet(new Request(`http://local/api/speaker/cue-deck?eventId=${EVENT}&speakerId=${grace.guestId}`))).json();
    expect(adaView.speakerId).toBe(ada.guestId);
    expect(adaView.approved.cards[0].title).toBe("Ada only");

    jar.set(GUEST_IDENTITY_COOKIE, graceCookie);
    const graceView = await (await cueDeckGet(new Request(`http://local/api/speaker/cue-deck?eventId=${EVENT}`))).json();
    expect(graceView.approved.cards[0].title).toBe("Grace only");

    jar.clear();
    const crewView = await (await cueDeckGet(new Request(`http://local/api/speaker/cue-deck?eventId=${EVENT}&speakerId=${ada.guestId}`))).json();
    expect(crewView.approved.cards[0].title).toBe("Ada only");

    control.mockResolvedValue({ ok: false, error: "Owner, showrunner/operator, or crew access required." });
    const anonymous = await cueDeckGet(new Request(`http://local/api/speaker/cue-deck?eventId=${EVENT}&speakerId=${ada.guestId}`));
    expect(anonymous.status).toBe(403);
  });

  it("the crew's cue-deck save is live at once; the speaker's paste waits; approve makes it live", async () => {
    const ada = await registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "Ada" });
    await saveProducerCueDeckAction(form({ eventId: EVENT, speakerId: ada.guestId, cards: "One | first\nTwo | second\nThree | third", talkingPoints: "- a\n- b", script: "" }));
    let deck = await getSpeakerCueDeck(EVENT, ada.guestId);
    expect(deck.approved?.cards.map((card) => card.title)).toEqual(["One", "Two", "Three"]);
    expect(deck.approved?.talkingPoints).toEqual(["a", "b"]);
    await saveCueDeckVersion(EVENT, ada.guestId, { cards: [{ title: "Mine", body: "" }], talkingPoints: [], author: "speaker", authorLabel: "Ada" });
    deck = await getSpeakerCueDeck(EVENT, ada.guestId);
    expect(deck.approved?.versionNumber).toBe(1);
    expect(deck.pending?.versionNumber).toBe(2);
    await approveSpeakerCueDeckAction(form({ eventId: EVENT, speakerId: ada.guestId, decision: "approve" }));
    deck = await getSpeakerCueDeck(EVENT, ada.guestId);
    expect(deck.approved?.cards[0].title).toBe("Mine");
    expect(deck.pending).toBeUndefined();
    await pushLiveCueAction(form({ eventId: EVENT, speakerId: ada.guestId, cue: "wrap in 2 min" }));
    const cue = await (await cueDeckGet(new Request(`http://local/api/speaker/cue-deck?eventId=${EVENT}&speakerId=${ada.guestId}`))).json();
    expect(cue.liveCue).toMatchObject({ text: "wrap in 2 min", pushedBy: "crew" });
  });

  it("every crew action is refused without a crew, operator, or owner cookie and changes nothing", async () => {
    const ada = await registerGuestIdentity({ eventId: EVENT, role: "speaker", name: "Ada" });
    control.mockResolvedValue({ ok: false, error: "Owner, showrunner/operator, or crew access required." });
    await expect(bringSpeakerToStageAction(form({ eventId: EVENT, speakerId: ada.guestId }))).rejects.toThrow(/crew access required/);
    await expect(sendSpeakerBackstageAction(form({ eventId: EVENT, speakerId: ada.guestId }))).rejects.toThrow(/crew access required/);
    await expect(saveProducerCueDeckAction(form({ eventId: EVENT, speakerId: ada.guestId, cards: "x" }))).rejects.toThrow(/crew access required/);
    await expect(approveSpeakerCueDeckAction(form({ eventId: EVENT, speakerId: ada.guestId }))).rejects.toThrow(/crew access required/);
    await expect(pushLiveCueAction(form({ eventId: EVENT, speakerId: ada.guestId, cue: "x" }))).rejects.toThrow(/crew access required/);
    await expect(saveProducerNotesAction(form({ eventId: EVENT, notes: "x" }))).rejects.toThrow(/crew access required/);
    await expect(setVipRoomAction(form({ eventId: EVENT, open: "true" }))).rejects.toThrow(/crew access required/);
    expect((await getSpeakerStageState(EVENT, ada.guestId)).status).toBe("backstage");
    expect((await getSpeakerCueDeck(EVENT, ada.guestId)).approved).toBeUndefined();
    expect(removed).toEqual([]);
  });
});
