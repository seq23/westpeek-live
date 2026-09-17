import type { Attendee, RunOfShowSegment, Session, SpeakerProfile, Sponsor, SponsorBooth, VideoRoom } from "@/types/core";
import { demoIso, demoMinuteMemo } from "@/lib/mock/demoSchedule";

/**
 * Nova Founder Summit — the demo event.
 *
 * This is the run of show the owner shows people. Its job is to be seen, so it is written the way a
 * producer actually writes one: a real shape for a half-day virtual summit, with the producer's own
 * notes, technical cues, backup plans, poll and Q&A cues, readiness and approval states on every
 * segment — and a client-facing line on each one that is the only thing a guest ever reads.
 *
 * Every segment is also chosen to light up a feature the product genuinely has, so the demo shows
 * the thing rather than describing it:
 *
 *   | Segment                         | What it makes visible                                     |
 *   | ------------------------------- | --------------------------------------------------------- |
 *   | Doors Open                      | lobby, the running-order strip, help                        |
 *   | Opening                         | main stage, live chat, pinned message                       |
 *   | Keynote                         | stage video, green room hand-off, poll cue                   |
 *   | Sponsor Spotlight (x2)          | sponsor lower third, expo booth, lead capture                |
 *   | Investor Panel                  | multi-speaker stage, hand-raise, stage requests              |
 *   | Live Q&A                        | hand-raise queue, moderated chat, attendee on stage          |
 *   | Break and Expo Walkabout        | expo directory, sponsor booths, People page                  |
 *   | Speed Networking                | 4-minute 1:1 matching, the networking queue                  |
 *   | Breakouts                       | breakout rooms, capacity, room chat                          |
 *   | Fireside                        | stage, replay capture                                        |
 *   | Operators' Hour                 | roundtable room, hand-raise                                  |
 *   | Close                           | replay availability, post-event report                       |
 *
 * EVERYONE AND EVERY COMPANY HERE IS INVENTED. Nova Capital Partners, its speakers, its sponsors
 * and its attendees do not exist; the addresses are all example.com, which cannot receive mail.
 * Nothing in this file may ever be confused with a real client event.
 */

const AGENCY = "agency-wpp";
const CLIENT = "client-nova";
const EVENT = "event-summit";
const base = { agencyId: AGENCY, clientId: CLIENT, eventId: EVENT } as const;

const MAIN_STAGE = "Main Stage";
const EXPO_HALL = "Expo Hall";
const NETWORKING_LOUNGE = "Networking Lounge";
const BREAKOUT_ROOMS = "Breakout Rooms";

/** Every segment of the day: [id, publicTitle, startOffset, endOffset, room]. */
interface SegmentPlan {
  id: string;
  segmentTitle: string;
  publicTitle: string;
  from: number;
  to: number;
  room: string;
  speakerId?: string;
  sponsorId?: string;
  producerNotes: string;
  technicalCues: string;
  clientFacingDescription: string;
  backupPlan: string;
  pollCue?: string;
  qAndACue?: string;
  sponsorMention?: string;
  readinessStatus: RunOfShowSegment["readinessStatus"];
  approvalStatus: RunOfShowSegment["approvalStatus"];
}

