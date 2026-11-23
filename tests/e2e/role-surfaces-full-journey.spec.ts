import { test } from "./fixtures";
import { expectRouteMatrix, loginAsSpecialGuest } from "./helpers/roleJourney";

test("speaker role journey exposes onboarding, tech check, green room, backstage, and teleprompter surfaces", async ({ page }) => {
  await loginAsSpecialGuest(page, "speaker", "demo", "/speaker/events/demo");
  await expectRouteMatrix(page, [
    { path: "/speaker/events/demo", label: "speaker event", anyOf: ["speaker", "backstage", "green room"] },
    { path: "/speaker/events/demo/onboarding", label: "speaker onboarding", anyOf: ["onboarding", "speaker"] },
    { path: "/speaker/events/demo/tech-check", label: "speaker tech check", anyOf: ["tech", "camera", "microphone", "check"] },
    { path: "/speaker/events/demo/green-room", label: "speaker green room", anyOf: ["green room", "speaker"] },
    { path: "/speaker/events/demo/backstage", label: "speaker backstage", anyOf: ["backstage", "speaker"] },
    { path: "/speaker/events/demo/teleprompter", label: "speaker teleprompter", anyOf: ["teleprompter", "script", "speaker"] },
  ]);
});

test("sponsor role journey exposes setup, booth, leads, ready room, and report surfaces", async ({ page }) => {
  await loginAsSpecialGuest(page, "sponsor", "demo", "/sponsor/events/demo");
  await expectRouteMatrix(page, [
    { path: "/sponsor/events/demo", label: "sponsor event", anyOf: ["sponsor", "booth", "leads"] },
    { path: "/sponsor/events/demo/setup", label: "sponsor setup", anyOf: ["setup", "sponsor"] },
    { path: "/sponsor/events/demo/booth", label: "sponsor booth", anyOf: ["booth", "sponsor"] },
    { path: "/sponsor/events/demo/leads", label: "sponsor leads", anyOf: ["leads", "sponsor"] },
    { path: "/sponsor/events/demo/ready-room", label: "sponsor ready room", anyOf: ["ready", "room", "sponsor"] },
    { path: "/sponsor/events/demo/report", label: "sponsor report", anyOf: ["report", "sponsor"] },
  ]);
});

test("crew role journey exposes call sheet, run-of-show, and task surfaces", async ({ page }) => {
  await loginAsSpecialGuest(page, "crew_lite", "demo", "/crew/events/demo");
  await expectRouteMatrix(page, [
    { path: "/crew/events/demo", label: "crew event", anyOf: ["crew", "call sheet", "run of show"] },
    { path: "/crew/events/demo/call-sheet", label: "crew call sheet", anyOf: ["call sheet", "crew"] },
    { path: "/crew/events/demo/run-of-show", label: "crew run of show", anyOf: ["run of show", "crew"] },
    { path: "/crew/events/demo/tasks", label: "crew tasks", anyOf: ["tasks", "crew"] },
  ]);
});

test("client role journey exposes approvals, assets, reports, run-of-show, and timeline", async ({ page }) => {
  await loginAsSpecialGuest(page, "client", "demo", "/client/nova-capital/events/demo");
  await expectRouteMatrix(page, [
    { path: "/client/nova-capital/events/demo", label: "client event", anyOf: ["client", "event", "approvals"] },
    { path: "/client/nova-capital/events/demo/approvals", label: "client approvals", anyOf: ["approval", "client"] },
    { path: "/client/nova-capital/events/demo/assets", label: "client assets", anyOf: ["assets", "client"] },
    { path: "/client/nova-capital/events/demo/reports", label: "client reports", anyOf: ["report", "client"] },
    { path: "/client/nova-capital/events/demo/run-of-show", label: "client run of show", anyOf: ["run of show", "client"] },
    { path: "/client/nova-capital/events/demo/timeline", label: "client timeline", anyOf: ["timeline", "client"] },
  ]);
});
