const fs = require("fs");
const path = require("path");
const { d1Files, requireD1 } = require("./lib/d1Schema");
const migrationFiles = d1Files();
if (!migrationFiles.length) throw new Error("migrations-d1 has no migration files.");
const nums = new Map();
for (const file of migrationFiles) {
  const num = file.slice(0, 4);
  if (nums.has(num)) throw new Error(`Duplicate migration number ${num}: ${nums.get(num)} and ${file}`);
  nums.set(num, file);
}
for (const table of ["v5_access_attempt_events", "v5_runtime_fallback_events", "v5_analytics_events"]) {
  const missing = requireD1(table, ["  id TEXT NOT NULL,"]);
  if (missing.length) throw new Error(`Migration missing runtime boundary invariant: ${missing.join("; ")}`);
}
// The boundary RLS used to state is structural now: D1 is a Worker binding, reachable only from server
// code. No client component may import the database or storage layer.
function walk(dir, out = []) {
  for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}
let clientFiles = 0;
for (const file of ["app", "components", "lib"].flatMap((dir) => walk(dir))) {
  const text = fs.readFileSync(file, "utf8");
  if (!/^\s*["']use client["']/.test(text)) continue;
  clientFiles += 1;
  if (/from "@\/lib\/d1\//.test(text) || /from "@\/services\/runtime\//.test(text)) throw new Error(`${file} is a client component and imports the database layer; D1 must stay server-only.`);
}
if (!clientFiles) throw new Error("Found zero client components; the boundary scan is broken.");
for (const file of ["services/runtime/runtimeStoreFactory.ts", "services/runtime/fileRuntimeStore.ts", "services/runtime/d1RuntimeStore.ts", "services/analytics/analyticsEventService.ts", "services/video/roomFallbackService.ts", "services/audit/createAuditLog.ts"]) {
  if (!fs.existsSync(file)) throw new Error(`Missing runtime boundary file: ${file}`);
}
const fallback = fs.readFileSync("services/video/roomFallbackService.ts", "utf8");
if (fallback.includes("logAccessAttempt")) throw new Error("Video fallback must not be logged as access attempts.");
for (const token of ["getRuntimeStore", "appendFallbackEvent", "setFallbackState", "manual_switch", "rollback"]) {
  if (!fallback.includes(token)) throw new Error(`Fallback runtime missing ${token}`);
}
const analytics = fs.readFileSync("services/analytics/analyticsEventService.ts", "utf8");
if (!analytics.includes("getRuntimeStore") || !analytics.includes("appendAnalyticsEvent")) throw new Error("Analytics events must persist through runtime store adapter.");
console.log("validate_v5_runtime_boundaries: PASS");
