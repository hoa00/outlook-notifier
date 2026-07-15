import { assertDeliveryEnabled } from "../config/feature-flags";
import type { ValidatedEnv } from "../schemas/env";
import type { TelegramAdapter } from "../adapters/telegram";

/**
 * Delivery service shell — kill switch gates any send invocation.
 */
export async function sendNotification(
  env: Pick<ValidatedEnv, "NOTIFICATIONS_KILL_SWITCH">,
  telegram: TelegramAdapter,
  chatId: string,
  text: string,
): Promise<void> {
  assertDeliveryEnabled(env);
  const result = await telegram.sendMessage(chatId, text);
  if (!result.ok) {
    throw new Error(result.errorCode ?? "TG_SEND_FAILED");
  }
}
