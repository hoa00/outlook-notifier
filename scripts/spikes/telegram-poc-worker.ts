/**
 * Disposable Cloudflare Worker for Telegram webhook PoC.
 *
 * Routes (under public hostname, e.g. https://outlook-notifier.hoadev.com):
 *   GET  /spikes/telegram-poc/health
 *   POST /spikes/telegram-poc/webhook
 *   GET  /spikes/telegram-poc/evidence   — sanitized structural summary only
 *   POST /spikes/telegram-poc/admin/reset — clear in-memory state (evidence token)
 *   POST /spikes/telegram-poc/admin/seed  — seed link codes for matrix (evidence token)
 *
 * Deploy only for the spike; tear down routes after evidence capture.
 * Request-body logging is intentionally absent.
 */

type BindOutcome =
  | "bound"
  | "expired"
  | "replayed"
  | "user_conflict"
  | "chat_conflict"
  | "non_private"
  | "invalid_schema"
  | "unsupported_update"
  | "duplicate_update"
  | "no_code"
  | "unknown_code";

type SanitizedEvent = {
  receivedAt: string;
  kind:
    | "webhook_reject"
    | "webhook_accept"
    | "bind_attempt"
    | "admin";
  reason?: string;
  outcome?: BindOutcome;
  chatType?: string;
  hasUpdateId: boolean;
  hasMessage: boolean;
  hasStartCommand: boolean;
  fieldPresence?: Record<string, "present" | "absent">;
};

type LinkCode = {
  userPlaceholder: string;
  expiresAtMs: number;
  consumed: boolean;
};

type Destination = {
  userPlaceholder: string;
  chatPlaceholder: string;
  state: "pending" | "bound-confirmation-pending" | "active";
};

export interface Env {
  TELEGRAM_WEBHOOK_SECRET?: string;
  POC_EVIDENCE_TOKEN?: string;
  /** Max raw body bytes before reject (default 256 KiB). */
  POC_MAX_BODY_BYTES?: string;
}

const MAX_BODY_DEFAULT = 256 * 1024;

const events: SanitizedEvent[] = [];
const seenUpdateIds = new Set<string>();
const linkCodes = new Map<string, LinkCode>();
const destinationsByUser = new Map<string, Destination>();
const destinationsByChat = new Map<string, Destination>();

let mutationCount = 0;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function unauthorized(): Response {
  return json({ ok: false, error: "unauthorized" }, 401);
}

function requireEvidenceAuth(request: Request, env: Env): boolean {
  const expected = env.POC_EVIDENCE_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    let acc = 0;
    for (let i = 0; i < ab.length; i++) acc |= ab[i]!;
    return false;
  }
  let out = 0;
  for (let i = 0; i < ab.length; i++) out |= ab[i]! ^ bb[i]!;
  return out === 0;
}

function maxBody(env: Env): number {
  const raw = env.POC_MAX_BODY_BYTES;
  if (!raw) return MAX_BODY_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : MAX_BODY_DEFAULT;
}

function pushEvent(e: SanitizedEvent): void {
  events.push(e);
  if (events.length > 200) events.shift();
}

function parseStartCode(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const m = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/);
  if (!m) return undefined;
  const code = m[1]?.trim();
  return code && code.length > 0 ? code : undefined;
}

function claimCode(
  code: string,
  chatType: string,
  chatPlaceholder: string,
): BindOutcome {
  if (chatType !== "private") return "non_private";

  const entry = linkCodes.get(code);
  if (!entry) return "unknown_code";
  if (entry.consumed) return "replayed";
  if (Date.now() > entry.expiresAtMs) return "expired";

  // App user is the seed-time owner of the bearer code — not Telegram from.id.
  const appUser = entry.userPlaceholder;

  const existingUser = destinationsByUser.get(appUser);
  if (existingUser && existingUser.chatPlaceholder !== chatPlaceholder) {
    return "user_conflict";
  }
  const existingChat = destinationsByChat.get(chatPlaceholder);
  if (existingChat && existingChat.userPlaceholder !== appUser) {
    return "chat_conflict";
  }

  // Sequential claim only — not a production concurrency proof.
  // Live Phase 2 must still race candidate durable primitives.
  entry.consumed = true;
  const dest: Destination = {
    userPlaceholder: appUser,
    chatPlaceholder,
    state: "bound-confirmation-pending",
  };
  destinationsByUser.set(appUser, dest);
  destinationsByChat.set(chatPlaceholder, dest);
  mutationCount += 1;
  return "bound";
}

