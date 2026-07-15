import { z } from "zod";

const nonEmpty = z.string().min(1);

/** Secret fields never appear in error messages or logs. */
const SECRET_FIELDS = [
  "MICROSOFT_CLIENT_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "SESSION_SECRET",
] as const;

export type SecretField = (typeof SECRET_FIELDS)[number];

export const secretFields: readonly SecretField[] = SECRET_FIELDS;

export const envSchema = z.object({
  ENVIRONMENT: z.enum(["development", "test", "production"]).default("development"),
  NOTIFICATIONS_KILL_SWITCH: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  TOKEN_KEY_VERSION: nonEmpty,
  MICROSOFT_TENANT: nonEmpty,
  TELEGRAM_BOT_USERNAME: nonEmpty,
  APP_BASE_URL: z.string().url(),
  MICROSOFT_CLIENT_ID: nonEmpty,
  MICROSOFT_CLIENT_SECRET: nonEmpty,
  TOKEN_ENCRYPTION_KEY: nonEmpty,
  TELEGRAM_BOT_TOKEN: nonEmpty,
  TELEGRAM_WEBHOOK_SECRET: nonEmpty,
  SESSION_SECRET: nonEmpty.min(16),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  readonly code = "ENV_VALIDATION_FAILED";
  readonly fields: string[];

  constructor(fields: string[]) {
    // Never include values — field names only.
    super(`Environment validation failed for: ${fields.join(", ")}`);
    this.name = "EnvValidationError";
    this.fields = fields;
  }
}

export function parseEnv(input: Record<string, unknown>): ValidatedEnv {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "unknown"))),
    ];
    throw new EnvValidationError(fields);
  }
  return result.data;
}

export function isSecretField(name: string): name is SecretField {
  return (SECRET_FIELDS as readonly string[]).includes(name);
}
