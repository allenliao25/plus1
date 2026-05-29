import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import type { NewQuestInput, Profile, Quest, QuestCategory } from "@/types/quest";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type QuestRow = Database["public"]["Tables"]["quests"]["Row"];
type QuestJoinRow = Database["public"]["Tables"]["quest_joins"]["Row"];

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
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("status", "open")
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

export async function joinQuest(questId: string, currentUserId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("quest_joins").insert({
    quest_id: questId,
    user_id: currentUserId,
  });

  // Postgres unique violations mean the user already joined; that is safe here.
  if (error && error.code !== "23505") {
    throw new Error(`Could not join quest: ${error.message}`);
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

  const [{ data: profiles, error: profilesError }, { data: joins, error: joinsError }] =
    await Promise.all([
      creatorIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, display_name, email, avatar_initials, created_at")
            .in("id", creatorIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("quest_joins")
        .select("id, quest_id, user_id, created_at")
        .in("quest_id", questIds),
    ]);

  if (profilesError) {
    throw new Error(`Could not load quest creators: ${profilesError.message}`);
  }

  if (joinsError) {
    throw new Error(`Could not load quest joins: ${joinsError.message}`);
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, mapProfileRow(profile)]),
  );
  const joinsByQuestId = groupJoinsByQuestId(joins ?? []);

  return rows.map((quest) =>
    mapQuestRow({
      currentUserId,
      joins: joinsByQuestId.get(quest.id) ?? [],
      profile: quest.creator_id ? profilesById.get(quest.creator_id) : null,
      quest,
    }),
  );
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
  quest,
}: {
  currentUserId: string;
  joins: QuestJoinRow[];
  profile: Profile | null | undefined;
  quest: QuestRow;
}): Quest {
  const joinedByCurrentUser = joins.some(
    (join) => join.user_id === currentUserId,
  );
  const createdByCurrentUser = quest.creator_id === currentUserId;

  return {
    id: quest.id,
    title: quest.title ?? "Untitled quest",
    category: normalizeCategory(quest.category),
    location: quest.location ?? "Campus",
    startTime: formatQuestTime(quest.start_time),
    description: quest.description ?? "No extra details yet.",
    creator: profile?.displayName ?? "Someone nearby",
    goingCount: 1 + joins.length,
    maxPeople: quest.max_people ?? 4,
    createdByCurrentUser,
    joinedByCurrentUser,
  };
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
