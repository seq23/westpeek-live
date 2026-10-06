const fs = require("fs");
const required = [
  "app/join/page.tsx",
  "app/production-access/page.tsx",
  "app/production-access/crew/page.tsx",
  "app/production-access/special-guest/page.tsx",
  "app/app/events/page.tsx",
  "app/app/events/[eventId]/page.tsx",
  "app/app/events/[eventId]/setup/page.tsx",
  "app/app/events/[eventId]/branding/page.tsx",
  "app/app/events/[eventId]/attendee-flow/page.tsx",
  "app/app/events/[eventId]/venue/page.tsx",
  "app/app/events/[eventId]/agenda/page.tsx",
  "app/app/events/[eventId]/speakers/page.tsx",
  "app/app/events/[eventId]/sponsors/page.tsx",
  "app/app/events/[eventId]/access/page.tsx",
  "app/app/events/[eventId]/run-of-show/page.tsx",
  "app/app/events/[eventId]/video-health/page.tsx",
  "app/app/events/[eventId]/communications/page.tsx",
  "app/app/events/[eventId]/preview/page.tsx",
  "app/app/events/[eventId]/publish/page.tsx",
  "app/app/events/[eventId]/incidents/page.tsx",
  "components/events/setup/EventSetupShell.tsx",
  "services/events/eventSetupCompletionService.ts",
  "services/runtime/fileRuntimeStore.ts",
  "services/runtime/d1RuntimeStore.ts",
  "lib/actions/videoFallbackActions.ts",
  "lib/actions/registrationActions.ts",
  "lib/actions/venueRuntimeActions.ts",
  // The communications surface is one panel now: lib/actions/communicationActions.ts and the older
  // dashboard behind it were deleted on 16 Sep 2026 because they stacked a second send log under the
  // first. Sending goes through lib/actions/eventEmailActions.ts.
  "lib/actions/eventEmailActions.ts",
  "migrations-d1/0006_events_audit_auth.sql"
];
const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error("V6 completion contract missing files:\n" + missing.map((file) => `- ${file}`).join("\n"));
  process.exit(1);
}
console.log("validate_v6_completion_contract: PASS");
