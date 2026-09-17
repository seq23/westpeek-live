const fs = require("fs");
const path = require("path");

const root = process.cwd();
const allowedOldNameFiles = new Set([
  "docs/BRAND_SYSTEM_WEST_PEEK_LIVE.md",
]);

const required = [
  "docs/BRAND_SYSTEM_WEST_PEEK_LIVE.md",
  "docs/BRANDING_ROLLOUT_CHECKLIST.md",
  "docs/MOBILE_TABLET_QA_WEST_PEEK_LIVE.md",
  "components/brand/WestPeekLiveWordmark.tsx",
  "public/brand/west-peek-live-wordmark.svg",
  "public/brand/wp-mark.svg",
  // The real West Peek monogram, taken from the join-west-peek brand repo. Required to exist so the
  // shells cannot quietly go back to typing the letters WP into a styled square.
  "public/brand/wp-mark-white.png",
  "public/brand/wp-mark-black.png",
  "components/brand/WestPeekLogo.tsx",
  "app/icon.png",
];

const userFacingRoots = [
  "app",
  "components",
  "content",
  "data",
  "emails",
  "lib",
  "public",
  "services",
  "styles",
  "types",
];
const userFacingRootFiles = new Set([
  "README.md",
  "package.json",
  "next.config.js",
  "wrangler.jsonc",
]);

const failures = [];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`Missing required brand file: ${rel}`);
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "coverage", ".open-next", "dist", "build", "out", "playwright-report", "test-results"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const filesToScan = [];
for (const relRoot of userFacingRoots) filesToScan.push(...walk(path.join(root, relRoot)));
for (const rel of userFacingRootFiles) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) filesToScan.push(full);
}
for (const rel of allowedOldNameFiles) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) filesToScan.push(full);
}

for (const file of filesToScan) {
  const rel = path.relative(root, file);
  if (!/\.(ts|tsx|md|json|css|svg|example|js|jsx|jsonc)$/.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("Agency Event OS") && !allowedOldNameFiles.has(rel)) {
    failures.push(`Deprecated user-facing name found in ${rel}`);
  }
}

const wordmarkPath = path.join(root, "components/brand/WestPeekLiveWordmark.tsx");
const wordmark = fs.existsSync(wordmarkPath) ? fs.readFileSync(wordmarkPath, "utf8") : "";
if (!wordmark.includes("text-brand-orange")) failures.push("Wordmark does not use orange for Live!");
if (!wordmark.includes("brand-script")) failures.push("Wordmark does not use script class for Live!");
if (!wordmark.includes("-rotate-6")) failures.push("Wordmark does not skew Live!");

/**
 * The logo, and the three things about it that are easy to lose.
 *
 * WEST_PEEK_BRAND_SYSTEM.md line 7 says to use the approved asset and not to fabricate substitute
 * marks; lines 37-42 put the parent logo in the primary shell. The owner's ask adds that it links
 * back to westpeek.live. Each of those is one assertion here, and each counts itself, so a shell
 * that drops the mark fails rather than passing on an empty loop.
 */
const logoChecks = [
  ["components/brand/WestPeekLogo.tsx", "/brand/wp-mark-white.png", "the logo component must reference the white monogram for dark shells"],
  ["components/brand/WestPeekLogo.tsx", "/brand/wp-mark-black.png", "the logo component must reference the dark monogram for white surfaces"],
  ["components/brand/WestPeekLogo.tsx", "https://westpeek.live", "the logo must link back to the West Peek home page"],
  // "<WestPeekLogoHomeLink", not the bare name: the import alone contains the identifier, so a
  // substring check would keep passing after the element was deleted from the markup.
  ["components/venue/VenueHeader.tsx", "<WestPeekLogoHomeLink", "the venue header must RENDER the real logo, not the wordmark alone"],
  ["components/navigation/Sidebar.tsx", "<WestPeekLogoHomeLink", "the workspace sidebar must RENDER the real logo"],
];

let logoAssertions = 0;
for (const [file, needle, why] of logoChecks) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failures.push(`Missing ${file} — ${why}`);
    continue;
  }
  logoAssertions += 1;
  if (!fs.readFileSync(full, "utf8").includes(needle)) failures.push(`${file} is missing "${needle}" — ${why}`);
}
if (logoAssertions !== logoChecks.length) {
  failures.push(`Only ${logoAssertions} of ${logoChecks.length} logo assertions could run; the logo surfaces moved and this check went inert`);
}

// The fabricated WP square is gone and must stay gone.
if (wordmark.includes("WestPeekLiveMark")) {
  failures.push("WestPeekLiveMark is back — WEST_PEEK_BRAND_SYSTEM.md line 7 forbids a fabricated substitute mark; use WestPeekLogo");
}

if (failures.length) {
  console.error("Brand validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Brand validation passed — scoped to public/user-facing brand surfaces, not internal audit docs.");
