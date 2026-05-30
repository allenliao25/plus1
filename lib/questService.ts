import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import type {
  NewQuestInput,
  Profile,
  Quest,
  QuestCategory,
  QuestStatus,
  UpdateQuestInput,
} from "@/types/quest";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type QuestRow = Database["public"]["Tables"]["quests"]["Row"];
type QuestJoinRow = Database["public"]["Tables"]["quest_joins"]["Row"];

const BOOT_TIMEOUT_MS = 10_000;
const demoUserNames = ["Allen", "Maya", "Chris"];
const validCategories: QuestCategory[] = [
  "Food",
  "Study",
  "Fitness",
  "Errand",
  "Outdoors",
  "Social",
];

export async function fetchDemoProfiles() {
  return withTimeout(
    loadDemoProfiles(),
    BOOT_TIMEOUT_MS,
    "Could not reach Supabase in time. Check your connection and tap Retry.",
  );
}

async function loadDemoProfiles() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_initials, created_at")
    .in("display_name", demoUserNames);

  if (error) {
    throw new Error(`Could not load demo users: ${error.message}`);
  }

  const profiles = (data ?? []).map(mapProfileRow);
  const missingNames = demoUserNames.filter(
    (name) => !profiles.some((profile) => profile.displayName === name),
  );

  if (missingNames.length > 0) {
    throw new Error(
      `Missing demo profiles in Supabase: ${missingNames.join(", ")}.`,
    );
  }

  return demoUserNames
    .map((name) => profiles.find((profile) => profile.displayName === name))
    .filter((profile): profile is Profile => Boolean(profile));
}

export async function fetchFeedQuests(currentUserId: string) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("status", "open")
    .gte("start_time", now)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Could not load quests: ${error.message}`);
  }

  return hydrateQuests(data ?? [], currentUserId);
}

export async function fetchMyQuests(currentUserId: string) {
  const supabase = getSupabaseClient();

  const [{ data: createdQuests, error: createdError }, joinedQuestIds] =
    await Promise.all([
      supabase
        .from("quests")
        .select("*")
        .eq("creator_id", currentUserId)
        .order("created_at", { ascending: false }),
      fetchJoinedQuestIds(currentUserId),
    ]);

  if (createdError) {
    throw new Error(`Could not load created quests: ${createdError.message}`);
  }

  let joinedQuests: QuestRow[] = [];

  if (joinedQuestIds.length > 0) {
    const { data, error } = await supabase
      .from("quests")
      .select("*")
      .in("id", joinedQuestIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Could not load joined quests: ${error.message}`);
    }

    joinedQuests = data ?? [];
  }

  const uniqueQuests = new Map<string, QuestRow>();

  for (const quest of [...(createdQuests ?? []), ...joinedQuests]) {
    uniqueQuests.set(quest.id, quest);
  }

  return hydrateQuests([...uniqueQuests.values()], currentUserId);
}

export async function createQuest(
  input: NewQuestInput,
  currentUserId: string,
) {
  const supabase = getSupabaseClient();
  const startTime = parseStartTime(input.startTime);
  const maxPeople = Math.min(12, Math.max(2, input.maxPeople || 4));

  const { data, error } = await supabase
    .from("quests")
    .insert({
      creator_id: currentUserId,
      title: input.title,
      category: input.category,
      location: input.location,
      start_time: startTime,
      description: input.description,
      max_people: maxPeople,
      status: "open",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Could not create quest: ${error.message}`);
  }

  const [quest] = await hydrateQuests([data], currentUserId);
  return quest;
}

export async function updateQuest(
  questId: string,
  input: UpdateQuestInput,
  currentUserId: string,
) {
  const supabase = getSupabaseClient();
  const startTime = parseStartTime(input.startTime);
  const maxPeople = Math.min(12, Math.max(2, input.maxPeople || 4));

  const { data, error } = await supabase
    .from("quests")
    .update({
      title: input.title,
      category: input.category,
      location: input.location,
      start_time: startTime,
      description: input.description,
      max_people: maxPeople,
    })
    .eq("id", questId)
    .eq("creator_id", currentUserId)
    .eq("status", "open")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not update quest: ${error?.message ?? "Quest not found."}`,
    );
  }

  const [quest] = await hydrateQuests([data], currentUserId);
  return quest;
}

