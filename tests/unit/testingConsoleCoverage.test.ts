import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

describe("testing console coverage", () => {
  it("contains the v4 named confidence panels", () => {
    const body = readFileSync("components/testing/TestingConsole.tsx", "utf8");
    for (const token of ["RouteHealthPanel", "AccessGatePanel", "EventConfigPanel", "PublishingPipelinePanel", "VideoProvidersPanel", "EmailResendPanel", "RuntimeStorePanel", "RunOfShowPanel", "AttendeeExperiencePanel", "SecuritySmokePanel", "PostDeploySmokePanel"]) {
      expect(body).toContain(token);
    }
  });
});
