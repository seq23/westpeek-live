import { describe, expect, it } from "vitest";
import {
  buildVirtualVenueModel,
  buildVenueLobbySections,
  findBooth,
  findSession,
  getBreakoutAvailability,
  groupReplaysByStatus,
  groupSessionsByStatus,
  searchPeople,
} from "@/services/venue";

describe("virtual venue completion", () => {
  it("builds a cohesive venue model", () => {
    const model = buildVirtualVenueModel("event-summit");

    expect(model.nav.map((item) => item.surface)).toContain("lobby");
    expect(model.nav.map((item) => item.surface)).toContain("stage");
    expect(model.sessions.length).toBeGreaterThan(0);
    expect(model.booths.length).toBeGreaterThan(0);
    expect(model.helpTopics).toContain("Video/audio issue");
  });

  it("groups venue surfaces and resolves cards", () => {
    const model = buildVirtualVenueModel("event-summit");
    const lobby = buildVenueLobbySections(model);
    const grouped = groupSessionsByStatus(model.sessions);

    expect(lobby.heroCta).toContain("/venue/");
    expect(grouped.live.length).toBeGreaterThanOrEqual(1);
    expect(findSession(model.sessions, model.sessions[0].id).id).toBe(model.sessions[0].id);
    expect(findBooth(model.booths, model.booths[0].id).id).toBe(model.booths[0].id);
    expect(getBreakoutAvailability(model.breakouts[0]).remaining).toBeGreaterThanOrEqual(0);
    expect(searchPeople(model.people, model.people[0].displayName).length).toBeGreaterThan(0);
    expect(groupReplaysByStatus(model.replays).available.length).toBeGreaterThanOrEqual(0);
  });
});
