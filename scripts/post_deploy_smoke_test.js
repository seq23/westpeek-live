const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
if (!baseUrl) {
  console.log("post_deploy_smoke_test: SKIP (set SMOKE_BASE_URL or NEXT_PUBLIC_APP_URL)");
  process.exit(0);
}

const checks = [
  { path: "/", kind: "public", mustContain: "Join an Event" },
  { path: "/join", kind: "public", mustContain: "Event code" },
  { path: "/production-access", kind: "public", mustContain: "Production Access" },
  { path: "/privacy", kind: "public", mustContain: "Privacy Policy" },
  { path: "/terms", kind: "public", mustContain: "Terms of Use" },
  { path: "/production-access/crew", kind: "public", mustContain: "Crew password" },
  { path: "/production-access/operator", kind: "public", mustContain: "Operator launchpad password" },
  { path: "/production-access/special-guest", kind: "public", mustContain: "Special guest password" },
  { path: "/request-event", kind: "public", mustContain: "Plan an Event" },
  { path: "/events/demo", kind: "public" },
  { path: "/venue/demo/lobby", kind: "public" },
  { path: "/venue/event-summit/stage", kind: "public" },
  { path: "/venue/event-summit/sessions", kind: "public" },
  { path: "/venue/event-summit/expo", kind: "public" },
  { path: "/venue/event-summit/help", kind: "public" },
  { path: "/app", kind: "protected" },
  { path: "/admin/testing", kind: "protected" },
  { path: "/api/video/livekit-token", kind: "api-safe-failure" },
  { path: "/api/video/daily-token", kind: "api-safe-failure" },
  { path: "/api/video/zoom-signature", kind: "api-safe-failure" },
  { path: "/api/runtime/health", kind: "runtime-health" },
];

async function run() {
  const failures = [];
  for (const check of checks) {
    const response = await fetch(new URL(check.path, baseUrl), { redirect: "manual" });
    const body = await response.text().catch(() => "");
    if (check.kind === "public" && response.status !== 200) failures.push(`${check.path} expected 200 got ${response.status}`);
    if (check.kind === "protected" && !(response.status >= 300 && response.status < 400)) failures.push(`${check.path} expected redirect guard got ${response.status}`);
    if (check.kind === "api-safe-failure" && ![400, 401, 403, 405].includes(response.status)) failures.push(`${check.path} expected safe auth/config failure got ${response.status}`);
    if (check.mustContain && !body.includes(check.mustContain)) failures.push(`${check.path} missing marker ${check.mustContain}`);
    if (check.kind === "runtime-health") {
      // Named stop, not a silent pass: the deployed app must say whether migration 0024 has been applied.
      let health;
      try { health = JSON.parse(body); } catch { health = undefined; }
      if (response.status !== 200 || !health) failures.push(`${check.path} expected JSON runtime health got ${response.status}`);
      else if (health.store !== "supabase") failures.push(`${check.path} store is ${health.store}; production must run the supabase runtime store`);
      else if (!health.runtimeEvents?.ready) failures.push(`${check.path} NAMED STOP — runtime tables missing (${(health.runtimeEvents?.missingTables || []).join(", ") || health.runtimeEvents?.detail || "unknown"}); run ${health.runtimeEvents?.migrationFile} in the Supabase SQL editor`);
      else if (health.seedEvents !== 5) failures.push(`${check.path} expected 5 compiled seed events got ${health.seedEvents}`);
      // The crew deck's and networking page's reads against a REAL runtime event: a mis-shaped table (16 Sep 2026) fails here by name.
      else if (health.crewPageReads && !health.crewPageReads.ok) failures.push(`${check.path} NAMED STOP — crew page reads failed on ${health.crewPageReads.eventId || "runtime event"}: ${(health.crewPageReads.reads || []).filter((r) => !r.ok).map((r) => `${r.name}: ${r.detail || "failed"}`).join("; ")}`);
      // Every entry in RUNTIME_TABLE_MIGRATIONS against the live database. Its own branch, not another
      // `else if`: a deploy whose database is behind its migrations must fail even when everything above
      // it passed, because that is exactly what 0030, 0037 and 0023 looked like from the outside — green.
      if (health && typeof health === "object") {
        const coverage = health.migrationCoverage;
        if (!coverage) failures.push(`${check.path} NAMED STOP — migrationCoverage missing from runtime health; the deployed build predates the migration coverage probe and cannot prove its database is current`);
        else if (!coverage.checked) failures.push(`${check.path} NAMED STOP — migration coverage checked 0 objects: ${coverage.detail || "no detail"}. A probe that examines nothing is a failure, not a pass.`);
        else if (!coverage.ok) {
          const named = (coverage.missing || []).map((row) => `${row.object} (apply ${row.migrationFile}${row.detail ? ` — ${row.detail}` : ""})`).join("; ");
          failures.push(`${check.path} NAMED STOP — the deployed database is missing ${(coverage.missing || []).length} of ${coverage.checked} objects its migrations create: ${named || coverage.detail || "unknown"}. Paste the named file(s) into the Supabase SQL editor (docs/manual-notes/migration-assurance.md).`);
        }
      }
    }
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log("post_deploy_smoke_test: PASS");
}
run().catch((error) => { console.error(error); process.exit(1); });
