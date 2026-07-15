import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppBindings } from "../env";
import { AppError, toErrorBody } from "../errors/app-error";
import { ErrorCode } from "../errors/codes";
import { KillSwitchError } from "../config/feature-flags";
import { createLogger } from "../logging/logger";

const logger = createLogger();

export const errorHandler: ErrorHandler<AppBindings> = (err, c) => {
  const correlationId = c.get("correlationId") ?? "unknown";

  if (err instanceof AppError) {
    logger.log({
      level: err.status >= 500 ? "error" : "warn",
      event: "request_error",
      correlationId,
      route: c.req.path,
      statusClass: statusClass(err.status),
      errorCode: err.code,
    });
    return c.json(
      toErrorBody(err.code, correlationId, err.expose ? err.message : err.code),
      err.status as ContentfulStatusCode,
    );
  }

  if (err instanceof KillSwitchError) {
    return c.json(toErrorBody(ErrorCode.KILL_SWITCH_ACTIVE, correlationId), 503);
  }

  logger.log({
    level: "error",
    event: "unhandled_error",
    correlationId,
    route: c.req.path,
    statusClass: "5xx",
    errorCode: ErrorCode.INTERNAL_ERROR,
  });

  return c.json(toErrorBody(ErrorCode.INTERNAL_ERROR, correlationId), 500);
};

function statusClass(status: number): "2xx" | "3xx" | "4xx" | "5xx" {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}
