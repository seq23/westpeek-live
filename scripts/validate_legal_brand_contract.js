const fs = require("fs");

function fail(message) {
  console.error("validate_legal_brand_contract: FAIL — " + message);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail("missing " + file);
  return fs.readFileSync(file, "utf8");
}

for (const file of [
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "components/legal/LegalFooter.tsx",
  "components/brand/BrandHomeLink.tsx",
  "components/brand/GlobalWestPeekLogoLink.tsx",
]) {
  read(file);
}

const footer = read("components/legal/LegalFooter.tsx");
for (const term of [
  "https://westpeek.live",
  "https://productions.joinwestpeek.com/",
  "mailto:info@westpeek.ventures",
  "/privacy",
  "/terms",
]) {
  if (!footer.includes(term)) fail("LegalFooter missing " + term);
}
for (const forbidden of ["fixed", "absolute", "z-50", "z-[1000]"]) {
  if (footer.includes(forbidden)) fail("LegalFooter must not contain overlay class " + forbidden);
}

const brandHome = read("components/brand/BrandHomeLink.tsx");
for (const forbidden of ["fixed", "absolute", "z-50", "z-[1000]"]) {
  if (brandHome.includes(forbidden)) fail("BrandHomeLink must not contain overlay class " + forbidden);
}

const globalLogo = read("components/brand/GlobalWestPeekLogoLink.tsx");
if (!globalLogo.includes("return null")) fail("GlobalWestPeekLogoLink must render null; global floating brand overlay is forbidden.");

const stagePage = read("app/venue/[eventId]/stage/page.tsx");
if (stagePage.includes("import { LegalFooter") || stagePage.includes("from \"@/components/legal/LegalFooter\"") || stagePage.includes("<LegalFooter")) {
  fail("stage page must not directly import/render LegalFooter in active livestream viewport");
}
if (!stagePage.includes("showLegalFooter={false}")) fail("stage page must opt out of venue legal footer");

const privacy = read("app/privacy/page.tsx");
const terms = read("app/terms/page.tsx");
for (const [name, body] of [["privacy", privacy], ["terms", terms]]) {
  for (const forbidden of ["TODO", "placeholder", "lorem"]) {
    if (body.toLowerCase().includes(forbidden.toLowerCase())) fail(name + " contains placeholder marker " + forbidden);
  }
}
if (!privacy.includes("info@westpeek.ventures")) fail("privacy page missing support email");
if (!terms.includes("info@westpeek.ventures")) fail("terms page missing support email");

console.log("validate_legal_brand_contract: PASS");
