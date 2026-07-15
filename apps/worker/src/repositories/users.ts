import { utcNow } from "./time";

export type UserRow = {
  id: string;
  microsoft_user_id: string;
  tenant_id: string;
  email: string;
  created_at: string;
  updated_at: string;
};

export class UsersRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: {
    id: string;
    microsoftUserId: string;
    tenantId: string;
    email: string;
  }): Promise<UserRow> {
    const now = utcNow();
    await this.db
      .prepare(
        `INSERT INTO users (id, microsoft_user_id, tenant_id, email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(input.id, input.microsoftUserId, input.tenantId, input.email, now, now)
      .run();
    const row = await this.findById(input.id);
    if (!row) throw new Error("User insert failed");
    return row;
  }

  async findById(id: string): Promise<UserRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT id, microsoft_user_id, tenant_id, email, created_at, updated_at
           FROM users WHERE id = ?`,
        )
        .bind(id)
        .first<UserRow>()) ?? null
    );
  }

  async findByMicrosoftIdentity(
    tenantId: string,
    microsoftUserId: string,
  ): Promise<UserRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT id, microsoft_user_id, tenant_id, email, created_at, updated_at
           FROM users WHERE tenant_id = ? AND microsoft_user_id = ?`,
        )
        .bind(tenantId, microsoftUserId)
        .first<UserRow>()) ?? null
    );
  }

  async deleteById(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
  }
}
