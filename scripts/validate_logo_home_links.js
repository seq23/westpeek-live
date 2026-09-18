#!/usr/bin/env node
/**
 * Every rendered West Peek mark or wordmark is inside a link home.
 *
 * The owner, 17 Sep 2026: "there are plenty of instances in westpeek.live where there is a logo in
 * the upper right corner and it isn't hyperlinked to the homepage, and the preview demo section
 * doesn't have any link to the homepage."
 *
 * WHY THIS PARSES JSX INSTEAD OF GREPPING.
 * Two agents in this repo were caught the same week by a validator that matched an identifier or an
 * import: both kept passing after the element had been deleted from the markup, because the import
 * line still contained the name. So this walks the JSX element tree of every file under app/ and
 * components/, and every assertion is about a RENDERED ELEMENT and its ancestors — delete the
 * element and the count of examined instances drops, which is itself a failure.
 *
 * WHAT IT PROVES.
 *  1. Every rendered mark element is either the content of the one home link, or a named exception.
 *  2. Exceptions are declared by file + element + reason below. A pattern would quietly absorb the
 *     next unlinked mark; a name cannot. A declared exception that no longer matches a rendered
 *     element is also a failure, so the list cannot rot.
 *  3. No home link is nested inside another anchor — no nested interactive elements.
 *  4. The one home link really carries the href, an accessible name, and a visible focus ring.
 *  5. Every home-link component routes through that one primitive rather than hand-rolling an
 *     anchor, which is what keeps points 4 true for all of them at once.
 *  6. It hard-fails when it examines zero marks, rather than passing on an empty loop.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const failures = [];

/** Components that RENDER West Peek artwork or the wordmark. Each one must end up inside a link. */
const MARK_ELEMENTS = new Set([
  "WestPeekLogo",
  "WestPeekLiveWordmark",
  "WestPeekProductionsLogo",
]);

/**
 * <HouseLogo /> is not a leaf: it is the dispatcher that CHOOSES between the linked West Peek
 * artwork and a house's own uploaded logo, so the proof for it lives in its own file (below) rather
 * than at its five call sites.
 */
const HOUSE_LOGO_FILE = "components/brand/HouseLogo.tsx";

/** The one link primitive. A mark whose ancestor is this is, by construction, linked home. */
const HOME_LINK_PRIMITIVE = "WestPeekHomeLink";

/** The named wrappers around the primitive. These are links, so they may not nest inside anchors. */
const HOME_LINK_WRAPPERS = new Set([
  "WestPeekLogoHomeLink",
  "BrandHomeLink",
  "WestPeekProductionsLogoHomeLink",
]);

/** Anything that is already interactive. A link inside one of these is a nested-interactive bug. */
const ANCHOR_ELEMENTS = new Set(["a", "Link", "button", HOME_LINK_PRIMITIVE, ...HOME_LINK_WRAPPERS]);

/**
 * The marks that are deliberately NOT links, each with the reason. Named, never pattern-matched.
 * `minimum` is how many such elements that file must still render: it stops an exception from
 * outliving the thing it excuses.
 */
const DECLARED_EXCEPTIONS = [
  {
    file: "app/page.tsx",
    element: "WestPeekProductionsLogo",
    minimum: 1,
    reason:
      "app/page.tsx IS https://westpeek.live/ (docs/DEPLOYMENT_ENV_CHECKLIST.md: 'westpeek.live is the West Peek Live! app and public product domain'). Linking the home page's own crest to the home page is a control that looks actionable and does nothing.",
  },
  {
    file: "app/page.tsx",
    element: "WestPeekLiveWordmark",
    minimum: 1,
    reason: "Same page, same reason: it is the home page's own lockup, inside its <h1>.",
  },
  {
    file: "app/join/page.tsx",
    element: "WestPeekLiveWordmark",
    minimum: 1,
    reason:
      "It sits immediately beside <WestPeekLogoHomeLink /> in the same lockup. Two adjacent links to one destination is announced twice and tabbed through twice; the monogram carries the link for the pair.",
  },
  {
    file: "components/navigation/Sidebar.tsx",
    element: "WestPeekLiveWordmark",
    minimum: 1,
    reason: "Beside the linked monogram in the sidebar lockup — same pair rule as the join page.",
  },
  {
    file: "components/venue/VenueHeader.tsx",
    element: "WestPeekLiveWordmark",
    minimum: 1,
    reason: "Beside the linked monogram in the venue chrome lockup — same pair rule.",
  },
  {
    file: "components/brand/HouseLogo.tsx",
    element: "WestPeekProductionsLogo",
    minimum: 1,
    reason:
      "The branch where a house has uploaded its OWN logo. Pointing an agency's mark at westpeek.live would send its client to the wrong company; that surface's way home is the 'Powered by West Peek Live' line in LegalFooter. The West Peek fallback artwork on the same component DOES link.",
  },
];

