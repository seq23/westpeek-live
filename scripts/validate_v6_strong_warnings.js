const fs = require("fs");
const checks = [
  ["components/testing/TestingConsole.tsx", "RouteHealthPanel"],
  ["components/testing/TestingConsole.tsx", "AccessGatePanel"],
  ["components/testing/TestingConsole.tsx", "PublishingPipelinePanel"],
  ["components/testing/TestingConsole.tsx", "SupabaseRuntimePanel"],
  ["components/testing/TestingConsole.tsx", "AttendeeExperiencePanel"],
  // The communications surface is one panel now; the old EventCommunicationsDashboard was deleted
  // on 16 Sep 2026 because it stacked a second send log under the first.
  ["components/email/EventEmailCenter.tsx", "Resend"],
  ["components/venue/VenueLobbyDashboard.tsx", "FallbackActiveBanner"],
  ["components/analytics/EventAnalyticsDashboard.tsx", "getRuntimeStore"],
];
const warnings = checks.filter(([file, token]) => !fs.existsSync(file) || !fs.readFileSync(file, "utf8").includes(token));
if (warnings.length) {
  console.warn("validate_v6_strong_warnings: WARNINGS");
  for (const [file, token] of warnings) console.warn(`- ${file} missing ${token}`);
  process.exitCode = 0;
} else {
  console.log("validate_v6_strong_warnings: PASS");
}
