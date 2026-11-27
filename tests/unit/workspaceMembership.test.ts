import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createDbClient } from "@/lib/d1/query";
import { setD1ForTests } from "@/lib/d1/binding";
import { createV5AccessCookie } from "@/lib/auth/productionAccess";
import { PasswordAuth } from "@/lib/auth/passwordAuth";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { recordUploadedAsset } from "@/services/assets/eventAssetService";
import { createTestD1 } from "./helpers/d1";

/**
 * SECURITY AUDIT A ROW 2 (27 Nov 2026, critical): anyone could sign up at /signup and walk into /app
 * and /admin: every event's people, the supplier file, documents and uploads. A signed-in account is
 * not a workspace any more; only an ACTIVE agency member's session is. Every case below runs the real
 * signup action, the real middleware, the real /app layout, the real API routes and the real upload
 * actions against a real D1 with every migration applied.
 */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
    set: (name: string | { name: string; value: string }, value?: string) => {
      if (typeof name === "string") jar.set(name, String(value));
      else jar.set(name.name, name.value);
    },
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers({ "cf-connecting-ip": "203.0.113.9" }),
}));
class Redirect extends Error {
  constructor(public readonly url: string) { super(`redirect ${url}`); }
}
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Redirect(url); }, notFound: () => { throw new Error("not found"); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const SESSION = "agency_event_os_session";
const SECRET = "test-cookie-secret-test-cookie-secret";
const AGENCY = "agency-test-0001";
let env: Awaited<ReturnType<typeof createTestD1>>;
let tempDir: string;
let strangerCookie = "";
let memberCookie = "";
let memberId = "";

async function redirectOf(run: () => Promise<unknown>) {
  try { await run(); } catch (error) { if (error instanceof Redirect) return error.url; throw error; }
  return undefined;
}

/** Sign up through the real /signup action and return the session cookie it set. */
async function signUp(email: string) {
  jar.clear();
  const { signupWithPassword } = await import("@/lib/auth/actions");
  const form = new FormData();
  form.set("email", email);
  form.set("password", "a-long-test-password-1");
  form.set("full_name", "TEST account");
  expect(await redirectOf(() => signupWithPassword(form))).toBe("/app");
  const cookie = jar.get(SESSION);
  if (!cookie) throw new Error("signup set no session cookie");
  return cookie;
}

const as = (cookie: string) => { jar.clear(); if (cookie) jar.set(SESSION, cookie); };
const door = async (pathname: string, cookie: string, extra = "") => {
  const { middleware } = await import("@/middleware");
  return middleware(new NextRequest(`https://westpeek.live${pathname}`, { headers: { cookie: `${SESSION}=${cookie}${extra}` } }));
};

beforeAll(async () => {
  vi.stubEnv("V5_ACCESS_COOKIE_SECRET", SECRET);
  env = await createTestD1();
  setD1ForTests(env.db);
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-membership-"));
  process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
  setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  await recordUploadedAsset({ eventId: "event-a", assetId: "asset-1", storagePath: "event-a/asset-1/deck.pdf", fileName: "deck.pdf", mimeType: "application/pdf", sizeBytes: 2048, uploadedByKind: "operator", uploadedByLabel: "TEST" });

  strangerCookie = await signUp("test.stranger@example.test");
  memberCookie = await signUp("test.member@example.test");
  memberId = (await new PasswordAuth(createDbClient(env.db)).findUserByEmail("test.member@example.test"))!.id;
  const now = new Date().toISOString();
  await env.db.prepare("INSERT INTO agencies (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(AGENCY, "TEST agency", "test-agency", now, now).run();
  await env.db.prepare("INSERT INTO agency_members (id, agency_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, 'producer', 'active', ?, ?)").bind("member-1", AGENCY, memberId, now, now).run();
}, 60_000);

afterAll(async () => {
  setD1ForTests(undefined);
  setRuntimeStoreForTests(undefined);
  vi.unstubAllEnvs();
  fs.rmSync(tempDir, { recursive: true, force: true });
  await env?.dispose();
});

beforeEach(() => jar.clear());

describe("an account made at /signup gets no workspace", () => {
  it("the /app and /admin doors send it to the ask-to-be-added page, never in", async () => {
    for (const pathname of ["/app", "/app/people", "/app/settings", "/admin/testing"]) {
      const res = await door(pathname, strangerCookie);
      expect(res.headers.get("x-middleware-next"), pathname).toBeNull();
      expect(res.status, pathname).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, pathname).toBe("/no-workspace");
    }
  });

  it("the /app layout sends it to the ask-to-be-added page too (the second lock behind the door)", async () => {
    as(strangerCookie);
    const { default: AgencyAppLayout } = await import("@/app/app/layout");
    expect(await redirectOf(() => AgencyAppLayout({ children: null }))).toBe("/no-workspace");
  });

  it("is no workspace actor, so the supplier file, asset and document downloads answer 403", async () => {
    as(strangerCookie);
    const { getWorkspaceActor } = await import("@/lib/auth/workspaceActor");
    expect(await getWorkspaceActor()).toBeNull();
    const suppliers = await (await import("@/app/api/suppliers/export/route")).GET(new Request("https://westpeek.live/api/suppliers/export?kind=contractor"));
    expect(suppliers.status).toBe(403);
    const asset = await (await import("@/app/api/assets/[assetId]/download/route")).GET(new Request("https://westpeek.live/api/assets/asset-1/download"), { params: Promise.resolve({ assetId: "asset-1" }) });
    expect(asset.status).toBe(403);
    const doc = await (await import("@/app/api/documents/[documentId]/download/route")).GET(new Request("https://westpeek.live/api/documents/x/download"), { params: Promise.resolve({ documentId: "x" }) });
    expect(doc.status).toBe(403);
  });

  it("cannot put a file in an event's library recorded as \"operator\"", async () => {
    as(strangerCookie);
    const { confirmAssetUploadAction, requestAssetUploadAction } = await import("@/lib/actions/eventAssetActions");
    expect(await requestAssetUploadAction({ eventId: "event-a", fileName: "x.pdf", mimeType: "application/pdf", sizeBytes: 10, place: "library" })).toMatchObject({ ok: false });
    await expect(confirmAssetUploadAction({ eventId: "event-a", assetId: "a2", storagePath: "pending/event-a/a2/x.pdf", fileName: "x.pdf", mimeType: "application/pdf", sizeBytes: 10 })).rejects.toThrow();
  });

  it("a membership that is no longer active opens nothing", async () => {
    const now = new Date().toISOString();
    const strangerId = (await new PasswordAuth(createDbClient(env.db)).findUserByEmail("test.stranger@example.test"))!.id;
    await env.db.prepare("INSERT INTO agency_members (id, agency_id, user_id, role, status, created_at, updated_at) VALUES ('member-off', ?, ?, 'producer', 'disabled', ?, ?)").bind(AGENCY, strangerId, now, now).run();
    expect(new URL((await door("/app", strangerCookie)).headers.get("location")!).pathname).toBe("/no-workspace");
    as(strangerCookie);
    expect(await (await import("@/lib/auth/workspaceActor")).getWorkspaceActor()).toBeNull();
  });
});

describe("an active agency member keeps the workspace", () => {
  it("the doors and the layout let the member in", async () => {
    for (const pathname of ["/app", "/app/people", "/admin/testing"]) expect((await door(pathname, memberCookie)).headers.get("x-middleware-next"), pathname).toBe("1");
    as(memberCookie);
    const { default: AgencyAppLayout } = await import("@/app/app/layout");
    expect(await redirectOf(() => AgencyAppLayout({ children: null }))).toBeUndefined();
  });

  it("is the workspace actor, and the same routes answer past the access check", async () => {
    as(memberCookie);
    expect(await (await import("@/lib/auth/workspaceActor")).getWorkspaceActor()).toMatchObject({ kind: "user", id: memberId });
    expect((await (await import("@/app/api/suppliers/export/route")).GET(new Request("https://westpeek.live/api/suppliers/export?kind=contractor"))).status).toBe(200);
    expect((await (await import("@/app/api/assets/[assetId]/download/route")).GET(new Request("https://westpeek.live/api/assets/asset-1/download"), { params: Promise.resolve({ assetId: "asset-1" }) })).status).not.toBe(403);
    expect((await (await import("@/app/api/documents/[documentId]/download/route")).GET(new Request("https://westpeek.live/api/documents/x/download"), { params: Promise.resolve({ documentId: "x" }) })).status).toBe(404);
    // Past the access check: refused only because this upload is not under the event's prefix.
    const { confirmAssetUploadAction } = await import("@/lib/actions/eventAssetActions");
    expect(await confirmAssetUploadAction({ eventId: "event-a", assetId: "a2", storagePath: "elsewhere/x.pdf", fileName: "x.pdf", mimeType: "application/pdf", sizeBytes: 10 })).toEqual({ ok: false, reason: "That upload does not belong to this event." });
  });
});

describe("other doors and failures", () => {
  it("the owner's own cookie still opens /app with a non-member session beside it", async () => {
    const owner = await createV5AccessCookie({ kind: "owner", role: "owner", issuedAt: Date.now(), expiresAt: Date.now() + 3_600_000 }, SECRET);
    expect((await door("/app", strangerCookie, `; wpl_owner_access=${owner}`)).headers.get("x-middleware-next")).toBe("1");
  });

  it("no cookie, a forged token or a revoked session goes to the login, not the invite page", async () => {
    const forged = Buffer.from(JSON.stringify({ accessToken: "b".repeat(64) })).toString("base64url");
    for (const cookie of ["", forged]) {
      const res = await door("/app/events", cookie);
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).not.toBe("/no-workspace");
      expect(res.headers.get("location")).toContain("next=%2Fapp%2Fevents");
    }
  });

  it("Log out on the no-workspace page clears the session even when D1 cannot be reached", async () => {
    as(strangerCookie);
    const { logout } = await import("@/lib/auth/actions");
    setD1ForTests(undefined);
    try {
      expect(await redirectOf(() => logout())).toBe("/login");
    } finally {
      setD1ForTests(env.db);
    }
    expect(jar.has(SESSION)).toBe(false);
  });

  it("when the membership cannot be read, the session opens nothing", async () => {
    const { selfServeStanding } = await import("@/lib/auth/selfServeSession");
    const broken = new Proxy(env.db, {
      get(target, key, receiver) {
        if (key === "prepare") return (sql: string) => { if (/agency_members/.test(sql)) throw new Error("D1 down"); return target.prepare(sql); };
        return Reflect.get(target, key, receiver);
      },
    });
    expect(await selfServeStanding(memberCookie, broken)).toBe("none");
    expect(await selfServeStanding(memberCookie, env.db)).toBe("member");
    expect(await selfServeStanding(strangerCookie, env.db)).toBe("no_workspace");
  });
});
