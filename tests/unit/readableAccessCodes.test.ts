import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { codesFromStem, createEventRecord, freeCodeStem } from "@/services/events/eventRepository";
import { adoptReadableCodes, codeSchemeSummary, roleCodesBuiltFromJoinCode, rotateAllRoleCodes, setEventAccessCode } from "@/services/events/accessCodeService";
import { resolveCrewAccess, resolveSpecialGuestAccess } from "@/services/access/eventAccessResolver";
import { getGeneratedEventRoleCode } from "@/services/events/eventConfigRepository";
import { liveSupersededCodesFor } from "@/services/events/supersededCodeService";
import { codeStem, codesMatch, codeKey, isRandomRoleCode, joinCodeForStem, LEGACY_ROLE_CODE_CUTOFF, legacyRoleCodeLastDay, liveRoleCode, mintRoleCode, ROLE_CODE_FIELDS, roleCodeListLabel, stemBuiltRoleCode, stemFromCode } from "@/lib/access/accessCodes";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The owner's scheme: the event code is WPL-STEM, the stem the first six letters of the event's own
 * name, and two live events never share one. Role codes name their role and carry ten random
 * characters (22 Nov 2026): every attendee holds the event code, so a role code built from it could
 * be typed by anyone. A hand-set code wins, and renaming an event does not silently change codes
 * that are already in somebody's inbox.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("stem derivation", () => {
  it("takes the first six letters or digits, uppercased, ignoring punctuation and emoji", () => {
    expect(codeStem("45 Minute AI workshop")).toBe("45MINU");
    expect(codeStem("Sequoia's first Room")).toBe("SEQUOI");
    expect(codeStem("  the   leadership reset ")).toBe("THELEA");
    expect(codeStem("🎉 Launch Party 🎉")).toBe("LAUNCH");
  });

  it("pads a short name from the event id, stably, and never returns a short stem", () => {
    const first = codeStem("Go", "go-event");
    expect(first).toHaveLength(6);
    expect(first.startsWith("GO")).toBe(true);
    expect(codeStem("Go", "go-event")).toBe(first);
    expect(codeStem("Go", "another-event")).not.toBe(first);
  });

  it("a role code names its role, carries ten random characters, and never contains the event code", () => {
    const seen = new Set<string>();
    for (const role of ROLE_CODE_FIELDS) {
      for (let index = 0; index < 50; index += 1) {
        const code = mintRoleCode(role);
        expect(isRandomRoleCode(code, role)).toBe(true);
        expect(code.startsWith(`WPL-${role === "speaker" ? "SPEAKER" : role.toUpperCase()}-`)).toBe(true);
        expect(codeKey(code.split("-").slice(2).join(""))).toHaveLength(10);
        seen.add(code);
      }
    }
    // 250 draws over 32^10 values: any repeat means the random part is not random.
    expect(seen.size).toBe(250);
    expect(joinCodeForStem("45MINU")).toBe("WPL-45MINU");
    expect(stemFromCode("wpl-crew-45minu")).toBe("45MINU");
    expect(stemFromCode("SPK-ABC123")).toBeUndefined();
  });
});

