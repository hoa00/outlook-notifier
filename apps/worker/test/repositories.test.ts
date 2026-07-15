import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { applyInitialMigration } from "./helpers/apply-migrations";
import {
  DeliveryStatusRepository,
  GraphSubscriptionsRepository,
  MicrosoftConnectionsRepository,
  NotificationSettingsRepository,
  SessionsRepository,
  TelegramDestinationsRepository,
  UsersRepository,
} from "../src/repositories";
import { syntheticUser, syntheticUserB } from "./fixtures/synthetic";

describe("repositories user isolation + full schema coverage", () => {
  it("covers all foundation tables with user-scoped queries", async () => {
    await applyInitialMigration(env.DB);
    const users = new UsersRepository(env.DB);
    const sessions = new SessionsRepository(env.DB);
    const ms = new MicrosoftConnectionsRepository(env.DB);
    const subs = new GraphSubscriptionsRepository(env.DB);
    const tg = new TelegramDestinationsRepository(env.DB);
    const settings = new NotificationSettingsRepository(env.DB);
    const delivery = new DeliveryStatusRepository(env.DB);

    await users.create({ ...syntheticUser, id: "repo-a" });
    await users.create({ ...syntheticUserB, id: "repo-b" });

    await sessions.create({
      idDigest: "digest-a",
      userId: "repo-a",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await sessions.create({
      idDigest: "digest-b",
      userId: "repo-b",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await ms.upsert({
      userId: "repo-a",
      encryptedRefreshToken: "enc-a",
      tokenKeyVersion: 1,
      grantedScopes: "openid",
      status: "active",
    });
    await ms.upsert({
      userId: "repo-b",
      encryptedRefreshToken: "enc-b",
      tokenKeyVersion: 1,
      grantedScopes: "openid",
      status: "active",
    });

    await subs.upsert({
      id: "sub-a",
      userId: "repo-a",
      clientStateDigest: "cs-a",
      resource: "/me/mailFolders('inbox')/messages",
      changeType: "created",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      status: "active",
    });
    await tg.upsert({
      id: "tg-a",
      userId: "repo-a",
      chatId: "1001",
      chatType: "private",
      status: "active",
    });
    await settings.upsert({
      userId: "repo-a",
      enabled: true,
      showSender: true,
      showSubject: false,
      timezone: "UTC",
    });
    await delivery.markFailure("repo-a", "TG_SEND_FAILED");
    expect((await delivery.findByUserId("repo-a"))?.last_error_code).toBe("TG_SEND_FAILED");
    await delivery.markSuccess("repo-a");
    expect((await delivery.findByUserId("repo-a"))?.last_error_code).toBeNull();

    expect((await ms.findByUserId("repo-a"))?.encrypted_refresh_token).toBe("enc-a");
    expect((await ms.findByUserId("repo-b"))?.encrypted_refresh_token).toBe("enc-b");
    expect(await subs.findByIdForUser("sub-a", "repo-b")).toBeNull();
    expect(await subs.findByIdForUser("sub-a", "repo-a")).not.toBeNull();
    expect(await tg.findByUserId("repo-b")).toBeNull();
    expect((await settings.findByUserId("repo-a"))?.show_subject).toBe(0);
    expect(await delivery.findByUserId("repo-b")).toBeNull();

    await sessions.revoke("digest-a", "repo-a");
    expect(await sessions.findActiveByDigest("digest-a")).toBeNull();
    expect(await sessions.findActiveByDigest("digest-b")).not.toBeNull();
  });
});

