// No raw workflow input is interpolated inside a `run:` block in any workflow
// (script injection). Trimmed 10 Nov 2026 to this rule (hostile review of the
// validator cut) and widened from one workflow to all of them.
const fs = require("fs");
const dir = ".github/workflows";
const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
if (!files.length) { console.error("validate_v5_publishing: examined zero workflows"); process.exit(1); }
const failures = [];
for (const f of files) {
  const lines = fs.readFileSync(`${dir}/${f}`, "utf8").split(/\r?\n/);
  let inRun = false, indent = 0;
  lines.forEach((line, i) => {
    const ind = line.length - line.trimStart().length;
    const single = line.match(/^\s*(?:-\s*)?run:\s*(?![|>])(.+)$/);
    if (single && /\$\{\{\s*(inputs|github\.event\.inputs)\./.test(single[1])) failures.push(`${f}:${i + 1} interpolates a workflow input inside run:`);
    if (/^\s*(?:-\s*)?run:\s*[|>]/.test(line)) { inRun = true; indent = ind; return; }
    if (inRun && line.trim() && ind <= indent) inRun = false;
    if (inRun && /\$\{\{\s*(inputs|github\.event\.inputs)\./.test(line)) failures.push(`${f}:${i + 1} interpolates a workflow input inside a run: block; pass it through env:`);
  });
}
if (failures.length) { console.error("validate_v5_publishing: FAIL\n- " + failures.join("\n- ")); process.exit(1); }
console.log(`validate_v5_publishing: PASS — ${files.length} workflows, no raw input inside run:.`);
