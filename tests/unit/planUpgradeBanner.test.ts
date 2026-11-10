import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eventPlanShortfalls, type PlanFitShow, type RecordedPlans } from "@/lib/capacity/capacityPlans";
import { planUpgradeBanner, type PlanBannerEvent } from "@/lib/capacity/planUpgradeBanner";
import { PlanUpgradeBannerView } from "@/components/capacity/PlanUpgradeBanner";
import { noticeEventPlanFit } from "@/services/capacity/livekitPlanFitService";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import type { RuntimeStore } from "@/services/runtime/runtimeStore";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * The plan check behind the red banner (owner, 10 Nov 2026: "switch back to Ship before the first
 * real event" lives in the product, not on a to-do list). A real show — 90 minutes, 200 people — on
 * the free plans names every service that falls short; each upgrade takes that service off; a show
 * that fits draws no banner at all; a plan nobody recorded is said, never assumed.
 */
const FREE: RecordedPlans = { livekit: "build", zoom: "basic", resend: "free", streamyard: "free" };
const PAID: RecordedPlans = { livekit: "ship", zoom: "pro", resend: "pro", streamyard: "core" };
const SHOW: PlanFitShow = { runMinutes: 90, audience: 200, format: "stage" };
const NOW = new Date("2026-11-10T15:00:00.000Z");

const services = (plans: RecordedPlans, show = SHOW) => eventPlanShortfalls(show, plans).map((item) => item.service);

function bannerEvent(id: string, startAt: string, plans: RecordedPlans, show = SHOW): PlanBannerEvent {
  return { id, name: `Show ${id}`, startAt, shortfalls: eventPlanShortfalls(show, plans) };
}

describe("eventPlanShortfalls", () => {
  it("a 90-minute, 200-person stage show on the free plans falls short on all four", () => {
    expect(services(FREE)).toEqual(["LiveKit", "Zoom", "Resend", "StreamYard"]);
    for (const item of eventPlanShortfalls(SHOW, FREE)) expect(item.reasons.length).toBeGreaterThan(0);
  });

  it("each upgrade takes exactly that service off", () => {
    expect(services({ ...FREE, livekit: "ship" })).toEqual(["Zoom", "Resend", "StreamYard"]);
    expect(services({ ...FREE, zoom: "pro" })).toEqual(["LiveKit", "Resend", "StreamYard"]);
    expect(services({ ...FREE, resend: "pro" })).toEqual(["LiveKit", "Zoom", "StreamYard"]);
    expect(services({ ...FREE, streamyard: "essential" })).toEqual(["LiveKit", "Zoom", "Resend"]);
    expect(services(PAID)).toEqual([]);
  });

  it("each limit is the real one: under it fits, past it does not", () => {
    // Zoom Basic ends a meeting at 40 minutes; Resend Free sends 100 a day.
    expect(services({ ...PAID, zoom: "basic" }, { runMinutes: 40, audience: 0, format: "stage" })).toEqual([]);
    expect(services({ ...PAID, zoom: "basic" }, { runMinutes: 41, audience: 0, format: "stage" })).toEqual(["Zoom"]);
    expect(services({ ...PAID, resend: "free" }, { runMinutes: 30, audience: 100, format: "stage" })).toEqual([]);
    expect(services({ ...PAID, resend: "free" }, { runMinutes: 30, audience: 101, format: "stage" })).toEqual(["Resend"]);
    // A Room has no StreamYard feed, so StreamYard Free does not hold it up.
    expect(services({ ...PAID, streamyard: "free" }, { runMinutes: 30, audience: 10, format: "room" })).toEqual([]);
    expect(services({ ...PAID, streamyard: "free" }, { runMinutes: 30, audience: 10, format: "stage" })).toEqual(["StreamYard"]);
  });

  it("a plan nobody recorded is named as not recorded, never guessed to fit", () => {
    const shortfalls = eventPlanShortfalls({ runMinutes: 10, audience: 1, format: "stage" }, { ...PAID, zoom: null, resend: null });
    expect(shortfalls.map((item) => [item.service, item.planRecorded, item.current])).toEqual([
      ["Zoom", false, "plan not recorded"],
      ["Resend", false, "plan not recorded"],
    ]);
  });
});

describe("the red banner", () => {
  it("renders nothing when every scheduled event fits", () => {
    expect(planUpgradeBanner([bannerEvent("a", "2027-01-09T00:00:00.000Z", PAID)], NOW)).toBeNull();
    expect(PlanUpgradeBannerView({ model: null })).toBeNull();
  });

  it("names the event, its days left and only the services that fall short, linking to /app/capacity", () => {
    const model = planUpgradeBanner([bannerEvent("a", "2026-11-22T00:30:00.000Z", { ...FREE, livekit: "ship", resend: "pro" })], NOW)!;
    expect(model.services).toEqual(["Zoom", "StreamYard"]);
    // 22 Nov 00:30 UTC is 21 Nov in Central time: 11 calendar days from 10 Nov.
    expect(model.daysLeft).toBe(11);
    const html = renderToStaticMarkup(PlanUpgradeBannerView({ model }));
    expect(html).toContain('href="/app/capacity"');
    expect(html).toContain("Show a");
    expect(html).toContain("Zoom");
    expect(html).toContain("StreamYard");
    expect(html).not.toContain("LiveKit");
    expect(html).not.toContain("Resend");
    // The code is for machines: an attribute, never on screen.
    expect(html).toContain('data-code="PLAN_TOO_SMALL"');
    expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/PLAN_TOO_SMALL/);
  });

  it("several events: one line, the soonest first, every service any of them needs", () => {
    const model = planUpgradeBanner([
      bannerEvent("later", "2027-02-01T00:00:00.000Z", { ...PAID, resend: "free" }),
      bannerEvent("fits", "2026-12-01T00:00:00.000Z", PAID),
      bannerEvent("soon", "2027-01-09T00:00:00.000Z", { ...PAID, livekit: "build" }),
    ], NOW)!;
    expect(model.eventCount).toBe(2);
    expect(model.first.id).toBe("soon");
    expect(model.services).toEqual(["LiveKit", "Resend"]);
  });
});

