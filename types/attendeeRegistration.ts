export interface AttendeeProfile {
  attendeeId: string;
  eventId: string;
  emailHash: string;
  /** The raw address, lowercased and trimmed (kept since 16 Sep 2026; rows registered before have none). */
  email?: string;
  name: string;
  emailMasked?: string;
  company: string;
  title: string;
  personalWebsite?: string;
  socialLinks: string[];
  reasonForAttending?: string;
  interestingFact?: string;
  topicsOfInterest: string[];
  networkingGoals?: string;
  networkingOptIn: boolean;
  /** "Hide me from the People directory": left out of the People page and sponsor lead views; crew still see them; networking still works if they join. Default false. */
  hiddenFromDirectory?: boolean;
  /** Answers to the event's registration questions, keyed by question key (the legacy four columns mirror their keys). */
  extraAnswers?: Record<string, string>;
  role: "attendee";
  status: "active" | "revoked" | "expired";
  createdAt: string;
  updatedAt: string;
}

export interface AttendeeRegistrationInput {
  eventId: string;
  name: string;
  email: string;
  company: string;
  /** Optional since 16 Sep 2026: registration is name, email, company; the title comes later from "Tell us more". */
  title?: string;
  personalWebsite?: string;
  socialLinks?: string[];
  reasonForAttending?: string;
  interestingFact?: string;
  topicsOfInterest?: string[];
  networkingGoals?: string;
  networkingOptIn?: boolean;
}

export interface AttendeeRegistrationResult {
  profile: AttendeeProfile;
  duplicateBehavior: "created" | "updated_existing_email";
}

/** One person across events, keyed by lowercased email; upserted on every registration. */
export interface ContactRecord {
  email: string;
  name: string;
  company: string;
  title: string;
  personalWebsite?: string;
  socialLinks: string[];
  topicsOfInterest: string[];
  networkingGoals?: string;
  hiddenFromDirectory: boolean;
  eventsAttended: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  /** Set when the owner archives one of our own test rows (migration 0030). Archived rows are never deleted, only left out. */
  archivedAt?: string;
}

/** A per-event "Tell us more" question. */
export interface RegistrationQuestion {
  key: string;
  label: string;
  type: "text" | "textarea" | "tags";
  required?: boolean;
}

/** The legacy four, so nothing changes for events without their own list. */
export const DEFAULT_REGISTRATION_QUESTIONS: RegistrationQuestion[] = [
  { key: "reasonForAttending", label: "What brings you here", type: "textarea" },
  { key: "interestingFact", label: "One interesting fact", type: "textarea" },
  { key: "topicsOfInterest", label: "Topics you care about", type: "tags" },
  { key: "networkingGoals", label: "Networking goals", type: "textarea" },
];
export const MAX_REGISTRATION_QUESTIONS = 8;
