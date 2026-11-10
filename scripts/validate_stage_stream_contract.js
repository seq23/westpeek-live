// The LiveKit webhook verifies the signature and fails closed. A forged
// `ingress_ended` could otherwise end a live show. Trimmed 10 Nov 2026 to this
// rule (hostile review of the validator cut).
const fs = require("fs");
const file = "app/api/video/livekit-webhook/route.ts";
if (!fs.existsSync(file)) throw new Error(`Missing ${file}: the webhook this check guards is gone`);
const src = fs.readFileSync(file, "utf8");
const failures = [];
if (!/\.verifyWebhook\(|verifyWebhook\(/.test(src) && !/WebhookReceiver/.test(src)) failures.push("the webhook never verifies the LiveKit signature");
if (!src.includes("ingress_ended")) failures.push("the webhook no longer handles ingress_ended, so this check examined nothing");
if (!src.includes("verification failed closed")) failures.push("a failed signature check must fail closed (no event acted on)");
if (!/status:\s*40[13]/.test(src)) failures.push("a request that fails verification must be refused with 401/403");
if (failures.length) { console.error("validate_stage_stream_contract: FAIL\n- " + failures.join("\n- ")); process.exit(1); }
console.log("validate_stage_stream_contract: PASS — webhook verifies its signature and fails closed.");
