import type { ValidatedEnv } from "./schemas/env";
import { parseEnv } from "./schemas/env";

/** Queue job shape — technical IDs only, no email metadata. */
export type MailNotificationJob = {
  version: 1;
  userId: string;
  subscriptionId: string;
  resourceId: string;
  receivedAt: string;
  correlationId: string;
};

/**
 * Cloudflare binding + config contract.
 * Names only — no real resource IDs or secrets in source.
 */
export type Env = {
  DB: D1Database;
  APP_KV: KVNamespace;
  MAIL_QUEUE: Queue<MailNotificationJob>;
  ENVIRONMENT: string;
  NOTIFICATIONS_KILL_SWITCH: string;
  TOKEN_KEY_VERSION: string;
  MICROSOFT_TENANT: string;
  TELEGRAM_BOT_USERNAME: string;
  APP_BASE_URL: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  SESSION_SECRET: string;
};

export type AppBindings = {
  Bindings: Env;
  Variables: {
    correlationId: string;
    validatedEnv?: ValidatedEnv;
    sessionId: string | null;
    userId: string | null;
    csrfToken: string | null;
  };
};

export function validateBindings(env: Env): ValidatedEnv {
  return parseEnv({
    ENVIRONMENT: env.ENVIRONMENT,
    NOTIFICATIONS_KILL_SWITCH: env.NOTIFICATIONS_KILL_SWITCH,
    TOKEN_KEY_VERSION: env.TOKEN_KEY_VERSION,
    MICROSOFT_TENANT: env.MICROSOFT_TENANT,
    TELEGRAM_BOT_USERNAME: env.TELEGRAM_BOT_USERNAME,
    APP_BASE_URL: env.APP_BASE_URL,
    MICROSOFT_CLIENT_ID: env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: env.MICROSOFT_CLIENT_SECRET,
    TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY,
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: env.TELEGRAM_WEBHOOK_SECRET,
    SESSION_SECRET: env.SESSION_SECRET,
  });
}
