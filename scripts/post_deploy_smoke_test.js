const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
if (!baseUrl) {
  console.log("post_deploy_smoke_test: SKIP (set SMOKE_BASE_URL or NEXT_PUBLIC_APP_URL)");
  process.exit(0);
}

/**
 * A deploy rolls out over seconds; checking the URL the moment `wrangler deploy` returns can read the
 * PREVIOUS version (6 Oct 2026: three 500s from the outgoing Supabase build, seconds after the D1
 * build deployed). When SMOKE_EXPECT_BUILD_ID is set (the deploy workflow passes the commit), every
 * check below waits until /api/runtime/build-id answers that build five times in a row, and fails by
 * name if it never does — it never checks whichever version happens to answer.
 */
async function waitForExpectedBuild(expected) {
  if (!expected) return;
  const want = expected.slice(0, 12);
  const deadline = Date.now() + 120_000;
  let streak = 0;
  let last = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/api/runtime/build-id", baseUrl), { headers: { "cache-control": "no-cache" }, redirect: "manual" });
      last = response.ok ? String((await response.json()).buildId || "") : `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    streak = last === want ? streak + 1 : 0;
    if (streak >= 5) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  console.error(`post_deploy_smoke_test: NAMED STOP — ${baseUrl} never served build ${want} five times in a row within 120s (last answer: ${last}). The deploy did not take, or an older version is still serving.`);
  process.exit(1);
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
  await waitForExpectedBuild(process.env.SMOKE_EXPECT_BUILD_ID);
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
      // 503 is the health route saying "not ok" (6 Oct 2026); read its body for the named stop.
      if (![200, 503].includes(response.status) || !health) failures.push(`${check.path} expected JSON runtime health got ${response.status}`);
      else if (response.status === 503 && health.ok !== false) failures.push(`${check.path} answered 503 without ok:false`);
      else if (response.status === 200 && health.ok !== true) failures.push(`${check.path} answered 200 with ok:${health.ok}; the route must say 503 when it is not ok`);
      else if (health.store !== "d1") failures.push(`${check.path} store is ${health.store}; production must run the d1 runtime store (binding DB)`);
      else if (!health.runtimeEvents?.ready) failures.push(`${check.path} NAMED STOP — runtime tables missing (${(health.runtimeEvents?.missingTables || []).join(", ") || health.runtimeEvents?.detail || "unknown"}); apply ${health.runtimeEvents?.migrationFile} (npx wrangler d1 migrations apply west-peek-live --remote)`);
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
          failures.push(`${check.path} NAMED STOP — the deployed database is missing ${(coverage.missing || []).length} of ${coverage.checked} objects its migrations create: ${named || coverage.detail || "unknown"}. Apply them with npx wrangler d1 migrations apply west-peek-live --remote (docs/manual-notes/migration-assurance.md).`);
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
