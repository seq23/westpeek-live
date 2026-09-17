import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An old code against the store. The bug this proves gone: Adopt moved
 * 45-minute-ai-workshop from WPL-GE43TU to WPL-45MINU and the link already sent answered "That code
 * did not match an event", identical to a typo.
 *
 * The two halves of the fix pull in opposite directions and both are asserted here. An old ATTENDEE
 * event code must RESOLVE, because it is an invitation and we are the ones who changed it. An old
 * PRIVILEGED code must REFUSE, because ending somebody's access is the whole reason to rotate one —
 * so there is an explicit test that the refusal grants nothing, not merely that the wording is nice.
 */
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { adoptReadableCodes, setEventAccessCode } from "@/services/events/accessCodeService";
import { revokeHostLinks } from "@/services/events/hostLinkService";
import { resolveEventJoinCode } from "@/services/events/eventStateResolver";
import { resolveCrewAccess, resolveSpecialGuestAccess } from "@/services/access/eventAccessResolver";
import { describeCodeChangeImpact, findSupersededCode, listSupersededCodes } from "@/services/events/supersededCodeService";
import { SUPERSEDED_CODE_WINDOW_DAYS, supersededCodeIsLive, supersededPrivilegedMessage } from "@/types/supersededCode";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };
const DAY_MS = 24 * 60 * 60 * 1000;

