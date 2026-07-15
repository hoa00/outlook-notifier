/**
 * Sanitized Telegram webhook / deep-link PoC harness.
 *
 * Does NOT commit secrets. Configure via environment only.
 * Live run requires: project-owned test bot, two private clients,
 * public HTTPS worker at /spikes/telegram-poc/*.
 *
 * Usage (after deps exist):
 *   pnpm exec tsx scripts/spikes/telegram-webhook-deep-link-poc.ts
 *
 * Required env (never commit real values):
 *   TELEGRAM_BOT_TOKEN       — BotFather token for disposable test bot
 *   TELEGRAM_WEBHOOK_SECRET  — 1-256 chars [A-Za-z0-9_-]
 *   WEBHOOK_URL              — https://…/spikes/telegram-poc/webhook
 * Optional:
 *   EXPECTED_BOT_USERNAME    — abort setWebhook if getMe username mismatches
 *   EXPECTED_BOT_ID          — abort if getMe id mismatches (string)
 *   POC_EVIDENCE_TOKEN       — for worker admin/evidence routes
 *   EVIDENCE_BASE_URL        — https://…/spikes/telegram-poc
 *   SKIP_SET_WEBHOOK=1       — inspect only
 *   SKIP_TEARDOWN=1          — leave webhook (must inventory resource)
 *   CONFIRM_CHAT_ID          — real chat id only in env for sendMessage test
 *   LOCAL_SECRET_MATRIX=1    — POST forged requests to WEBHOOK_URL (no Telegram)
 */

const API = "https://api.telegram.org";

type Assertion =
  | "get_me"
  | "webhook_ownership"
  | "set_webhook"
  | "get_webhook_info"
  | "secret_missing"
  | "secret_wrong"
  | "secret_valid"
  | "deep_link_private_bind"
  | "code_expired"
  | "code_replay"
  | "user_conflict"
  | "chat_conflict"
  | "non_private_reject"
  | "concurrent_redeem"
  | "update_id_dedupe"
  | "bind_confirm_recovery"
  | "send_message_confirm"
  | "ingress_reject"
  | "secret_rotation"
  | "teardown";

type StepResult = "pass" | "fail" | "blocked" | "skipped";

type Step = {
  assertion: Assertion;
  result: StepResult;
  httpStatus?: number;
  telegramErrorCode?: number;
  fieldPresence?: Record<string, "present" | "absent" | "error">;
  notes?: string;
};

type SanitizedTelegramPocEvidence = {
  accessDate: string;
  botApiDocsDate: string;
  steps: Step[];
  placeholdersUsed: string[];
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function accessDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidWebhookSecret(secret: string): boolean {
  return (
    secret.length >= 1 &&
    secret.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(secret)
  );
}

function generateStartCode(): string {
  const bytes = new Uint8Array(16); // 128 bits
  crypto.getRandomValues(bytes);
  // base64url without padding, ≤64 chars
  const b64 = Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return b64;
}

async function telegram(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; ok: boolean; result?: unknown; errorCode?: number }> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { rawType: "non_json", length: text.length };
    }
  }
  const obj =
    json && typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : {};
  const ok = obj.ok === true;
  const errorCode =
    typeof obj.error_code === "number" ? obj.error_code : undefined;
  return {
    status: res.status,
    ok,
    result: obj.result,
    errorCode,
  };
}

function fieldPresence(
  obj: Record<string, unknown> | null | undefined,
  fields: string[],
): Record<string, "present" | "absent" | "error"> {
  if (!obj) {
    return Object.fromEntries(fields.map((f) => [f, "error" as const]));
  }
  const out: Record<string, "present" | "absent" | "error"> = {};
  for (const f of fields) {
    out[f] =
      f in obj && obj[f] !== undefined && obj[f] !== null ? "present" : "absent";
  }
  return out;
}

async function postWebhookRaw(
  url: string,
  opts: {
    secret?: string;
    body?: string | ArrayBuffer;
    contentType?: string;
  },
): Promise<number> {
  const headers: Record<string, string> = {};
  if (opts.contentType) headers["content-type"] = opts.contentType;
  if (opts.secret !== undefined) {
    headers["X-Telegram-Bot-Api-Secret-Token"] = opts.secret;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: opts.body,
  });
  return res.status;
}

