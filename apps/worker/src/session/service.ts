import { SessionsRepository } from "../repositories/sessions";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  csrfCookieOptions,
  parseCookieHeader,
  serializeCookie,
  sessionCookieOptions,
} from "./cookie";
import { digestSessionId, generateCsrfToken, generateSessionId } from "./crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionService = {
  create(userId: string, isProduction: boolean): Promise<{
    sessionId: string;
    csrfToken: string;
    setCookies: string[];
  }>;
  resolve(
    cookieHeader: string | null | undefined,
  ): Promise<{ sessionId: string; userId: string; csrfToken: string | null } | null>;
  revoke(
    sessionId: string,
    userId: string,
    isProduction: boolean,
  ): Promise<{ setCookies: string[] }>;
  rotate(
    oldSessionId: string,
    userId: string,
    isProduction: boolean,
  ): Promise<{
    sessionId: string;
    csrfToken: string;
    setCookies: string[];
  }>;
};

export function createSessionService(db: D1Database, sessionSecret: string): SessionService {
  const sessions = new SessionsRepository(db);

  return {
    async create(userId, isProduction) {
      const sessionId = generateSessionId();
      const idDigest = await digestSessionId(sessionId, sessionSecret);
      const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
      await sessions.create({ idDigest, userId, expiresAt });
      const csrfToken = generateCsrfToken();
      const sidOpts = sessionCookieOptions(isProduction, SESSION_TTL_SECONDS);
      const csrfOpts = csrfCookieOptions(isProduction, SESSION_TTL_SECONDS);
      return {
        sessionId,
        csrfToken,
        setCookies: [
          serializeCookie(SESSION_COOKIE, sessionId, sidOpts),
          serializeCookie(CSRF_COOKIE, csrfToken, csrfOpts),
        ],
      };
    },

    async resolve(cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const sessionId = cookies[SESSION_COOKIE];
      if (!sessionId) return null;
      const idDigest = await digestSessionId(sessionId, sessionSecret);
      const row = await sessions.findActiveByDigest(idDigest);
      if (!row) return null;
      await sessions.touch(idDigest, row.user_id);
      return {
        sessionId,
        userId: row.user_id,
        csrfToken: cookies[CSRF_COOKIE] ?? null,
      };
    },

    async revoke(sessionId, userId, isProduction) {
      const idDigest = await digestSessionId(sessionId, sessionSecret);
      await sessions.revoke(idDigest, userId);
      const sidOpts = sessionCookieOptions(isProduction, 0);
      const csrfOpts = csrfCookieOptions(isProduction, 0);
      return {
        setCookies: [clearCookie(SESSION_COOKIE, sidOpts), clearCookie(CSRF_COOKIE, csrfOpts)],
      };
    },

    async rotate(oldSessionId, userId, isProduction) {
      const idDigest = await digestSessionId(oldSessionId, sessionSecret);
      await sessions.revoke(idDigest, userId);
      return this.create(userId, isProduction);
    },
  };
}
