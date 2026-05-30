import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import type { ActivityEvent, ActivityEventType } from "@/types/quest";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];

const validTypes: ActivityEventType[] = ["join", "edit", "close", "reminder"];

export async function fetchActivityEvents(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, type, title, body, quest_id, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Could not load activity: ${error.message}`);
  }

  return (data ?? []).map(mapActivityEventRow);
}

export async function markActivityRead(userId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("activity_events")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    throw new Error(`Could not update activity: ${error.message}`);
  }
}

type NewActivityEvent = {
  userId: string;
  actorId: string;
  questId: string;
  type: ActivityEventType;
  title: string;
  body?: string | null;
};

/**
 * Insert activity events for recipients. RLS requires the caller to be the
 * actor (`actor_id`), so this is only used to notify other users about an
 * action the current user performed.
 */
export async function recordActivityEvents(events: NewActivityEvent[]) {
  if (events.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("activity_events").insert(
    events.map((event) => ({
      user_id: event.userId,
      actor_id: event.actorId,
      quest_id: event.questId,
      type: event.type,
      title: event.title,
      body: event.body ?? null,
    })),
  );

  // Activity is a best-effort feed; surface only unexpected failures.
  if (error) {
    throw new Error(`Could not record activity: ${error.message}`);
  }
}

function mapActivityEventRow(
  row: Pick<
    ActivityEventRow,
    "id" | "type" | "title" | "body" | "quest_id" | "read_at" | "created_at"
  >,
): ActivityEvent {
  return {
    id: row.id,
    type: normalizeType(row.type),
    title: row.title,
    body: row.body,
    questId: row.quest_id,
    createdAtISO: row.created_at,
    createdAtRelative: formatRelativeTime(row.created_at),
    isRead: Boolean(row.read_at),
  };
}

function normalizeType(value: string): ActivityEventType {
  return validTypes.find((option) => option === value) ?? "join";
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = Date.now() - date.getTime();
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return "Just now";
  }

  if (diffMs < hourMs) {
    return `${Math.round(diffMs / minuteMs)}m ago`;
  }

  if (diffMs < dayMs) {
    return `${Math.round(diffMs / hourMs)}h ago`;
  }

  return `${Math.round(diffMs / dayMs)}d ago`;
}
