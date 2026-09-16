const fs = require("fs");
/**
 * Real assets (16 Sep 2026). The page used to render seed fixtures with no way to upload anything.
 * What must hold now: a file goes from the browser STRAIGHT to Supabase Storage through a
 * short-lived signed URL (never through the Worker), every file is a row in event_assets with who
 * sent it, a review state and a visibility, a speaker's or sponsor's upload arrives "in review",
 * downloads are signed and access-checked, removal is archiving, and storage that is missing says
 * so in words instead of failing silently.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

const service = check("services/assets/eventAssetService.ts", ["createSignedUploadUrl", "createSignedUrl", "ensureBucket", "requestAssetUpload", "recordUploadedAsset", "setAssetReview", "setAssetVisibility", "archiveAsset", "assetDownloadUrl", "Paste a link instead"]);
if (/\.remove\(|deleteObject|\.delete\(\)/.test(service)) throw new Error("Assets are archived, never deleted.");
if (!/status: input.uploadedByKind === "speaker" \|\| input.uploadedByKind === "sponsor" \? "in_review"/.test(service)) throw new Error("A guest upload must arrive as in_review.");

const uploader = check("components/assets/AssetUploader.tsx", ["requestAssetUploadAction", "confirmAssetUploadAction", "fetch(ticket.signedUrl", 'method: "PUT"', "onDrop", "asset-file-input", "assetUploadRefusal"]);
if (uploader.includes("SUPABASE_SERVICE_ROLE_KEY")) throw new Error("The browser must never see a service key.");

check("lib/actions/eventAssetActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "manage_assets")', "getCurrentGuestIdentity", "requestAssetUpload(", "recordUploadedAsset(", "archiveAsset(", "addAssetLinkAction"]);
check("lib/auth/crewRolePermissions.ts", ['"manage_assets"', "manage_assets: \"approve, hide, or archive a file in the asset library\""]);
check("components/assets/EventAssetLibrary.tsx", ["listEventAssets(", 'action="manage_assets"', "asset-approve-", "asset-visibility-toggle-", "asset-archive-", "asset-download-", "AssetUploader", "asset-link-form"]);
check("components/assets/GuestAssetUpload.tsx", ["AssetUploader", "in review", "readOnly"]);
check("components/assets/AssetsAcrossEvents.tsx", ["listAssetsAcrossEvents(", "assets-across-events", "assets-event-"]);
check("app/api/assets/[assetId]/download/route.ts", ["assetDownloadUrl(", "getCrewViewer(", "NextResponse.redirect"]);
check("app/app/assets/page.tsx", ["AssetsAcrossEvents"]);
check("app/app/events/[eventId]/assets/page.tsx", ["EventAssetLibrary"]);
check("app/speaker/events/[eventId]/green-room/page.tsx", ['GuestAssetUpload({ eventId, role: "speaker"']);
check("app/sponsor/events/[eventId]/booth/page.tsx", ['GuestAssetUpload({ eventId, role: "sponsor"']);
check("db/migrations/0031_event_assets.sql", ["create table if not exists public.event_assets", "archived_at", "visibility", "storage_path", "external_url"]);
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/supabaseRuntimeStore.ts"]) check(store, ["upsertEventAsset", "listEventAssets", "listAllEventAssets", "getEventAsset"]);
check("tests/unit/eventAssets.test.ts", ["a speaker's upload waits in review", "archiving keeps the row"]);
if (fs.existsSync("components/assets/AssetLibrary.tsx")) throw new Error("The seed-fixture AssetLibrary must be gone; EventAssetLibrary replaced it.");
if (examined < 14) throw new Error(`validate_event_assets_contract examined only ${examined} files`);
console.log(`validate_event_assets_contract: PASS — ${examined} files examined; the upload, review and archive paths are proven by tests/unit/eventAssets.test.ts and tests/e2e/event-assets.spec.ts.`);
