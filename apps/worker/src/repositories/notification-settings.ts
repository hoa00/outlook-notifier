import { utcNow } from "./time";

export type NotificationSettingsRow = {
  user_id: string;
  enabled: number;
  show_sender: number;
  show_subject: number;
  timezone: string;
  updated_at: string;
};

export class NotificationSettingsRepository {
  constructor(private readonly db: D1Database) {}

  async upsert(input: {
    userId: string;
    enabled: boolean;
    showSender: boolean;
    showSubject: boolean;
    timezone: string;
  }): Promise<NotificationSettingsRow> {
    const now = utcNow();
    await this.db
      .prepare(
        `INSERT INTO notification_settings
           (user_id, enabled, show_sender, show_subject, timezone, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           enabled = excluded.enabled,
           show_sender = excluded.show_sender,
           show_subject = excluded.show_subject,
           timezone = excluded.timezone,
           updated_at = excluded.updated_at`,
      )
      .bind(
        input.userId,
        input.enabled ? 1 : 0,
        input.showSender ? 1 : 0,
        input.showSubject ? 1 : 0,
        input.timezone,
        now,
      )
      .run();
    const row = await this.findByUserId(input.userId);
    if (!row) throw new Error("Notification settings upsert failed");
    return row;
  }

  async findByUserId(userId: string): Promise<NotificationSettingsRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT user_id, enabled, show_sender, show_subject, timezone, updated_at
           FROM notification_settings WHERE user_id = ?`,
        )
        .bind(userId)
        .first<NotificationSettingsRow>()) ?? null
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM notification_settings WHERE user_id = ?`)
      .bind(userId)
      .run();
  }
}
