import type { ValidatedEnv } from "../schemas/env";

/**
 * System-wide delivery kill switch.
 * Defaults safe (blocked) when missing or true.
 */
export function isDeliveryEnabled(env: Pick<ValidatedEnv, "NOTIFICATIONS_KILL_SWITCH">): boolean {
  return env.NOTIFICATIONS_KILL_SWITCH === false;
}

export function assertDeliveryEnabled(
  env: Pick<ValidatedEnv, "NOTIFICATIONS_KILL_SWITCH">,
): void {
  if (!isDeliveryEnabled(env)) {
    throw new KillSwitchError();
  }
}

export class KillSwitchError extends Error {
  readonly code = "KILL_SWITCH_ACTIVE" as const;
  constructor() {
    super("Notification delivery is disabled by kill switch");
    this.name = "KillSwitchError";
  }
}
