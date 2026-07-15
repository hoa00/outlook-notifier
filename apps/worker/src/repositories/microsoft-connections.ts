import { utcNow } from "./time";

export type MicrosoftConnectionRow = {
  user_id: string;
  encrypted_refresh_token: string;
  token_key_version: number;
  granted_scopes: string;
  status: string;
  connected_at: string;
  updated_at: string;
};

export class MicrosoftConnectionsRepository {
  constructor(private readonly db: D1Database) {}

  async upsert(input: {
    userId: string;
    encryptedRefreshToken: string;
    tokenKeyVersion: number;
    grantedScopes: string;
    status: string;
  }): Promise<MicrosoftConnectionRow> {
    const now = utcNow();
    await this.db
      .prepare(
        `INSERT INTO microsoft_connections
           (user_id, encrypted_refresh_token, token_key_version, granted_scopes, status, connected_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           encrypted_refresh_token = excluded.encrypted_refresh_token,
           token_key_version = excluded.token_key_version,
           granted_scopes = excluded.granted_scopes,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .bind(
        input.userId,
        input.encryptedRefreshToken,
        input.tokenKeyVersion,
        input.grantedScopes,
        input.status,
        now,
        now,
      )
      .run();
    const row = await this.findByUserId(input.userId);
    if (!row) throw new Error("Microsoft connection upsert failed");
    return row;
  }

  async findByUserId(userId: string): Promise<MicrosoftConnectionRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT user_id, encrypted_refresh_token, token_key_version, granted_scopes, status, connected_at, updated_at
           FROM microsoft_connections WHERE user_id = ?`,
        )
        .bind(userId)
        .first<MicrosoftConnectionRow>()) ?? null
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM microsoft_connections WHERE user_id = ?`)
      .bind(userId)
      .run();
  }
}
