import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../env";
import { generateCorrelationId } from "../session/crypto";

const HEADER = "x-correlation-id";

export const correlationMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const incoming = c.req.header(HEADER);
  const correlationId =
    incoming && /^[a-f0-9-]{8,64}$/i.test(incoming) ? incoming : generateCorrelationId();
  c.set("correlationId", correlationId);
  await next();
  c.header(HEADER, correlationId);
});
