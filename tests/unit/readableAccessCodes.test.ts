import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { codesFromStem, createEventRecord, freeCodeStem } from "@/services/events/eventRepository";
import { adoptReadableCodes, codeSchemeSummary, setEventAccessCode } from "@/services/events/accessCodeService";
import { codeStem, codesMatch, derivedCodes, roleCodeForStem, stemFromCode } from "@/lib/access/accessCodes";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The owner's scheme: every code is WPL-[ROLE-]STEM, the stem is the first six letters of the
 * event's own name, two live events never share a stem, a hand-set code wins, and renaming an
 * event does not silently change codes that are already in somebody's inbox.
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

  it("builds every code from one stem, with the role in the middle", () => {
    const codes = derivedCodes("45MINU");
    expect(codes.join).toBe("WPL-45MINU");
    expect(codes.crew).toBe("WPL-CREW-45MINU");
    expect(codes.speaker).toBe("WPL-SPEAKER-45MINU");
    expect(codes.sponsor).toBe("WPL-SPONSOR-45MINU");
    expect(codes.client).toBe("WPL-CLIENT-45MINU");
    expect(codes.vip).toBe("WPL-VIP-45MINU");
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

  it("a new event gets the readable six", async () => {
    const event = await createEventRecord({ name: "45 Minute AI workshop", when: "now" }, owner);
    expect(event.joinCode.toUpperCase()).toBe("WPL-45MINU");
    expect(event.accessCodes.crew).toBe("WPL-CREW-45MINU");
    expect(event.accessCodes.vip).toBe("WPL-VIP-45MINU");
    expect(codeSchemeSummary(event).onScheme).toBe(true);
  });

  it("two events that want the same stem never share a code", async () => {
    const first = await createEventRecord({ name: "Sequoia's first Room", when: "now" }, owner);
    const second = await createEventRecord({ name: "Sequoia's second Room", when: "now" }, owner);
    expect(first.joinCode.toUpperCase()).toBe("WPL-SEQUOI");
    expect(second.joinCode.toUpperCase()).toBe("WPL-SEQUOI2");
    expect(second.accessCodes.crew).toBe("WPL-CREW-SEQUOI2");
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
    expect(after?.accessCodes.speaker).toBe("WPL-SPEAKER-FOUNDE");
  });

  it("a hand-set code wins and survives adopting", async () => {
    const event = await createEventRecord({ name: "Provider Expo", when: "now" }, owner);
    const custom = await setEventAccessCode(event.id, "client", { value: "ACME-BOARD" }, "owner");
    expect(custom.ok).toBe(true);
    const adopted = await adoptReadableCodes(event.id, "owner");
    expect(adopted.kept).toContain("client");
    const after = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(after?.accessCodes.client).toBe("ACME-BOARD");
    expect(after?.accessCodes.crew).toBe(roleCodeForStem("PROVID", "crew"));
    // …unless the owner says replace everything.
    await adoptReadableCodes(event.id, "owner", { includeCustom: true });
    const replaced = await getRuntimeStore().getRuntimeEvent(event.id);
    expect(codesMatch(replaced?.accessCodes.client, "WPL-CLIENT-PROVID")).toBe(true);
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

  it("codesFromStem stores the join code lowercase and role codes uppercase", () => {
    const codes = codesFromStem("45MINU");
    expect(codes.joinCode).toBe("wpl-45minu");
    expect(codes.accessCodes.sponsor).toBe("WPL-SPONSOR-45MINU");
  });
});
