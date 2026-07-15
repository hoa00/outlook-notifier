import { utcNow } from "./time";

export type GraphSubscriptionRow = {
  id: string;
  user_id: string;
  client_state_digest: string;
  resource: string;
  change_type: string;
  expires_at: string;
  status: string;
  last_renewed_at: string | null;
  last_error_code: string | null;
  updated_at: string;
};

export class GraphSubscriptionsRepository {
  constructor(private readonly db: D1Database) {}

  async upsert(input: {
    id: string;
    userId: string;
    clientStateDigest: string;
    resource: string;
    changeType: string;
    expiresAt: string;
    status: string;
  }): Promise<GraphSubscriptionRow> {
    const now = utcNow();
    await this.db
      .prepare(
        `INSERT INTO graph_subscriptions
           (id, user_id, client_state_digest, resource, change_type, expires_at, status, last_renewed_at, last_error_code, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           id = excluded.id,
           client_state_digest = excluded.client_state_digest,
           resource = excluded.resource,
           change_type = excluded.change_type,
           expires_at = excluded.expires_at,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .bind(
        input.id,
        input.userId,
        input.clientStateDigest,
        input.resource,
        input.changeType,
        input.expiresAt,
        input.status,
        now,
      )
      .run();
    const row = await this.findByUserId(input.userId);
    if (!row) throw new Error("Graph subscription upsert failed");
    return row;
  }

  async findByUserId(userId: string): Promise<GraphSubscriptionRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT id, user_id, client_state_digest, resource, change_type, expires_at, status,
                  last_renewed_at, last_error_code, updated_at
           FROM graph_subscriptions WHERE user_id = ?`,
        )
        .bind(userId)
        .first<GraphSubscriptionRow>()) ?? null
    );
  }

  async findByIdForUser(id: string, userId: string): Promise<GraphSubscriptionRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT id, user_id, client_state_digest, resource, change_type, expires_at, status,
                  last_renewed_at, last_error_code, updated_at
           FROM graph_subscriptions WHERE id = ? AND user_id = ?`,
        )
        .bind(id, userId)
        .first<GraphSubscriptionRow>()) ?? null
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM graph_subscriptions WHERE user_id = ?`)
      .bind(userId)
      .run();
  }
}
