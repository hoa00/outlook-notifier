/**
 * Allowlisted structured logger.
 * Only known technical fields may be serialized — no free-form objects.
 */

export type LogLevel = "info" | "warn" | "error";

export type TechnicalEvent = {
  level: LogLevel;
  event: string;
  correlationId: string;
  route?: string;
  statusClass?: "2xx" | "3xx" | "4xx" | "5xx";
  errorCode?: string;
  durationMs?: number;
  retryCount?: number;
  /** Pseudonymized / hashed user id only — never raw email. */
  userIdHash?: string;
};

const FORBIDDEN_KEYS = new Set([
  "authorization",
  "cookie",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "subject",
  "sender",
  "from",
  "body",
  "bodyPreview",
  "recipients",
  "to",
  "cc",
  "bcc",
  "email",
  "raw",
  "payload",
  "message",
  "content",
  "bot_token",
  "webhook_secret",
]);

const ALLOWED_KEYS = new Set([
  "level",
  "event",
  "correlationId",
  "route",
  "statusClass",
  "errorCode",
  "durationMs",
  "retryCount",
  "userIdHash",
]);

export class LoggerRejectionError extends Error {
  readonly code = "LOGGER_REJECTION";
  constructor(reason: string) {
    super(reason);
    this.name = "LoggerRejectionError";
  }
}

function assertAllowlisted(event: TechnicalEvent): void {
  for (const key of Object.keys(event)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new LoggerRejectionError(`Disallowed log field: ${key}`);
    }
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new LoggerRejectionError(`Forbidden log field: ${key}`);
    }
  }
}

function assertNoSensitiveStrings(event: TechnicalEvent): void {
  for (const [key, value] of Object.entries(event)) {
    if (typeof value !== "string") continue;
    const lower = value.toLowerCase();
    if (
      lower.includes("bearer ") ||
      lower.includes("access_token") ||
      lower.includes("refresh_token") ||
      lower.includes("bot_token")
    ) {
      throw new LoggerRejectionError(`Sensitive pattern in ${key}`);
    }
  }
}

export type LogSink = (line: string) => void;

const defaultSink: LogSink = (line) => {
  console.warn(line);
};

export function createLogger(sink: LogSink = defaultSink) {
  return {
    log(event: TechnicalEvent): void {
      assertAllowlisted(event);
      assertNoSensitiveStrings(event);
      const payload: TechnicalEvent = {
        level: event.level,
        event: event.event,
        correlationId: event.correlationId,
      };
      if (event.route !== undefined) payload.route = event.route;
      if (event.statusClass !== undefined) payload.statusClass = event.statusClass;
      if (event.errorCode !== undefined) payload.errorCode = event.errorCode;
      if (event.durationMs !== undefined) payload.durationMs = event.durationMs;
      if (event.retryCount !== undefined) payload.retryCount = event.retryCount;
      if (event.userIdHash !== undefined) payload.userIdHash = event.userIdHash;
      sink(JSON.stringify(payload));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
