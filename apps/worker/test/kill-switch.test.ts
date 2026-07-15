import { describe, expect, it } from "vitest";
import {
  KillSwitchError,
  assertDeliveryEnabled,
  isDeliveryEnabled,
} from "../src/config/feature-flags";
import { FakeTelegramAdapter } from "../src/adapters/telegram";
import { sendNotification } from "../src/services/delivery";

describe("notification kill switch", () => {
  it("defaults to blocked when kill switch is true", () => {
    expect(isDeliveryEnabled({ NOTIFICATIONS_KILL_SWITCH: true })).toBe(false);
  });

  it("allows delivery only when explicitly false", () => {
    expect(isDeliveryEnabled({ NOTIFICATIONS_KILL_SWITCH: false })).toBe(true);
  });

  it("prevents delivery service invocation when active", async () => {
    const telegram = new FakeTelegramAdapter();
    await expect(
      sendNotification({ NOTIFICATIONS_KILL_SWITCH: true }, telegram, "1", "hello"),
    ).rejects.toBeInstanceOf(KillSwitchError);
    expect(telegram.sent).toHaveLength(0);
  });

  it("assertDeliveryEnabled throws KillSwitchError", () => {
    expect(() => assertDeliveryEnabled({ NOTIFICATIONS_KILL_SWITCH: true })).toThrow(
      KillSwitchError,
    );
  });
});
