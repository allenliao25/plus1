import { formatRelativeTime } from "@/lib/relativeTime";
import { isMissingRelationError, isMissingRpcError } from "@/lib/schemaCompat";
import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import type {
  ChatMessage,
  MessageThread,
  MessageThreadKind,
  MessageThreadQuestSummary,
  Quest,
  QuestCategory,
  QuestInviteProfile,
} from "@/types/quest";

type MessageThreadRow = Database["public"]["Tables"]["message_threads"]["Row"];
type MessageParticipantRow =
  Database["public"]["Tables"]["message_thread_participants"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name" | "handle" | "avatar_initials" | "avatar_url"
>;
type QuestRow = Pick<
  Database["public"]["Tables"]["quests"]["Row"],
  "id" | "title" | "category" | "card_image_url"
>;

export type ThreadSections = {
  direct: MessageThread[];
  event: MessageThread[];
};

export async function fetchMessageThreads(currentUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("message_threads")
    .select("id, kind, quest_id, direct_key, created_by, created_at, updated_at, last_message_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(60);

  if (isMissingRelationError(error, "message_threads")) {
    return [];
  }

  if (error) {
    throw new Error(`Could not load messages: ${error.message}`);
  }

  const threads = data ?? [];
  const threadIds = threads.map((thread) => thread.id);

  if (threadIds.length === 0) {
    return [];
  }

  const [participants, messages, questsById] = await Promise.all([
    fetchThreadParticipants(threadIds),
    fetchRecentMessages(threadIds),
    fetchThreadQuests(threads),
  ]);
  const profileIds = uniqueValues([
    ...participants.map((participant) => participant.user_id),
    ...messages.map((message) => message.sender_id),
  ]);
  const profilesById = await fetchMessageProfiles(profileIds);
  const participantsByThreadId = groupBy(participants, "thread_id");
  const messagesByThreadId = groupBy(messages, "thread_id");

  return threads
    .map((thread) =>
      mapMessageThread({
        currentUserId,
        messages: messagesByThreadId.get(thread.id) ?? [],
        participants: participantsByThreadId.get(thread.id) ?? [],
        profilesById,
        quest: thread.quest_id ? questsById.get(thread.quest_id) ?? null : null,
        thread,
      }),
    )
    .sort(compareThreads);
}

export async function fetchThreadMessages(
  threadId: string,
  currentUserId: string,
) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, thread_id, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(150);

  if (isMissingRelationError(error, "messages")) {
    return [];
  }

  if (error) {
    throw new Error(`Could not load chat: ${error.message}`);
  }

  const messages = data ?? [];
  const profilesById = await fetchMessageProfiles(
    uniqueValues(messages.map((message) => message.sender_id)),
  );

  return messages.map((message) =>
    mapChatMessage(message, currentUserId, profilesById.get(message.sender_id)),
  );
}

export async function sendMessage(
  threadId: string,
  currentUserId: string,
  body: string,
) {
  const normalizedBody = normalizeMessageBody(body);

  if (!normalizedBody) {
    throw new Error("Message cannot be empty.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: currentUserId,
    body: normalizedBody,
  });

  if (error) {
    throw new Error(`Could not send message: ${error.message}`);
  }
}

export async function markThreadRead(threadId: string, currentUserId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("message_thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", currentUserId);

  if (isMissingRelationError(error, "message_thread_participants")) {
    return;
  }

  if (error) {
    throw new Error(`Could not mark chat read: ${error.message}`);
  }
}

export async function getOrCreateDirectThread(targetUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_or_create_direct_thread", {
    target_user_id: targetUserId,
  });

  if (isMissingRpcError(error, "get_or_create_direct_thread")) {
    throw new Error("Messaging is not enabled for this database yet.");
  }

  if (error) {
    throw new Error(`Could not open message: ${error.message}`);
  }

  return data;
}

export async function getOrCreateEventThread(questId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_or_create_event_thread", {
    target_quest_id: questId,
  });

  if (isMissingRpcError(error, "get_or_create_event_thread")) {
    throw new Error("Messaging is not enabled for this database yet.");
  }

  if (error) {
    throw new Error(`Could not open event chat: ${error.message}`);
  }

  return data;
}

