/**
 * Disposable Cloudflare Worker for Graph webhook validation + notification capture.
 *
 * Routes (under public hostname, e.g. https://outlook-notifier.hoadev.com):
 *   GET  /spikes/graph-poc/health
 *   GET  /spikes/graph-poc/oauth/callback  — placeholder; tokens stay out of logs
 *   POST /spikes/graph-poc/notifications
 *   POST /spikes/graph-poc/lifecycle
 *   GET  /spikes/graph-poc/evidence        — sanitized structural summary only
 *
 * Deploy only for the spike; tear down routes after evidence capture.
 * Request-body logging is intentionally absent.
 */

type SanitizedNotification = {
  receivedAt: string;
  kind: "change" | "lifecycle" | "validation";
  changeType?: string;
  lifecycleEvent?: string;
  hasSubscriptionId: boolean;
  hasResource: boolean;
  hasResourceDataId: boolean;
  hasClientState: boolean;
  hasTenantId: boolean;
  resourcePattern?: string;
};

export interface Env {
  // Optional shared secret for reading /evidence; set via wrangler secret.
  POC_EVIDENCE_TOKEN?: string;
}

const store: SanitizedNotification[] = [];

function textPlain(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Redact concrete IDs from resource paths for evidence. */
function resourcePattern(resource: string | undefined): string | undefined {
  if (!resource) return undefined;
  return resource
    .replace(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
      "<guid>",
    )
    .replace(/Messages\('[^']+'\)/gi, "Messages('<messageId>')")
    .replace(/messages\('[^']+'\)/gi, "messages('<messageId>')")
    .replace(/Users\('[^']+'\)/gi, "Users('<userId>')")
    .replace(/users\/[^/]+/gi, "users/<userId>");
}

async function handleValidationOrBody(
  request: Request,
  kind: "change" | "lifecycle",
): Promise<Response> {
  const url = new URL(request.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken !== null) {
    // Graph requires URL-decoded plain text within 10s.
    store.push({
      receivedAt: new Date().toISOString(),
      kind: "validation",
    });
    return textPlain(validationToken, 200);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const value = (body as { value?: unknown[] })?.value;
  if (!Array.isArray(value)) {
    return json({ ok: false, error: "missing_value" }, 400);
  }

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const n = item as Record<string, unknown>;
    const resourceData =
      n.resourceData && typeof n.resourceData === "object"
        ? (n.resourceData as Record<string, unknown>)
        : undefined;

    store.push({
      receivedAt: new Date().toISOString(),
      kind: typeof n.lifecycleEvent === "string" ? "lifecycle" : kind,
      changeType: typeof n.changeType === "string" ? n.changeType : undefined,
      lifecycleEvent:
        typeof n.lifecycleEvent === "string" ? n.lifecycleEvent : undefined,
      hasSubscriptionId: typeof n.subscriptionId === "string",
      hasResource: typeof n.resource === "string",
      hasResourceDataId: typeof resourceData?.id === "string",
      hasClientState: typeof n.clientState === "string",
      hasTenantId: typeof n.tenantId === "string",
      resourcePattern: resourcePattern(
        typeof n.resource === "string" ? n.resource : undefined,
      ),
    });
  }

  // Prefer 202 after queueing; PoC has no queue — still return quickly.
  return new Response(null, { status: 202 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/spikes/graph-poc/health" && request.method === "GET") {
      return json({ ok: true, purpose: "graph-permission-subscription-poc" });
    }

    if (
      path === "/spikes/graph-poc/oauth/callback" &&
      request.method === "GET"
    ) {
      // Do not log query (may contain code). Operator extracts code offline.
      return textPlain(
        "oauth_callback_ok: exchange code offline; do not log query string",
        200,
      );
    }

    if (
      path === "/spikes/graph-poc/notifications" &&
      request.method === "POST"
    ) {
      return handleValidationOrBody(request, "change");
    }

    if (path === "/spikes/graph-poc/lifecycle" && request.method === "POST") {
      return handleValidationOrBody(request, "lifecycle");
    }

    if (path === "/spikes/graph-poc/evidence" && request.method === "GET") {
      const auth = request.headers.get("authorization") ?? "";
      const expected = env.POC_EVIDENCE_TOKEN;
      if (!expected || auth !== `Bearer ${expected}`) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      return json({
        count: store.length,
        items: store.slice(-50),
        note: "Structural only; no tokens, subjects, or raw payloads. In-memory store may be empty after isolate recycle.",
      });
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
