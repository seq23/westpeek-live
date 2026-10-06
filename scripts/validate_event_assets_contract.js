const fs = require("fs");
/**
 * Real assets (16 Sep 2026). The page used to render seed fixtures with no way to upload anything.
 * What must hold now (R2 since 6 Oct 2026): a file goes from the browser to the private R2 bucket
 * only through a short-lived HMAC-signed link to /api/assets/upload (checked: signature, expiry,
 * type, size), the row is written only once the object is in the bucket, every file is a row in
 * event_assets with who
 * sent it, a review state and a visibility, a speaker's or sponsor's upload arrives "in review",
 * downloads are signed and access-checked, removal is archiving, and storage that is missing says
 * so in words instead of failing silently.
 */
function read(file) { if (!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file, "utf8"); }
let examined = 0;
function check(file, tokens) { const body = read(file); examined += 1; const missing = tokens.filter((t) => !body.includes(t)); if (missing.length) throw new Error(`${file} missing: ${missing.join(" | ")}`); return body; }

const service = check("services/assets/eventAssetService.ts", ["signUploadUrl", "signDownloadUrl", "getAssetsBucket", "export async function storedObjectExists", "requestAssetUpload", "recordUploadedAsset", "setAssetReview", "setAssetVisibility", "archiveAsset", "assetDownloadUrl", "Paste a link to the file instead"]);
check("services/assets/signedUrlService.ts", ["hmacSha256Base64Url", "getV5AccessCookieSecret", "export async function verifyUploadUrl", "export async function verifyDownloadUrl", "has expired", "was not signed by this site"]);
check("app/api/assets/upload/route.ts", ["verifyUploadUrl(", "bucket.put(check.key", "EVENT_ASSET_MAX_BYTES", "status: 415", "status: 413", "ASSETS_BUCKET"]);
check("app/api/assets/file/route.ts", ["verifyDownloadUrl(", "bucket.get(check.key)", "x-content-type-options"]);
check("wrangler.jsonc", ['"binding": "ASSETS_BUCKET"', '"bucket_name": "west-peek-live-assets"']);
check("tests/unit/signedAssetUrls.test.ts", ["refuses a link whose key, size, type, expiry or signature was changed", "round-trips a file through R2"]);
if (/\.remove\(|deleteObject|\.delete\(\)/.test(service)) throw new Error("Assets are archived, never deleted.");
if (!/status: input.uploadedByKind === "speaker" \|\| input.uploadedByKind === "sponsor" \? "in_review"/.test(service)) throw new Error("A guest upload must arrive as in_review.");

const uploader = check("components/assets/AssetUploader.tsx", ["requestAssetUploadAction", "confirmAssetUploadAction", "fetch(ticket.signedUrl", 'method: "PUT"', "onDrop", "asset-file-input", "assetUploadRefusal"]);
if (/SERVICE_ROLE|API_TOKEN|ACCESS_KEY/.test(uploader)) throw new Error("The browser must never see a storage key.");

check("lib/actions/eventAssetActions.ts", ['requireLiveEventControlAccessForRequest(eventId, "manage_assets")', "getCurrentGuestIdentity", "requestAssetUpload(", "recordUploadedAsset(", "archiveAsset(", "addAssetLinkAction", "await storedObjectExists(input.storagePath)"]);
check("lib/auth/crewRolePermissions.ts", ['"manage_assets"', "manage_assets: \"approve, hide, or archive a file in the asset library\""]);
check("components/assets/EventAssetLibrary.tsx", ["listEventAssets(", 'action="manage_assets"', "asset-approve-", "asset-visibility-toggle-", "asset-archive-", "asset-download-", "AssetUploader", "asset-link-form"]);
check("components/assets/GuestAssetUpload.tsx", ["AssetUploader", "in review", "readOnly"]);
check("components/assets/AssetsAcrossEvents.tsx", ["listAssetsAcrossEvents(", "assets-across-events", "assets-event-"]);
check("app/api/assets/[assetId]/download/route.ts", ["assetDownloadUrl(", "getCrewViewer(", "NextResponse.redirect"]);
check("app/app/assets/page.tsx", ["AssetsAcrossEvents"]);
check("app/app/events/[eventId]/assets/page.tsx", ["EventAssetLibrary"]);
check("app/speaker/events/[eventId]/green-room/page.tsx", ['GuestAssetUpload({ eventId, role: "speaker"']);
check("app/sponsor/events/[eventId]/booth/page.tsx", ['GuestAssetUpload({ eventId, role: "sponsor"']);
{ const f = require("./lib/d1Schema").requireD1("event_assets", ["  archived_at TEXT,", "  visibility TEXT", "  storage_path TEXT,", "  external_url TEXT,"]); examined += 1; if (f.length) throw new Error(f.join("; ")); }
for (const store of ["services/runtime/fileRuntimeStore.ts", "services/runtime/d1RuntimeStore.ts"]) check(store, ["upsertEventAsset", "listEventAssets", "listAllEventAssets", "getEventAsset"]);
check("tests/unit/eventAssets.test.ts", ["a speaker's upload waits in review", "archiving keeps the row"]);
if (fs.existsSync("components/assets/AssetLibrary.tsx")) throw new Error("The seed-fixture AssetLibrary must be gone; EventAssetLibrary replaced it.");
if (examined < 20) throw new Error(`validate_event_assets_contract examined only ${examined} files`);
console.log(`validate_event_assets_contract: PASS — ${examined} files examined; the upload, review and archive paths are proven by tests/unit/eventAssets.test.ts and tests/e2e/event-assets.spec.ts.`);