export function splitThreadsByKind(threads: MessageThread[]): ThreadSections {
  return {
    direct: threads.filter((thread) => thread.kind === "direct"),
    event: threads.filter((thread) => thread.kind === "event"),
  };
}

export function countUnreadThreads(threads: MessageThread[]) {
  return threads.filter((thread) => thread.unreadCount > 0).length;
}

export function normalizeMessageBody(body: string) {
  return body.trim().replace(/\s+\n/g, "\n").slice(0, 1000);
}

export function canOpenEventChat(
  quest: Pick<Quest, "createdByCurrentUser" | "joinedByCurrentUser" | "status">,
) {
  return (
    quest.status === "open" &&
    Boolean(quest.createdByCurrentUser || quest.joinedByCurrentUser)
  );
}

export function buildThreadTitle({
  currentUserId,
  kind,
  participants,
  quest,
}: {
  currentUserId: string;
  kind: MessageThreadKind;
  participants: QuestInviteProfile[];
  quest: MessageThreadQuestSummary | null;
}) {
  if (kind === "event") {
    return quest?.title ?? "Event chat";
  }

  const others = participants.filter((participant) => participant.id !== currentUserId);

  return others.map((participant) => participant.displayName).join(", ") || "Messages";
}

function compareThreads(left: MessageThread, right: MessageThread) {
  return readThreadSortTime(right) - readThreadSortTime(left);
}

function readThreadSortTime(thread: MessageThread) {
  const value = thread.lastMessageAtISO;

  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

async function fetchThreadParticipants(threadIds: string[]) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("message_thread_participants")
    .select("thread_id, user_id, last_read_at, created_at")
    .in("thread_id", threadIds);

  if (isMissingRelationError(error, "message_thread_participants")) {
    return [];
  }

  if (error) {
    throw new Error(`Could not load message participants: ${error.message}`);
  }

  return data ?? [];
}

async function fetchRecentMessages(threadIds: string[]) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, thread_id, sender_id, body, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(300);

  if (isMissingRelationError(error, "messages")) {
    return [];
  }

  if (error) {
    throw new Error(`Could not load message previews: ${error.message}`);
  }

  return data ?? [];
}

