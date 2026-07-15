import type { ErrorCode } from "./codes";
import { httpStatusFor } from "./codes";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(code: ErrorCode, message?: string, options?: { expose?: boolean }) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = httpStatusFor(code);
    this.expose = options?.expose ?? true;
  }
}

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    correlationId: string;
  };
};

export function toErrorBody(code: ErrorCode, correlationId: string, message?: string): ErrorBody {
  return {
    error: {
      code,
      message: message ?? code,
      correlationId,
    },
  };
}
