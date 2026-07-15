#!/usr/bin/env node
/**
 * Scans source/fixtures for likely real runtime secrets and resource IDs.
 * Documented placeholders and synthetic test values are allowlisted.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".wrangler",
  "dist",
  "coverage",
  "plans",
  "docs",
]);

const SKIP_FILES = new Set(["check-secrets.mjs", "package-lock.json", "pnpm-lock.yaml"]);

const PATTERNS = [
  { name: "private-key-pem", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "aws-access-key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "github-pat", re: /ghp_[A-Za-z0-9]{36}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  {
    name: "high-entropy-jwt",
    re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  },
  {
    name: "telegram-bot-token",
    re: /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/,
  },
  {
    name: "public-https-url",
    re: /https:\/\/(?!localhost\b|127\.0\.0\.1\b|example\.|[\w-]+\.example\.)[a-z0-9.-]+\.[a-z]{2,}/i,
  },
  {
    name: "non-placeholder-uuid",
    re: /\b(?!00000000-0000-0000-0000-[0-9a-f]{12}\b)[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  },
];

/** Paths that may contain documented historical spike hosts / comments only. */
const PATH_ALLOWLIST = [
  /^scripts\/spikes\//,
  /^\.dev\.vars\.example$/,
  /^apps\/worker\/test\//,
  /^apps\/worker\/vitest\.config\.ts$/,
  /^apps\/worker\/wrangler\.jsonc$/,
];

function isPathAllowlisted(rel) {
  return PATH_ALLOWLIST.some((re) => re.test(rel));
}

function isLineAllowlisted(rel, line) {
  if (isPathAllowlisted(rel)) {
    // Still block private keys / AWS / GitHub PATs even in allowlisted paths.
    if (
      /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line) ||
      /AKIA[0-9A-Z]{16}/.test(line) ||
      /ghp_[A-Za-z0-9]{36}/.test(line)
    ) {
      return false;
    }
    return true;
  }
  // Placeholder tokens in foundation source are ok when explicitly TEST_/example.
  if (/TEST_|example_bot|common|localhost|00000000-0000-0000-0000-/.test(line)) {
    // But reject real-looking Telegram tokens even with TEST_ prefix if format matches
    // unless clearly labeled PLACEHOLDER.
    if (/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/.test(line) && !/PLACEHOLDER|TEST_TELEGRAM/.test(line)) {
      return false;
    }
    return true;
  }
  return false;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (
      !SKIP_FILES.has(name) &&
      /\.(ts|tsx|js|mjs|cjs|json|jsonc|yml|yaml|sql|txt|example)$/i.test(name)
    ) {
      out.push(p);
    }
  }
  return out;
}

let failed = false;
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  if (rel.startsWith("docs/") || rel.startsWith("plans/")) continue;
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isLineAllowlisted(rel, line)) continue;
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        console.error(`${rel}:${i + 1}: matched ${name}`);
        failed = true;
      }
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log("check-secrets: ok");
