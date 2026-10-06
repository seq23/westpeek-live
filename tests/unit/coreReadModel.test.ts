import { describe, expect, it } from "vitest";
import { buildCoreReadModel, getPersistenceModeLabel } from "@/services/persistence/coreReadModel";

describe("core read model", () => {
  it("falls back to mock data when no database rows are provided", () => {
    const model = buildCoreReadModel();
    expect(model.clients.length).toBeGreaterThan(0);
    expect(getPersistenceModeLabel()).toBe("Mock fallback read model");
  });

  it("uses provided D1 records", () => {
    const model = buildCoreReadModel({
      agencies: [{ id: "a1", name: "Agency", slug: "agency", status: "active" }],
      clients: [{ id: "c1", agency_id: "a1", name: "Client", slug: "client", status: "active" }],
      events: [{ id: "e1", agency_id: "a1", client_id: "c1", name: "Event", slug: "event", event_type: "webinar", status: "draft", timezone: "America/Chicago", registration_enabled: false, venue_enabled: true, replay_enabled: true, reporting_enabled: true }],
    });
    expect(model.clients[0].name).toBe("Client");
    expect(getPersistenceModeLabel({ agencies: [] })).toBe("D1 read model");
  });
});
