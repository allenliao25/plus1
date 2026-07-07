import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import { isMissingRelationError } from "@/lib/schemaCompat";
import type {
  ActivityActor,
  ActivityEvent,
  ActivityEventType,
  ActivityFriendRequest,
  ActivityQuestSummary,
  QuestCategory,
} from "@/types/quest";

type ActivityEventRow = Database["public"]["Tables"]["activity_events"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type QuestRow = Database["public"]["Tables"]["quests"]["Row"];
type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];

const validTypes: ActivityEventType[] = [
  "join",
  "edit",
  "close",
  "reminder",
  "invite",
  "friend_request",
  "friend_accept",
  "friend_free",
];

export async function fetchActivityEvents(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, type, title, body, actor_id, quest_id, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Could not load activity: ${error.message}`);
  }

  const rows = data ?? [];
  const actorIds = uniqueValues(rows.map((row) => row.actor_id));
  const questIds = uniqueValues(rows.map((row) => row.quest_id));

  const [actorsById, questsById, friendRequestsByActorId] = await Promise.all([
    fetchActivityActors(actorIds),
    fetchActivityQuests(questIds),
    fetchPendingFriendRequests(userId, rows),
  ]);

  return rows.map((row) =>
    mapActivityEventRow(
      row,
      actorsById.get(row.actor_id ?? ""),
      questsById.get(row.quest_id ?? ""),
      friendRequestsByActorId.get(row.actor_id ?? ""),
    ),
  );
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
  questId?: string | null;
  type: ActivityEventType;
  title: string;
  body?: string | null;
};

/**
 * Insert activity events for recipients. RLS requires the caller to be the
 * actor (`actor_id`), and the recipient (`user_id`) must be the actor
 * themself, an invitee of the actor on the quest, or have a pending/accepted
 * friendship with the actor. So this is only used to notify other users about
 * an action the current user performed.
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
      quest_id: event.questId ?? null,
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
    | "id"
    | "type"
    | "title"
    | "body"
    | "actor_id"
    | "quest_id"
    | "read_at"
    | "created_at"
  >,
  actor?: ActivityActor,
  quest?: ActivityQuestSummary,
  friendRequest?: ActivityFriendRequest,
): ActivityEvent {
  return {
    id: row.id,
    type: normalizeType(row.type),
    title: row.title,
    body: row.body,
    actorId: row.actor_id,
    actor: actor ?? null,
    questId: row.quest_id,
    quest: quest ?? null,
    friendRequest: friendRequest ?? null,
    createdAtISO: row.created_at,
    createdAtRelative: formatRelativeTime(row.created_at),
    isRead: Boolean(row.read_at),
  };
}

async function fetchActivityActors(actorIds: string[]) {
  if (actorIds.length === 0) {
    return new Map<string, ActivityActor>();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_initials, avatar_url")
    .in("id", actorIds);

  if (error) {
    throw new Error(`Could not load activity profiles: ${error.message}`);
  }

  return new Map((data ?? []).map((profile) => [profile.id, mapActivityActor(profile)]));
}

async function fetchActivityQuests(questIds: string[]) {
  if (questIds.length === 0) {
    return new Map<string, ActivityQuestSummary>();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("quests")
    .select("id, title, category, card_image_url")
    .in("id", questIds);

  if (error) {
    throw new Error(`Could not load activity events: ${error.message}`);
  }

  return new Map((data ?? []).map((quest) => [quest.id, mapActivityQuest(quest)]));
}

async function fetchPendingFriendRequests(
  userId: string,
  rows: Pick<ActivityEventRow, "actor_id" | "type">[],
) {
  const requesterIds = uniqueValues(
    rows.reduce<string[]>((actorIds, row) => {
      if (normalizeType(row.type) === "friend_request" && row.actor_id) {
        actorIds.push(row.actor_id);
      }

      return actorIds;
    }, []),
  );

  if (requesterIds.length === 0) {
    return new Map<string, ActivityFriendRequest>();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .eq("addressee_id", userId)
    .in("requester_id", requesterIds)
    .order("created_at", { ascending: false });

  if (isMissingRelationError(error, "friendships")) {
    return new Map<string, ActivityFriendRequest>();
  }

  if (error) {
    throw new Error(`Could not load friend requests: ${error.message}`);
  }

  const requests = new Map<string, ActivityFriendRequest>();

  for (const row of data ?? []) {
    if (!requests.has(row.requester_id)) {
      requests.set(row.requester_id, mapActivityFriendRequest(row));
    }
  }

  return requests;
}

function mapActivityActor(
  profile: Pick<
    ProfileRow,
    "id" | "display_name" | "handle" | "avatar_initials" | "avatar_url"
  >,
): ActivityActor {
  const displayName = profile.display_name ?? "Someone";

  return {
    id: profile.id,
    displayName,
    handle: profile.handle,
    avatarInitials: profile.avatar_initials ?? initials(displayName),
    avatarUrl: profile.avatar_url,
  };
}

function mapActivityQuest(
  quest: Pick<QuestRow, "id" | "title" | "category" | "card_image_url">,
): ActivityQuestSummary {
  return {
    id: quest.id,
    title: quest.title ?? "Untitled event",
    category: normalizeQuestCategory(quest.category),
    cardImageUrl: quest.card_image_url,
  };
}

function mapActivityFriendRequest(
  friendship: Pick<FriendshipRow, "id" | "status">,
): ActivityFriendRequest {
  return {
    friendshipId: friendship.id,
    status: friendship.status,
  };
}

function normalizeType(value: string): ActivityEventType {
  return validTypes.find((option) => option === value) ?? "join";
}

function normalizeQuestCategory(value: string | null): QuestCategory {
  if (value === "Errand") {
    return "Sidequest";
  }

  const validCategories: QuestCategory[] = [
    "Food",
    "Study",
    "Fitness",
    "Outdoors",
    "Social",
    "Sidequest",
    "Other",
  ];

  return validCategories.find((category) => category === value) ?? "Other";
}

function uniqueValues(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
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
    return "Now";
  }

  if (diffMs < hourMs) {
    return `${Math.round(diffMs / minuteMs)}m`;
  }

  if (diffMs < dayMs) {
    return `${Math.round(diffMs / hourMs)}h`;
  }

  return `${Math.round(diffMs / dayMs)}d`;
}
