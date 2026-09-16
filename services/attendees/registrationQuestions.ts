import { DEFAULT_REGISTRATION_QUESTIONS, MAX_REGISTRATION_QUESTIONS, type AttendeeProfile, type RegistrationQuestion } from "@/types/attendeeRegistration";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * Per-event "Tell us more" questions. An event without its own list gets the legacy four; answers
 * live in extra_answers keyed by question key, and the four legacy columns stay populated when the
 * keys match so existing UI (People cards, networking) keeps working. Pure.
 */
export const LEGACY_KEYS = new Set(["reasonForAttending", "interestingFact", "topicsOfInterest", "networkingGoals"]);

export function questionsForEvent(event: Pick<RuntimeEventRecord, "registrationQuestions"> | undefined): RegistrationQuestion[] {
  const list = event?.registrationQuestions;
  return Array.isArray(list) && list.length ? list.slice(0, MAX_REGISTRATION_QUESTIONS) : DEFAULT_REGISTRATION_QUESTIONS;
}

export function slugKey(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "question";
}

/** Parse the editor's lines ("Label | textarea", "Label | tags", "Label") into questions; legacy labels keep their legacy keys. */
export function parseQuestionLines(text: string): RegistrationQuestion[] {
  const legacyByLabel = new Map(DEFAULT_REGISTRATION_QUESTIONS.map((q) => [q.label.toLowerCase(), q]));
  const out: RegistrationQuestion[] = [];
  const seen = new Set<string>();
  for (const raw of String(text || "").split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [labelPart, typePart] = line.split("|").map((part) => part.trim());
    const label = labelPart.slice(0, 80);
    if (!label) continue;
    const legacy = legacyByLabel.get(label.toLowerCase());
    const type: RegistrationQuestion["type"] = typePart === "text" || typePart === "tags" || typePart === "textarea" ? typePart : legacy?.type || "textarea";
    let key = legacy?.key || slugKey(label);
    while (seen.has(key)) key = `${key}_2`;
    seen.add(key);
    out.push({ key, label, type, required: false });
    if (out.length >= MAX_REGISTRATION_QUESTIONS) break;
  }
  return out;
}

export function questionLines(questions: RegistrationQuestion[]) {
  return questions.map((q) => `${q.label} | ${q.type}`).join("\n");
}

/** The answer to a question: extra_answers first, then the legacy column when the key is one of the four. */
export function answerFor(profile: AttendeeProfile, question: RegistrationQuestion): string {
  const extra = profile.extraAnswers?.[question.key];
  if (extra !== undefined && extra !== "") return extra;
  if (question.key === "topicsOfInterest") return (profile.topicsOfInterest || []).join("\n");
  if (question.key === "reasonForAttending") return profile.reasonForAttending || "";
  if (question.key === "interestingFact") return profile.interestingFact || "";
  if (question.key === "networkingGoals") return profile.networkingGoals || "";
  return "";
}

/** Write answers: every key into extra_answers; the legacy four also into their columns. */
export function applyAnswers(profile: AttendeeProfile, answers: Record<string, string>): AttendeeProfile {
  const extra = { ...(profile.extraAnswers || {}) };
  const next: AttendeeProfile = { ...profile };
  for (const [key, raw] of Object.entries(answers)) {
    const value = String(raw || "").trim();
    if (value) extra[key] = value; else delete extra[key];
    if (key === "reasonForAttending") next.reasonForAttending = value || undefined;
    if (key === "interestingFact") next.interestingFact = value || undefined;
    if (key === "networkingGoals") next.networkingGoals = value || undefined;
    if (key === "topicsOfInterest") next.topicsOfInterest = value.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  }
  next.extraAnswers = extra;
  return next;
}

/** How many of the event's questions plus the three fixed extras (title, website, socials) are answered. */
export function tellUsMoreProgressFor(profile: AttendeeProfile, questions: RegistrationQuestion[]) {
  const fixed = [profile.title, profile.personalWebsite, profile.socialLinks?.length ? "x" : ""].filter((value) => value && String(value).trim()).length;
  const answered = questions.filter((question) => answerFor(profile, question).trim()).length;
  return { filled: fixed + answered, total: 3 + questions.length };
}
