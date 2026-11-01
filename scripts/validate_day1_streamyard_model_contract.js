const fs = require("fs");

const reads = (file) => {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${file}`);
  return fs.readFileSync(file, "utf8");
};

// The operator-facing wording of the StreamYard model used to be pinned here phrase by phrase; that
// was a copy pin and went in the 1 Nov 2026 test cleanup. What stays is safety: no legacy guest codes
// on the operator packet, and no operator-only StreamYard credential on a public page.
const stalePatternByFile = {
  "app/operator-packet/page.tsx": [/SpeakerGuest-\d{4}!/, /SponsorGuest-\d{4}!/, /VIPGuest-\d{4}!/],
};

const failures = [];
for (const [file, patterns] of Object.entries(stalePatternByFile)) {
  const text = reads(file);
  for (const pattern of patterns) {
    if (pattern.test(text)) failures.push(`${file} still contains legacy guest-code pattern: ${pattern}`);
  }
}

for (const file of ["app/venue/[eventId]/stage/page.tsx", "app/venue/[eventId]/lobby/page.tsx", "app/events/[eventSlug]/page.tsx"]) {
  if (!fs.existsSync(file)) continue;
  const text = reads(file);
  for (const secretToken of ["livekitStreamKey", "Click to Copy Stream Key", "Stream Key", "RTMP URL"]) {
    if (text.includes(secretToken)) failures.push(`${file} must not expose operator-only StreamYard credential token: ${secretToken}`);
  }
}

if (failures.length) {
  console.error("validate_day1_streamyard_model_contract: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("validate_day1_streamyard_model_contract: PASS — guest-code and stream-credential guardrails only; real provider smoke is separate.");
