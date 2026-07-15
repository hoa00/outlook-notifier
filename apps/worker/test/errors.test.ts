import { describe, expect, it } from "vitest";
import { AppError, toErrorBody } from "../src/errors/app-error";
import { ErrorCode, httpStatusFor } from "../src/errors/codes";

describe("error taxonomy", () => {
  it("maps codes to stable HTTP statuses", () => {
    expect(httpStatusFor(ErrorCode.UNAUTHORIZED)).toBe(401);
    expect(httpStatusFor(ErrorCode.CSRF_FAILED)).toBe(403);
    expect(httpStatusFor(ErrorCode.KILL_SWITCH_ACTIVE)).toBe(503);
    expect(httpStatusFor(ErrorCode.INTERNAL_ERROR)).toBe(500);
  });

  it("error body never includes upstream detail fields", () => {
    const body = toErrorBody(ErrorCode.MS_GRAPH_RATE_LIMITED, "corr-1");
    expect(body).toEqual({
      error: {
        code: "MS_GRAPH_RATE_LIMITED",
        message: "MS_GRAPH_RATE_LIMITED",
        correlationId: "corr-1",
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/graph\.microsoft|stack|token/i);
  });

  it("AppError exposes stable code", () => {
    const err = new AppError(ErrorCode.SESSION_REVOKED);
    expect(err.code).toBe("SESSION_REVOKED");
    expect(err.status).toBe(401);
  });
});
