const fs = require("fs");
const path = require("path");

const input = process.argv[2] || "";
const forbidden = /[\n\r`$;&|<>]/;
function fail(message) {
  console.error(`[event-config-import] ${message}`);
  process.exit(1);
}
if (!input) fail("event_config_package input is required.");
if (path.isAbsolute(input) || input.includes("..") || forbidden.test(input)) fail("Package path must be a safe relative directory path.");
if (!input.startsWith("event-config-packages/")) fail("Package path must start with event-config-packages/.");
const sourceRoot = path.resolve(process.cwd(), input);
if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) fail(`Package directory not found: ${input}`);

const allowRoots = new Set(["data/events", "data/access", "public/events"]);
const requiredFiles = ["manifest.json"];
for (const required of requiredFiles) if (!fs.existsSync(path.join(sourceRoot, required))) fail(`Missing required package file: ${required}`);

const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"));
if (!manifest.slug || !/^[a-z0-9-]+$/.test(manifest.slug)) fail("manifest.slug must be kebab-case.");
if (JSON.stringify(manifest).match(/secret|password|token|api[_-]?key/i)) fail("Manifest must not contain secret-like fields.");

function copyTree(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(target, { recursive: true });
      copyTree(source, target);
    } else if (entry.isFile()) {
      const body = fs.readFileSync(source);
      if (body.toString("utf8").match(/(sk_live_[A-Za-z0-9]|CLOUDFLARE_API_TOKEN[ \t]*=[ \t]*[^\n#]+|RESEND_API_KEY[ \t]*=[ \t]*[^\n#]+|LIVEKIT_API_SECRET[ \t]*=[ \t]*[^\n#]+|-----BEGIN PRIVATE KEY-----)/)) fail(`Secret-like value found in ${source}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
    }
  }
}

for (const rootName of allowRoots) {
  const src = path.join(sourceRoot, rootName);
  if (fs.existsSync(src)) copyTree(src, path.resolve(process.cwd(), rootName));
}
console.log(`[event-config-import] Imported package ${input}.`);
