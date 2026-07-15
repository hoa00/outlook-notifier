import { describe, expect, it } from "vitest";
import { serializeCookie, sessionCookieOptions } from "../src/session/cookie";

describe("session cookie serialization", () => {
  it("emits HttpOnly Secure SameSite=Lax for production", () => {
    const value = serializeCookie("sid", "opaque-id", sessionCookieOptions(true, 3600));
    expect(value).toBe("sid=opaque-id; Path=/; SameSite=Lax; HttpOnly; Secure; Max-Age=3600");
  });
});
