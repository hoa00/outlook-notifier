/**
 * Telegram Bot API adapter contract — fakes only until Chặng 3+.
 */

export type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
  errorCode?: string;
};

export interface TelegramAdapter {
  getMe(): Promise<{ id: number; username: string }>;
  sendMessage(chatId: string, text: string): Promise<TelegramSendResult>;
}

export class FakeTelegramAdapter implements TelegramAdapter {
  readonly sent: Array<{ chatId: string; text: string }> = [];
  private blocked = false;

  async getMe(): Promise<{ id: number; username: string }> {
    return { id: 1, username: "example_bot" };
  }

  async sendMessage(chatId: string, text: string): Promise<TelegramSendResult> {
    if (this.blocked) {
      return { ok: false, errorCode: "TG_DESTINATION_BLOCKED" };
    }
    this.sent.push({ chatId, text });
    return { ok: true, messageId: this.sent.length };
  }

  setBlocked(blocked: boolean): void {
    this.blocked = blocked;
  }
}
