import { describe, expect, it } from "vitest";
import { assertSeparatedProductionPasswords, getEnv, matchOwnerMasterPassword } from "@/lib/env";

function envWith(overrides: Partial<ReturnType<typeof getEnv>>) {
  return { ...getEnv(), CREW_ACCESS_PASSWORD: "crew-password-123456", OPERATOR_LAUNCHPAD_PASSWORD: "operator-password-123456", OWNER_MASTER_ACCESS_PASSWORD: "owner-primary-password-1234", OWNER_MASTER_ACCESS_PASSWORD_2: "", ...overrides };
}

describe("second owner master password", () => {
  it("matches only the primary when the secondary is unset", () => {
    const env = envWith({});
    expect(matchOwnerMasterPassword("owner-primary-password-1234", env)).toBe("primary");
    expect(matchOwnerMasterPassword("owner-secondary-password-1234", env)).toBeUndefined();
    expect(matchOwnerMasterPassword("", env)).toBeUndefined();
  });

  it("matches either owner password and reports which one when the secondary is set", () => {
    const env = envWith({ OWNER_MASTER_ACCESS_PASSWORD_2: "owner-secondary-password-1234" });
    expect(matchOwnerMasterPassword("owner-primary-password-1234", env)).toBe("primary");
    expect(matchOwnerMasterPassword("owner-secondary-password-1234", env)).toBe("secondary");
    expect(matchOwnerMasterPassword("operator-password-123456", env)).toBeUndefined();
  });

  it("requires the secondary to differ from every other production password", () => {
    expect(() => assertSeparatedProductionPasswords(envWith({ OWNER_MASTER_ACCESS_PASSWORD_2: "owner-primary-password-1234" }))).toThrow(/OWNER_MASTER_ACCESS_PASSWORD and OWNER_MASTER_ACCESS_PASSWORD_2 must be different/);
    expect(() => assertSeparatedProductionPasswords(envWith({ OWNER_MASTER_ACCESS_PASSWORD_2: "crew-password-123456" }))).toThrow(/CREW_ACCESS_PASSWORD and OWNER_MASTER_ACCESS_PASSWORD_2/);
    expect(() => assertSeparatedProductionPasswords(envWith({ OWNER_MASTER_ACCESS_PASSWORD_2: "owner-secondary-password-1234" }))).not.toThrow();
    expect(() => assertSeparatedProductionPasswords(envWith({}))).not.toThrow();
  });
});