/**
 * The surfaces that MUST render a way home. Without this list the walk proves only "nothing
 * unlinked is rendered", which a page that deleted its crest outright would also satisfy — the
 * "runs but inert" failure. Each entry is checked as a rendered element, so deleting the crest from
 * any one of them fails here rather than passing quietly.
 */
const REQUIRED_HOME_LINK_SURFACES = [
  "app/join/page.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/pricing/page.tsx",
  "app/how-it-works/page.tsx",
  "app/how-it-works/[audience]/page.tsx",
  "app/operator-packet/page.tsx",
  "app/request-event/page.tsx",
  "app/proposal/[token]/page.tsx",
  "app/app/capacity/page.tsx",
  "app/app/events/new/page.tsx",
  "app/production-access/page.tsx",
  "app/production-access/owner/page.tsx",
  "app/production-access/crew/page.tsx",
  "app/production-access/operator/page.tsx",
  "app/production-access/special-guest/page.tsx",
  // The "preview demo section" the owner named: the guest-preview page, and the venue chrome that
  // the demo venue itself renders. Both were unreachable from the front door before 17 Sep 2026.
  "app/production-access/special-guest/preview/page.tsx",
  "components/venue/VenueHeader.tsx",
  "components/navigation/Sidebar.tsx",
  "components/navigation/Topbar.tsx",
  "components/dashboard/AgencyDashboard.tsx",
  "components/production/OperatorLaunchpad.tsx",
  "components/system/BrandedSetupError.tsx",
];

/** The elements that count as "this surface has a way home". HouseLogo dispatches to one. */
const HOME_LINK_ELEMENTS = new Set([...HOME_LINK_WRAPPERS, HOME_LINK_PRIMITIVE, "HouseLogo"]);

/** Files that define the links themselves rather than consuming them. */
const LINK_DEFINITION_FILES = new Set([
  "components/brand/WestPeekHomeLink.tsx",
  "components/brand/WestPeekLogo.tsx",
  "components/brand/BrandHomeLink.tsx",
  "components/brand/WestPeekProductionsLogo.tsx",
]);

// ---------------------------------------------------------------------------------------------
// A small JSX element walker. It reports every opened element of interest together with the stack
// of elements enclosing it, which is what lets "is this mark inside a link" be a real question.
// ---------------------------------------------------------------------------------------------

/** Skip past a JSX attribute list, respecting quotes and {expression} nesting. Returns {end, selfClosing}. */
function endOfTag(text, from) {
  let i = from;
  let quote = null;
  let braces = 0;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "{") {
      braces += 1;
    } else if (c === "}") {
      braces -= 1;
    } else if (braces === 0 && c === ">") {
      const selfClosing = text[i - 1] === "/";
      return { end: i, selfClosing };
    }
    i += 1;
  }
  return null;
}

/**
 * Blank out comments before walking, keeping the byte count so line numbers survive.
 *
 * This is the whole point of the exercise: the doc comment in WestPeekProductionsLogo.tsx contains
 * the words "<HouseLogo />", and a walker that reads prose would accept a comment as evidence of a
 * rendered element — exactly the class of bug this validator exists to catch. Quotes are tracked so
 * the "https://..." inside an href is never mistaken for a line comment.
 */
