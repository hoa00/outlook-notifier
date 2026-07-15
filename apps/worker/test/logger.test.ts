import { describe, expect, it } from "vitest";
import { LoggerRejectionError, createLogger } from "../src/logging/logger";

describe("allowlist logger", () => {
  it("serializes only technical fields", () => {
    const lines: string[] = [];
    const logger = createLogger((line) => lines.push(line));
    logger.log({
      level: "info",
      event: "request_ok",
      correlationId: "c1",
      route: "/health",
      statusClass: "2xx",
      durationMs: 3,
    });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed).toEqual({
      level: "info",
      event: "request_ok",
      correlationId: "c1",
      route: "/health",
      statusClass: "2xx",
      durationMs: 3,
    });
  });

  it("rejects forbidden fields like subject/sender/token", () => {
    const logger = createLogger(() => undefined);
    expect(() =>
      logger.log({
        level: "info",
        event: "bad",
        correlationId: "c1",
        // @ts-expect-error intentional forbidden field
        subject: "Invoice",
      }),
    ).toThrow(LoggerRejectionError);

    expect(() =>
      logger.log({
        level: "info",
        event: "bad",
        correlationId: "c1",
        // @ts-expect-error intentional forbidden field
        token: "secret",
      }),
    ).toThrow(LoggerRejectionError);
  });

  it("rejects sensitive string patterns", () => {
    const logger = createLogger(() => undefined);
    expect(() =>
      logger.log({
        level: "error",
        event: "leak",
        correlationId: "c1",
        errorCode: "Bearer abc.def.ghi",
      }),
    ).toThrow(LoggerRejectionError);
  });
});
