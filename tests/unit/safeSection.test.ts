import { describe, expect, it } from "vitest";
import { renderSafely } from "@/lib/ui/renderSafely";

/** The fail-soft core behind SafeSection: a section that throws becomes one named message; one that renders passes through; nothing rethrows. */
describe("renderSafely (SafeSection core)", () => {
  it("passes a resolved section through", async () => {
    expect(await renderSafely("Speakers", async () => "the roster")).toEqual({ ok: true, node: "the roster" });
  });
  it("turns an async throw into a named, bounded message and never rethrows", async () => {
    const result = await renderSafely("Networking", async () => { throw new Error('invalid input syntax for type uuid: "workshop"'); });
    expect(result).toMatchObject({ ok: false, label: "Networking" });
    expect(!result.ok && result.message).toContain("invalid input syntax for type uuid");
  });
  it("catches a synchronous throw and a non-Error too", async () => {
    expect(await renderSafely("Chat", () => { throw new Error("boom"); })).toMatchObject({ ok: false, message: "boom" });
    expect(await renderSafely("Chat", () => { throw "string failure"; })).toMatchObject({ ok: false, message: "string failure" });
  });
});
