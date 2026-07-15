import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv, secretFields } from "../src/schemas/env";

const valid = {
  ENVIRONMENT: "test",
  NOTIFICATIONS_KILL_SWITCH: "true",
  TOKEN_KEY_VERSION: "1",
  MICROSOFT_TENANT: "common",
  TELEGRAM_BOT_USERNAME: "example_bot",
  APP_BASE_URL: "http://localhost:8787",
  MICROSOFT_CLIENT_ID: "00000000-0000-0000-0000-000000000010",
  MICROSOFT_CLIENT_SECRET: "test-secret-value",
  TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  TELEGRAM_BOT_TOKEN: "000000000:TEST_TOKEN",
  TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
  SESSION_SECRET: "test-session-secret-32chars-min!!",
};

describe("env schema", () => {
  it("accepts placeholder/test values", () => {
    const parsed = parseEnv(valid);
    expect(parsed.ENVIRONMENT).toBe("test");
    expect(parsed.NOTIFICATIONS_KILL_SWITCH).toBe(true);
  });

  it("rejects missing required fields without logging secret values", () => {
    const incomplete = { ...valid };
    delete (incomplete as { MICROSOFT_CLIENT_SECRET?: string }).MICROSOFT_CLIENT_SECRET;
    try {
      parseEnv(incomplete);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const message = (err as EnvValidationError).message;
      expect(message).toContain("MICROSOFT_CLIENT_SECRET");
      expect(message).not.toContain("test-secret-value");
      for (const field of secretFields) {
        const value = (valid as Record<string, string>)[field];
        if (value) expect(message).not.toContain(value);
      }
    }
  });

  it("rejects invalid APP_BASE_URL type", () => {
    expect(() => parseEnv({ ...valid, APP_BASE_URL: "not-a-url" })).toThrow(EnvValidationError);
  });
});
