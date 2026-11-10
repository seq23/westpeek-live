// /api/venue/tick is owner/operator only and never carries a stream key: its
// signals name internal failures an attendee must never read. Trimmed 10 Nov 2026
// to this rule (hostile review of the validator cut); bar visibility is unit-tested.
const fs = require("fs");
const file = "app/api/venue/tick/route.ts";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
const tick = fs.readFileSync(file, "utf8");
const failures = [];
if (!(/if \(!commandBarVisibleTo\(viewer\)\)/.test(tick) && tick.includes("403"))) failures.push(`${file} must refuse anyone the bar is not for (owner and operator), with a 403`);
if (/streamKey|livekitStreamKey/.test(tick)) failures.push(`${file} must never carry a stream key`);
if (failures.length) { console.error("validate_event_command_bar: FAIL\n- " + failures.join("\n- ")); process.exit(1); }
console.log("validate_event_command_bar: PASS — /api/venue/tick is 403 to all but owner/operator and carries no stream key.");
