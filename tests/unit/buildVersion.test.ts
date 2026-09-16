import { describe, expect, it } from "vitest";
import { buildChanged, typingInProgress } from "@/lib/runtime/buildVersion";

/** The build-version watchdog's decisions: reload only on a real change, never mid-typing. */
describe("build version watchdog", () => {
  it("reloads only when both ids are known and differ", () => {
    expect(buildChanged("abc123", "def456")).toBe(true);
    expect(buildChanged("abc123", "abc123")).toBe(false);
    expect(buildChanged("dev", "dev")).toBe(false);
    expect(buildChanged(undefined, "def456")).toBe(false);
    expect(buildChanged("abc123", null)).toBe(false);
    expect(buildChanged("abc123", "")).toBe(false);
  });
  it("defers while a chat input or textarea has text; an empty field does not block", () => {
    const doc = (values: string[]) => ({ querySelectorAll: () => values.map((value) => ({ value })) });
    expect(typingInProgress(doc([]))).toBe(false);
    expect(typingInProgress(doc(["", "   "]))).toBe(false);
    expect(typingInProgress(doc(["", "half a thought"]))).toBe(true);
  });
});
