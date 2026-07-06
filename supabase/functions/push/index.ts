// plus1 push pipeline — APNs sender.
//
// Invoked by Postgres AFTER INSERT triggers (via pg_net) with one of:
//   { kind: "activity", record: <activity_events row> }
//   { kind: "message",  record: <messages row> }
//   { kind: "report",   record: <reports row> }
//
// Auth: header `x-push-secret` must equal env PUSH_WEBHOOK_SECRET (else 401).
//
// Sends token-based (ES256 JWT) APNs alert notifications over HTTP/2.
// If APNs credentials are unset the pipeline is dormant: it returns 200 without
// sending. On 410 Unregistered it prunes the dead push_tokens row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

const MODERATOR_HANDLE = Deno.env.get("MODERATOR_HANDLE") ?? "";

const APNS_KEY_P8 = Deno.env.get("APNS_KEY_P8") ?? "";
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID") ?? "";
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID") ?? "";
const APNS_TOPIC = Deno.env.get("APNS_TOPIC") ?? "";

const APNS_PROD = "https://api.push.apple.com";
const APNS_SANDBOX = "https://api.sandbox.push.apple.com";

const service = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

// ---------- APNs auth JWT (ES256, cached ~45min) ----------

let cachedJwt: { token: string; issuedAt: number } | null = null;

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlFromString(str: string): string {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < 45 * 60) {
    return cachedJwt.token;
  }

  const header = { alg: "ES256", kid: APNS_KEY_ID };
  const payload = { iss: APNS_TEAM_ID, iat: now };
  const signingInput =
    b64urlFromString(JSON.stringify(header)) +
    "." +
    b64urlFromString(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(APNS_KEY_P8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  const token = signingInput + "." + b64urlFromBytes(new Uint8Array(sig));
  cachedJwt = { token, issuedAt: now };
  return token;
}

// ---------- APNs send ----------

type Note = {
  title: string;
  body: string;
  threadId: string;
  custom: Record<string, string>;
};

async function sendToToken(
  deviceToken: string,
  note: Note,
): Promise<{ ok: boolean; unregistered: boolean }> {
  const jwt = await apnsJwt();
  const payload = JSON.stringify({
    aps: {
      alert: { title: note.title, body: note.body },
      sound: "default",
      "thread-id": note.threadId,
    },
    ...note.custom,
  });

  const doPost = (base: string) =>
    fetch(`${base}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${jwt}`,
        "apns-topic": APNS_TOPIC,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-collapse-id": note.threadId.slice(0, 64),
      },
      body: payload,
    });

  let res = await doPost(APNS_PROD);

  // Dev-build tokens are minted against the sandbox gateway; retry once there.
  if (res.status === 400) {
    let reason = "";
    try {
      reason = ((await res.clone().json()) as { reason?: string }).reason ?? "";
    } catch {
      // ignore parse failure
    }
    if (reason === "BadDeviceToken") {
      res = await doPost(APNS_SANDBOX);
    }
  }

  if (res.status === 410) {
    return { ok: false, unregistered: true };
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    console.error(`APNs send failed ${res.status}: ${detail}`);
    return { ok: false, unregistered: false };
  }

  return { ok: true, unregistered: false };
}

async function deliver(
  recipientIds: string[],
  note: Note,
): Promise<{ sent: number; recipients: number; tokens: number }> {
  const client = service();
  const uniqueRecipients = [...new Set(recipientIds)].filter(Boolean);
  if (uniqueRecipients.length === 0) {
    return { sent: 0, recipients: 0, tokens: 0 };
  }

  const { data: tokenRows, error } = await client
    .from("push_tokens")
    .select("token")
    .eq("platform", "ios")
    .in("user_id", uniqueRecipients);

  if (error) {
    console.error("push_tokens query failed:", error.message);
    return { sent: 0, recipients: uniqueRecipients.length, tokens: 0 };
  }

  const tokens = (tokenRows ?? []).map((r) => r.token as string);
  let sent = 0;

  for (const token of tokens) {
    const { ok, unregistered } = await sendToToken(token, note);
    if (ok) sent++;
    if (unregistered) {
      await client.from("push_tokens").delete().eq("token", token);
    }
  }

  return { sent, recipients: uniqueRecipients.length, tokens: tokens.length };
}

// ---------- Notification builders ----------

