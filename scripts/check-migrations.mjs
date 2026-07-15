#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const MIGRATIONS = join(ROOT, "migrations");
const EMBED = join(
  ROOT,
  "apps/worker/test/helpers/apply-migrations.ts",
);

if (!existsSync(MIGRATIONS)) {
  console.error("migrations/ directory missing");
  process.exit(1);
}

const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) {
  console.error("No migration SQL files found");
  process.exit(1);
}

const firstPath = join(MIGRATIONS, files[0]);
const first = readFileSync(firstPath, "utf8");
const required = [
  "CREATE TABLE users",
  "CREATE TABLE sessions",
  "CREATE TABLE microsoft_connections",
  "CREATE TABLE graph_subscriptions",
  "CREATE TABLE telegram_destinations",
  "CREATE TABLE notification_settings",
  "CREATE TABLE delivery_status",
];

let failed = false;
for (const stmt of required) {
  if (!first.includes(stmt)) {
    console.error(`Missing required statement in ${files[0]}: ${stmt}`);
    failed = true;
  }
}

if (!/id_digest/.test(first)) {
  console.error("sessions table must use id_digest (opaque cookie digest model)");
  failed = true;
}

if (!/PRAGMA foreign_keys = ON/.test(first)) {
  console.error("migration must enable foreign_keys");
  failed = true;
}

// Ensure test embed stays in sync with the real migration (normalize whitespace).
if (existsSync(EMBED)) {
  const embedSrc = readFileSync(EMBED, "utf8");
  const extract = embedSrc.match(/export const INITIAL_MIGRATION_SQL = `([\s\S]*?)`\.trim\(\)/);
  if (!extract) {
    console.error("Could not extract INITIAL_MIGRATION_SQL from test helper");
    failed = true;
  } else {
    const normalize = (s) =>
      s
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((l) => l.trimEnd())
        .join("\n")
        .trim();
    const a = normalize(first);
    const b = normalize(extract[1]);
    const ha = createHash("sha256").update(a).digest("hex");
    const hb = createHash("sha256").update(b).digest("hex");
    if (ha !== hb) {
      console.error(
        "Test migration embed is out of sync with migrations/0001-initial-schema.sql",
      );
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`check-migrations: ok (${files.length} file(s), embed in sync)`);
