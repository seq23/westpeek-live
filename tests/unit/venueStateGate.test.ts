import { describe, expect, it } from "vitest";
import { VENUE_GATE_MESSAGE, venueGateFor } from "@/services/venue/venueStateGate";

/** The venue follows the event's state: one rule for every venue page and the poll behind it. */
describe("venue state gate", () => {
  it("ended and replay_available show the ended state everywhere but the replay page", () => {
    for (const status of ["ended", "replay_available"] as const) {
      expect(venueGateFor({ status })).toBe("ended");
      expect(venueGateFor({ status, isHost: true })).toBe("ended");
      expect(venueGateFor({ status, surface: "replay" })).toBe("open");
    }
  });
  it("a stage marked ENDED ends the venue even before the event row says so", () => {
    expect(venueGateFor({ status: "live", stageEnded: true })).toBe("ended");
    expect(venueGateFor({ status: "live", stageEnded: true, surface: "replay" })).toBe("open");
  });
  it("archived is archived for everyone; draft is not open unless you are the host", () => {
    expect(venueGateFor({ status: "archived" })).toBe("archived");
    expect(venueGateFor({ status: "archived", isHost: true })).toBe("archived");
    expect(venueGateFor({ status: "draft" })).toBe("draft");
    expect(venueGateFor({ status: "draft", isHost: true })).toBe("open");
  });
  it("live, published, registration_open, pre_event are open; unknown events are left to the page", () => {
    for (const status of ["live", "published", "registration_open", "pre_event"] as const) expect(venueGateFor({ status })).toBe("open");
    expect(venueGateFor({ status: undefined })).toBe("open");
  });
  it("uses the join code's own words", () => {
    expect(VENUE_GATE_MESSAGE.ended).toBe("Event ended. Replay access is available.");
    expect(VENUE_GATE_MESSAGE.draft).toBe("This event is not publicly open yet.");
    expect(VENUE_GATE_MESSAGE.archived).toBe("This event is archived and no longer publicly available.");
  });
});
