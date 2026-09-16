/**
 * A template is a starting point for an event: the format, the type, how long it runs, the sessions
 * it opens with and the questions it asks at registration. Nothing more — a template that carried
 * things the create form does not read would be decoration.
 */
export interface TemplateSession {
  title: string;
  minutes: number;
}

export interface EventTemplateRecord {
  id: string;
  name: string;
  description: string;
  format: "stage" | "room";
  eventType: string;
  durationMinutes: number;
  sessions: TemplateSession[];
  registrationQuestions: string[];
  createdByLabel: string;
  createdAt: string;
  updatedAt: string;
}

/** What "Use this template" puts in the URL of /app/events/new. */
export function templatePrefillQuery(template: EventTemplateRecord) {
  const params = new URLSearchParams({ template: template.id, when: "later", format: template.format, eventType: template.eventType });
  return `?${params.toString()}`;
}

export function templateSummary(template: EventTemplateRecord) {
  const sessions = template.sessions.length ? `${template.sessions.length} session${template.sessions.length === 1 ? "" : "s"}` : "no sessions yet";
  return `${template.format === "room" ? "Room" : "Stage"} · ${template.durationMinutes} min · ${sessions}`;
}
