import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            ENVIRONMENT: "test",
            NOTIFICATIONS_KILL_SWITCH: "true",
            TOKEN_KEY_VERSION: "1",
            MICROSOFT_TENANT: "common",
            TELEGRAM_BOT_USERNAME: "example_bot",
            APP_BASE_URL: "http://localhost:8787",
            MICROSOFT_CLIENT_ID: "00000000-0000-0000-0000-000000000010",
            MICROSOFT_CLIENT_SECRET: "test-microsoft-client-secret",
            TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
            TELEGRAM_BOT_TOKEN: "000000000:TEST_TELEGRAM_BOT_TOKEN_PLACEHOLDER",
            TELEGRAM_WEBHOOK_SECRET: "test-telegram-webhook-secret",
            SESSION_SECRET: "test-session-secret-32chars-min!!",
          },
        },
      },
    },
  },
});
