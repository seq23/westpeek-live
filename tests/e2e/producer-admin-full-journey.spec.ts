import { test } from "./fixtures";
import { expectRouteMatrix, grantAgencySession } from "./helpers/roleJourney";

test("producer/admin can inspect event setup, operations, publishing, and video-health surfaces", async ({ page }) => {
  await grantAgencySession(page);
  await expectRouteMatrix(page, [
    { path: "/app", label: "app dashboard", anyOf: ["dashboard", "events", "west peek"] },
    { path: "/app/events", label: "events index", anyOf: ["events", "nova"] },
    { path: "/app/events/demo", label: "event overview", anyOf: ["overview", "event", "nova"] },
    { path: "/app/events/demo/setup", label: "setup", anyOf: ["setup", "event"] },
    { path: "/app/events/demo/agenda", label: "agenda", anyOf: ["agenda", "session"] },
    { path: "/app/events/demo/run-of-show", label: "run of show", anyOf: ["run of show", "cue"] },
    { path: "/app/events/demo/approvals", label: "approvals", anyOf: ["approval", "client", "producer"] },
    { path: "/app/events/demo/approval-queue", label: "approval queue", anyOf: ["approval", "queue"] },
    { path: "/app/events/demo/assets", label: "assets", anyOf: ["assets", "deck", "logo"] },
    { path: "/app/events/demo/communications", label: "communications", anyOf: ["communications", "email", "template"] },
    { path: "/app/events/demo/inbox", label: "inbox", anyOf: ["inbox", "production"] },
    { path: "/app/events/demo/incidents", label: "incidents", anyOf: ["incident", "production"] },
    { path: "/app/events/demo/tasks", label: "tasks", anyOf: ["tasks", "owner"] },
    { path: "/app/events/demo/timeline", label: "timeline", anyOf: ["timeline", "event"] },
    { path: "/app/events/demo/video-health", label: "video health", anyOf: ["video", "health", "provider"] },
    { path: "/app/events/demo/publish", label: "publish", anyOf: ["publish", "deployment"] },
    { path: "/app/events/demo/report", label: "report", anyOf: ["report", "export"] },
    { path: "/app/events/demo/preview", label: "preview", anyOf: ["preview", "venue"] },
  ]);
});