export async function joinQuest(questId: string, currentUserId: string) {
  const supabase = getSupabaseClient();

  const [{ data: quest, error: questError }, { data: joins, error: joinsError }] =
    await Promise.all([
      supabase
        .from("quests")
        .select("id, creator_id, max_people, status")
        .eq("id", questId)
        .single(),
      supabase.from("quest_joins").select("user_id").eq("quest_id", questId),
    ]);

  if (questError || !quest) {
    throw new Error(
      `Could not load quest: ${questError?.message ?? "Quest not found."}`,
    );
  }

  if (joinsError) {
    throw new Error(`Could not join quest: ${joinsError.message}`);
  }

  if (quest.status !== "open") {
    throw new Error("This quest is no longer open.");
  }

  const joinRows = joins ?? [];
  const alreadyJoined = joinRows.some((join) => join.user_id === currentUserId);

  if (alreadyJoined) {
    return;
  }

  if (quest.creator_id === currentUserId) {
    throw new Error("You're already hosting this quest.");
  }

  const goingCount = 1 + joinRows.length;
  const maxPeople = quest.max_people ?? 4;

  if (goingCount >= maxPeople) {
    throw new Error("This quest is full.");
  }

  const { error } = await supabase.from("quest_joins").insert({
    quest_id: questId,
    user_id: currentUserId,
  });

  // Postgres unique violations mean the user already joined; that is safe here.
  if (error && error.code !== "23505") {
    throw new Error(`Could not join quest: ${error.message}`);
  }
}

export async function leaveQuest(questId: string, currentUserId: string) {
  const supabase = getSupabaseClient();

  const { data: quest, error: questError } = await supabase
    .from("quests")
    .select("id, creator_id")
    .eq("id", questId)
    .single();

  if (questError || !quest) {
    throw new Error(
      `Could not load quest: ${questError?.message ?? "Quest not found."}`,
    );
  }

  if (quest.creator_id === currentUserId) {
    throw new Error("Hosts can close a quest, but cannot leave it.");
  }

  const { error } = await supabase
    .from("quest_joins")
    .delete()
    .eq("quest_id", questId)
    .eq("user_id", currentUserId);

  if (error) {
    throw new Error(`Could not leave quest: ${error.message}`);
  }
}