function stripComments(text) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next === undefined ? "" : next;
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (c === "/" && next === "/") {
      let end = text.indexOf("\n", i);
      if (end === -1) end = text.length;
      out += " ".repeat(end - i);
      i = end;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function walkJsx(rawText, onOpen) {
  const text = stripComments(rawText);
  const stack = [];
  const tagStart = /<(\/?)([A-Za-z][A-Za-z0-9_.]*)/g;
  let match;
  while ((match = tagStart.exec(text))) {
    const closing = match[1] === "/";
    const name = match[2];
    if (closing) {
      // Pop to the matching open tag; tolerate the odd unbalanced fragment rather than throwing.
      const at = stack.lastIndexOf(name);
      if (at !== -1) stack.length = at;
      continue;
    }
    const tag = endOfTag(text, match.index + match[0].length);
    if (!tag) break;
    onOpen(name, stack.slice(), match.index);
    if (!tag.selfClosing) stack.push(name);
    tagStart.lastIndex = tag.end + 1;
  }
}

function sourceFiles() {
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        visit(full);
      } else if (entry.name.endsWith(".tsx")) {
        out.push(full);
      }
    }
  };
  for (const dir of ["app", "components"]) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) failures.push(`${dir}/ is missing — this validator cannot see the UI`);
    else visit(full);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

// ---------------------------------------------------------------------------------------------
// 1 + 2 + 3: every rendered mark, and every rendered link.
// ---------------------------------------------------------------------------------------------

let marksExamined = 0;
let linkedMarks = 0;
let homeLinksExamined = 0;
const exceptionHits = new Map(DECLARED_EXCEPTIONS.map((item) => [`${item.file}::${item.element}`, 0]));

for (const file of sourceFiles()) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("<")) continue;

  walkJsx(text, (name, stack, index) => {
    if (MARK_ELEMENTS.has(name)) {
      marksExamined += 1;
      if (stack.includes(HOME_LINK_PRIMITIVE)) {
        linkedMarks += 1;
        return;
      }
      const key = `${rel}::${name}`;
      if (exceptionHits.has(key)) {
        exceptionHits.set(key, exceptionHits.get(key) + 1);
        return;
      }
      failures.push(
        `${rel}:${lineOf(text, index)} renders <${name}> outside a link home. Wrap it in the matching home link (WestPeekLogoHomeLink / BrandHomeLink / WestPeekProductionsLogoHomeLink), or declare it by name in DECLARED_EXCEPTIONS with a reason.`,
      );
      return;
    }

    if (name === HOME_LINK_PRIMITIVE || HOME_LINK_WRAPPERS.has(name)) {
      homeLinksExamined += 1;
      const enclosing = stack.filter((parent) => ANCHOR_ELEMENTS.has(parent) && parent !== name);
      if (enclosing.length) {
        failures.push(
          `${rel}:${lineOf(text, index)} renders <${name}> inside <${enclosing[enclosing.length - 1]}> — nested interactive elements. The mark must be the anchor, not sit inside one.`,
        );
      }
    }
  });
}

if (marksExamined === 0) {
  failures.push(
    "Examined ZERO rendered West Peek marks. Either the JSX walk broke or every mark was deleted; both are failures, not a pass on an empty loop.",
  );
}
if (homeLinksExamined === 0) {
  failures.push("Examined ZERO rendered home links. Nothing links home, so nothing here was proved.");
}
for (const [key, hits] of exceptionHits) {
  const declared = DECLARED_EXCEPTIONS.find((item) => `${item.file}::${item.element}` === key);
  if (hits < declared.minimum) {
    failures.push(
      `Declared exception ${key} matched ${hits} rendered element(s), expected at least ${declared.minimum}. The element moved or was deleted; retire the exception rather than leaving it to excuse the next one.`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 3a: every named surface still RENDERS a way home.
// ---------------------------------------------------------------------------------------------

let surfacesProved = 0;
for (const rel of REQUIRED_HOME_LINK_SURFACES) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`${rel} is missing — a surface that must carry a way home no longer exists`);
    continue;
  }
  let found = null;
  walkJsx(fs.readFileSync(full, "utf8"), (name) => {
    if (!found && HOME_LINK_ELEMENTS.has(name)) found = name;
  });
  if (!found) {
    failures.push(`${rel} renders no link home. Every one of these surfaces shows a West Peek crest and must let the visitor back to westpeek.live.`);
    continue;
  }
  surfacesProved += 1;
}
if (surfacesProved !== REQUIRED_HOME_LINK_SURFACES.length) {
  failures.push(`Only ${surfacesProved} of ${REQUIRED_HOME_LINK_SURFACES.length} required surfaces were proved; this assertion is inert on the rest`);
}

