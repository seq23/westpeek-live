import type { PlanService, PlanShortfall } from "@/lib/capacity/capacityPlans";

/**
 * The red line at the top of every operator screen while a scheduled event will not fit the plans
 * we are on. Pure, so the words are worked out once and the same everywhere (banner, launchpad).
 */
export interface PlanBannerEvent {
  id: string;
  name: string;
  startAt: string;
  shortfalls: PlanShortfall[];
}

export interface PlanUpgradeBannerModel {
  eventCount: number;
  /** The soonest event that needs an upgrade. */
  first: PlanBannerEvent;
  /** Every service that falls short for any of the events, in banner order, once each. */
  services: PlanService[];
  daysLeft: number;
  text: string;
}

const ORDER: PlanService[] = ["LiveKit", "Zoom", "Resend", "StreamYard"];
const BANNER_ZONE = "America/Chicago";

function ctDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: BANNER_ZONE, weekday: "short", day: "numeric", month: "short" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("weekday")} ${get("day")} ${get("month")}`;
}

function ctDayNumber(date: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: BANNER_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Calendar days in Central time from now to the event's start; 0 = today (or already started). */
export function daysUntil(startAt: string, now: Date): number {
  return Math.max(0, ctDayNumber(new Date(startAt)) - ctDayNumber(now));
}

function whenWords(days: number, startAt: string, now: Date) {
  if (new Date(startAt).getTime() <= now.getTime()) return "on now";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function serviceWords(service: PlanService, shortfalls: PlanShortfall[]) {
  const shortfall = shortfalls.find((item) => item.service === service)!;
  return shortfall.planRecorded ? `${service} to ${shortfall.upgradeTo}` : `${service} (plan not recorded)`;
}

export function planUpgradeBanner(events: PlanBannerEvent[], now: Date = new Date()): PlanUpgradeBannerModel | null {
  const short = events.filter((event) => event.shortfalls.length).sort((a, b) => a.startAt.localeCompare(b.startAt));
  if (!short.length) return null;
  const first = short[0];
  const all = short.flatMap((event) => event.shortfalls);
  const services = ORDER.filter((service) => all.some((item) => item.service === service));
  const daysLeft = daysUntil(first.startAt, now);
  const when = `${ctDate(first.startAt)}, ${whenWords(daysLeft, first.startAt, now)}`;
  const list = services.map((service) => serviceWords(service, all)).join(", ");
  const text = short.length === 1
    ? `⚠ Upgrade before ${first.name} (${when}): ${list}.`
    : `⚠ ${short.length} events need upgrades first, the next is ${first.name} (${when}): ${list}.`;
  return { eventCount: short.length, first, services, daysLeft, text };
}
