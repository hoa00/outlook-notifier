import { createApp } from "./app";
import type { Env, MailNotificationJob } from "./env";

const app = createApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  // Queue/scheduled handlers are stubs for Foundation — real logic in later stages.
  async queue(
    _batch: MessageBatch<MailNotificationJob>,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // no-op foundation shell
  },

  async scheduled(
    _controller: ScheduledController,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // no-op foundation shell
  },
};
