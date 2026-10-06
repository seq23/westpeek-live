import { expect, test } from "@playwright/test";

/**
 * A token request from someone with no registered session, against a run with no provider secrets,
 * is refused safely: never a token, never a 500 page, always a sentence. LiveKit unregistered is a
 * 503 that says which provider is missing (providerFailure); the attendee check refuses with 403.
 */
test("video token routes fail safely when provider secrets are absent", async ({ request }) => {
  const payload = {
    eventId: "event-summit",
    roomId: "event-summit-main-stage",
    roomType: "main_stage",
    displayName: "E2E Attendee",
    role: "attendee",
  };
  for (const route of ["/api/video/livekit-token", "/api/video/daily-token"]) {
    const response = await request.post(route, { data: payload });
    expect([403, 503], `${route} status`).toContain(response.status());
    const text = await response.text();
    expect(text).not.toContain("__next_error__");
    expect(text).not.toContain("Internal Server Error");
    const body = JSON.parse(text) as { ok: boolean; error?: string; providerFailure?: boolean; token?: unknown; result?: unknown };
    expect(body.ok).toBe(false);
    expect(body.token ?? body.result).toBeUndefined();
    expect(body.error, `${route} names why`).toMatch(/\w+ \w+/);
    if (response.status() === 503) {
      expect(body.providerFailure).toBe(true);
      expect(body.error).toMatch(/provider/i);
    }
  }
});