async function fetchThreadQuests(threads: MessageThreadRow[]) {
  const questIds = uniqueValues(threads.map((thread) => thread.quest_id));

  if (questIds.length === 0) {
    return new Map<string, MessageThreadQuestSummary>();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("quests")
    .select("id, title, category, card_image_url")
    .in("id", questIds);

  if (error) {
    throw new Error(`Could not load event chats: ${error.message}`);
  }

  return new Map((data ?? []).map((quest) => [quest.id, mapThreadQuest(quest)]));
}

async function fetchMessageProfiles(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, QuestInviteProfile>();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, handle, avatar_initials, avatar_url")
    .in("id", profileIds);

  if (error) {
    throw new Error(`Could not load message profiles: ${error.message}`);
  }

  return new Map((data ?? []).map((profile) => [profile.id, mapMessageProfile(profile)]));
}

function mapMessageThread({
  currentUserId,
  messages,
  participants,
  profilesById,
  quest,
  thread,
}: {
  currentUserId: string;
  messages: MessageRow[];
  participants: MessageParticipantRow[];
  profilesById: Map<string, QuestInviteProfile>;
  quest: MessageThreadQuestSummary | null;
  thread: MessageThreadRow;
}): MessageThread {
  const mappedParticipants = participants
    .map((participant) => profilesById.get(participant.user_id))
    .filter((profile): profile is QuestInviteProfile => Boolean(profile))
    .sort((left, right) => {
      if (left.id === currentUserId) {
        return 1;
      }
      if (right.id === currentUserId) {
        return -1;
      }
      return left.displayName.localeCompare(right.displayName);
    });
  const latestMessage = findLatestMessage(messages);
  const currentParticipant = participants.find(
    (participant) => participant.user_id === currentUserId,
  );
  const unreadCount = countUnreadMessages({
    currentUserId,
    lastReadAt: currentParticipant?.last_read_at ?? null,
    messages,
  });
  const title = buildThreadTitle({
    currentUserId,
    kind: thread.kind,
    participants: mappedParticipants,
    quest,
  });

  return {
    id: thread.id,
    kind: thread.kind,
    questId: thread.quest_id,
    quest,
    participants: mappedParticipants,
    title,
    subtitle: buildThreadSubtitle({
      currentUserId,
      kind: thread.kind,
      participants: mappedParticipants,
    }),
    preview: buildThreadPreview(latestMessage, currentUserId, profilesById),
    lastMessageAtISO:
      latestMessage?.created_at ?? thread.last_message_at ?? thread.updated_at ?? thread.created_at,
    lastMessageAtRelative: formatRelativeTime(
      latestMessage?.created_at ?? thread.last_message_at ?? thread.updated_at ?? thread.created_at,
    ),
    unreadCount,
  };
}

function mapChatMessage(
  message: MessageRow,
  currentUserId: string,
  sender?: QuestInviteProfile,
): ChatMessage {
  return {
    id: message.id,
    threadId: message.thread_id,
    senderId: message.sender_id,
    sender: sender ?? null,
    body: message.body,
    createdAtISO: message.created_at,
    createdAtRelative: formatRelativeTime(message.created_at),
    isMine: message.sender_id === currentUserId,
  };
}

function buildThreadSubtitle({
  currentUserId,
  kind,
  participants,
}: {
  currentUserId: string;
  kind: MessageThreadKind;
  participants: QuestInviteProfile[];
}) {
  if (kind === "event") {
    return "Event chat";
  }

  const other = participants.find((participant) => participant.id !== currentUserId);
  return other ? `@${other.handle}` : null;
}

function buildThreadPreview(
  message: MessageRow | null,
  currentUserId: string,
  profilesById: Map<string, QuestInviteProfile>,
) {
  if (!message) {
    return "Start the conversation.";
  }

  const senderName =
    message.sender_id === currentUserId
      ? "You"
      : (profilesById.get(message.sender_id)?.displayName ?? "Someone");

  return `${senderName}: ${message.body}`;
}

function countUnreadMessages({
  currentUserId,
  lastReadAt,
  messages,
}: {
  currentUserId: string;
  lastReadAt: string | null;
  messages: MessageRow[];
}) {
  const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;

  return messages.filter((message) => {
    if (message.sender_id === currentUserId || !message.created_at) {
      return false;
    }

    const messageTime = new Date(message.created_at).getTime();
    return Number.isNaN(messageTime) ? false : messageTime > lastReadTime;
  }).length;
}

function findLatestMessage(messages: MessageRow[]) {
  return [...messages].sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  })[0] ?? null;
}

function mapMessageProfile(profile: ProfileRow): QuestInviteProfile {
  const displayName = profile.display_name ?? "Someone";

  return {
    id: profile.id,
    displayName,
    handle: profile.handle,
    avatarInitials: profile.avatar_initials ?? initials(displayName),
    avatarUrl: profile.avatar_url,
  };
}

function mapThreadQuest(quest: QuestRow): MessageThreadQuestSummary {
  return {
    id: quest.id,
    title: quest.title ?? "Untitled event",
    category: normalizeQuestCategory(quest.category),
    cardImageUrl: quest.card_image_url,
  };
}

function groupBy<Row extends Record<Key, string>, Key extends keyof Row>(
  rows: Row[],
  key: Key,
) {
  const groups = new Map<string, Row[]>();

  for (const row of rows) {
    groups.set(row[key], [...(groups.get(row[key]) ?? []), row]);
  }

  return groups;
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

function normalizeQuestCategory(value: string | null): QuestCategory {
  const validCategories: QuestCategory[] = [
    "Food",
    "Study",
    "Fitness",
    "Outdoors",
    "Social",
    "Other",
  ];

  return validCategories.find((category) => category === value) ?? "Other";
}

