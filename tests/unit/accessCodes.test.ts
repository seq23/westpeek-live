import { describe, expect, it } from "vitest";
import { codeKey, codesMatch, displayCode, guestGatePath, normalizeJoinCode, normalizeRoleCode, validateCustomCode } from "@/lib/access/accessCodes";

/** One case convention: displayed uppercase, matched case-insensitively ignoring spaces and dashes; custom codes validated. */
describe("access codes", () => {
  it("matches a role code typed lowercase, mixed, with spaces, or without the dash", () => {
    for (const typed of ["spk-wygjmy", "Spk-WygJmy", " SPK WYGJMY ", "spkwygjmy", "SPK-WYGJMY"]) expect(codesMatch("SPK-WYGJMY", typed), typed).toBe(true);
    expect(codesMatch("SPK-WYGJMY", "SPK-WYGJMX")).toBe(false);
    expect(codesMatch("", "")).toBe(false);
    expect(codesMatch(undefined, "SPK-WYGJMY")).toBe(false);
  });
  it("two codes differing only by case (or dashes) have the same key and cannot coexist", () => {
    expect(codeKey("crew-93h7sd")).toBe(codeKey("CREW-93H7SD"));
    expect(codeKey("crew 93h7sd")).toBe("CREW93H7SD");
  });
  it("displays uppercase; stores role codes uppercase and join codes lowercase", () => {
    expect(displayCode("wpl-vxckx6")).toBe("WPL-VXCKX6");
    expect(normalizeRoleCode(" spk-wyg jmy ")).toBe("SPK-WYGJMY");
    expect(normalizeJoinCode(" WPL-VX CKX6 ")).toBe("wpl-vxckx6");
  });
  it("validates a custom code: letters, digits, hyphens, 4–24 chars, no edge hyphen", () => {
    expect(validateCustomCode("founders-2026", "speaker")).toEqual({ ok: true, stored: "FOUNDERS-2026" });
    expect(validateCustomCode("Room One", "join")).toEqual({ ok: true, stored: "roomone" });
    expect(validateCustomCode("abc", "vip")).toMatchObject({ ok: false });
    expect(validateCustomCode("a".repeat(25), "vip")).toMatchObject({ ok: false });
    expect(validateCustomCode("-abcd", "vip")).toMatchObject({ ok: false });
    expect(validateCustomCode("ab_cd", "vip")).toMatchObject({ ok: false });
    expect(validateCustomCode("ab.cd!", "vip")).toMatchObject({ ok: false });
  });
  it("builds guest links with both fields prefilled, uppercase, to the right gate", () => {
    const event = { joinCode: "wpl-vxckx6", accessCodes: { crew: "CREW-93H7SD", speaker: "SPK-WYGJMY", sponsor: "SPN-1", vip: "VIP-1", client: "CLT-1" } };
    expect(guestGatePath(event, "speaker")).toBe("/production-access/special-guest?event=WPL-VXCKX6&code=SPK-WYGJMY");
    expect(guestGatePath(event, "crew")).toBe("/production-access/crew?event=WPL-VXCKX6&code=CREW-93H7SD&role=crew");
  });
});
