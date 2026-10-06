const fs = require("fs");
const path = require("path");
const root = process.argv[2];
function fail(message) { console.error(message); process.exit(1); }
if (!root) fail("Usage: node scripts/validate_event_config_package.js event-config-packages/<slug>");
if (path.isAbsolute(root) || root.includes("..") || !root.startsWith("event-config-packages/")) fail("Package path must be event-config-packages/<slug>.");
const manifestPath = path.join(root, "manifest.json");
if (!fs.existsSync(manifestPath)) fail("Missing manifest.json.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (!manifest.slug || !/^[a-z0-9-]+$/.test(manifest.slug)) fail("manifest.slug must be kebab-case.");
const expected = [
  `data/events/${manifest.slug}/event.json`,
  `data/events/${manifest.slug}/branding.json`,
  `data/events/${manifest.slug}/attendee.json`,
  `data/events/${manifest.slug}/agenda.json`,
  `data/events/${manifest.slug}/speakers.json`,
  `data/events/${manifest.slug}/sponsors.json`,
  `data/events/${manifest.slug}/run-of-show.json`,
  `data/events/${manifest.slug}/video.json`,
  `data/events/${manifest.slug}/communications.json`,
  "data/access/event-access-config.json",
];
for (const rel of expected) if (!fs.existsSync(path.join(root, rel))) fail(`Package missing ${rel}`);
const secretPattern = /(sk_live_[A-Za-z0-9]|CLOUDFLARE_API_TOKEN[ \t]*=[ \t]*[^\n#]+|RESEND_API_KEY[ \t]*=[ \t]*[^\n#]+|LIVEKIT_API_SECRET[ \t]*=[ \t]*[^\n#]+|-----BEGIN PRIVATE KEY-----)/;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && secretPattern.test(fs.readFileSync(full, "utf8"))) fail(`Secret-like value found in package: ${full}`);
  }
}
walk(root);
console.log("validate_event_config_package: PASS");
