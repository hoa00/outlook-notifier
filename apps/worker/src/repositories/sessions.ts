import { utcNow } from "./time";

export type SessionRow = {
  id_digest: string;
  user_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_seen_at: string;
};

export class SessionsRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: {
    idDigest: string;
    userId: string;
    expiresAt: string;
  }): Promise<SessionRow> {
    const now = utcNow();
    await this.db
      .prepare(
        `INSERT INTO sessions (id_digest, user_id, expires_at, revoked_at, created_at, last_seen_at)
         VALUES (?, ?, ?, NULL, ?, ?)`,
      )
      .bind(input.idDigest, input.userId, input.expiresAt, now, now)
      .run();
    const row = await this.findByDigest(input.idDigest);
    if (!row) throw new Error("Session insert failed");
    return row;
  }

  async findByDigest(idDigest: string): Promise<SessionRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT id_digest, user_id, expires_at, revoked_at, created_at, last_seen_at
           FROM sessions WHERE id_digest = ?`,
        )
        .bind(idDigest)
        .first<SessionRow>()) ?? null
    );
  }

  async touch(idDigest: string, userId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE sessions SET last_seen_at = ?
         WHERE id_digest = ? AND user_id = ? AND revoked_at IS NULL`,
      )
      .bind(utcNow(), idDigest, userId)
      .run();
  }

  async revoke(idDigest: string, userId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE sessions SET revoked_at = ?
         WHERE id_digest = ? AND user_id = ? AND revoked_at IS NULL`,
      )
      .bind(utcNow(), idDigest, userId)
      .run();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE sessions SET revoked_at = ?
         WHERE user_id = ? AND revoked_at IS NULL`,
      )
      .bind(utcNow(), userId)
      .run();
  }

  async findActiveByDigest(idDigest: string, nowIso = utcNow()): Promise<SessionRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT id_digest, user_id, expires_at, revoked_at, created_at, last_seen_at
           FROM sessions
           WHERE id_digest = ?
             AND revoked_at IS NULL
             AND expires_at > ?`,
        )
        .bind(idDigest, nowIso)
        .first<SessionRow>()) ?? null
    );
  }
}
