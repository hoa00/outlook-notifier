import { utcNow } from "./time";

export type TelegramDestinationRow = {
  id: string;
  user_id: string;
  chat_id: string;
  chat_type: string;
  chat_title: string | null;
  status: string;
  connected_at: string;
  updated_at: string;
};

export class TelegramDestinationsRepository {
  constructor(private readonly db: D1Database) {}

  async upsert(input: {
    id: string;
    userId: string;
    chatId: string;
    chatType: string;
    chatTitle?: string | null;
    status: string;
  }): Promise<TelegramDestinationRow> {
    const now = utcNow();
    await this.db
      .prepare(
        `INSERT INTO telegram_destinations
           (id, user_id, chat_id, chat_type, chat_title, status, connected_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           id = excluded.id,
           chat_id = excluded.chat_id,
           chat_type = excluded.chat_type,
           chat_title = excluded.chat_title,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .bind(
        input.id,
        input.userId,
        input.chatId,
        input.chatType,
        input.chatTitle ?? null,
        input.status,
        now,
        now,
      )
      .run();
    const row = await this.findByUserId(input.userId);
    if (!row) throw new Error("Telegram destination upsert failed");
    return row;
  }

  async findByUserId(userId: string): Promise<TelegramDestinationRow | null> {
    return (
      (await this.db
        .prepare(
          `SELECT id, user_id, chat_id, chat_type, chat_title, status, connected_at, updated_at
           FROM telegram_destinations WHERE user_id = ?`,
        )
        .bind(userId)
        .first<TelegramDestinationRow>()) ?? null
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM telegram_destinations WHERE user_id = ?`)
      .bind(userId)
      .run();
  }
}
