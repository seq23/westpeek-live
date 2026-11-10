// The speed-networking privacy promise is shown beside the Join action. It is a
// privacy disclosure, so it must survive verbatim and be rendered where the person
// decides. Trimmed 10 Nov 2026 to this rule (hostile review of the validator cut).
const fs = require("fs");
const read = (f) => { if (!fs.existsSync(f)) throw new Error(`Missing ${f}`); return fs.readFileSync(f, "utf8"); };
const failures = [];
if (!/SPEED_NETWORKING_PRIVACY_PROMISE = "Your match sees your name and your company\. Nothing else\."/.test(read("types/speedNetworking.ts"))) failures.push("the privacy promise must survive verbatim");
const panel = read("components/venue/SpeedNetworkingQueuePanel.tsx");
if (!/speed-networking-privacy-promise/.test(panel) || !panel.includes("SPEED_NETWORKING_PRIVACY_PROMISE")) failures.push("the privacy promise must be rendered with the Join action, not filed in a constant nothing reads");
if (failures.length) { console.error("validate_demo_summit_showcase: FAIL\n- " + failures.join("\n- ")); process.exit(1); }
console.log("validate_demo_summit_showcase: PASS — the privacy promise is rendered beside the Join action.");
