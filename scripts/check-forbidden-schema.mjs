#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MIGRATIONS = join(ROOT, "migrations");

const FORBIDDEN = [
  /\bCREATE\s+TABLE\s+(messages|emails|notifications_history)\b/i,
  /\b(subject|sender|body_preview|raw_payload|recipients)\s+(TEXT|BLOB)/i,
];

const ALLOWED_FALSE_POSITIVES = [
  // none — keep strict
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".sql")) out.push(p);
  }
  return out;
}

let failed = false;
for (const file of walk(MIGRATIONS)) {
  const content = readFileSync(file, "utf8");
  for (const pattern of FORBIDDEN) {
    if (pattern.test(content)) {
      const rel = relative(ROOT, file);
      if (ALLOWED_FALSE_POSITIVES.some((a) => a.test(content))) continue;
      console.error(`Forbidden schema pattern ${pattern} in ${rel}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log("check-forbidden-schema: ok");