// ---------------------------------------------------------------------------------------------
// 3b: the HouseLogo dispatcher links the West Peek artwork home.
// ---------------------------------------------------------------------------------------------

const houseLogoFull = path.join(root, HOUSE_LOGO_FILE);
if (!fs.existsSync(houseLogoFull)) {
  failures.push(`${HOUSE_LOGO_FILE} is missing — the house-logo surfaces can no longer be proved`);
} else {
  const houseText = fs.readFileSync(houseLogoFull, "utf8");
  let rendersHomeLink = false;
  walkJsx(houseText, (name) => {
    if (name === "WestPeekProductionsLogoHomeLink") rendersHomeLink = true;
  });
  if (!rendersHomeLink) {
    failures.push(
      `${HOUSE_LOGO_FILE} must RENDER <WestPeekProductionsLogoHomeLink> for the branch with no uploaded logo — otherwise the five surfaces that show the West Peek fallback artwork have no way home.`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 4: the one home link carries the destination, a name, and a focus state.
// ---------------------------------------------------------------------------------------------

const primitivePath = path.join(root, "components/brand/WestPeekHomeLink.tsx");
if (!fs.existsSync(primitivePath)) {
  failures.push("components/brand/WestPeekHomeLink.tsx is missing — there is no single home link left to check");
} else {
  const primitive = fs.readFileSync(primitivePath, "utf8");
  const required = [
    ['"https://westpeek.live"', "the home link must point at the West Peek Live front door"],
    ["href={WEST_PEEK_HOME_HREF}", "the rendered <Link> must USE that constant, not merely declare it"],
    ["aria-label={WEST_PEEK_HOME_LABEL}", "the link needs a real accessible name; an image alt is not one"],
    ["focus:ring-2", "the link needs a visible focus state for keyboard users"],
    ["focus:ring-brand-orange", "the focus ring is brand orange, per the brand system"],
  ];
  for (const [needle, why] of required) {
    if (!primitive.includes(needle)) failures.push(`WestPeekHomeLink.tsx is missing ${needle} — ${why}`);
  }
}

// ---------------------------------------------------------------------------------------------
// 5: every named wrapper RENDERS the primitive. Element, not import.
// ---------------------------------------------------------------------------------------------

let wrappersProved = 0;
for (const rel of LINK_DEFINITION_FILES) {
  if (rel.endsWith("WestPeekHomeLink.tsx")) continue;
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`${rel} is missing — a home link surface disappeared`);
    continue;
  }
  const text = fs.readFileSync(full, "utf8");
  let rendersPrimitive = false;
  walkJsx(text, (name) => {
    if (name === HOME_LINK_PRIMITIVE) rendersPrimitive = true;
  });
  wrappersProved += 1;
  if (!rendersPrimitive) {
    failures.push(
      `${rel} does not RENDER <${HOME_LINK_PRIMITIVE}>. Every home link goes through the one primitive; a hand-rolled anchor loses the shared href, name and focus ring.`,
    );
  }
  if (/<Link\b/.test(text)) {
    failures.push(`${rel} renders a bare <Link> — route it through <${HOME_LINK_PRIMITIVE}> instead.`);
  }
}
if (wrappersProved !== LINK_DEFINITION_FILES.size - 1) {
  failures.push(`Only ${wrappersProved} home-link components could be checked; this assertion went inert`);
}

// ---------------------------------------------------------------------------------------------

if (failures.length) {
  console.error("validate_logo_home_links: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `validate_logo_home_links: PASS — ${surfacesProved}/${REQUIRED_HOME_LINK_SURFACES.length} required surfaces render a way home; ${homeLinksExamined} home links rendered app-wide, none nested inside another anchor; ${marksExamined} bare marks examined (${linkedMarks} inside the one home link, ${DECLARED_EXCEPTIONS.length} declared exceptions, all still matching a rendered element).`,
);
