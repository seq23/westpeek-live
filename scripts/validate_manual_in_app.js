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

// No codes, anywhere — in the file, in what the app renders, or in what Assets hands out.
//
// The shapes are read out of lib/manual/accessCodeShapes.ts rather than kept here, because the
// manual is downloadable as Markdown from /app/assets now and that download applies the same list.
// Two lists would drift, and the one that drifted would be the one guarding the file somebody
// actually walks away with.
const SHAPES_FILE = "lib/manual/accessCodeShapes.ts";
const shapesSource = read(SHAPES_FILE);
const shapeBody = (shapesSource.match(/export const ACCESS_CODE_SHAPES[^[]*\[([\s\S]*?)\];/) || [])[1] || "";
const CODE_SHAPES = (shapeBody.match(/\/(?:\\.|[^/\\])+\//g) || []).map((literal) => new RegExp(literal.slice(1, -1)));
const placeholderLiteral = (shapesSource.match(/export const ACCESS_CODE_PLACEHOLDERS = \/(.+?)\/;/) || [])[1];
const passwordLiteral = (shapesSource.match(/export const PASSWORD_SHAPE = \/(.+?)\/;/) || [])[1];
if (CODE_SHAPES.length < 6 || !placeholderLiteral || !passwordLiteral) {
  // Hard stop rather than a quiet pass: a parse that found nothing would check nothing.
  failures.push(`${SHAPES_FILE} did not yield the code shapes (${CODE_SHAPES.length} found). The manual would go out unchecked.`);
} else {
  const PLACEHOLDERS = new RegExp(placeholderLiteral);
  const PASSWORD_SHAPE = new RegExp(passwordLiteral);
  // The scheme is described with a STEM placeholder; a real six-character stem is a code.
  // Placeholders are how the scheme is explained: XXXXXX, STEM, and the worked example 45MINU
  // (the demo stem used throughout §5). A real-looking code that is none of those is a leak.
  for (const [label, body] of [[SOURCE, source], [GENERATED, generatedAfter]]) {
    for (const shape of CODE_SHAPES) {
      const match = shape.exec(body);
      if (match && !PLACEHOLDERS.test(match[0])) failures.push(`${label} carries something code-shaped (${match[0]}). The manual never carries codes.`);
    }
    if (PASSWORD_SHAPE.test(body)) failures.push(`${label} looks like it carries a password value.`);
  }
}

// And the download really runs that check before it serves a byte.
const documents = read("services/documents/westPeekDocuments.ts");
for (const token of ["findAccessCodeShape", "MANUAL_SOURCE", "readHowItWorksPage"]) if (!documents.includes(token)) failures.push(`services/documents/westPeekDocuments.ts must use ${token}`);
const downloadRoute = read("app/api/documents/[documentId]/download/route.ts");
for (const token of ["renderWestPeekDocument", "getWorkspaceActor", "text/markdown"]) if (!downloadRoute.includes(token)) failures.push(`the document download route must use ${token}`);

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
