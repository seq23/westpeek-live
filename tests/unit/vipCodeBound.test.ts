import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { setEventAccessCode } from "@/services/events/accessCodeService";
import { registerOrUpdateAttendee } from "@/services/attendees/attendeeRegistrationService";
import { admitInvitedVip, grantVip, isVip, listVipStanding, parseVipInviteList, redeemVipCode, revokeVip, setVipInviteList, vipCodeFor, vipStandingFor } from "@/services/guests/vipGrantService";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * VIP is never a bare flag. Somebody is a VIP because they hold the event's VIP code — typed by
 * them, issued to them by the crew, or issued at registration because their address was invited —
 * and every grant carries the code version, so rotating the code takes the grants with it.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

describe("VIP is code-bound", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-vip-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "VIP Room", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("the event has a VIP code and typing it is what admits you", async () => {
    const code = await vipCodeFor(eventId);
    expect(code).toBe("WPL-VIP-VIPROO");
    const wrong = await redeemVipCode(eventId, "WPL-VIP-NOPE", { attendeeId: "att-1", name: "Cal" });
    expect(wrong.ok).toBe(false);
    expect(await isVip(eventId, "att-1")).toBe(false);
    // Case, spaces and dashes are forgiven, the way every other code is.
    const right = await redeemVipCode(eventId, " wpl vip viproo ", { attendeeId: "att-1", name: "Cal" });
    expect(right.ok).toBe(true);
    expect(await isVip(eventId, "att-1")).toBe(true);
    expect((await vipStandingFor(eventId, "att-1"))?.source).toBe("entered_code");
  });

  it("a crew grant is the code being issued, and it records who issued it", async () => {
    await grantVip(eventId, { attendeeId: "att-2", name: "Ada", source: "crew_grant", grantedBy: "crew:producer" });
    const standing = await vipStandingFor(eventId, "att-2");
    expect(standing?.current).toBe(true);
    expect(standing?.source).toBe("crew_grant");
    expect(standing?.grantedBy).toBe("crew:producer");
    expect(standing?.reason).toContain("Issued by crew:producer");
  });

  it("rotating the VIP code revokes everyone admitted under the old one — crew grants included", async () => {
    await redeemVipCode(eventId, (await vipCodeFor(eventId))!, { attendeeId: "att-1", name: "Cal" });
    await grantVip(eventId, { attendeeId: "att-2", name: "Ada", source: "crew_grant", grantedBy: "crew:producer" });
    expect((await listVipStanding(eventId)).filter((grant) => grant.current)).toHaveLength(2);

    const rotated = await setEventAccessCode(eventId, "vip", { regenerate: true }, "owner");
    expect(rotated.ok).toBe(true);
    const after = await listVipStanding(eventId);
    expect(after.every((grant) => !grant.current)).toBe(true);
    expect(after[0].reason).toContain("rotated");
    expect(await isVip(eventId, "att-1")).toBe(false);

    // Entering the NEW code makes them a VIP again.
    const fresh = await redeemVipCode(eventId, (await vipCodeFor(eventId))!, { attendeeId: "att-1", name: "Cal" });
    expect(fresh.ok).toBe(true);
    expect(await isVip(eventId, "att-1")).toBe(true);
  });

  it("Remove VIP revokes the grant, and the person can come back with the current code", async () => {
    await grantVip(eventId, { attendeeId: "att-3", name: "Scooter", source: "crew_grant", grantedBy: "owner" });
    await revokeVip(eventId, "att-3", "crew:producer");
    expect(await isVip(eventId, "att-3")).toBe(false);
    expect((await vipStandingFor(eventId, "att-3"))?.reason).toContain("Removed by crew:producer");
    await redeemVipCode(eventId, (await vipCodeFor(eventId))!, { attendeeId: "att-3", name: "Scooter" });
    expect(await isVip(eventId, "att-3")).toBe(true);
  });

  it("the invite list is a pre-authorisation of the code: registration issues it under the current version", async () => {
    expect(parseVipInviteList("Ada@Example.com, cal@realco.io\nnot-an-email")).toEqual(["ada@example.com", "cal@realco.io"]);
    await setVipInviteList(eventId, "ada@example.com", "owner");
    const registered = await registerOrUpdateAttendee({ eventId, name: "Ada Lovelace", email: "ada@example.com", company: "Engines" });
    const standing = await vipStandingFor(eventId, registered.profile.attendeeId);
    expect(standing?.current).toBe(true);
    expect(standing?.source).toBe("invite_list");
    // Somebody not on the list registers and is nobody special.
    const other = await registerOrUpdateAttendee({ eventId, name: "Cal", email: "cal@realco.io", company: "Co" });
    expect(await isVip(eventId, other.profile.attendeeId)).toBe(false);
    // And an invited address admitted before a rotation loses it with everyone else.
    await setEventAccessCode(eventId, "vip", { regenerate: true }, "owner");
    expect(await isVip(eventId, registered.profile.attendeeId)).toBe(false);
  });

  it("no code path can create a grant without a code version", async () => {
    const service = fs.readFileSync("services/guests/vipGrantService.ts", "utf8");
    expect(service).toContain("const codeVersion = await vipCodeVersion(eventId);");
    // grantVip is the only writer, and it always reads the version from the event.
    // writeGrant is the single writer: its definition plus grantVip and revokeVip.
    expect(service.match(/writeGrant\(/g)?.length).toBe(3);
    expect(service).not.toMatch(/codeVersion:\s*0\b/);
    const admitted = await admitInvitedVip(eventId, { attendeeId: "att-9", name: "Nobody" });
    expect(admitted).toBeUndefined();
  });
});
