const fs = require('fs');
/**
 * The operator launchpad, reorganised 16 Sep 2026. The old rule here listed the exact card titles
 * and demo links the page had to print — client-facing prose, not behaviour, and it froze the page
 * in the shape the owner asked us to fix (nine sections, nine cards pointing at one diagnostics
 * page). What the launchpad must now be:
 *   · behind the operator gate, owner cookie accepted;
 *   · the operator's REAL events read from the store, not a hard-coded demo id;
 *   · one collapsible section per job, with a table of contents, each remembering its own state;
 *   · Diagnostics is exactly two cards;
 *   · Demo & training exists but is NOT open by default;
 *   · no two cards on the page share an href.
 */
const file = 'components/production/OperatorLaunchpad.tsx';
if (!fs.existsSync(file)) throw new Error('OperatorLaunchpad component missing.');
const s = fs.readFileSync(file, 'utf8');

for (const token of ['ConsoleSection', 'ConsoleToc', 'listEventRecords(', 'SafeSection', 'storagePrefix="wpl-launchpad"']) {
  if (!s.includes(token)) throw new Error(`OperatorLaunchpad must use ${token}`);
}
const sectionIds = [...s.matchAll(/<ConsoleSection[^>]*\sid="([a-z-]+)"/g)].map((match) => match[1]);
for (const id of ['your-events', 'run-a-show', 'set-up', 'people-data', 'diagnostics', 'demo']) {
  if (!sectionIds.includes(id)) throw new Error(`OperatorLaunchpad is missing the "${id}" section`);
}
if (sectionIds.length !== new Set(sectionIds).size) throw new Error('Two launchpad sections share an id');

// Demo stays, folded away: its section must not be defaultOpen.
const demoSection = s.slice(s.indexOf('id="demo"'));
const demoHeader = demoSection.slice(0, demoSection.indexOf('>'));
if (demoHeader.includes('defaultOpen')) throw new Error('Demo & training must be collapsed by default');

// Diagnostics: two cards, not nine doors to the same page.
const diagnostics = s.slice(s.indexOf('id="diagnostics"'), s.indexOf('id="demo"'));
const diagnosticCards = (diagnostics.match(/<LaunchpadCard/g) || []).length;
if (diagnosticCards !== 2) throw new Error(`Diagnostics must be exactly 2 cards (found ${diagnosticCards})`);

// No two cards share an href: a duplicate is a second door to the same room.
const cardHrefs = [...s.matchAll(/<LaunchpadCard[^>]*href=\{?["`]([^"`]+)["`]/g)].map((match) => match[1]);
if (cardHrefs.length < 12) throw new Error(`Only ${cardHrefs.length} launchpad cards found; the page lost its content`);
const seen = new Map();
for (const href of cardHrefs) {
  if (seen.has(href)) throw new Error(`Two launchpad cards share the href ${href}`);
  seen.set(href, true);
}
// The demo event id must not be the page's spine any more.
if (/const demoEventId\s*=/.test(s)) throw new Error('The launchpad must read real events, not a hard-coded demo event id');

const route = fs.readFileSync('app/production-access/launchpad/page.tsx', 'utf8');
if (!route.includes('readV5AccessCookie') || !route.includes('operatorPayload?.kind === "operator"')) throw new Error('Operator Launchpad route must remain behind operator production gate.');
if (!route.includes('ownerPayload?.kind === "owner"')) throw new Error('Operator Launchpad route must accept owner master cookie as universal authority.');
console.log(`validate_v7_operator_launchpad: PASS — ${sectionIds.length} sections, ${cardHrefs.length} cards, no duplicate hrefs, demo collapsed.`);
