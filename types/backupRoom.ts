/**
 * The bottom two rungs of the show-day ladder, as something a person types in rather than something
 * a deploy decides.
 *
 * Zoom and Google Meet exist for the moment the feed is already down and the crew is walking down
 * the ladder. Until 17 Sep 2026 both read fixed Worker variables, so on the day nobody could put a
 * meeting in. These are the values the crew deck now saves per event, and the shape of the "no, and
 * here is what is wrong with it" answer they get when what they typed is not a meeting.
 */
export interface EventBackupRoomRecord {
  eventId: string;
  stageId: string;
  /** Digits only, as Zoom's SDK wants it. Undefined means the Zoom rung is not configured. */
  zoomMeetingNumber?: string;
  /** Optional: plenty of meetings have none. A Zoom meeting passcode, never a West Peek access code. */
  zoomPasscode?: string;
  /** The whole https://meet.google.com/... link. Undefined means the Meet rung is not configured. */
  googleMeetUrl?: string;
  /** The ROLE that saved it — "owner", "operator", "crew:producer" — never a person's name. */
  updatedBy?: string;
  updatedAt: string;
}

/** What the ladder needs to know about a saved row: two values, either of which may be absent. */
export interface BackupRoomValues {
  zoomMeetingNumber?: string;
  googleMeetUrl?: string;
}

export interface FieldVerdict {
  ok: boolean;
  /** The cleaned value to store. Undefined means the field was left empty, which is allowed. */
  value?: string;
  /** What is wrong with it, in words, when ok is false. */
  reason?: string;
}

/**
 * A Zoom meeting number is 9, 10 or 11 digits. People paste it with spaces ("878 1234 5678"), out of
 * a join URL, or they paste the whole invite. We take the spaces and dashes out and then say plainly
 * what is wrong with whatever is left, because "invalid" on show day helps nobody.
 */
export function parseZoomMeetingNumber(input: string | undefined): FieldVerdict {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: true, value: undefined };
  const fromJoinUrl = /zoom\.us\/(?:j|s|w)\/(\d{9,11})/i.exec(raw);
  const digits = (fromJoinUrl ? fromJoinUrl[1] : raw).replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) {
    return { ok: false, reason: "A Zoom meeting number is only digits. Paste the number from the invite (the “Meeting ID”), not the whole invite text." };
  }
  if (digits.length < 9 || digits.length > 11) {
    return { ok: false, reason: `A Zoom meeting number is 9, 10 or 11 digits and this one is ${digits.length}. Check it against the invite before the show.` };
  }
  return { ok: true, value: digits };
}

/** Optional, and Zoom's own limit is 10 characters. Anything longer was not a passcode. */
export function parseZoomPasscode(input: string | undefined): FieldVerdict {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: true, value: undefined };
  if (raw.length > 10) return { ok: false, reason: "A Zoom meeting passcode is at most 10 characters. If the meeting has no passcode, leave this empty." };
  return { ok: true, value: raw };
}

/**
 * A real Meet link, not a calendar invite and not a Zoom link pasted in the wrong box. Google's own
 * shape is meet.google.com/xxx-yyyy-zzz; we also take the g.co/meet shortener people copy from
 * Calendar. This is the rung that sends attendees off our page, so a wrong link here is the worst
 * mistake on the ladder and it is worth being strict about.
 */
export function parseGoogleMeetUrl(input: string | undefined): FieldVerdict {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: true, value: undefined };
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "That is not a link. Open the Meet room and copy the address out of the browser bar." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "A Meet link is https. Copy it out of the browser bar rather than typing it." };
  const host = url.hostname.toLowerCase();
  if (host === "g.co" && /^\/meet\/?/i.test(url.pathname)) return { ok: true, value: url.toString() };
  if (host !== "meet.google.com") {
    return { ok: false, reason: `A Google Meet link is on meet.google.com and this one is on ${host}. Paste the Meet room link here and the Zoom meeting number in the Zoom box above.` };
  }
  const code = url.pathname.replace(/^\/+|\/+$/g, "");
  if (!/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(code)) {
    return { ok: false, reason: "A Meet link ends in a three-part code like abc-defg-hij. This one has no room code, so it would open Meet's front page instead of your room." };
  }
  return { ok: true, value: `https://meet.google.com/${code.toLowerCase()}` };
}