const SEGMENT_PLAN: SegmentPlan[] = [
  {
    id: "ros-opening",
    segmentTitle: "Doors open — holding loop and orientation",
    publicTitle: "Doors Open: Welcome and Orientation",
    from: 0,
    to: 10,
    room: MAIN_STAGE,
    speakerId: "speaker-drake",
    producerNotes: "Holding slate up from call time. Confirm lower third, then bring Drake live after the 30-second bumper. Watch the lobby count before opening mics.",
    technicalCues: "Start bumper video, fade to host camera, pin the orientation message in stage chat.",
    clientFacingDescription: "Come in, get your bearings, and see how the day runs. Chat is open and the running order is on every page.",
    backupPlan: "If the host is late, hold the slate and run the orientation card on a loop; producer reads the opening script.",
    pollCue: "Launch the icebreaker poll at minute 5 — 'what brought you today?'",
    qAndACue: "Q&A closed during orientation; chat moderated.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-welcome",
    segmentTitle: "Client welcome — Nova Capital",
    publicTitle: "Opening: Why We Brought You Together",
    from: 10,
    to: 20,
    room: MAIN_STAGE,
    producerNotes: "Client speaks from the green room. Keep to 8 minutes; hard cut to the keynote bumper at 20.",
    technicalCues: "Single camera, client lower third, no slides.",
    clientFacingDescription: "Nova Capital opens the summit and sets out what the next few hours are for.",
    backupPlan: "If the client drops, the host covers with the pre-recorded welcome on file.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-keynote",
    segmentTitle: "Keynote — Drake Mensah",
    publicTitle: "Keynote: Building in the Open",
    from: 20,
    to: 65,
    room: MAIN_STAGE,
    speakerId: "speaker-drake",
    producerNotes: "Deck v3 is the live version. Speaker shares from the green room; producer holds slide advance as backup.",
    technicalCues: "Speaker camera full frame, screen share picture-in-picture, captions on.",
    clientFacingDescription: "Forty-five minutes on building a company with the work visible — what it costs, what it returns, and when to stop.",
    backupPlan: "If screen share fails, producer advances the deck from the crew copy and the speaker stays on camera.",
    pollCue: "Poll at minute 30 — 'how open is your roadmap today?'",
    qAndACue: "Collect questions throughout; hold them for the panel Q&A.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-sponsor",
    segmentTitle: "Sponsor spotlight — Clarity Systems",
    publicTitle: "Sponsor Spotlight: Clarity Systems",
    from: 65,
    to: 75,
    room: MAIN_STAGE,
    sponsorId: "sponsor-clarity",
    producerNotes: "Sponsor rep joins for 5 minutes, then the booth card goes up. Keep the CTA clean and do not let it run over.",
    technicalCues: "Sponsor lower third, booth link card in chat, expo booth opens at the same moment.",
    clientFacingDescription: "A short word from Clarity Systems, and their booth opens in the expo for the rest of the day.",
    backupPlan: "Play the sponsor video if the representative is unavailable.",
    sponsorMention: "Clarity Systems sponsor CTA — free workflow audit for summit attendees.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-panel",
    segmentTitle: "Investor panel — four up, moderated",
    publicTitle: "Investor Panel: What Gets Funded Now",
    from: 75,
    to: 120,
    room: MAIN_STAGE,
    speakerId: "speaker-nadia",
    producerNotes: "Four panellists plus moderator. Bring all of them live from the green room at 73. Keep it tight; hard stop at 120.",
    technicalCues: "Grid layout, moderator pinned, hand-raise queue open from minute 25.",
    clientFacingDescription: "Four investors on what is actually getting funded this year, and what they are quietly passing on.",
    backupPlan: "Move to a solo fireside with the moderator if two or more panellists drop.",
    qAndACue: "Open the hand-raise queue at minute 25; moderator takes three from the room.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-qa",
    segmentTitle: "Live Q&A — attendees on stage",
    publicTitle: "Live Q&A with the Panel",
    from: 120,
    to: 135,
    room: MAIN_STAGE,
    speakerId: "speaker-nadia",
    producerNotes: "Attendees come up from the hand-raise queue. Moderator vets in the green room first; two at a time on stage, no more.",
    technicalCues: "Approve stage requests from the crew panel; drop each attendee back to the audience after their question.",
    clientFacingDescription: "Raise your hand and ask the panel yourself, on camera. The moderator takes as many as the clock allows.",
    backupPlan: "If nobody raises a hand, the moderator reads from the collected chat questions.",
    qAndACue: "Hand-raise queue open for the whole segment.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-break",
    segmentTitle: "Break — expo walkabout",
    publicTitle: "Break and Expo Walkabout",
    from: 135,
    to: 155,
    room: EXPO_HALL,
    producerNotes: "Stage goes to the break card with a countdown. Crew resets the panel set and checks the networking queue depth.",
    technicalCues: "Break card with countdown on stage, music bed, expo booths all open, help desk staffed.",
    clientFacingDescription: "Twenty minutes. Stretch, or walk the expo — every sponsor booth is staffed and the People page is open.",
    backupPlan: "Extend the break card by five minutes if the panel overruns.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-networking",
    segmentTitle: "Speed networking — 4-minute rounds",
    publicTitle: "Speed Networking: Four Minutes Each",
    from: 155,
    to: 175,
    room: NETWORKING_LOUNGE,
    producerNotes: "Queue opens at 153 so there is a pool before the first round. Watch the monitor for odd numbers and unmatched waits.",
    technicalCues: "Open the networking queue, stage shows the lounge card, crew monitors match health.",
    clientFacingDescription: "Four minutes on camera with one person you have not met, then it moves you on. Join the queue and it keeps going until you leave.",
    backupPlan: "If the queue thins out, extend round length and point the stage card at the expo instead.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-breakouts",
    segmentTitle: "Breakouts — three rooms",
    publicTitle: "Breakouts: Three Rooms, Pick One",
    from: 175,
    to: 220,
    room: BREAKOUT_ROOMS,
    speakerId: "speaker-iona",
    producerNotes: "Three rooms, one host each, 25 seats each. Crew watches capacity and moves the overflow to room C.",
    technicalCues: "Open all three breakout rooms at 175, each with its own chat; recording on for A and B only.",
    clientFacingDescription: "Three small rooms running at once — founder lessons, hiring, and pricing. Pick one, cameras on, twenty-five people maximum.",
    backupPlan: "If a host drops, merge that room into the one next door and announce it in room chat.",
    readinessStatus: "needs_speaker",
    approvalStatus: "approved",
  },
  {
    id: "ros-sponsor-two",
    segmentTitle: "Sponsor spotlight — Northwind Analytics",
    publicTitle: "Sponsor Spotlight: Northwind Analytics",
    from: 220,
    to: 230,
    room: MAIN_STAGE,
    sponsorId: "sponsor-northwind",
    producerNotes: "Second sponsor read. Copy is still in client review — do not go live on v2 until that clears.",
    technicalCues: "Sponsor lower third, booth link card in chat.",
    clientFacingDescription: "A short word from Northwind Analytics as everyone comes back from the breakouts.",
    backupPlan: "Play the 60-second sponsor video and keep the booth card up.",
    sponsorMention: "Northwind Analytics sponsor CTA — benchmark report for attendees.",
    readinessStatus: "needs_assets",
    approvalStatus: "needs_agency_review",
  },
  {
    id: "ros-fireside",
    segmentTitle: "Fireside — the second hire",
    publicTitle: "Fireside: The Second Hire",
    from: 230,
    to: 265,
    room: MAIN_STAGE,
    speakerId: "speaker-amara",
    producerNotes: "Two chairs, no slides. Warm lighting look. This is the replay clip the client will want first.",
    technicalCues: "Two-shot, cut to singles on answers, recording flagged for the highlight cut.",
    clientFacingDescription: "The hire after the founders — who it should be, when to make it, and what it changes.",
    backupPlan: "If the guest drops, the host runs the same questions with the breakout host who stayed back.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-ama",
    segmentTitle: "Operators' hour — open roundtable",
    publicTitle: "Ask Me Anything: The Operators' Hour",
    from: 265,
    to: 280,
    room: MAIN_STAGE,
    speakerId: "speaker-priya",
    producerNotes: "Loose format. Hand-raise queue open the whole way; producer keeps a hard eye on the clock for the close.",
    technicalCues: "Hand-raise queue open, two attendees on stage at a time, captions on.",
    clientFacingDescription: "Anything you did not get to ask. Raise your hand and come up, or put it in chat.",
    backupPlan: "Moderator reads from the chat backlog if the queue empties.",
    qAndACue: "Hand-raise queue open for the whole segment.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
  {
    id: "ros-close",
    segmentTitle: "Close — what happens next",
    publicTitle: "Closing: What Happens Next",
    from: 280,
    to: 295,
    room: MAIN_STAGE,
    producerNotes: "Client closes. Replay goes live within the hour; confirm the post-event report is queued before the stage ends.",
    technicalCues: "Host and client two-shot, end card with the replay link, stop recording on the end card.",
    clientFacingDescription: "How to reach the people you met, when the replay lands, and what Nova is doing next.",
    backupPlan: "Host closes alone against the end card if the client cannot make it back.",
    readinessStatus: "ready",
    approvalStatus: "approved",
  },
];

function buildRunOfShow(): RunOfShowSegment[] {
  return SEGMENT_PLAN.map((plan) => ({
    ...base,
    id: plan.id,
    segmentTitle: plan.segmentTitle,
    publicTitle: plan.publicTitle,
    startAt: demoIso(plan.from),
    endAt: demoIso(plan.to),
    durationMinutes: plan.to - plan.from,
    room: plan.room,
    speakerId: plan.speakerId,
    sponsorId: plan.sponsorId,
    responsibleUserId: "user-producer-maya",
    producerNotes: plan.producerNotes,
    technicalCues: plan.technicalCues,
    clientFacingDescription: plan.clientFacingDescription,
    backupPlan: plan.backupPlan,
    pollCue: plan.pollCue,
    qAndACue: plan.qAndACue,
    sponsorMention: plan.sponsorMention,
    readinessStatus: plan.readinessStatus,
    approvalStatus: plan.approvalStatus,
    clientVisible: true,
  }));
}

/** The day as rooms an attendee can actually be in. Contiguous, so something is always on. */
const SESSION_PLAN: Array<{ id: string; name: string; description: string; sessionType: Session["sessionType"]; from: number; to: number; capacity: number }> = [
  { id: "session-doors", name: "Doors Open and Orientation", description: "How the day runs, where everything is, and who is here.", sessionType: "workshop", from: 0, to: 20, capacity: 600 },
  { id: "session-keynote", name: "Keynote: Building in the Open", description: "Forty-five minutes on building a company with the work visible.", sessionType: "workshop", from: 20, to: 65, capacity: 600 },
  { id: "session-sponsor-clarity", name: "Sponsor Spotlight: Clarity Systems", description: "A short word from Clarity Systems, and their booth opens.", sessionType: "sponsor_session", from: 65, to: 75, capacity: 600 },
  { id: "session-panel", name: "Investor Panel: What Gets Funded Now", description: "Four investors on what is getting funded and what they are passing on.", sessionType: "panel", from: 75, to: 120, capacity: 600 },
  { id: "session-qa", name: "Live Q&A with the Panel", description: "Raise your hand and ask the panel yourself, on camera.", sessionType: "roundtable", from: 120, to: 135, capacity: 600 },
  { id: "session-expo-break", name: "Break and Expo Walkabout", description: "Twenty minutes. Walk the expo, or find someone on the People page.", sessionType: "workshop", from: 135, to: 155, capacity: 600 },
  { id: "session-speed-networking", name: "Speed Networking: Four Minutes Each", description: "Four minutes on camera with one person you have not met, on a loop.", sessionType: "roundtable", from: 155, to: 175, capacity: 300 },
  { id: "session-breakout-a", name: "Breakout A: Founder Lessons", description: "Small-group room with founder case studies and open discussion.", sessionType: "breakout", from: 175, to: 220, capacity: 25 },
  { id: "session-breakout-b", name: "Breakout B: Hiring Before You Are Ready", description: "The first five hires, in the order that actually works.", sessionType: "breakout", from: 175, to: 220, capacity: 25 },
  { id: "session-breakout-c", name: "Breakout C: Pricing Without Flinching", description: "Setting a price, defending it, and changing it in public.", sessionType: "breakout", from: 175, to: 220, capacity: 25 },
  { id: "session-sponsor-northwind", name: "Sponsor Spotlight: Northwind Analytics", description: "A short word from Northwind Analytics after the breakouts.", sessionType: "sponsor_session", from: 220, to: 230, capacity: 600 },
  { id: "session-fireside", name: "Fireside: The Second Hire", description: "The hire after the founders, and what it changes.", sessionType: "workshop", from: 230, to: 265, capacity: 600 },
  { id: "session-roundtable", name: "Ask Me Anything: The Operators' Hour", description: "Anything you did not get to ask, on camera or in chat.", sessionType: "roundtable", from: 265, to: 280, capacity: 600 },
  { id: "session-close", name: "Closing: What Happens Next", description: "Replay, the people you met, and what Nova is doing next.", sessionType: "workshop", from: 280, to: 295, capacity: 600 },
];

function buildSessions(): Session[] {
  return SESSION_PLAN.map((plan) => ({
    ...base,
    id: plan.id,
    name: plan.name,
    description: plan.description,
    sessionType: plan.sessionType,
    status: "scheduled" as const,
    startAt: demoIso(plan.from),
    endAt: demoIso(plan.to),
    capacity: plan.capacity,
  }));
}

export const demoSummitRunOfShow = demoMinuteMemo(buildRunOfShow);
export const demoSummitSessions = demoMinuteMemo(buildSessions);

/**
 * Speakers. Invented people at invented companies — the summit needs a believable bill, and a bill
 * of "Drake Speaker" and "Iona Founder" made the product look unfinished rather than honest.
 */
export const demoSummitSpeakers: SpeakerProfile[] = [
  { ...base, id: "speaker-drake", userId: "user-speaker-drake", name: "Drake Mensah", title: "Managing Partner", company: "Northline Ventures", email: "drake@example.com", bio: "Investor and operator focused on founder-market fit. Writes the first cheque more often than the second.", readinessStatus: "tech_check_scheduled", techCheckStatus: "scheduled", sessionTitle: "Keynote: Building in the Open" },
  { ...base, id: "speaker-nadia", name: "Nadia Haddad", title: "Partner", company: "Long Bridge Partners", email: "nadia@example.com", bio: "Leads early-stage investing and moderates more panels than she sits on.", readinessStatus: "ready", techCheckStatus: "completed", sessionTitle: "Investor Panel: What Gets Funded Now" },
  { ...base, id: "speaker-iona", name: "Iona Adeyemi", title: "Founder and CEO", company: "ScaleThread", email: "iona@example.com", bio: "Founder sharing lessons from the seed-to-Series-A path, including the parts that did not work.", readinessStatus: "deck_submitted", techCheckStatus: "not_scheduled", sessionTitle: "Breakout A: Founder Lessons" },
  { ...base, id: "speaker-amara", name: "Amara Okonjo", title: "Chief Operating Officer", company: "Brightloom Health", email: "amara@example.com", bio: "Built the operating function at two companies before either had one.", readinessStatus: "ready", techCheckStatus: "completed", sessionTitle: "Fireside: The Second Hire" },
  { ...base, id: "speaker-priya", name: "Priya Raghunathan", title: "Co-founder and CTO", company: "Ostinato Labs", email: "priya@example.com", bio: "Engineer turned founder. Ships in public and answers the hard question first.", readinessStatus: "ready", techCheckStatus: "completed", sessionTitle: "Ask Me Anything: The Operators' Hour" },
  { ...base, id: "speaker-teo", name: "Teo Alvarez", title: "Founder", company: "Cadence Robotics", email: "teo@example.com", bio: "Hardware founder who learned pricing the expensive way.", readinessStatus: "tech_check_scheduled", techCheckStatus: "scheduled", sessionTitle: "Breakout C: Pricing Without Flinching" },
  { ...base, id: "speaker-yuki", name: "Yuki Tanaka-Bright", title: "Head of Platform", company: "Ferrymead", email: "yuki@example.com", bio: "Runs the platform team and the hiring bar that comes with it.", readinessStatus: "ready", techCheckStatus: "completed", sessionTitle: "Breakout B: Hiring Before You Are Ready" },
  { ...base, id: "speaker-marcus", name: "Marcus Bell", title: "General Partner", company: "Tidewater Growth", email: "marcus.b@example.com", bio: "Growth-stage investor, former operator, allergic to a vague metric.", readinessStatus: "ready", techCheckStatus: "completed", sessionTitle: "Investor Panel: What Gets Funded Now" },
];

export const demoSummitSponsors: Sponsor[] = [
  { ...base, id: "sponsor-clarity", name: "Clarity Systems", websiteUrl: "https://westpeek.live", tier: "title", status: "assets_submitted", primaryContactName: "Riley Okafor", primaryContactEmail: "riley@example.com" },
  { ...base, id: "sponsor-northwind", name: "Northwind Analytics", websiteUrl: "https://westpeek.live", tier: "gold", status: "assets_submitted", primaryContactName: "Dana Whitfield", primaryContactEmail: "dana@example.com" },
  { ...base, id: "sponsor-fernbank", name: "Fernbank Legal", websiteUrl: "https://westpeek.live", tier: "silver", status: "booth_approved", primaryContactName: "Priyanka Shah", primaryContactEmail: "priyanka@example.com" },
  { ...base, id: "sponsor-relay", name: "Relay Payroll", websiteUrl: "https://westpeek.live", tier: "community", status: "live", primaryContactName: "Jonah Reyes", primaryContactEmail: "jonah@example.com" },
];

export const demoSummitBooths: SponsorBooth[] = [
  { ...base, id: "booth-clarity", sponsorId: "sponsor-clarity", name: "Clarity Systems", description: "Operational dashboards for scaling founder teams. Staffed all day; the team answers in booth chat.", ctaLabel: "Book a founder ops demo", ctaUrl: "https://westpeek.live", offerText: "Summit attendees get a free workflow audit.", status: "live", approvalStatus: "approved", leadCount: 42, resourceCount: 3 },
  { ...base, id: "booth-northwind", sponsorId: "sponsor-northwind", name: "Northwind Analytics", description: "Benchmarks for early-stage companies, built from anonymised operating data.", ctaLabel: "Get the benchmark report", ctaUrl: "https://westpeek.live", offerText: "The 2026 seed-stage benchmark report, free to attendees.", status: "agency_review", approvalStatus: "needs_agency_review", leadCount: 18, resourceCount: 2 },
  { ...base, id: "booth-fernbank", sponsorId: "sponsor-fernbank", name: "Fernbank Legal", description: "Company formation, option pools, and the paperwork nobody enjoys.", ctaLabel: "Book a 15-minute clinic", ctaUrl: "https://westpeek.live", offerText: "Fifteen-minute clinic slots, first come first served.", status: "live", approvalStatus: "approved", leadCount: 11, resourceCount: 4 },
  { ...base, id: "booth-relay", sponsorId: "sponsor-relay", name: "Relay Payroll", description: "Payroll and contractor payments for teams in more than one country.", ctaLabel: "See how it works", ctaUrl: "https://westpeek.live", offerText: "Three months free for teams under twenty.", status: "live", approvalStatus: "approved", leadCount: 7, resourceCount: 1 },
];

function person(id: string, name: string, company: string, title: string, reason: string, fact: string, userId?: string): Attendee {
  return {
    ...base,
    id,
    userId,
    name,
    email: `${id.replace("attendee-", "")}@example.com`,
    company,
    title,
    website: "https://westpeek.live",
    socialLinks: [`/venue/${EVENT}/people#${id}`],
    reasonForAttending: reason,
    interestingFact: fact,
    networkingEnabled: true,
    status: "registered",
  };
}

export const demoSummitAttendees: Attendee[] = [
  person("attendee-sam", "Sam Rivera", "SeedWorks", "Founder", "Meeting operators and investors who understand high-trust virtual events.", "I keep a list of every great networking question I hear.", "user-attendee-sam"),
  person("attendee-morgan", "Morgan Baptiste", "LaunchOps", "Chief Operating Officer", "Learning how to make large online events feel smaller and more useful.", "I once ran a backstage comms room with 27 speakers and no missed cues."),
  person("attendee-devon", "Devon Achebe", "Halfpipe", "Head of Growth", "Looking for the two or three people here who have already solved my pricing problem.", "I have read every pricing page in my category. All of them."),
  person("attendee-lena", "Lena Kowalski", "Tiller", "Founder", "Raising in the autumn and want to hear what partners actually say when founders are not listening.", "I write the investor update before the month starts, then fill it in."),
  person("attendee-omar", "Omar Farouk", "Brightside Labs", "VP Engineering", "Hiring three people this quarter and I would like to get it right.", "I keep a spreadsheet of interview questions that turned out to predict nothing."),
  person("attendee-yara", "Yara Mensah", "Coastline", "Co-founder", "Here for the breakouts. Big rooms teach me less than small ones.", "My best hire came from a four-minute speed-networking call at an event like this."),
  person("attendee-ines", "Inés Villanueva", "Quiet Hours", "Founder", "Working out whether our next round should happen at all.", "I run the company from a boat two months a year."),
  person("attendee-tom", "Tom Bergström", "Northfield", "Chief Financial Officer", "Benchmarks. I want to know whether our numbers are normal.", "I have never once found the benchmark I needed in a benchmark report."),
  person("attendee-ada", "Ada Nwosu", "Loop and Ladder", "Head of People", "Everything on the hiring breakout, and then the people who ran it.", "I interview candidates about their worst week, never their best."),
  person("attendee-kai", "Kai Lindqvist", "Solden", "Founder", "First time at one of these. Mostly here to listen.", "I built the first version of our product on a train."),
];

export const demoSummitVideoRooms: VideoRoom[] = [
  { ...base, id: "video-main-stage", roomType: "main_stage", resourceType: "stage", resourceId: "stage-main", provider: "mock", name: "Main Stage", status: "live", recordingEnabled: true },
  { ...base, id: "video-breakout-a", roomType: "breakout_session", resourceType: "session", resourceId: "session-breakout-a", provider: "mock", name: "Breakout A: Founder Lessons", status: "scheduled", recordingEnabled: true },
  { ...base, id: "video-breakout-b", roomType: "breakout_session", resourceType: "session", resourceId: "session-breakout-b", provider: "mock", name: "Breakout B: Hiring Before You Are Ready", status: "scheduled", recordingEnabled: true },
  { ...base, id: "video-breakout-c", roomType: "breakout_session", resourceType: "session", resourceId: "session-breakout-c", provider: "mock", name: "Breakout C: Pricing Without Flinching", status: "scheduled", recordingEnabled: false },
  { ...base, id: "video-booth-clarity", roomType: "sponsor_booth", resourceType: "sponsor_booth", resourceId: "booth-clarity", provider: "mock", name: "Clarity Systems Booth", status: "live", recordingEnabled: false },
  { ...base, id: "video-booth-northwind", roomType: "sponsor_booth", resourceType: "sponsor_booth", resourceId: "booth-northwind", provider: "mock", name: "Northwind Analytics Booth", status: "scheduled", recordingEnabled: false },
  { ...base, id: "video-green-room", roomType: "backstage", resourceType: "stage", resourceId: "stage-main", provider: "mock", name: "Speaker Green Room", status: "live", recordingEnabled: false },
];