describe("superseded access codes", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-superseded-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    jar.clear();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a superseded attendee code resolves to the event and carries the changed-code notice", async () => {
    const event = await createEventRecord({ name: `Superseded join ${Date.now()}`, when: "now" }, owner);
    const oldCode = event.joinCode;
    expect(await setEventAccessCode(event.id, "join", { value: "wpl-newdoor" }, "owner")).toMatchObject({ ok: true });
    resetOverlayForTests();

    // The current code resolves with nothing to explain.
    const current = await resolveEventJoinCode("wpl-newdoor");
    expect(current.ok).toBe(true);
    expect(current.supersededCode).toBeUndefined();

    // The old one lands on the same event and says the code changed. No retyping, no second form.
    const stale = await resolveEventJoinCode(oldCode);
    expect(stale.ok).toBe(true);
    expect(stale.eventId).toBe(event.id);
    expect(stale.destination).toBe(current.destination);
    expect(stale.supersededCode).toBe(oldCode.toUpperCase());

    // And the way a phone mangles it still finds it: capitals, a space, the prefix dropped.
    for (const typed of [oldCode.toUpperCase(), oldCode.replace("-", " "), oldCode.replace("wpl-", "")]) {
      expect((await resolveEventJoinCode(typed)).eventId, typed).toBe(event.id);
    }
  });

  it("a superseded crew code is refused with the informative message and grants nothing", async () => {
    const event = await createEventRecord({ name: `Superseded crew ${Date.now()}`, when: "now" }, owner);
    const oldCrew = event.accessCodes.crew;
    expect(await setEventAccessCode(event.id, "crew", { value: "crew-day-two" }, "owner")).toMatchObject({ ok: true });
    resetOverlayForTests();

    const refused = await resolveCrewAccess(event.joinCode, "producer", oldCrew);
    // The refusal is the load-bearing assertion: rotation must genuinely revoke.
    expect(refused.ok).toBe(false);
    expect(refused.destination).toBeUndefined();
    expect(refused.role).toBeUndefined();
    expect(refused.reason).toBe("superseded_code");
    expect(refused.supersededField).toBe("crew");
    expect(refused.message).toMatch(/^This crew code was replaced on \d+ \w+\. Ask the producer for the current one\.$/);
    // It must not be the generic answer, and it must never hand back the new code.
    expect(refused.message).not.toMatch(/did not match/);
    expect(refused.message.toUpperCase()).not.toContain("CREW-DAY-TWO");
    // The current code still opens the door.
    expect((await resolveCrewAccess(event.joinCode, "producer", "crew day two")).ok).toBe(true);
  });

  it("a superseded speaker code is refused informatively; the current one still grants", async () => {
    const event = await createEventRecord({ name: `Superseded speaker ${Date.now()}`, when: "now" }, owner);
    const oldSpeaker = event.accessCodes.speaker;
    await setEventAccessCode(event.id, "speaker", { regenerate: true }, "owner");
    resetOverlayForTests();
    const refused = await resolveSpecialGuestAccess(event.joinCode, oldSpeaker);
    expect(refused.ok).toBe(false);
    expect(refused.destination).toBeUndefined();
    expect(refused.reason).toBe("superseded_code");
    expect(refused.supersededField).toBe("speaker");
    expect(refused.message).toContain("Ask the producer for the current one.");
  });

  it("an unknown code still gets the ordinary not-found, at the join page and at both gates", async () => {
    const event = await createEventRecord({ name: `Superseded unknown ${Date.now()}`, when: "now" }, owner);
    await setEventAccessCode(event.id, "join", { value: "wpl-moved" }, "owner");
    resetOverlayForTests();
    const invented = await resolveEventJoinCode("wpl-zzzzzz");
    expect(invented.ok).toBe(false);
    expect(invented.reason).toBe("invalid_code");
    expect(invented.supersededCode).toBeUndefined();
    const guest = await resolveSpecialGuestAccess("wpl-moved", "SPK-NOPE01");
    expect(guest.reason).toBe("invalid_role_code");
    const crew = await resolveCrewAccess("wpl-moved", "crew", "not-the-code");
    expect(crew.reason).toBe("invalid_password");
  });

  it("the window expires: an old code answers inside 90 days and is forgotten after", async () => {
    const event = await createEventRecord({ name: `Superseded window ${Date.now()}`, when: "now" }, owner);
    const oldCode = event.joinCode;
    await setEventAccessCode(event.id, "join", { value: "wpl-window" }, "owner");
    resetOverlayForTests();
    const [record] = await listSupersededCodes(event.id);
    expect(record.code).toBe(oldCode);
    expect(record.reason).toBe("custom");

    const inside = new Date(Date.now() + (SUPERSEDED_CODE_WINDOW_DAYS - 1) * DAY_MS);
    const outside = new Date(Date.now() + (SUPERSEDED_CODE_WINDOW_DAYS + 1) * DAY_MS);
    expect(supersededCodeIsLive(record, inside)).toBe(true);
    expect(supersededCodeIsLive(record, outside)).toBe(false);
    expect(await findSupersededCode(oldCode, inside)).toBeDefined();
    expect(await findSupersededCode(oldCode, outside)).toBeUndefined();

    // Past the window the old code is a stranger again, not an event.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(outside);
      expect((await resolveEventJoinCode(oldCode)).reason).toBe("invalid_code");
    } finally {
      vi.useRealTimers();
    }
  });

  it("Adopt records every code it replaces, tagged as an adopt, and leaves hand-set codes alone", async () => {
    const event = await createEventRecord({ name: `Adopt history ${Date.now()}`, when: "now" }, owner);
    await setEventAccessCode(event.id, "vip", { value: "gold-room" }, "owner");
    const before = await listSupersededCodes(event.id);
    const result = await adoptReadableCodes(event.id, "owner");
    expect(result.ok).toBe(true);
    expect(result.kept).toContain("vip"); // a custom code is a decision, so it is not replaced
    const after = await listSupersededCodes(event.id);
    // One history row per code Adopt actually changed, and not one for the code it kept.
    expect(after.length - before.length).toBe(result.changed?.length);
    expect(after.filter((row) => row.reason === "adopt").map((row) => row.field).sort()).toEqual([...(result.changed || [])].sort());
    expect(after.some((row) => row.field === "vip" && row.reason === "adopt")).toBe(false);
  });

  it("\"Revoke host link\" records the crew code too - it rotates without touching setEventAccessCode", async () => {
    const event = await createEventRecord({ name: `Revoke history ${Date.now()}`, when: "now" }, owner);
    const oldCrew = event.accessCodes.crew;
    // The Host panel's button, which bypasses the Access page entirely. Before this was the one
    // rotation that left no history, so a revoked host link went back to "that did not match".
    await revokeHostLinks(event.id, "owner");
    resetOverlayForTests();
    expect((await listSupersededCodes(event.id)).map((row) => row.code)).toContain(oldCrew);
    const refused = await resolveCrewAccess(event.joinCode, "producer", oldCrew);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe("superseded_code");
    // Exactly one row: setEventAccessCode must not double-record what revokeHostLinks already did.
    await setEventAccessCode(event.id, "crew", { regenerate: true }, "owner");
    expect((await listSupersededCodes(event.id)).filter((row) => row.field === "crew").length).toBe(2);
  });

  it("a code refused for a collision is not recorded as superseded", async () => {
    const event = await createEventRecord({ name: `No ghost history ${Date.now()}`, when: "now" }, owner);
    await setEventAccessCode(event.id, "vip", { value: "gold-room" }, "owner");
    const before = await listSupersededCodes(event.id);
    expect(await setEventAccessCode(event.id, "sponsor", { value: "GOLD ROOM" }, "owner")).toMatchObject({ ok: false });
    expect((await listSupersededCodes(event.id)).length).toBe(before.length);
  });

  it("the confirm text carries a real count, and says so plainly where there is no number", async () => {
    const event = await createEventRecord({ name: `Impact ${Date.now()}`, when: "now" }, owner);
    const empty = await describeCodeChangeImpact(event.id);
    expect(empty.registered).toBe(0);
    expect(empty.lines.join).toContain("Nobody has registered yet");
    // No count exists for role links, so the line must admit that rather than invent one.
    expect(empty.lines.speaker).toContain("do not record");
    expect(empty.lines.speaker).not.toMatch(/\d/);

    const store = (await import("@/services/runtime/runtimeStoreFactory")).getRuntimeStore();
    for (const index of [1, 2, 3]) {
      await store.upsertAttendeeProfile({ attendeeId: `attendee-${index}`, eventId: event.id, emailHash: `hash-${index}`, name: `Attendee ${index}`, company: "", title: "", socialLinks: [], topicsOfInterest: [], networkingOptIn: false, role: "attendee", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    const counted = await describeCodeChangeImpact(event.id);
    expect(counted.registered).toBe(3);
    expect(counted.lines.join).toContain("3 registered attendees");
  });

  it("the refusal names the day and never the current code", () => {
    expect(supersededPrivilegedMessage("crew", "2026-09-16T00:00:00.000Z")).toBe("This crew code was replaced on 16 September. Ask the producer for the current one.");
    expect(supersededPrivilegedMessage("vip", "2026-09-16T00:00:00.000Z")).toContain("This VIP code was replaced");
  });
});
