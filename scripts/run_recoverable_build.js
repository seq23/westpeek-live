#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const COMMANDS = {
  build: ["npx", ["next", "build"]],
  "cf:build": ["npx", ["opennextjs-cloudflare", "build"]],
};

function fail(message) {
  console.error(`run_recoverable_build: FAIL — ${message}`);
  process.exit(1);
}

const target = process.argv[2] || "build";
const clean = process.argv.includes("--clean");
const command = COMMANDS[target];
if (!command) {
  fail(`unknown target "${target}". Supported targets: ${Object.keys(COMMANDS).join(", ")}`);
}

const repoRoot = process.cwd();
const logDir = path.join(repoRoot, "logs", "build-recovery");
fs.mkdirSync(logDir, { recursive: true });

if (clean) {
  for (const entry of ["dist", "build", ".next", "out", ".open-next"]) {
    fs.rmSync(path.join(repoRoot, entry), { recursive: true, force: true });
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFile = path.join(logDir, `${stamp}-${target.replace(/[^a-z0-9_-]/gi, "-")}.log`);
const stream = fs.createWriteStream(logFile, { flags: "a" });
const [bin, args] = command;
const envSource = globalThis.process.env;
const env = {
  ...envSource,
  NODE_OPTIONS: envSource.NODE_OPTIONS || "--max-old-space-size=4096",
};

function write(line) {
  process.stdout.write(line);
  stream.write(line);
}

write(`run_recoverable_build: target=${target}\n`);
write(`run_recoverable_build: clean=${clean ? "true" : "false"}\n`);
write(`run_recoverable_build: NODE_OPTIONS=${env.NODE_OPTIONS}\n`);
write(`run_recoverable_build: log=${path.relative(repoRoot, logFile)}\n`);
write(`run_recoverable_build: command=${bin} ${args.join(" ")}\n\n`);

const child = spawn(bin, args, { cwd: repoRoot, env, shell: false });
child.stdout.on("data", (chunk) => write(chunk.toString()));
child.stderr.on("data", (chunk) => write(chunk.toString()));
child.on("error", (error) => {
  write(`\nrun_recoverable_build: spawn error: ${error.stack || error.message}\n`);
  stream.end();
  process.exit(1);
});
child.on("close", (code, signal) => {
  write(`\nrun_recoverable_build: exit_code=${code}\n`);
  if (signal) write(`run_recoverable_build: signal=${signal}\n`);
  write("run_recoverable_build: output probes\n");
  for (const entry of ["dist", "build", ".next", "out", ".open-next"]) {
    const full = path.join(repoRoot, entry);
    if (!fs.existsSync(full)) {
      write(`- ${entry}: missing\n`);
      continue;
    }
    const stat = fs.statSync(full);
    const count = stat.isDirectory() ? fs.readdirSync(full).length : 1;
    write(`- ${entry}: present (${count} top-level item${count === 1 ? "" : "s"})\n`);
  }
  write(`run_recoverable_build: full log saved to ${path.relative(repoRoot, logFile)}\n`);
  stream.end();
  process.exit(code || 0);
});
