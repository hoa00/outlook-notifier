import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { applyInitialMigration } from "./helpers/apply-migrations";

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "microsoft_connections",
  "graph_subscriptions",
  "telegram_destinations",
  "notification_settings",
  "delivery_status",
];

const FORBIDDEN_COLUMNS = [
  "subject",
  "sender",
  "body",
  "body_preview",
  "recipients",
  "raw_payload",
  "message_id",
  "from_address",
];

describe("D1 initial migration", () => {
  it("applies from empty and creates approved tables only", async () => {
    await applyInitialMigration(env.DB);
    const tables = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
    ).all<{ name: string }>();
    const names = (tables.results ?? []).map((r: { name: string }) => r.name).sort();
    for (const t of REQUIRED_TABLES) {
      expect(names).toContain(t);
    }
    expect(names).not.toContain("messages");
    expect(names).not.toContain("emails");
    expect(names).not.toContain("notifications_history");
  });

  it("has no forbidden email/raw-payload columns", async () => {
    await applyInitialMigration(env.DB);
    for (const table of REQUIRED_TABLES) {
      const cols = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
      const colNames = (cols.results ?? []).map((c: { name: string }) => c.name.toLowerCase());
      for (const forbidden of FORBIDDEN_COLUMNS) {
        expect(colNames).not.toContain(forbidden);
      }
    }
  });
});
