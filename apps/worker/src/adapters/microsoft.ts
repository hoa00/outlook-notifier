/**
 * Microsoft Graph adapter contract — fakes only until Chặng 2+.
 * No live SDK wiring in Foundation.
 */

export type MicrosoftProfile = {
  microsoftUserId: string;
  tenantId: string;
  email: string;
};

export type MicrosoftMessageMeta = {
  id: string;
  subject: string;
  from: string;
  receivedDateTime: string;
};

export interface MicrosoftAdapter {
  getProfile(): Promise<MicrosoftProfile>;
  getMessageMeta(messageId: string): Promise<MicrosoftMessageMeta | null>;
}

export class FakeMicrosoftAdapter implements MicrosoftAdapter {
  constructor(
    private readonly profile: MicrosoftProfile = {
      microsoftUserId: "ms-user-test",
      tenantId: "tenant-test",
      email: "user@example.test",
    },
    private readonly messages: Map<string, MicrosoftMessageMeta> = new Map(),
  ) {}

  async getProfile(): Promise<MicrosoftProfile> {
    return this.profile;
  }

  async getMessageMeta(messageId: string): Promise<MicrosoftMessageMeta | null> {
    return this.messages.get(messageId) ?? null;
  }

  setMessage(meta: MicrosoftMessageMeta): void {
    this.messages.set(meta.id, meta);
  }
}
