import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { isBelowFloor, minimumLength } = require("../../scripts/lib/lengthFloor.js") as {
  isBelowFloor: (length: number, target: number) => boolean;
  minimumLength: (target: number) => number;
};

describe("validator length floors", () => {
  it("fail only below 75% of the target, and never for being long", () => {
    expect(minimumLength(800)).toBe(600);
    expect(isBelowFloor(599, 800)).toBe(true);
    expect(isBelowFloor(600, 800)).toBe(false);
    expect(isBelowFloor(799, 800)).toBe(false);
    expect(isBelowFloor(5000, 800)).toBe(false);
  });
});
