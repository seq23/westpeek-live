#!/usr/bin/env node
// Single JSONC-safe reader for wrangler.jsonc.
//
// Root cause this exists to kill: the deploy workflow used to verify the Worker
// target with `node -e 'require("./wrangler.jsonc")'`. Node has no loader for the
// .jsonc extension, so it treats the file as CommonJS JavaScript and throws on
// the leading `"$schema"` token. Plain `JSON.parse` on the raw text is only
// marginally better: it works right now purely because wrangler.jsonc happens to
// carry no comments, and dies the moment anyone uses the format as intended.
//
// Comments are stripped (string- and escape-aware) and trailing commas removed
// before parsing, so the target guard keeps working whatever the file looks like.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

export const EXPECTED_WORKER_NAME = 'west-peek-live';
// worker.ts answers the signed upload before OpenNext and hands everything else to .open-next/worker.js.
export const EXPECTED_WORKER_MAIN = 'worker.ts';

export function stripJsonComments(source) {
  let out = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      } else if (ch === '\n') {
        out += ch;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    out += ch;
  }

  // Trailing commas are legal in JSONC and fatal to JSON.parse.
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function readWranglerConfig(root = process.cwd()) {
  const file = path.join(root, 'wrangler.jsonc');
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  try {
    return JSON.parse(stripJsonComments(raw));
  } catch (error) {
    throw new Error(`wrangler.jsonc is not parseable JSONC: ${error.message}`);
  }
}

export function verifyWorkerTarget(root = process.cwd()) {
  const config = readWranglerConfig(root);
  const failures = [];
  if (config.name !== EXPECTED_WORKER_NAME) {
    failures.push(`Unexpected Cloudflare Worker name: ${config.name}`);
  }
  if (config.main !== EXPECTED_WORKER_MAIN) {
    failures.push(`Unexpected Cloudflare Worker entrypoint: ${config.main}`);
  }
  return { config, failures };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  try {
    const { config, failures } = verifyWorkerTarget();
    if (failures.length) {
      console.error(failures.join('\n'));
      process.exit(1);
    }
    console.log(`Worker target: ${config.name} (${config.main})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