describe("codes on a real event", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-codes-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("a new event gets the readable event code and role codes that never contain the event code", async () => {
    const event = await createEventRecord({ name: "45 Minute AI workshop", when: "now" }, owner);
    expect(event.joinCode.toUpperCase()).toBe("WPL-45MINU");
    for (const role of ROLE_CODE_FIELDS) {
      expect(isRandomRoleCode(event.accessCodes[role], role)).toBe(true);
      expect(codeKey(event.accessCodes[role])).not.toContain("45MINU");
      expect(codesMatch(event.accessCodes[role], stemBuiltRoleCode("45MINU", role))).toBe(false);
    }
    expect(codeSchemeSummary(event).onScheme).toBe(true);
    expect(roleCodesBuiltFromJoinCode(event)).toEqual([]);
  });

  it("two events that want the same stem never share a code", async () => {
    const first = await createEventRecord({ name: "Sequoia's first Room", when: "now" }, owner);
    const second = await createEventRecord({ name: "Sequoia's second Room", when: "now" }, owner);
    expect(first.joinCode.toUpperCase()).toBe("WPL-SEQUOI");
    expect(second.joinCode.toUpperCase()).toBe("WPL-SEQUOI2");
    expect(isRandomRoleCode(second.accessCodes.crew, "crew")).toBe(true);
    const all = await getRuntimeStore().listRuntimeEvents();
    const every = all.flatMap((event) => [event.joinCode, ...Object.values(event.accessCodes)].map((code) => code.toUpperCase()));
    expect(new Set(every).size).toBe(every.length);
    // An archived event does not hold a stem hostage.
    expect(await freeCodeStem("Sequoia's third Room", "new-id", all.map((event) => ({ ...event, status: "archived" as const })))).toBe("SEQUOI");
  });

  it("renaming an event leaves its codes alone; adopting is the explicit action", async () => {
    const event = await createEventRecord({ name: "Leadership Reset", when: "now" }, owner);
    expect(event.joinCode.toUpperCase()).toBe("WPL-LEADER");
    await getRuntimeStore().upsertRuntimeEvent({ ...event, name: "Founder Forum" });
    const renamed = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(renamed?.joinCode.toUpperCase()).toBe("WPL-LEADER");
    const adopted = await adoptReadableCodes(event.id, "owner", { newStem: true });
    expect(adopted.stem).toBe("FOUNDE");
    const after = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(after?.joinCode.toUpperCase()).toBe("WPL-FOUNDE");
    expect(isRandomRoleCode(after?.accessCodes.speaker, "speaker")).toBe(true);
  });

  it("a hand-set code wins and survives adopting", async () => {
    const event = await createEventRecord({ name: "Provider Expo", when: "now" }, owner);
    const custom = await setEventAccessCode(event.id, "client", { value: "ACME-BOARD" }, "owner");
    expect(custom.ok).toBe(true);
    const adopted = await adoptReadableCodes(event.id, "owner");
    expect(adopted.kept).toContain("client");
    const after = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(after?.accessCodes.client).toBe("ACME-BOARD");
    // A random role code is already safe: adopting leaves it where it is.
    expect(after?.accessCodes.crew).toBe(event.accessCodes.crew);
    // …unless the owner says replace everything.
    await adoptReadableCodes(event.id, "owner", { includeCustom: true });
    const replaced = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(isRandomRoleCode(replaced?.accessCodes.client, "client")).toBe(true);
  });

  it("an old-format event adopts the scheme in one call", async () => {
    const event = await createEventRecord({ name: "Legacy Room", when: "now" }, owner);
    await getRuntimeStore().upsertRuntimeEvent({ ...event, joinCode: "wpl-ab12cd", accessCodes: { crew: "CREW-AAA111", speaker: "SPK-BBB222", sponsor: "SPN-CCC333", vip: "VIP-DDD444", client: "CLT-EEE555" } });
    const stale = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(codeSchemeSummary(stale!).onScheme).toBe(false);
    const adopted = await adoptReadableCodes(event.id, "owner");
    expect(adopted.changed).toEqual(expect.arrayContaining(["join", "crew", "speaker", "sponsor", "vip", "client"]));
    const after = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(codeSchemeSummary(after!).onScheme).toBe(true);
    expect(after?.joinCode.toUpperCase()).toBe("WPL-LEGACY");
  });

  it("codesFromStem stores the join code lowercase and random role codes uppercase", () => {
    const codes = codesFromStem("45MINU");
    expect(codes.joinCode).toBe("wpl-45minu");
    expect(isRandomRoleCode(codes.accessCodes.sponsor, "sponsor")).toBe(true);
    expect(codes.accessCodes.sponsor).toBe(codes.accessCodes.sponsor.toUpperCase());
  });

  it("a hand-set role code built from the event code is refused", async () => {
    const event = await createEventRecord({ name: "Hand Set Room", when: "now" }, owner);
    const result = await setEventAccessCode(event.id, "crew", { value: "wpl crew handse" }, "owner");
    expect(result).toMatchObject({ ok: false });
    expect((await getRuntimeStore().getRuntimeEvent(event.id))?.accessCodes.crew).toBe(event.accessCodes.crew);
  });
});

/**
 * Events made before 22 Nov 2026 hold WPL-CREW-STEM codes that producers have already sent out. The
 * build never rewrites them; they keep working until the producer presses New codes, or until
 * LEGACY_ROLE_CODE_CUTOFF, whichever is first. The crew code never opens executive producer.
 */
