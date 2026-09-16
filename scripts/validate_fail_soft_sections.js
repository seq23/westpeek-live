const fs = require("fs");
const path = require("path");
/**
 * Fail soft on shared pages (16 Sep 2026): every async server component under components/moderation
 * and components/venue (plus the host panel and the go-live panel) that reads the runtime store
 * ("@/services/") is rendered through SafeSection — CALLED inside its try — never as bare JSX,
 * so one failing read becomes one "unavailable" card and never a 500 for the whole crew deck or
 * venue page. A component may instead own its failure with try/catch in its body. The venue shell
 * must catch its own reads. Hard-fails when it examines nothing.
 */
function read(file) { return fs.readFileSync(file, "utf8"); }
function walk(dir, out = []) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, out); else if (/\.tsx$/.test(entry.name)) out.push(full); } return out; }
const scope = [...walk("components/moderation"), ...walk("components/venue"), "components/events/HostPanel.tsx", "components/testing/StreamYardIngressPanel.tsx"];
const renderSites = [...walk("app"), ...walk("components")];
const failures = [];
let examined = 0;
for (const file of scope) {
  const body = read(file);
  if (!body.includes('"@/services/')) continue;
  for (const match of body.matchAll(/export async function ([A-Z][A-Za-z0-9]*)\(/g)) {
    const name = match[1];
    if (name === "VenuePageShell" || name === "SafeSection") continue;
    examined += 1;
    const ownsFailure = /\btry\s*\{/.test(body.slice(match.index));
    const bareSites = renderSites.filter((site) => site !== file && new RegExp(`<${name}[\\s/>]`).test(read(site)));
    if (bareSites.length && !ownsFailure) failures.push(`${name} (${file}) is rendered as bare JSX in ${bareSites.join(", ")}; render it through <SafeSection render={() => ${name}({...})} /> or catch inside it.`);
    const safeSites = renderSites.filter((site) => new RegExp(`render=\\{\\(\\) => ${name}\\(`).test(read(site)));
    if (!safeSites.length && !ownsFailure) failures.push(`${name} (${file}) reads the store but is neither rendered through SafeSection nor catches its own failure.`);
  }
}
examined += 1;
const shell = read("components/venue/VenuePageShell.tsx");
if (!/try\s*\{[\s\S]*findEventRecord[\s\S]*\}\s*catch/.test(shell)) failures.push("VenuePageShell must catch its own store reads and render open.");
const safe = read("components/system/SafeSection.tsx");
if (!safe.includes("renderSafely(label, render)") || !safe.includes("data-section-unavailable")) failures.push("SafeSection must render the section through renderSafely (the try lives there) and render a named unavailable card.");
if (!/try\s*\{[\s\S]*await render\(\)[\s\S]*\}\s*catch/.test(read("lib/ui/renderSafely.ts"))) failures.push("renderSafely must await the section inside its try.");
if (examined < 10) failures.push(`validate_fail_soft_sections examined only ${examined} components`);
if (failures.length) { console.error("validate_fail_soft_sections: FAIL"); for (const f of failures) console.error(`- ${f}`); process.exit(1); }
console.log(`validate_fail_soft_sections: PASS — ${examined} store-reading server components, every render site through SafeSection or self-caught.`);
