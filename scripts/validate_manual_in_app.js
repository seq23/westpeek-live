const fs = require("fs");
/**
 * The manual is part of the product: one source of truth in docs/, rendered inside the app at
 * /manual for owner and operator, with its screenshots served from public/. Two things must hold
 * forever: the in-app copy cannot drift from the file, and NO access code, password or secret may
 * appear in either — the whole point of the codes vault is that the document does not carry them.
 */
const { build, SOURCE, GENERATED } = require("./build_manual_assets.js");
const failures = [];
let examined = 0;

function read(file) { if (!fs.existsSync(file)) { failures.push(`Missing ${file}`); return ""; } examined += 1; return fs.readFileSync(file, "utf8"); }

const source = read(SOURCE);
const generatedBefore = fs.existsSync(GENERATED) ? fs.readFileSync(GENERATED, "utf8") : "";
build();
const generatedAfter = fs.readFileSync(GENERATED, "utf8");
examined += 1;
if (generatedBefore !== generatedAfter) failures.push(`${GENERATED} was stale: run "node scripts/build_manual_assets.js" and commit it (the in-app manual had drifted from ${SOURCE})`);

// No codes, anywhere — in the file or in what the app renders.
const CODE_SHAPES = [/\bWPL-[A-Z0-9]{4,}/, /\bCREW-[A-Z0-9]{6}/, /\bSPK-[A-Z0-9]{6}/, /\bSPN-[A-Z0-9]{6}/, /\bCLT-[A-Z0-9]{6}/, /\bVIP-[A-Z0-9]{6}/];
for (const [label, body] of [[SOURCE, source], [GENERATED, generatedAfter]]) {
  for (const shape of CODE_SHAPES) {
    const match = shape.exec(body);
    // The scheme is described with a STEM placeholder; a real six-character stem is a code.
    // Placeholders are how the scheme is explained: XXXXXX, STEM, and the worked example 45MINU
    // (the demo stem used throughout §5). A real-looking code that is none of those is a leak.
    if (match && !/STEM|ROLE|45MINU|XXXX|EXAMPL/.test(match[0])) failures.push(`${label} carries something code-shaped (${match[0]}). The manual never carries codes.`);
  }
  if (/PASSWORD\s*[:=]\s*\S/.test(body)) failures.push(`${label} looks like it carries a password value.`);
}

const page = read("app/manual/page.tsx");
for (const token of ["MANUAL_SOURCE", "renderMarkdownLite", "manual-toc", "manual-body"]) if (!page.includes(token)) failures.push(`app/manual/page.tsx must use ${token}`);
const routeAccess = read("lib/auth/routeAccess.ts");
if (!routeAccess.includes('prefix: "/manual"')) failures.push("/manual must be a protected route (owner + operator)");
const middleware = read("middleware.ts");
if (!middleware.includes('"/manual"')) failures.push("/manual must be in the middleware matcher");
const authorization = read("lib/auth/v5RouteAuthorization.ts");
if (!authorization.includes('cleanPath === "/manual"')) failures.push("The owner must be able to read /manual");
if (!authorization.includes('"/manual",')) failures.push("The operator must be able to read /manual");

// Reachable from the places people actually are.
for (const [file, token] of [["components/owner/AccessCodesVault.tsx", "/manual#"], ["components/production/OperatorLaunchpad.tsx", 'href="/manual"'], ["components/moderation/CrewLiveModerationDeck.tsx", 'href="/manual"']]) {
  if (!read(file).includes(token)) failures.push(`${file} must link to the manual`);
}

// Every route the manual names must exist in the route ledger.
const ledger = JSON.parse(read("config/deployed-route-manifest.json"));
const known = new Set((ledger.routes || ledger).map((row) => (typeof row === "string" ? row : row.path)));
const mentioned = [...source.matchAll(/`(\/[a-z0-9/\[\]{}_-]+)`/g)].map((match) => match[1]);
const normalise = (route) => route.replace(/\{[^}]+\}/g, "[eventId]").replace(/\/$/, "");
const missing = [...new Set(mentioned.map(normalise))].filter((route) => {
  if (known.has(route)) return false;
  if (route.startsWith("/api/") || route.startsWith("/docs")) return false;
  // A templated path is fine when its shape exists in the ledger.
  return ![...known].some((candidate) => normalise(candidate) === route);
});
if (missing.length) failures.push(`The manual names routes that are not in the ledger: ${missing.join(", ")}`);

if (!examined) failures.push("validate_manual_in_app examined zero files");
if (failures.length) {
  console.error("validate_manual_in_app: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`validate_manual_in_app: PASS — ${examined} files examined; the in-app manual matches ${SOURCE}, carries no codes, and names only routes that exist.`);
