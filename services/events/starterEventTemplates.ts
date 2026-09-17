import type { EventTemplateRecord } from "@/types/eventTemplates";

/**
 * The four shapes West Peek Live actually runs, installed once so the shelf is never empty.
 *
 * A new install had zero templates, so /app/events/new offered nothing and the whole feature read
 * as broken. These fix that — but they are ORDINARY ROWS, not fixtures: they are written to the
 * runtime store one time, the owner can edit or delete any of them, and a deleted one stays
 * deleted because the install is marked on the house defaults row and never runs twice. Nothing
 * here is on a seed-data exemption list; after the install they are indistinguishable from a
 * template saved from an event.
 *
 * The lengths are the ones this product has run, not invented numbers: the webinar is the 75
 * minutes of Leadership Reset (17:00–18:15), the demo day is the 180 minutes of Seed Demo Day
 * (16:00–19:00), the workshop is the 45-minute workshop the access-code examples are cut from, and
 * the Room is the short on-demand session West Peek opens for itself.
 */
export const STARTER_TEMPLATE_IDS = [
  "template-starter-west-peek-room",
  "template-starter-45-minute-workshop",
  "template-starter-client-webinar",
  "template-starter-demo-day",
] as const;

export interface StarterEventTemplate extends Omit<EventTemplateRecord, "createdAt" | "updatedAt"> {}

export const STARTER_EVENT_TEMPLATES: StarterEventTemplate[] = [
  {
    id: "template-starter-west-peek-room",
    name: "West Peek Room",
    description: "Our own on-demand room. Open it, send the join code, talk. No registration, no client.",
    format: "room",
    eventType: "community_event",
    durationMinutes: 45,
    sessions: [{ title: "Main stage", minutes: 45 }],
    registrationQuestions: [],
    createdByLabel: "West Peek Live",
  },
  {
    id: "template-starter-45-minute-workshop",
    name: "45-minute workshop",
    description: "One teacher, one subject, people actually doing the thing. Short enough that nobody drifts off.",
    format: "stage",
    eventType: "paid_workshop",
    durationMinutes: 45,
    sessions: [
      { title: "Welcome and what we are doing", minutes: 5 },
      { title: "Teach it", minutes: 20 },
      { title: "Work it through together", minutes: 12 },
      { title: "Questions and close", minutes: 8 },
    ],
    registrationQuestions: ["What brings you here | textarea", "Topics you care about | tags"],
    createdByLabel: "West Peek Live",
  },
  {
    id: "template-starter-client-webinar",
    name: "Client webinar",
    description: "The standard client booking: one stage, one talk, a real Q&A, replay afterwards.",
    format: "stage",
    eventType: "webinar",
    durationMinutes: 75,
    sessions: [
      { title: "Welcome and housekeeping", minutes: 5 },
      { title: "Main talk", minutes: 40 },
      { title: "Q&A", minutes: 20 },
      { title: "Close and what happens next", minutes: 10 },
    ],
    registrationQuestions: ["What brings you here | textarea", "One interesting fact | textarea", "Topics you care about | tags", "Networking goals | textarea"],
    createdByLabel: "West Peek Live",
  },
  {
    id: "template-starter-demo-day",
    name: "Demo day",
    description: "Founder pitches on a timer, then investors ask the questions. Three hours, run tight.",
    format: "stage",
    eventType: "demo_day",
    durationMinutes: 180,
    sessions: [
      { title: "Open and the rules of the room", minutes: 10 },
      { title: "Founder pitches", minutes: 120 },
      { title: "Investor Q&A", minutes: 35 },
      { title: "Close", minutes: 15 },
    ],
    registrationQuestions: ["What brings you here | textarea", "Networking goals | textarea"],
    createdByLabel: "West Peek Live",
  },
];

/** The sessions of a starter template add up to its stated length; a template whose agenda overran would lie on the card. */
export function starterTemplateLengthMismatches() {
  return STARTER_EVENT_TEMPLATES.filter((template) => template.sessions.reduce((total, session) => total + session.minutes, 0) !== template.durationMinutes);
}