describe("the backend notice", () => {
  afterEach(() => {
    setRuntimeStoreForTests(undefined);
    vi.restoreAllMocks();
  });

  function fakeStore(audience: number) {
    return {
      getHouseDefaults: async () => undefined,
      listAttendeeProfiles: async () => Array.from({ length: audience }, (_, index) => ({ attendeeId: `a${index}` })),
    } as unknown as RuntimeStore;
  }

  const event = { id: "evt-1", name: "Show", status: "registration_open", format: "stage", startAt: "2027-01-09T00:00:00.000Z", endAt: "2027-01-09T01:30:00.000Z" } as RuntimeEventRecord;

  it("logs one structured NOTICE line naming the event, the services and the start when an event does not fit", async () => {
    setRuntimeStoreForTests(fakeStore(200));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const shortfalls = await noticeEventPlanFit(event, { now: NOW });
    // The recorded plans today: LiveKit Build (default tier), Zoom Basic, Resend Free, StreamYard Free.
    expect(shortfalls.map((item) => item.service)).toEqual(["LiveKit", "Zoom", "Resend", "StreamYard"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe("NOTICE [PLAN_TOO_SMALL] event=evt-1 services=LiveKit,Zoom,Resend,StreamYard starts=2027-01-09T00:00:00.000Z");
  });

  it("a finished event logs nothing; a sign-up logs only when it pushes a new service over", async () => {
    setRuntimeStoreForTests(fakeStore(101));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await noticeEventPlanFit({ ...event, status: "ended" }, { now: NOW })).toEqual([]);
    // 100 → 101 pushes Resend Free (and LiveKit Build's 100 connections) over: one line.
    await noticeEventPlanFit(event, { now: NOW, previousAudience: 100 });
    // 101 → 102 changes nothing that was not already short: no line.
    setRuntimeStoreForTests(fakeStore(102));
    await noticeEventPlanFit(event, { now: NOW, previousAudience: 101 });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