export async function closeQuest(questId: string, currentUserId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("quests")
    .update({ status: "closed" })
    .eq("id", questId)
    .eq("creator_id", currentUserId)
    .eq("status", "open")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not close quest: ${error?.message ?? "Quest not found."}`,
    );
  }
}

async function fetchJoinedQuestIds(currentUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("quest_joins")
    .select("quest_id")
    .eq("user_id", currentUserId);

  if (error) {
    throw new Error(`Could not load joined quest ids: ${error.message}`);
  }

  return (data ?? [])
    .map((join) => join.quest_id)
    .filter((questId): questId is string => Boolean(questId));
}

async function hydrateQuests(rows: QuestRow[], currentUserId: string) {
  if (rows.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const questIds = rows.map((quest) => quest.id);
  const creatorIds = [
    ...new Set(
      rows
        .map((quest) => quest.creator_id)
        .filter((creatorId): creatorId is string => Boolean(creatorId)),
    ),
  ];

  const { data: joins, error: joinsError } = await supabase
    .from("quest_joins")
    .select("id, quest_id, user_id, created_at")
    .in("quest_id", questIds);

  if (joinsError) {
    throw new Error(`Could not load quest joins: ${joinsError.message}`);
  }

  const joinsByQuestId = groupJoinsByQuestId(joins ?? []);
  const joinerIds = [
    ...new Set(
      (joins ?? [])
        .map((join) => join.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const profileIds = [...new Set([...creatorIds, ...joinerIds])];

  const profiles =
    profileIds.length > 0
      ? await fetchProfilesByIds(profileIds)
      : [];
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return rows.map((quest) =>
    mapQuestRow({
      currentUserId,
      joins: joinsByQuestId.get(quest.id) ?? [],
      profile: quest.creator_id ? profilesById.get(quest.creator_id) : null,
      profilesById,
      quest,
    }),
  );
}

export async function fetchProfilesByIds(profileIds: string[]) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_initials, created_at")
    .in("id", profileIds);

  if (error) {
    throw new Error(`Could not load quest profiles: ${error.message}`);
  }

  return (data ?? []).map(mapProfileRow);
}

function groupJoinsByQuestId(joins: QuestJoinRow[]) {
  const grouped = new Map<string, QuestJoinRow[]>();

  for (const join of joins) {
    if (!join.quest_id) {
      continue;
    }

    grouped.set(join.quest_id, [...(grouped.get(join.quest_id) ?? []), join]);
  }

  return grouped;
}

function mapQuestRow({
  currentUserId,
  joins,
  profile,
  profilesById,
  quest,
}: {
  currentUserId: string;
  joins: QuestJoinRow[];
  profile: Profile | null | undefined;
  profilesById: Map<string, Profile>;
  quest: QuestRow;
}): Quest {
  const joinedByCurrentUser = joins.some(
    (join) => join.user_id === currentUserId,
  );
  const createdByCurrentUser = quest.creator_id === currentUserId;
  const attendees = buildAttendees(joins, profile, profilesById);
  const startTime = formatQuestTime(quest.start_time);

  return {
    id: quest.id,
    title: quest.title ?? "Untitled quest",
    category: normalizeCategory(quest.category),
    status: normalizeStatus(quest.status, quest.start_time),
    location: quest.location ?? "Campus",
    startTimeISO: quest.start_time,
    startTime,
    startTimeRelative: formatRelativeTime(quest.start_time),
    description: quest.description ?? "No extra details yet.",
    creator: profile?.displayName ?? "Someone nearby",
    goingCount: 1 + joins.length,
    maxPeople: quest.max_people ?? 4,
    attendees,
    createdByCurrentUser,
    joinedByCurrentUser,
  };
}

function buildAttendees(
  joins: QuestJoinRow[],
  host: Profile | null | undefined,
  profilesById: Map<string, Profile>,
) {
  const hostAttendee = host
    ? [
        {
          id: host.id,
          displayName: host.displayName,
          avatarInitials: host.avatarInitials,
          isHost: true,
        },
      ]
    : [];

  const joiners = joins
    .map((join) => (join.user_id ? profilesById.get(join.user_id) : null))
    .filter((profile): profile is Profile => Boolean(profile))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      avatarInitials: profile.avatarInitials,
      isHost: false,
    }));

  return [...hostAttendee, ...joiners];
}

function mapProfileRow(profile: ProfileRow): Profile {
  return {
    id: profile.id,
    displayName: profile.display_name ?? "Demo user",
    email: profile.email,
    avatarInitials: profile.avatar_initials ?? initials(profile.display_name),
  };
}

function normalizeCategory(category: string | null): QuestCategory {
  const match = validCategories.find((option) => option === category);
  return match ?? "Social";
}

function normalizeStatus(status: string | null, startTime: string | null): QuestStatus {
  if (status === "closed") {
    return "closed";
  }

  if (startTime) {
    const parsed = new Date(startTime);

    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now()) {
      return "past";
    }
  }

  return "open";
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absMs < minuteMs) {
    return diffMs >= 0 ? "Starting now" : "Started just now";
  }

  if (absMs < hourMs) {
    const minutes = Math.round(absMs / minuteMs);
    return diffMs >= 0
      ? `Starts in ${minutes}m`
      : `Started ${minutes}m ago`;
  }

  if (absMs < dayMs) {
    const hours = Math.round(absMs / hourMs);
    return diffMs >= 0 ? `Starts in ${hours}h` : `Started ${hours}h ago`;
  }

  const days = Math.round(absMs / dayMs);
  return diffMs >= 0 ? `Starts in ${days}d` : `Started ${days}d ago`;
}

function parseStartTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid start time.");
  }

  return date.toISOString();
}

function formatQuestTime(value: string | null) {
  if (!value) {
    return "Time TBD";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function initials(name: string | null) {
  return (name ?? "DU")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