async function main(): Promise<void> {
  const steps: Step[] = [];
  const evidence: SanitizedTelegramPocEvidence = {
    accessDate: accessDate(),
    botApiDocsDate: "2026-07-15",
    steps,
    placeholdersUsed: [
      "<botToken>",
      "<webhookSecret>",
      "<botUsername>",
      "<botId>",
      "<chatId>",
      "<userId>",
      "<updateId>",
      "<startCode>",
    ],
  };

  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) {
    steps.push({
      assertion: "get_me",
      result: "blocked",
      notes:
        "No TELEGRAM_BOT_TOKEN. Create a project-owned disposable bot via BotFather, set env, never commit the token.",
    });
    blockRemainingLive(steps);
    printEvidence(evidence);
    return;
  }

  const secret = env("TELEGRAM_WEBHOOK_SECRET");
  if (!secret || !isValidWebhookSecret(secret)) {
    steps.push({
      assertion: "set_webhook",
      result: "blocked",
      notes:
        "Set TELEGRAM_WEBHOOK_SECRET to 1-256 chars matching [A-Za-z0-9_-] per setWebhook docs.",
    });
    blockRemainingLive(steps);
    printEvidence(evidence);
    return;
  }

  // --- getMe ---
  const me = await telegram(token, "getMe");
  if (!me.ok || !me.result || typeof me.result !== "object") {
    steps.push({
      assertion: "get_me",
      result: "fail",
      httpStatus: me.status,
      telegramErrorCode: me.errorCode,
      notes: "getMe failed; token invalid or API error. Description not logged.",
    });
    blockRemainingLive(steps);
    printEvidence(evidence);
    return;
  }

  const meObj = me.result as Record<string, unknown>;
  const username =
    typeof meObj.username === "string" ? meObj.username : undefined;
  const botId =
    typeof meObj.id === "number" || typeof meObj.id === "string"
      ? String(meObj.id)
      : undefined;

  const expectedUser = env("EXPECTED_BOT_USERNAME");
  const expectedId = env("EXPECTED_BOT_ID");
  if (expectedUser && username !== expectedUser) {
    steps.push({
      assertion: "get_me",
      result: "fail",
      notes:
        "EXPECTED_BOT_USERNAME mismatch. Abort before setWebhook. Values not logged.",
    });
    printEvidence(evidence);
    return;
  }
  if (expectedId && botId !== expectedId) {
    steps.push({
      assertion: "get_me",
      result: "fail",
      notes: "EXPECTED_BOT_ID mismatch. Abort before setWebhook.",
    });
    printEvidence(evidence);
    return;
  }

  steps.push({
    assertion: "get_me",
    result: "pass",
    httpStatus: me.status,
    fieldPresence: fieldPresence(meObj, [
      "id",
      "is_bot",
      "username",
      "first_name",
      "can_join_groups",
    ]),
    notes:
      "Bot identity ok as <botId>/<botUsername>. first_name/username values discarded.",
  });

  const webhookUrl = env("WEBHOOK_URL");
  if (!webhookUrl) {
    steps.push({
      assertion: "set_webhook",
      result: "blocked",
      notes:
        "Set WEBHOOK_URL to public HTTPS …/spikes/telegram-poc/webhook on supported ports 443/80/88/8443.",
    });
    blockRemainingLive(steps);
    printEvidence(evidence);
    return;
  }

  // --- webhook ownership (abort before setWebhook on unexpected URL) ---
  const infoBefore = await telegram(token, "getWebhookInfo");
  if (!infoBefore.ok || !infoBefore.result || typeof infoBefore.result !== "object") {
    steps.push({
      assertion: "webhook_ownership",
      result: "fail",
      httpStatus: infoBefore.status,
      telegramErrorCode: infoBefore.errorCode,
      notes: "getWebhookInfo failed before mutation.",
    });
    printEvidence(evidence);
    return;
  }

  const whBefore = infoBefore.result as Record<string, unknown>;
  const currentUrl =
    typeof whBefore.url === "string" ? whBefore.url : "";
  // Allow empty (no webhook) or exact expected spike URL / WEBHOOK_URL.
  const expectedOwnership =
    env("EXPECTED_WEBHOOK_URL") ?? webhookUrl;
  const ownershipOk =
    currentUrl === "" ||
    currentUrl === expectedOwnership ||
    currentUrl === webhookUrl;

  steps.push({
    assertion: "webhook_ownership",
    result: ownershipOk ? "pass" : "fail",
    fieldPresence: fieldPresence(whBefore, [
      "url",
      "pending_update_count",
      "has_custom_certificate",
      "last_error_date",
      "allowed_updates",
    ]),
    notes: ownershipOk
      ? "Webhook URL empty or matches expected spike path. URL value not logged."
      : "Unexpected existing webhook URL. Abort before setWebhook. Set EXPECTED_WEBHOOK_URL if intentional.",
  });
  if (!ownershipOk) {
    printEvidence(evidence);
    return;
  }

  // --- local secret / ingress matrix (does not need Telegram delivery) ---
  if (env("LOCAL_SECRET_MATRIX") === "1") {
    await runLocalMatrix(steps, webhookUrl, secret);
  } else {
    for (const a of [
      "secret_missing",
      "secret_wrong",
      "secret_valid",
      "ingress_reject",
      "update_id_dedupe",
    ] as Assertion[]) {
      steps.push({
        assertion: a,
        result: "skipped",
        notes: "Set LOCAL_SECRET_MATRIX=1 after worker deploy to exercise locally.",
      });
    }
  }

  // --- setWebhook ---
  if (env("SKIP_SET_WEBHOOK") === "1") {
    steps.push({
      assertion: "set_webhook",
      result: "skipped",
      notes: "SKIP_SET_WEBHOOK=1",
    });
  } else {
    const set = await telegram(token, "setWebhook", {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    steps.push({
      assertion: "set_webhook",
      result: set.ok ? "pass" : "fail",
      httpStatus: set.status,
      telegramErrorCode: set.errorCode,
      notes: set.ok
        ? "setWebhook with secret_token + allowed_updates message + drop_pending_updates."
        : "setWebhook failed; URL/port/certificate issue. Description not logged.",
    });
  }

  const infoAfter = await telegram(token, "getWebhookInfo");
  if (infoAfter.ok && infoAfter.result && typeof infoAfter.result === "object") {
    const wh = infoAfter.result as Record<string, unknown>;
    const pending =
      typeof wh.pending_update_count === "number"
        ? wh.pending_update_count
        : undefined;
    steps.push({
      assertion: "get_webhook_info",
      result: pending === 0 ? "pass" : pending === undefined ? "fail" : "fail",
      fieldPresence: fieldPresence(wh, ["url", "pending_update_count", "allowed_updates"]),
      notes:
        pending === 0
          ? "pending_update_count==0 before unique-code matrix."
          : `pending_update_count is ${pending === undefined ? "absent" : "non-zero"}; clear before matrix.`,
    });
  } else {
    steps.push({
      assertion: "get_webhook_info",
      result: "fail",
      httpStatus: infoAfter.status,
      telegramErrorCode: infoAfter.errorCode,
    });
  }

  // Deep-link / multi-client matrices require human clients — mark blocked with instructions.
  const startCode = generateStartCode();
  steps.push({
    assertion: "deep_link_private_bind",
    result: "blocked",
    notes: `Open https://t.me/<botUsername>?start=<startCode> from private client A after seeding code in worker. Generated code entropy=128bit length=${startCode.length}. Code value not printed.`,
  });
  for (const a of [
    "code_expired",
    "code_replay",
    "user_conflict",
    "chat_conflict",
    "non_private_reject",
    "concurrent_redeem",
    "bind_confirm_recovery",
  ] as Assertion[]) {
    steps.push({
      assertion: a,
      result: "blocked",
      notes:
        a === "concurrent_redeem"
          ? "Hard gate: barrier N-way redeem against D1 conditional / durable single-writer. In-memory worker claim is not production proof."
          : "Requires two private clients + seeded codes + evidence review. Not auto-runnable without interactive Telegram clients.",
    });
  }

  const chatId = env("CONFIRM_CHAT_ID");
  if (!chatId) {
    steps.push({
      assertion: "send_message_confirm",
      result: "blocked",
      notes:
        "Set CONFIRM_CHAT_ID only in local env after a successful private bind. Message text must be non-sensitive canary; do not log chat id or text into git.",
    });
  } else {
    const send = await telegram(token, "sendMessage", {
      chat_id: chatId,
      text: "outlook-notifier telegram poc canary",
    });
    steps.push({
      assertion: "send_message_confirm",
      result: send.ok ? "pass" : "fail",
      httpStatus: send.status,
      telegramErrorCode: send.errorCode,
      notes: send.ok
        ? "sendMessage accepted. chat_id and text not logged."
        : "sendMessage failed (blocked bot / invalid chat / etc). description not logged.",
    });
  }

  steps.push({
    assertion: "secret_rotation",
    result: "skipped",
    notes:
      "Classify zero-downtime rotation only after controlled old/new/wrong secret live matrix.",
  });

  // --- teardown ---
  if (env("SKIP_TEARDOWN") === "1") {
    steps.push({
      assertion: "teardown",
      result: "blocked",
      notes:
        "SKIP_TEARDOWN=1. Inventory bot/webhook/route with owner and cleanup date; do not leave untracked.",
    });
  } else {
    const del = await telegram(token, "deleteWebhook", {
      drop_pending_updates: true,
    });
    const info = await telegram(token, "getWebhookInfo");
    let empty = false;
    if (info.ok && info.result && typeof info.result === "object") {
      const wh = info.result as Record<string, unknown>;
      empty =
        (wh.url === "" || wh.url === undefined) &&
        (wh.pending_update_count === 0 || wh.pending_update_count === undefined);
    }
    steps.push({
      assertion: "teardown",
      result: del.ok && empty ? "pass" : "fail",
      httpStatus: del.status,
      telegramErrorCode: del.errorCode,
      notes: del.ok && empty
        ? "deleteWebhook(drop_pending_updates=true) verified empty webhook."
        : "Teardown incomplete; operator must clear webhook and Worker route.",
    });
  }

  printEvidence(evidence);
}

async function fetchMutationCount(): Promise<number | undefined> {
  const base = env("EVIDENCE_BASE_URL");
  const token = env("POC_EVIDENCE_TOKEN");
  if (!base || !token) return undefined;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/evidence`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { mutationCount?: unknown };
    return typeof data.mutationCount === "number" ? data.mutationCount : undefined;
  } catch {
    return undefined;
  }
}

async function runLocalMatrix(
  steps: Step[],
  webhookUrl: string,
  secret: string,
): Promise<void> {
  const mutationsBefore = await fetchMutationCount();

  const missing = await postWebhookRaw(webhookUrl, {
    contentType: "application/json",
    body: JSON.stringify({ update_id: 1, message: { text: "/start x" } }),
  });
  const afterMissing = await fetchMutationCount();
  const missingNoMut =
    mutationsBefore === undefined ||
    afterMissing === undefined ||
    afterMissing === mutationsBefore;
  steps.push({
    assertion: "secret_missing",
    result:
      missing >= 400 && missing < 500 && missingNoMut ? "pass" : "fail",
    httpStatus: missing,
    notes:
      mutationsBefore === undefined
        ? "Missing secret non-2xx. Set EVIDENCE_BASE_URL+POC_EVIDENCE_TOKEN to prove mutationCount unchanged."
        : `Missing secret non-2xx; mutationCount ${missingNoMut ? "unchanged" : "CHANGED"}.`,
  });

  const wrong = await postWebhookRaw(webhookUrl, {
    secret: "wrong-secret-value",
    contentType: "application/json",
    body: JSON.stringify({ update_id: 2, message: { text: "/start x" } }),
  });
  const afterWrong = await fetchMutationCount();
  const wrongNoMut =
    afterMissing === undefined ||
    afterWrong === undefined ||
    afterWrong === afterMissing;
  steps.push({
    assertion: "secret_wrong",
    result: wrong >= 400 && wrong < 500 && wrongNoMut ? "pass" : "fail",
    httpStatus: wrong,
    notes:
      afterMissing === undefined
        ? "Wrong secret non-2xx. Evidence token optional for mutation proof."
        : `Wrong secret non-2xx; mutationCount ${wrongNoMut ? "unchanged" : "CHANGED"}.`,
  });

  const validBody = {
    update_id: 900001,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 1, type: "private" },
      from: { id: 1, is_bot: false, first_name: "x" },
      text: "/start not-seeded-code",
    },
  };
  const valid = await postWebhookRaw(webhookUrl, {
    secret,
    contentType: "application/json",
    body: JSON.stringify(validBody),
  });
  steps.push({
    assertion: "secret_valid",
    result: valid >= 200 && valid < 300 ? "pass" : "fail",
    httpStatus: valid,
    notes: "Valid secret reaches handler (unknown_code is fine).",
  });

  const oversize = await postWebhookRaw(webhookUrl, {
    secret,
    contentType: "application/json",
    body: "x".repeat(300 * 1024),
  });
  const badCt = await postWebhookRaw(webhookUrl, {
    secret,
    contentType: "text/plain",
    body: "{}",
  });
  const badJson = await postWebhookRaw(webhookUrl, {
    secret,
    contentType: "application/json",
    body: "{",
  });
  // Nested object depth > 8
  let deep: unknown = { v: 0 };
  for (let i = 0; i < 12; i++) deep = { n: deep };
  const deepNest = await postWebhookRaw(webhookUrl, {
    secret,
    contentType: "application/json",
    body: JSON.stringify(deep),
  });
  const afterIngress = await fetchMutationCount();
  const ingressNoMut =
    afterWrong === undefined ||
    afterIngress === undefined ||
    afterIngress === afterWrong;
  steps.push({
    assertion: "ingress_reject",
    result:
      oversize === 413 &&
      badCt === 415 &&
      badJson === 400 &&
      deepNest === 400 &&
      ingressNoMut
        ? "pass"
        : "fail",
    httpStatus: oversize,
    notes: `oversize=${oversize} contentType=${badCt} badJson=${badJson} deepNest=${deepNest} mutationStable=${ingressNoMut}`,
  });

  const mutBeforeDup = await fetchMutationCount();
  const dup1 = await postWebhookRaw(webhookUrl, {
    secret,
    contentType: "application/json",
    body: JSON.stringify({ ...validBody, update_id: 900002 }),
  });
  const dup2 = await postWebhookRaw(webhookUrl, {
    secret,
    contentType: "application/json",
    body: JSON.stringify({ ...validBody, update_id: 900002 }),
  });
  const mutAfterDup = await fetchMutationCount();
  // unknown_code path does not bind; mutationCount must not increase on duplicate either
  const dupNoExtraMut =
    mutBeforeDup === undefined ||
    mutAfterDup === undefined ||
    mutAfterDup === mutBeforeDup;
  steps.push({
    assertion: "update_id_dedupe",
    result:
      dup1 >= 200 &&
      dup1 < 300 &&
      dup2 >= 200 &&
      dup2 < 300 &&
      dupNoExtraMut
        ? "pass"
        : "fail",
    httpStatus: dup2,
    notes:
      "Identical update_id must 2xx without second bind; mutationCount checked when evidence token set.",
  });
}

function blockRemainingLive(steps: Step[]): void {
  const present = new Set(steps.map((s) => s.assertion));
  const all: Assertion[] = [
    "webhook_ownership",
    "set_webhook",
    "get_webhook_info",
    "secret_missing",
    "secret_wrong",
    "secret_valid",
    "deep_link_private_bind",
    "code_expired",
    "code_replay",
    "user_conflict",
    "chat_conflict",
    "non_private_reject",
    "concurrent_redeem",
    "update_id_dedupe",
    "bind_confirm_recovery",
    "send_message_confirm",
    "ingress_reject",
    "secret_rotation",
    "teardown",
  ];
  for (const a of all) {
    if (present.has(a)) continue;
    steps.push({
      assertion: a,
      result: "blocked",
      notes: "Blocked on missing prerequisites earlier in harness.",
    });
  }
}

function printEvidence(evidence: SanitizedTelegramPocEvidence): void {
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "unknown_error";
  console.error(
    JSON.stringify({
      accessDate: accessDate(),
      botApiDocsDate: "2026-07-15",
      result: "fail",
      notes: message.includes("Missing")
        ? message
        : "Harness error (message redacted if sensitive).",
    }),
  );
  process.exitCode = 1;
});
