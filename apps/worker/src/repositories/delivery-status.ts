import { utcNow } from "./time";

export type DeliveryStatusRow = {
  user_id: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error_code: string | null;
  updated_at: string;
};

export class DeliveryStatusRepository {
  constructor(private readonly db: D1Database) {}

  async markSuccess(userId: string, at = utcNow()): Promise<DeliveryStatusRow> {
    await this.db
      .prepare(
        `INSERT INTO delivery_status
           (user_id, last_success_at, last_failure_at, last_error_code, updated_at)
         VALUES (?, ?, NULL, NULL, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           last_success_at = excluded.last_success_at,
           last_error_code = NULL,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, at, at)
      .run();
    const row = await this.findByUserId(userId);
    if (!row) throw new Error("Delivery status markSuccess failed");
    return row;
  }

  async markFailure(
    userId: string,
    errorCode: string,
    at = utcNow(),
  ): Promise<DeliveryStatusRow> {
    await this.db
      .prepare(
        `INSERT INTO delivery_status
           (user_id, last_success_at, last_failure_at, last_error_code, updated_at)
         VALUES (?, NULL, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           last_failure_at = excluded.last_failure_at,
           last_error_code = excluded.last_error_code,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, at, errorCode, at)
      .run();
    const row = await this.findByUserId(userId);
    if (!row) throw new Error("Delivery status markFailure failed");
    return row;
  }

  async findByUserId(userId: string): Promise<DeliveryStatusRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT user_id, last_success_at, last_failure_at, last_error_code, updated_at
           FROM delivery_status WHERE user_id = ?`,
        )
        .bind(userId)
        .first<DeliveryStatusRow>()) ?? null
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM delivery_status WHERE user_id = ?`).bind(userId).run();
  }
}
