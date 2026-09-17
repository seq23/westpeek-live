#!/usr/bin/env node
/**
 * The sender identity cannot drift.
 *
 * The owner's requirement is that West Peek Live mail comes from notifications@, and there are four
 * separate places that have each, at some point, claimed a different answer:
 *
 *   - lib/brand.ts, the constant;
 *   - scripts/sync_required_secrets_manifest.js, which writes the .env.example an operator copies
 *     from, and which said "West Peek Live <hello@westpeek.live>" until 17 Sep 2026;
 *   - the EMAIL_FROM Cloudflare secret, whose value cannot be read back from CI;
 *   - the runtime_house_defaults row, which an operator can edit in Settings.
 *
 * The last two are not readable from here, which is exactly why the code resolves them rather than
 * trusting them: resolveSendingIdentity refuses anything off the verified sending domain. This
 * validator holds the parts that ARE in the repo to the same answer, and holds the resolver in
 * place so a later edit cannot quietly restore "whatever the secret said".
 *
 * Every check counts itself. Zero checks is a failure, not a pass.
 */
const fs = require("fs");

const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push(name);
  if (!condition) failures.push(`${name} — ${detail}`);
}

function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`missing file ${file}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

const brand = read("lib/brand.ts");
const emailService = read("services/email/emailService.ts");
const resend = read("services/email/ResendEmailProvider.ts");
const env = read("lib/env.ts");
const manifest = read("scripts/sync_required_secrets_manifest.js");

const EXPECTED_FROM = "notifications@events.westpeek.live";
const EXPECTED_DOMAIN = "events.westpeek.live";
const EXPECTED_REPLY_TO = "hello@westpeek.live";

// 1. The constants say what the owner asked for.
check(
  "brand.BRAND_FROM_EMAIL",
  new RegExp(`BRAND_FROM_EMAIL\\s*=\\s*"${EXPECTED_FROM}"`).test(brand),
  `lib/brand.ts must set BRAND_FROM_EMAIL to ${EXPECTED_FROM}`,
);
check(
  "brand.BRAND_REPLY_TO",
  new RegExp(`BRAND_REPLY_TO\\s*=\\s*"${EXPECTED_REPLY_TO}"`).test(brand),
  `lib/brand.ts must set BRAND_REPLY_TO to ${EXPECTED_REPLY_TO}`,
);
check(
  "brand.BRAND_SENDING_DOMAIN",
  new RegExp(`BRAND_SENDING_DOMAIN\\s*=\\s*"${EXPECTED_DOMAIN}"`).test(brand),
  `lib/brand.ts must set BRAND_SENDING_DOMAIN to ${EXPECTED_DOMAIN}, the domain carrying the Resend DKIM record`,
);
check(
  "brand.from is on the sending domain",
  EXPECTED_FROM.endsWith(`@${EXPECTED_DOMAIN}`),
  "the from address must live on the verified sending domain",
);

// 2. The resolver exists and is the only way an address reaches a provider.
check(
  "brand.resolveSendingIdentity exists",
  /export function resolveSendingIdentity/.test(brand),
  "lib/brand.ts must export resolveSendingIdentity",
);
check(
  "brand.resolveSendingIdentity falls back to the constant",
  /isBrandSendingIdentity\([\s\S]{0,80}\?[\s\S]{0,80}:\s*BRAND_FROM_EMAIL/.test(brand),
  "resolveSendingIdentity must return BRAND_FROM_EMAIL for anything off the sending domain",
);
check(
  "emailService resolves the from",
  /from:\s*resolveSendingIdentity\(/.test(emailService),
  "withHouseAddresses must pass the from through resolveSendingIdentity, so a stale Settings row cannot send",
);
check(
  "ResendEmailProvider resolves the from",
  /from:\s*resolveSendingIdentity\(/.test(resend),
  "the direct provider path must resolve too — sendProductionEmail does not go through sendEmail",
);
check(
  "no raw house fromEmail reaches a message",
  !/from:\s*message\.from\s*\|\|\s*house\.fromEmail/.test(emailService),
  "the unresolved `message.from || house.fromEmail` form is the drift this validator exists to stop",
);
check(
  "no raw EMAIL_FROM reaches a message",
  !/from:\s*message\.from\s*\|\|\s*env\.EMAIL_FROM\s*,/.test(resend),
  "the unresolved `message.from || env.EMAIL_FROM` form sends whatever the secret happens to hold",
);

// 3. EMAIL_FROM must never again decide whether mail sends at all.
check(
  "isResendConfigured does not gate on EMAIL_FROM",
  !/RESEND_API_KEY\s*&&\s*env\.EMAIL_FROM/.test(env),
  "gating on EMAIL_FROM silently swaps in MockEmailProvider and discards every message with no error",
);

// 4. The example an operator copies from must not teach an unverified address.
check(
  "secrets manifest EMAIL_FROM",
  manifest.includes(EXPECTED_FROM),
  `scripts/sync_required_secrets_manifest.js must offer ${EXPECTED_FROM} as EMAIL_FROM`,
);
check(
  "secrets manifest teaches no apex sender",
  !/EMAIL_FROM:\s*"[^"]*@westpeek\.live>?"/.test(manifest),
  "EMAIL_FROM must not be an apex westpeek.live address — the apex has no Resend DKIM key, so Resend rejects it",
);

// 5. Nothing anywhere may hardcode a from address that is not the brand one.
const SEND_SURFACES = ["services/email", "lib/actions", "services/agencies"];
let scanned = 0;
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      scanned += 1;
      const text = fs.readFileSync(full, "utf8");
      for (const hit of text.match(/[a-z0-9._-]+@westpeek\.live/gi) || []) {
        if (hit.toLowerCase() !== EXPECTED_REPLY_TO) {
          failures.push(`stray westpeek.live address "${hit}" in ${full} — send identities come from lib/brand.ts`);
        }
      }
    }
  }
};
SEND_SURFACES.forEach(walk);
check("send surfaces scanned", scanned > 0, "no files were scanned; the send surfaces moved and this check went inert");
checks.push(`scanned ${scanned} send-surface files`);

if (checks.length === 0) {
  console.error("validate_email_sender_identity: FAIL — no checks ran at all");
  process.exit(1);
}

if (failures.length) {
  console.error("validate_email_sender_identity: FAIL");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `validate_email_sender_identity: PASS — ${checks.length} assertions; every send path resolves through ` +
    `lib/brand.ts to ${EXPECTED_FROM} on the DKIM-verified domain ${EXPECTED_DOMAIN}, and EMAIL_FROM can no ` +
    `longer silently disable delivery.`,
);
