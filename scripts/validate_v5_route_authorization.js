const fs = require("fs");
const required = ["lib/auth/v5RouteAuthorization.ts", "tests/unit/v5RouteAuthorization.test.ts"];
for (const file of required) if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
const auth = fs.readFileSync("lib/auth/v5RouteAuthorization.ts", "utf8");
const tests = fs.readFileSync("tests/unit/v5RouteAuthorization.test.ts", "utf8");
if (auth.includes("pathname.includes(`/${eventId}`)")) throw new Error("Route authorization must not use substring event matching.");
for (const token of ["eventIdFromPath", "eventIdsMatch(pathEventId, payload.eventId)", "canOwnerAccessPath"]) {
  if (!auth.includes(token)) throw new Error(`Missing route authorization invariant: ${token}`);
}
for (const token of ["event-12", "role escalation", "/app/events/event-1", "/sponsor/events/event-1", "owner can access settings"]) {
  if (!tests.includes(token)) throw new Error(`Missing route authorization behavioral test marker: ${token}`);
}
console.log("validate_v5_route_authorization: PASS");
