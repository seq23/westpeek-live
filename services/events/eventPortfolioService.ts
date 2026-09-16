import { getRuntimeData } from "@/lib/runtime/getRuntimeData";
import { calculateEventReadiness } from "@/lib/readiness/calculateEventReadiness";
import { getSetupCompletion } from "@/services/events/eventSetupCompletionService";
import { getRoomFallbackState, recommendFallbackProvider } from "@/services/video/roomFallbackService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { listEventRecords, type EventListOptions } from "@/services/events/eventRepository";
import { ensureRuntimeEvents } from "@/services/events/runtimeEventOverlay";
import type { EventStatus } from "@/types/core";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

export type EventPortfolioTab = "Live Now" | "Upcoming" | "Drafts" | "Needs Review" | "Past" | "Archived" | "All";

export interface EventPortfolioCard {
  id: string;
  name: string;
  client: string;
  status: EventStatus;
  source: RuntimeEventRecord["source"];
  format: RuntimeEventRecord["format"];
  joinCode: string;
  createdByLabel: string;
  tab: EventPortfolioTab;
  startAt: string;
  timezone: string;
  readinessScore: number;
  setupCompletion: number;
  accessReadiness: string;
  speakerReadiness: string;
  sponsorReadiness: string;
  assetReadiness: string;
  runOfShowStatus: string;
  videoHealth: string;
  publishStatus: string;
  lastSmokeResult: string;
  incidentCount: number;
  reportingStatus: string;
  currentSegment: string;
  nextSegment: string;
  fallbackRecommendation: string;
}

function tabForStatus(status: EventStatus): EventPortfolioTab {
  if (status === "live") return "Live Now";
  if (status === "draft") return "Drafts";
  if (status === "published" || status === "registration_open" || status === "pre_event") return "Upcoming";
  if (status === "ended" || status === "replay_available") return "Past";
  if (status === "archived") return "Archived";
  return "Needs Review";
}

export type EventPortfolioOptions = EventListOptions;

/**
 * Real rows first (runtime store), compiled seed/demo events only when asked.
 * Runtime events are hydrated into the overlay so the readiness/read-model
 * helpers below see them exactly like seed events.
 */
export async function getEventPortfolioCards(options: EventPortfolioOptions = {}): Promise<EventPortfolioCard[]> {
  const records = await listEventRecords({ includeSeed: options.includeSeed, includeArchived: options.includeArchived });
  await ensureRuntimeEvents(records.filter((record) => record.source !== "seed"));
  const recordById = new Map(records.map((record) => [record.id, record]));
  const data = getRuntimeData();
  const runtime = await getRuntimeStore().readSnapshot();
  const cards: EventPortfolioCard[] = [];
  const orderedEvents = records.map((record) => data.events.find((event) => event.id === record.id)).filter((event): event is (typeof data.events)[number] => Boolean(event));
  for (const event of orderedEvents) {
    const record = recordById.get(event.id);
    if (!record) continue;
    const client = data.clients.find((item) => item.id === event.clientId);
    const readiness = calculateEventReadiness(data, event.id);
    const setup = getSetupCompletion(event.id);
    const fallback = await getRoomFallbackState(event.id, "main_stage");
    const incidents = runtime.incidentEvents.filter((incident) => incident.eventId === event.id && incident.status !== "resolved");
    const segments = data.runOfShowSegments.filter((segment) => segment.eventId === event.id);
    cards.push({
      id: event.id,
      name: event.name,
      client: record.clientName || client?.name || "Unassigned client",
      status: event.status,
      source: record.source,
      format: record.format,
      joinCode: record.joinCode,
      createdByLabel: record.createdByLabel,
      tab: tabForStatus(event.status),
      startAt: event.startAt,
      timezone: event.timezone,
      readinessScore: readiness.overallScore,
      setupCompletion: setup.score,
      accessReadiness: setup.sections.find((section) => section.key === "access")?.complete ? "ready" : "blocked",
      speakerReadiness: data.speakers.some((speaker) => speaker.eventId === event.id) ? "ready" : "missing speakers",
      sponsorReadiness: data.sponsors.some((sponsor) => sponsor.eventId === event.id) ? "ready" : "missing sponsors",
      assetReadiness: data.assets.some((asset) => asset.eventId === event.id) ? "ready" : "needs assets",
      runOfShowStatus: segments.length > 0 ? "configured" : "missing",
      videoHealth: fallback.health.livekit === "healthy" ? "healthy" : fallback.health.livekit,
      publishStatus: event.status === "draft" ? "draft" : "published path configured",
      lastSmokeResult: "pending local smoke",
      incidentCount: incidents.length,
      reportingStatus: event.reportingEnabled ? "enabled" : "disabled",
      currentSegment: segments[0]?.publicTitle || segments[0]?.segmentTitle || "No segment live",
      nextSegment: segments[1]?.publicTitle || segments[1]?.segmentTitle || "No next segment queued",
      fallbackRecommendation: recommendFallbackProvider(fallback),
    });
  }
  return cards;
}

export async function groupEventPortfolioCards(cards?: EventPortfolioCard[], options: EventPortfolioOptions = {}) {
  const resolvedCards = cards ?? await getEventPortfolioCards(options);
  const tabs: EventPortfolioTab[] = ["Live Now", "Upcoming", "Drafts", "Needs Review", "Past", "Archived", "All"];
  return tabs.map((tab) => ({ tab, cards: tab === "All" ? resolvedCards : resolvedCards.filter((card) => card.tab === tab) }));
}