function truncate(text: string, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

type ActivityRecord = {
  user_id: string;
  actor_id: string | null;
  quest_id: string | null;
  title: string;
};

function buildActivity(record: ActivityRecord): {
  recipients: string[];
  note: Note;
} | null {
  // Skip self-authored activity (actor == recipient).
  if (record.actor_id && record.actor_id === record.user_id) {
    return null;
  }
  const custom: Record<string, string> = {};
  if (record.quest_id) custom.questId = record.quest_id;

  return {
    recipients: [record.user_id],
    note: {
      title: "plus1",
      body: record.title ?? "",
      threadId: record.quest_id ?? record.user_id,
      custom,
    },
  };
}

type MessageRecord = {
  thread_id: string;
  sender_id: string;
  body: string;
};

async function buildMessage(
  record: MessageRecord,
): Promise<{ recipients: string[]; note: Note } | null> {
  const client = service();

  const { data: participants, error: partErr } = await client
    .from("message_thread_participants")
    .select("user_id, muted_at")
    .eq("thread_id", record.thread_id);

  if (partErr) {
    console.error("participants query failed:", partErr.message);
    return null;
  }

  const recipients = (participants ?? [])
    .filter((p) => !p.muted_at)
    .map((p) => p.user_id as string)
    .filter((id) => id && id !== record.sender_id);

  if (recipients.length === 0) return null;

  // Sender display name.
  let senderName = "New message";
  const { data: sender } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", record.sender_id)
    .maybeSingle();
  if (sender?.display_name) senderName = sender.display_name;

  // Thread label: event quest title, else "Message".
  let threadLabel = "Message";
  const { data: thread } = await client
    .from("message_threads")
    .select("kind, quest_id")
    .eq("id", record.thread_id)
    .maybeSingle();

  if (thread?.kind === "event" && thread.quest_id) {
    const { data: quest } = await client
      .from("quests")
      .select("title")
      .eq("id", thread.quest_id)
      .maybeSingle();
    if (quest?.title) threadLabel = quest.title;
  }

  return {
    recipients,
    note: {
      title: `${senderName} · ${threadLabel}`,
      body: truncate(record.body, 120),
      threadId: record.thread_id,
      custom: { threadId: record.thread_id },
    },
  };
}

type ReportRecord = {
  id: string;
  target_kind: string;
  reason: string;
  details: string | null;
};

async function buildReport(
  record: ReportRecord,
): Promise<{ recipients: string[]; note: Note } | null> {
  if (!MODERATOR_HANDLE) {
    console.log("MODERATOR_HANDLE not set, skipping report notification");
    return null;
  }

  const client = service();
  const { data: moderator } = await client
    .from("profiles")
    .select("id")
    .eq("handle", MODERATOR_HANDLE)
    .maybeSingle();

  if (!moderator?.id) {
    console.log(`moderator @${MODERATOR_HANDLE} not found, skipping`);
    return null;
  }

  const details = record.details ? ` — ${truncate(record.details, 100)}` : "";

  return {
    recipients: [moderator.id as string],
    note: {
      title: `New report: ${record.target_kind}`,
      body: truncate(`${record.reason}${details}`, 180),
      threadId: `report:${record.id}`,
      custom: { reportId: record.id },
    },
  };
}

// ---------- HTTP entry ----------

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  if (req.headers.get("x-push-secret") !== PUSH_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let payload: { kind?: string; record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad_request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { kind, record } = payload;
  if (!kind || !record) {
    return new Response(JSON.stringify({ error: "missing kind or record" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let built: { recipients: string[]; note: Note } | null = null;
  if (kind === "activity") {
    built = buildActivity(record as unknown as ActivityRecord);
  } else if (kind === "message") {
    built = await buildMessage(record as unknown as MessageRecord);
  } else if (kind === "report") {
    built = await buildReport(record as unknown as ReportRecord);
  } else {
    return new Response(JSON.stringify({ error: "unknown kind" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!built) {
    return new Response(JSON.stringify({ status: "skipped" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Dormant until APNs credentials are provisioned.
  if (!APNS_KEY_P8 || !APNS_KEY_ID) {
    console.log("APNs not configured, skipping");
    return new Response(
      JSON.stringify({ status: "dormant", recipients: built.recipients.length }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const result = await deliver(built.recipients, built.note);
  return new Response(JSON.stringify({ status: "sent", ...result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
