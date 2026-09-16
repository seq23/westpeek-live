const fs = require('fs');
const required = [
  'types/attendeeRegistration.ts',
  'types/attendeeSession.ts',
  'services/attendees/attendeeRegistrationService.ts',
  'services/attendees/attendeeSessionService.ts',
  'services/attendees/attendeeAgendaIntentService.ts',
  'lib/actions/attendeeAgendaActions.ts',
  'lib/actions/attendeeProfileActions.ts',
  'components/venue/RegistrationAgendaPlanner.tsx',
  'components/venue/MyAgendaPanel.tsx',
  'components/venue/EditAttendeeProfilePanel.tsx',
  'db/migrations/0022_attendee_identity_and_agenda_intents.sql'
];
const failures = [];
for (const file of required) if (!fs.existsSync(file)) failures.push(`Missing ${file}`);
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
const registration = read('lib/actions/registrationActions.ts');
for (const token of ['createAttendeeSession', 'upsertAttendeeAgendaIntent', 'company', 'title', 'plannedSessionIds']) if (!registration.includes(token)) failures.push(`registrationActions.ts missing ${token}`);
const chat = read('components/venue/LiveRoomChat.tsx');
if (chat.includes('Conference Attendee')) failures.push('LiveRoomChat still uses fake Conference Attendee identity.');
if (!chat.includes('getCurrentAttendeeIdentity')) failures.push('LiveRoomChat does not derive identity from attendee session.');
const controls = read('components/venue/AttendeeStageJoinControls.tsx');
if (controls.includes('current-attendee')) failures.push('AttendeeStageJoinControls still defaults to current-attendee.');
const networking = read('lib/actions/networkingActions.ts') + read('components/venue/SpeedNetworkingQueuePanel.tsx');
if (networking.includes('Local E2E Attendee') || networking.includes('local-e2e-attendee')) failures.push('Networking queue still uses fake attendee identity.');
if (!networking.includes('getCurrentAttendeeIdentity')) failures.push('Networking queue does not use attendee session identity.');
const help = read('lib/actions/venueRuntimeActions.ts') + read('components/venue/HelpRequestForm.tsx');
if (!help.includes('getCurrentAttendeeIdentity') || !help.includes('attendeeId')) failures.push('Help requests are not tied to attendee identity.');
const sponsor = read('lib/actions/venueRuntimeActions.ts') + read('components/venue/SponsorLeadCaptureForm.tsx');
if (!sponsor.includes('appendSponsorLeadOptIn') || !sponsor.includes('getCurrentAttendeeProfile')) failures.push('Sponsor lead capture does not require intentional attendee-profile opt-in.');
const agenda = read('components/venue/MyAgendaPanel.tsx') + read('lib/actions/attendeeAgendaActions.ts');
if (!agenda.includes('updateMyAgendaAction') || !agenda.includes('plannedSponsorBoothIds')) failures.push('My Agenda is not editable for sessions, breakouts, and sponsor booths.');
// Lighter registration (16 Sep 2026): three required fields + optional title; everything else on "Tell us more".
const registrationForm = read('components/venue/PublicEventPage.tsx');
if (!registrationForm.includes('["title", "Title / role (optional)", "text", false')) failures.push('Registration must ask for name, email, company (required) and an optional title only.');
for (const gone of ['name="reasonForAttending"', 'name="topicsOfInterest"', 'name="socialLinks"', '<RegistrationAgendaPlanner']) if (registrationForm.includes(gone)) failures.push(`Registration page must not carry ${gone}; that belongs to "Tell us more".`);
if (registration.includes('!title')) failures.push('registrationActions must not require a title.');
const merge = read('services/attendees/attendeeProfileMerge.ts');
for (const token of ['export function mergeAttendeeProfile', 'export function tellUsMoreProgress', 'export function visibleInDirectory', 'hiddenFromDirectory']) if (!merge.includes(token)) failures.push(`attendeeProfileMerge.ts missing ${token}`);
const card = read('components/venue/EditAttendeeProfilePanel.tsx');
for (const token of ['Tell us more about you', 'tellUsMoreProgressFor(profile, questions)', 'name="hiddenFromDirectory"', 'Crew can still see you; networking still works']) if (!card.includes(token)) failures.push(`Tell-us-more card missing ${token}`);
if (!read('app/venue/[eventId]/people/page.tsx').includes('visibleInDirectory(profile)')) failures.push('People page must filter by visibleInDirectory (hide-me switch).');
if (/Here to learn, connect|Ask me what I am hoping/.test(read('components/venue/PeopleDirectoryCard.tsx'))) failures.push('People cards must show only what exists — no placeholder sentences.');
if (!read('components/sponsors/SponsorPortalLive.tsx').includes('hiddenFromDirectory')) failures.push('Sponsor lead views must leave out hidden attendees.');
if (!read('components/venue/SpeedNetworkingQueuePanel.tsx').includes('networking-topics-gate') || !read('lib/actions/networkingActions.ts').includes('mergeAttendeeProfile(profile, { topicsOfInterest')) failures.push('The networking gate must ask for topics inline and save through the one profile write path.');
if (!read('lib/actions/attendeeProfileActions.ts').includes('mergeAttendeeProfile(profile, patch)')) failures.push('The profile action must write through mergeAttendeeProfile.');
if (read('db/migrations/0029_attendee_profile_visibility.sql') !== read('supabase/migrations/20260916180000_attendee_profile_visibility.sql')) failures.push('0029 mirror drifted.');
if (!read('services/runtime/supabaseRuntimeStore.ts').includes('hidden_from_directory: Boolean(profile.hiddenFromDirectory)')) failures.push('Supabase store must persist hidden_from_directory.');
for (const proof of ['tests/unit/attendeeProfileMerge.test.ts', 'tests/unit/contactsAndQuestions.test.ts', 'tests/e2e/lighter-registration.spec.ts']) if (!fs.existsSync(proof)) failures.push(`Missing ${proof}`);
// The attendee database gaps (16 Sep 2026): raw email stored; contacts across events; per-event questions.
const registrationService = read('services/attendees/attendeeRegistrationService.ts');
if (!registrationService.includes('email: input.email.trim().toLowerCase()')) failures.push('registerOrUpdateAttendee must store the raw email, lowercased and trimmed.');
if (!registrationService.includes('await upsertContactFromProfile(profile)')) failures.push('registerOrUpdateAttendee must upsert the contact across events.');
const migration = read('db/migrations/0029_attendee_profile_visibility.sql');
for (const token of ['add column if not exists email text', 'add column if not exists extra_answers jsonb', 'create table if not exists public.contacts', 'add column if not exists registration_questions jsonb', 'BACKFILL IS']) if (!migration.includes(token)) failures.push(`0029 migration missing ${token}`);
// Registration questions render from event config, never a literal list; the default set is the legacy four.
if (!card.includes('questionsForEvent(event)') || !card.includes('questions.map((question) =>')) failures.push('Tell-us-more must render the event\'s question list from config.');
for (const literal of ['name="reasonForAttending"', 'name="interestingFact"', 'name="topicsOfInterest"', 'name="networkingGoals"']) if (card.includes(literal)) failures.push(`Tell-us-more must not hard-code ${literal}; questions come from the event.`);
const questions = read('types/attendeeRegistration.ts');
if (!/DEFAULT_REGISTRATION_QUESTIONS[\s\S]*"reasonForAttending"[\s\S]*"interestingFact"[\s\S]*"topicsOfInterest"[\s\S]*"networkingGoals"/.test(questions)) failures.push('DEFAULT_REGISTRATION_QUESTIONS must be the legacy four, in order.');
if (!questions.includes('MAX_REGISTRATION_QUESTIONS = 8')) failures.push('Registration questions cap at eight.');
for (const editor of ['app/app/events/new/page.tsx', 'app/app/events/[eventId]/setup/page.tsx']) if (!read(editor).includes('name="registrationQuestions"')) failures.push(`${editor} must carry the question editor.`);
if (!read('lib/actions/eventWorkspaceActions.ts').includes('parseQuestionLines(field(formData, "registrationQuestions"))')) failures.push('Event actions must save the parsed question list.');
if (!read('components/people/ContactsAcrossEvents.tsx').includes('/api/contacts/export') || !read('app/api/contacts/export/route.ts').includes('actor?.kind !== "owner"')) failures.push('People across events must offer the owner-only CSV export.');
const profile = read('components/venue/EditAttendeeProfilePanel.tsx') + read('lib/actions/attendeeProfileActions.ts');
if (!profile.includes('updateAttendeeProfileAction') || !profile.includes('networkingOptIn')) failures.push('Attendee profile is not editable with networking opt-in state.');
if (failures.length) { console.error('ATTENDEE REGISTRATION CONTRACT FAIL\n' + failures.map(f => `- ${f}`).join('\n')); process.exit(1); }
console.log('ATTENDEE REGISTRATION CONTRACT PASS — static contract only; runtime cookie/form behavior requires tests.');
