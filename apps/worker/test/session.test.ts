import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { applyInitialMigration } from "./helpers/apply-migrations";
import { UsersRepository } from "../src/repositories/users";
import { SessionsRepository } from "../src/repositories/sessions";
import { createSessionService } from "../src/session/service";
import { digestSessionId } from "../src/session/crypto";
import { SESSION_COOKIE, parseCookieHeader, sessionCookieOptions } from "../src/session/cookie";
import { syntheticUser } from "./fixtures/synthetic";

const SECRET = env.SESSION_SECRET;

describe("opaque session shell", () => {
  it("stores only digest server-side and cookie holds opaque id", async () => {
    await applyInitialMigration(env.DB);
    const users = new UsersRepository(env.DB);
    await users.create({ ...syntheticUser, id: "sess-user-1" });
    const service = createSessionService(env.DB, SECRET);
    const created = await service.create("sess-user-1", true);

    expect(created.sessionId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(created.setCookies[0]).toContain(`${SESSION_COOKIE}=${created.sessionId}`);
    expect(created.setCookies[0]).toContain("HttpOnly");
    expect(created.setCookies[0]).toContain("Secure");
    expect(created.setCookies[0]).toContain("SameSite=Lax");

    const digest = await digestSessionId(created.sessionId, SECRET);
    const row = await new SessionsRepository(env.DB).findByDigest(digest);
    expect(row).not.toBeNull();
    expect(row!.id_digest).toBe(digest);
    expect(row!.user_id).toBe("sess-user-1");
    expect(JSON.stringify(row)).not.toContain(created.sessionId);
  });

  it("revokes immediately so resolve returns null", async () => {
    await applyInitialMigration(env.DB);
    const users = new UsersRepository(env.DB);
    await users.create({ ...syntheticUser, id: "sess-user-2" });
    const service = createSessionService(env.DB, SECRET);
    const created = await service.create("sess-user-2", false);
    const cookie = created.setCookies.map((c) => c.split(";")[0]).join("; ");

    const before = await service.resolve(cookie);
    expect(before?.userId).toBe("sess-user-2");

    await service.revoke(created.sessionId, "sess-user-2", false);
    const after = await service.resolve(cookie);
    expect(after).toBeNull();
  });

  it("rotation invalidates old session id", async () => {
    await applyInitialMigration(env.DB);
    const users = new UsersRepository(env.DB);
    await users.create({ ...syntheticUser, id: "sess-user-3" });
    const service = createSessionService(env.DB, SECRET);
    const first = await service.create("sess-user-3", false);
    const rotated = await service.rotate(first.sessionId, "sess-user-3", false);

    expect(rotated.sessionId).not.toBe(first.sessionId);
    const oldCookie = `${SESSION_COOKIE}=${first.sessionId}`;
    expect(await service.resolve(oldCookie)).toBeNull();
    const newCookie = rotated.setCookies.map((c) => c.split(";")[0]).join("; ");
    expect((await service.resolve(newCookie))?.userId).toBe("sess-user-3");
  });

  it("rejects expired sessions", async () => {
    await applyInitialMigration(env.DB);
    const users = new UsersRepository(env.DB);
    await users.create({ ...syntheticUser, id: "sess-user-4" });
    const sessions = new SessionsRepository(env.DB);
    const sessionId = "opaque-expired-session-id";
    const digest = await digestSessionId(sessionId, SECRET);
    await sessions.create({
      idDigest: digest,
      userId: "sess-user-4",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const service = createSessionService(env.DB, SECRET);
    expect(await service.resolve(`${SESSION_COOKIE}=${sessionId}`)).toBeNull();
    expect(await sessions.findActiveByDigest(digest)).toBeNull();
  });

  it("cookie defaults are secure outside local test", () => {
    const prod = sessionCookieOptions(true, 3600);
    expect(prod.httpOnly).toBe(true);
    expect(prod.secure).toBe(true);
    expect(prod.sameSite).toBe("Lax");

    const local = sessionCookieOptions(false, 3600);
    expect(local.secure).toBe(false);
  });

  it("parseCookieHeader extracts values", () => {
    const parsed = parseCookieHeader("sid=abc; csrf=xyz");
    expect(parsed.sid).toBe("abc");
    expect(parsed.csrf).toBe("xyz");
  });
});