describe("events with role codes built from the event code", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-legacy-codes-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); vi.useRealTimers(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  async function legacyEvent(name: string) {
    const event = await createEventRecord({ name, when: "now" }, owner);
    const stem = stemFromCode(event.joinCode)!;
    const accessCodes = Object.fromEntries(ROLE_CODE_FIELDS.map((role) => [role, stemBuiltRoleCode(stem, role)])) as unknown as typeof event.accessCodes;
    // What the store held before this change, written straight to the row, as an old event would be.
    await getRuntimeStore().upsertRuntimeEvent({ ...event, accessCodes });
    resetOverlayForTests();
    return { ...event, accessCodes, stem };
  }

  it("the build leaves stored codes alone, and the producer view names the ones anyone could work out", async () => {
    const event = await legacyEvent("Legacy Showcase");
    const stored = (await getRuntimeStore().getRuntimeEvent(event.id))!;
    expect(stored.accessCodes).toEqual(event.accessCodes);
    expect(roleCodesBuiltFromJoinCode(stored)).toEqual(ROLE_CODE_FIELDS);
    expect(codeSchemeSummary(stored)).toMatchObject({ onScheme: false, unsafeRoles: ROLE_CODE_FIELDS });
  });

  it("a stem-built code works before the cut-off and is refused after the cut-off, told it was changed", async () => {
    const event = await legacyEvent("Cutoff Night");
    const before = new Date(Date.parse(LEGACY_ROLE_CODE_CUTOFF) - 60_000);
    const after = new Date(Date.parse(LEGACY_ROLE_CODE_CUTOFF) + 60_000);
    expect(liveRoleCode(event, "crew", before)).toBe(event.accessCodes.crew);
    expect(liveRoleCode(event, "crew", after)).toBeUndefined();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(before);
    expect(await resolveCrewAccess(event.joinCode, "producer", event.accessCodes.crew)).toMatchObject({ ok: true });
    expect(await resolveSpecialGuestAccess(event.joinCode, event.accessCodes.speaker)).toMatchObject({ ok: true });
    expect(await getGeneratedEventRoleCode(event.id, "vip")).toBe(event.accessCodes.vip);

    vi.setSystemTime(after);
    expect(await resolveCrewAccess(event.joinCode, "producer", event.accessCodes.crew)).toMatchObject({ ok: false, reason: "rotated" });
    expect(await resolveSpecialGuestAccess(event.joinCode, event.accessCodes.speaker)).toMatchObject({ ok: false, reason: "rotated" });
    expect(await getGeneratedEventRoleCode(event.id, "vip")).toBeUndefined();
  });

  it("the crew code never opens executive producer, even before the cut-off", async () => {
    const event = await legacyEvent("Host Grab");
    expect(await resolveCrewAccess(event.joinCode, "executive_producer", event.accessCodes.crew)).toMatchObject({ ok: false, reason: "host_link_required" });
  });

  it("New codes replaces all five with random ones, keeps the event code, and records the old ones", async () => {
    const event = await legacyEvent("Rotate Party");
    const result = await rotateAllRoleCodes(event.id, "owner");
    expect(result).toMatchObject({ ok: true, changed: ROLE_CODE_FIELDS });
    const after = (await getRuntimeStore().getRuntimeEvent(event.id))!;
    expect(after.joinCode).toBe(event.joinCode);
    for (const role of ROLE_CODE_FIELDS) {
      expect(isRandomRoleCode(after.accessCodes[role], role)).toBe(true);
      expect(after.accessCodes[role]).not.toBe(event.accessCodes[role]);
    }
    expect(roleCodesBuiltFromJoinCode(after)).toEqual([]);
    const superseded = await liveSupersededCodesFor(event.id);
    expect(superseded.map((record) => record.field).sort()).toEqual([...ROLE_CODE_FIELDS].sort());
    // The old crew code is refused now, before any cut-off.
    expect(await resolveCrewAccess(event.joinCode, "producer", event.accessCodes.crew)).toMatchObject({ ok: false });
    expect(await resolveCrewAccess(event.joinCode, "producer", after.accessCodes.crew)).toMatchObject({ ok: true });
  });

  it("adopting replaces the stem-built role codes and keeps the event code", async () => {
    const event = await legacyEvent("Adopt Gala");
    const adopted = await adoptReadableCodes(event.id, "owner");
    expect(adopted.changed?.sort()).toEqual([...ROLE_CODE_FIELDS].sort());
    const after = (await getRuntimeStore().getRuntimeEvent(event.id))!;
    expect(after.joinCode).toBe(event.joinCode);
    expect(codeSchemeSummary(after).onScheme).toBe(true);
  });
});

describe("the cut-off notice names the right day", () => {
  it("names the last day the old codes work (the Chicago day before the cut-off moment), not the day the cut-off falls on", () => {
    const lastMoment = new Date(Date.parse(LEGACY_ROLE_CODE_CUTOFF) - 1);
    const chicagoWeekday = lastMoment.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Chicago" });
    expect(legacyRoleCodeLastDay()).toBe("Saturday, November 28");
    expect(legacyRoleCodeLastDay().startsWith(chicagoWeekday)).toBe(true);
    // Still refused at the cut-off itself, still working 1 ms before: the named day really is the last one.
    expect(liveRoleCode({ joinCode: "WPL-45MINU", accessCodes: { crew: "WPL-CREW-45MINU" } } as never, "crew", lastMoment)).toBeTruthy();
    expect(liveRoleCode({ joinCode: "WPL-45MINU", accessCodes: { crew: "WPL-CREW-45MINU" } } as never, "crew", new Date(LEGACY_ROLE_CODE_CUTOFF))).toBeFalsy();
  });

  it("lists the roles in words, VIP in capitals", () => {
    expect(roleCodeListLabel(["crew", "speaker", "sponsor", "vip", "client"])).toBe("crew, speaker, sponsor, VIP and client codes");
    expect(roleCodeListLabel(["vip"])).toBe("VIP code");
    expect(roleCodeListLabel(["crew", "vip"])).toBe("crew and VIP codes");
  });
});