/** Reject JSON with excessive nesting (DoS / parser abuse). */
function jsonDepth(value: unknown, max = 8): number {
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) {
    let d = 0;
    for (const item of value) d = Math.max(d, jsonDepth(item, max));
    return 1 + d;
  }
  let d = 0;
  for (const v of Object.values(value as Record<string, unknown>)) {
    d = Math.max(d, jsonDepth(v, max));
    if (1 + d > max) return 1 + d;
  }
  return 1 + d;
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: "server_misconfigured",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: false, error: "misconfigured" }, 500);
  }

  const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!timingSafeEqual(header, secret)) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: header.length === 0 ? "secret_missing" : "secret_wrong",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    // Non-2xx so Telegram may retry; no mutation performed.
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: "content_type",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }

  const limit = maxBody(env);
  const raw = await request.arrayBuffer();
  if (raw.byteLength > limit) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: "body_too_large",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: "invalid_json",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (jsonDepth(body) > 8) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: "json_too_deep",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: false, error: "payload_too_complex" }, 400);
  }

  if (!body || typeof body !== "object") {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: "invalid_schema",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: false, error: "invalid_schema" }, 400);
  }

  const update = body as Record<string, unknown>;
  const updateId =
    typeof update.update_id === "number" || typeof update.update_id === "string"
      ? String(update.update_id)
      : undefined;

  if (!updateId) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_reject",
      reason: "missing_update_id",
      hasUpdateId: false,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: false, error: "invalid_schema" }, 400);
  }

  if (seenUpdateIds.has(updateId)) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_accept",
      outcome: "duplicate_update",
      hasUpdateId: true,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: true, duplicate: true }, 200);
  }
  seenUpdateIds.add(updateId);

  const message =
    update.message && typeof update.message === "object"
      ? (update.message as Record<string, unknown>)
      : undefined;

  if (!message) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "webhook_accept",
      outcome: "unsupported_update",
      hasUpdateId: true,
      hasMessage: false,
      hasStartCommand: false,
    });
    return json({ ok: true, ignored: true }, 200);
  }

  const chat =
    message.chat && typeof message.chat === "object"
      ? (message.chat as Record<string, unknown>)
      : undefined;
  const from =
    message.from && typeof message.from === "object"
      ? (message.from as Record<string, unknown>)
      : undefined;
  const text = typeof message.text === "string" ? message.text : undefined;
  const chatType = typeof chat?.type === "string" ? chat.type : "unknown";
  const startCode = parseStartCode(text);

  const fieldPresence: Record<string, "present" | "absent"> = {
    update_id: "present",
    message: "present",
    "message.chat": chat ? "present" : "absent",
    "message.chat.id": chat && chat.id !== undefined ? "present" : "absent",
    "message.chat.type": chat && typeof chat.type === "string" ? "present" : "absent",
    "message.from": from ? "present" : "absent",
    "message.from.id": from && from.id !== undefined ? "present" : "absent",
    "message.text": text !== undefined ? "present" : "absent",
  };

  if (!startCode) {
    pushEvent({
      receivedAt: new Date().toISOString(),
      kind: "bind_attempt",
      outcome: "no_code",
      chatType,
      hasUpdateId: true,
      hasMessage: true,
      hasStartCommand: false,
      fieldPresence,
    });
    return json({ ok: true, ignored: true }, 200);
  }

  // Distinct chat placeholders without logging raw ids (Telegram chat only).
  // App-user identity comes from the seeded link code, not message.from.
  const chatPlaceholder =
    chat && chat.id !== undefined
      ? `<chatId:${hashShort(String(chat.id))}>`
      : "<chatId:missing>";

  const outcome = claimCode(startCode, chatType, chatPlaceholder);

  pushEvent({
    receivedAt: new Date().toISOString(),
    kind: "bind_attempt",
    outcome,
    chatType,
    hasUpdateId: true,
    hasMessage: true,
    hasStartCommand: true,
    fieldPresence,
  });

  return json({ ok: true, outcome }, 200);
}

/** Short non-reversible tag so two different ids stay distinct in evidence. */
function hashShort(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).slice(0, 8);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/spikes/telegram-poc/health" && request.method === "GET") {
      return json({ ok: true, purpose: "telegram-webhook-deep-link-poc" });
    }

    if (path === "/spikes/telegram-poc/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    if (path === "/spikes/telegram-poc/evidence" && request.method === "GET") {
      if (!requireEvidenceAuth(request, env)) return unauthorized();
      return json({
        count: events.length,
        mutationCount,
        linkCodeCount: linkCodes.size,
        destinationCount: destinationsByUser.size,
        seenUpdateCount: seenUpdateIds.size,
        items: events.slice(-50),
        note: "Structural only; no tokens, chat ids, usernames, or message text. In-memory store may be empty after isolate recycle. Concurrent redeem is not proven by this worker alone.",
      });
    }

    if (path === "/spikes/telegram-poc/admin/reset" && request.method === "POST") {
      if (!requireEvidenceAuth(request, env)) return unauthorized();
      events.length = 0;
      seenUpdateIds.clear();
      linkCodes.clear();
      destinationsByUser.clear();
      destinationsByChat.clear();
      mutationCount = 0;
      pushEvent({
        receivedAt: new Date().toISOString(),
        kind: "admin",
        reason: "reset",
        hasUpdateId: false,
        hasMessage: false,
        hasStartCommand: false,
      });
      return json({ ok: true });
    }

    if (path === "/spikes/telegram-poc/admin/seed" && request.method === "POST") {
      if (!requireEvidenceAuth(request, env)) return unauthorized();
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "invalid_json" }, 400);
      }
      const codes = (body as { codes?: unknown })?.codes;
      if (!Array.isArray(codes)) {
        return json({ ok: false, error: "codes_required" }, 400);
      }
      let seeded = 0;
      for (const item of codes) {
        if (!item || typeof item !== "object") continue;
        const c = item as Record<string, unknown>;
        const code = typeof c.code === "string" ? c.code : undefined;
        const userPlaceholder =
          typeof c.userPlaceholder === "string"
            ? c.userPlaceholder
            : "<userId:seed>";
        const ttlSec =
          typeof c.ttlSec === "number" && c.ttlSec > 0 ? c.ttlSec : 600;
        if (!code || code.length > 64) continue;
        if (!/^[A-Za-z0-9_-]+$/.test(code)) continue;
        linkCodes.set(code, {
          userPlaceholder,
          expiresAtMs: Date.now() + ttlSec * 1000,
          consumed: c.consumed === true,
        });
        seeded += 1;
      }
      pushEvent({
        receivedAt: new Date().toISOString(),
        kind: "admin",
        reason: "seed",
        hasUpdateId: false,
        hasMessage: false,
        hasStartCommand: false,
        fieldPresence: { seeded: seeded > 0 ? "present" : "absent" },
      });
      return json({ ok: true, seeded });
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
