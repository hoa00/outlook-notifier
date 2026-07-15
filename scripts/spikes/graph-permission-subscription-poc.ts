/**
 * Sanitized delegated Graph permission/subscription PoC harness.
 *
 * Does NOT commit secrets. Configure via environment only.
 * Live run requires: Entra app, test mailboxes, public HTTPS worker.
 *
 * Usage (after deps exist):
 *   pnpm exec tsx scripts/spikes/graph-permission-subscription-poc.ts
 *
 * Required env (never commit real values):
 *   GRAPH_ACCESS_TOKEN   — short-lived delegated token for one track
 *   POC_TRACK            — personal | work_school_isolated | work_school_consent_blocked
 *   NOTIFICATION_URL     — https://outlook-notifier.hoadev.com/.../notifications
 *   LIFECYCLE_URL        — https://outlook-notifier.hoadev.com/.../lifecycle
 *   PERMISSION_ATTEMPTED — Mail.ReadBasic | Mail.Read (default Mail.ReadBasic)
 *   MESSAGE_ID           — optional; after a real notification, set for GET test
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

type Track =
  | "personal"
  | "work_school_isolated"
  | "work_school_consent_blocked";

type Permission = "Mail.ReadBasic" | "Mail.Read";

type Assertion =
  | "oauth_token"
  | "create_subscription"
  | "validation_handshake"
  | "basic_notification"
  | "message_get"
  | "consent_policy";

type StepResult = "pass" | "fail" | "blocked" | "skipped";

type Step = {
  assertion: Assertion;
  result: StepResult;
  httpStatus?: number;
  graphErrorCode?: string;
  fieldPresence?: Record<string, "present" | "absent" | "error">;
  notes?: string;
};

type SanitizedPocEvidence = {
  accessDate: string;
  graphVersion: "v1.0";
  track: Track;
  cloud: "global";
  permissionAttempted: Permission;
  steps: Step[];
  placeholdersUsed: string[];
};

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function accessDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function expirationDateTime(minutes = 4200): string {
  // Conservative default well under 10080 (basic max) and under 1440 if rich ever used.
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toISOString();
}

function randomClientState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function graphJson(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown; errorCode?: string }> {
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
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
  const errorCode =
    json &&
    typeof json === "object" &&
    json !== null &&
    "error" in json &&
    typeof (json as { error?: { code?: string } }).error?.code === "string"
      ? (json as { error: { code: string } }).error.code
      : undefined;
  return { status: res.status, json, errorCode };
}

function fieldPresence(
  obj: Record<string, unknown> | null,
  fields: string[],
): Record<string, "present" | "absent" | "error"> {
  if (!obj) {
    return Object.fromEntries(fields.map((f) => [f, "error" as const]));
  }
  const out: Record<string, "present" | "absent" | "error"> = {};
  for (const f of fields) {
    out[f] = f in obj && obj[f] !== undefined && obj[f] !== null ? "present" : "absent";
  }
  return out;
}

async function main(): Promise<void> {
  const steps: Step[] = [];
  const track = (env("POC_TRACK") ?? "work_school_isolated") as Track;
  const permissionAttempted = (env("PERMISSION_ATTEMPTED") ??
    "Mail.ReadBasic") as Permission;

  const evidence: SanitizedPocEvidence = {
    accessDate: accessDate(),
    graphVersion: "v1.0",
    track,
    cloud: "global",
    permissionAttempted,
    steps,
    placeholdersUsed: [
      "<subscriptionId>",
      "<messageId>",
      "<userId>",
      "<tenantId>",
      "<token>",
      "<clientState>",
    ],
  };

  if (track === "work_school_consent_blocked") {
    steps.push({
      assertion: "consent_policy",
      result: "blocked",
      notes:
        "Record OAuth denial only. Map product error to unsupported_tenant_consent_policy. Do not open admin-consent URL.",
    });
    steps.push({
      assertion: "oauth_token",
      result: "skipped",
      notes: "Skipped after consent policy denial.",
    });
    printEvidence(evidence);
    return;
  }

  const token = env("GRAPH_ACCESS_TOKEN");
  if (!token) {
    steps.push({
      assertion: "oauth_token",
      result: "blocked",
      notes:
        "No GRAPH_ACCESS_TOKEN. Provision Entra app + user consent, then re-run. Do not paste tokens into git.",
    });
    printEvidence(evidence);
    return;
  }

  const me = await graphJson(token, "GET", "/me?$select=id");
  if (me.status !== 200) {
    steps.push({
      assertion: "oauth_token",
      result: "fail",
      httpStatus: me.status,
      graphErrorCode: me.errorCode,
      notes: "Token present but GET /me failed; not treated as valid delegated session.",
    });
    printEvidence(evidence);
    return;
  }
  steps.push({
    assertion: "oauth_token",
    result: "pass",
    httpStatus: me.status,
    notes: "GET /me succeeded. Token and user id not logged.",
  });

  const notificationUrl = env("NOTIFICATION_URL");
  const lifecycleUrl = env("LIFECYCLE_URL");
  if (!notificationUrl || !lifecycleUrl) {
    steps.push({
      assertion: "create_subscription",
      result: "blocked",
      notes:
        "Set NOTIFICATION_URL and LIFECYCLE_URL to public HTTPS endpoints that echo validationToken as 200 text/plain.",
    });
    printEvidence(evidence);
    return;
  }

  const clientState = randomClientState();
  const createBody = {
    changeType: "created",
    notificationUrl,
    lifecycleNotificationUrl: lifecycleUrl,
    resource: "/me/mailFolders('inbox')/messages",
    expirationDateTime: expirationDateTime(4200),
    clientState,
  };

  const create = await graphJson(token, "POST", "/subscriptions", createBody);
  let subscriptionId: string | undefined;
  if (
    create.status === 201 &&
    create.json &&
    typeof create.json === "object" &&
    "id" in create.json &&
    typeof (create.json as { id?: unknown }).id === "string"
  ) {
    subscriptionId = (create.json as { id: string }).id;
  }

  if (create.status === 201) {
    steps.push({
      assertion: "create_subscription",
      result: "pass",
      httpStatus: create.status,
      notes:
        "Subscription created as <subscriptionId>. clientState not logged. Harness will attempt DELETE cleanup.",
    });
    steps.push({
      assertion: "validation_handshake",
      result: "pass",
      notes:
        "Implied by 201 Created (Graph validated notificationUrl/lifecycleNotificationUrl). Confirm worker never logs token body.",
    });
  } else {
    steps.push({
      assertion: "create_subscription",
      result: "fail",
      httpStatus: create.status,
      graphErrorCode: create.errorCode,
      notes:
        "Baseline failed. Do not auto-retry with Mail.Read. Review evidence, then set PERMISSION_ATTEMPTED=Mail.Read for one isolated comparison.",
    });
    steps.push({
      assertion: "validation_handshake",
      result: create.status === 400 ? "fail" : "skipped",
      httpStatus: create.status,
      graphErrorCode: create.errorCode,
      notes: "If Graph returns 400 on validation, fix endpoint before permission conclusions.",
    });
  }

  // Notification shape is observed on the worker, not in this script.
  steps.push({
    assertion: "basic_notification",
    result: "skipped",
    notes:
      "Trigger a synthetic non-sensitive test email. On worker, record field names only: subscriptionId, changeType, resource, resourceData.id presence. Replace IDs with placeholders before writing docs.",
  });

  const messageId = env("MESSAGE_ID");
  if (!messageId) {
    steps.push({
      assertion: "message_get",
      result: "skipped",
      notes: "Set MESSAGE_ID=<id from notification> after sanitizing locally; never commit the id.",
    });
  } else {
    const select =
      "id,subject,from,sender,receivedDateTime,webLink";
    const get = await graphJson(
      token,
      "GET",
      `/me/messages/${encodeURIComponent(messageId)}?$select=${select}`,
    );
    if (get.status === 200 && get.json && typeof get.json === "object") {
      const obj = get.json as Record<string, unknown>;
      steps.push({
        assertion: "message_get",
        result: "pass",
        httpStatus: get.status,
        fieldPresence: fieldPresence(obj, select.split(",")),
        notes: "Values discarded; only presence recorded.",
      });
    } else {
      steps.push({
        assertion: "message_get",
        result: "fail",
        httpStatus: get.status,
        graphErrorCode: get.errorCode,
        fieldPresence: Object.fromEntries(
          select.split(",").map((f) => [f, "error" as const]),
        ),
      });
    }
  }

  if (subscriptionId) {
    const del = await graphJson(
      token,
      "DELETE",
      `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    );
    steps.push({
      assertion: "create_subscription",
      result: del.status === 204 ? "pass" : "fail",
      httpStatus: del.status,
      graphErrorCode: del.errorCode,
      notes:
        del.status === 204
          ? "Cleanup DELETE /subscriptions/<subscriptionId> succeeded."
          : "Cleanup DELETE failed; operator must delete <subscriptionId> manually.",
    });
  }

  printEvidence(evidence);
}

function printEvidence(evidence: SanitizedPocEvidence): void {
  // Single JSON line group for copy into docs/spikes after manual review.
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "unknown_error";
  console.error(
    JSON.stringify({
      accessDate: accessDate(),
      graphVersion: "v1.0",
      result: "fail",
      notes: message.includes("Missing env")
        ? message
        : "Harness error (message redacted if sensitive).",
    }),
  );
  process.exitCode = 1;
});
