import { normalizeArea } from "@/lib/area";
import {
  isMissingColumnError,
  isMissingRelationError,
  isMissingRpcError,
} from "@/lib/schemaCompat";
import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import type {
  NewQuestInput,
  Profile,
  Quest,
  QuestCategory,
  QuestStatus,
  QuestVisibility,
  UpdateQuestInput,
} from "@/types/quest";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type QuestRow = Database["public"]["Tables"]["quests"]["Row"];
type QuestJoinRow = Database["public"]["Tables"]["quest_joins"]["Row"];
type QuestInviteRow = Database["public"]["Tables"]["quest_invites"]["Row"];
type PublicProfileRow = Pick<
  ProfileRow,
  | "id"
  | "display_name"
  | "handle"
  | "avatar_initials"
  | "avatar_url"
  | "website_url"
  | "bio"
  | "pronouns"
  | "interests"
> &
  Partial<Pick<ProfileRow, "email" | "phone" | "area">>;

const BOOT_TIMEOUT_MS = 10_000;
export const QUEST_CARD_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const demoUserNames = ["Allen", "Maya", "Chris"];
const validCategories: QuestCategory[] = [
  "Food",
  "Study",
  "Fitness",
  "Outdoors",
  "Social",
  "Other",
];
const validVisibility: QuestVisibility[] = [
  "invite_only",
  "friends",
  "local",
];
const legacyLocalVisibilityValue = "campus";
export const publicProfileSelect =
  "id, display_name, handle, avatar_initials, avatar_url, website_url, bio, pronouns, area, interests, created_at, updated_at";
const legacyPublicProfileSelect =
  "id, display_name, handle, avatar_initials, avatar_url, website_url, bio, pronouns, interests, created_at, updated_at";

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
    .select(publicProfileSelect)
    .in("display_name", demoUserNames);
  let rows: PublicProfileRow[] = data ?? [];
  let loadError = error;

  if (isMissingColumnError(error, "area")) {
    const legacyResult = await supabase
      .from("profiles")
      .select(legacyPublicProfileSelect)
      .in("display_name", demoUserNames);

    rows = legacyResult.data ?? [];
    loadError = legacyResult.error;
  }

  if (loadError) {
    throw new Error(`Could not load demo users: ${loadError.message}`);
  }

  const profiles = rows.map(mapProfileRow);
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

export async function fetchFeedQuests(currentUserId: string, currentArea?: string) {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const normalizedArea = currentArea ? normalizeArea(currentArea) : "";
  let query = supabase
    .from("quests")
    .select("*")
    .eq("status", "open")
    .or(`start_time.is.null,start_time.gte.${now}`);

  if (normalizedArea) {
    query = query.eq("area", normalizedArea);
  }

  let { data, error } = await query.order("start_time", { ascending: true });

  if (normalizedArea && isMissingColumnError(error, "area")) {
    const fallback = await supabase
      .from("quests")
      .select("*")
      .eq("status", "open")
      .or(`start_time.is.null,start_time.gte.${now}`)
      .order("start_time", { ascending: true });

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(`Could not load events: ${error.message}`);
  }

  return hydrateQuests(
    filterLegacyAreaRows(data ?? [], currentArea),
    currentUserId,
  );
}

function filterLegacyAreaRows(rows: QuestRow[], currentArea?: string) {
  if (!currentArea || rows.some((row) => row.area === undefined)) {
    return rows;
  }

  const normalizedArea = normalizeArea(currentArea);
  return rows.filter((row) => {
    if (normalizeQuestVisibility(row.visibility) !== "local") {
      return true;
    }

    return normalizeArea(row.area) === normalizedArea;
  });
}

export async function fetchMyQuests(currentUserId: string) {
  const supabase = getSupabaseClient();

  const [{ data: createdQuests, error: createdError }, joinedQuestIds, invitedQuestIds] =
    await Promise.all([
      supabase
        .from("quests")
        .select("*")
        .eq("creator_id", currentUserId)
        .order("created_at", { ascending: false }),
      fetchJoinedQuestIds(currentUserId),
      fetchInvitedQuestIds(currentUserId),
    ]);

  if (createdError) {
    throw new Error(`Could not load created events: ${createdError.message}`);
  }

  let joinedQuests: QuestRow[] = [];

  const relatedQuestIds = [...new Set([...joinedQuestIds, ...invitedQuestIds])];

  if (relatedQuestIds.length > 0) {
    const { data, error } = await supabase
      .from("quests")
      .select("*")
      .in("id", relatedQuestIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Could not load joined events: ${error.message}`);
    }

    joinedQuests = data ?? [];
  }

  const uniqueQuests = new Map<string, QuestRow>();

  for (const quest of [...(createdQuests ?? []), ...joinedQuests]) {
    uniqueQuests.set(quest.id, quest);
  }

  return hydrateQuests([...uniqueQuests.values()], currentUserId);
}

export async function fetchVisibleProfileQuests(
  profileId: string,
  currentUserId: string,
) {
  const supabase = getSupabaseClient();
  const [{ data: createdQuests, error: createdError }, { data: joins, error: joinsError }] =
    await Promise.all([
      supabase
        .from("quests")
        .select("*")
        .eq("creator_id", profileId)
        .order("created_at", { ascending: false }),
      supabase.from("quest_joins").select("quest_id").eq("user_id", profileId),
    ]);

  if (createdError) {
    throw new Error(`Could not load profile events: ${createdError.message}`);
  }

  if (joinsError) {
    throw new Error(`Could not load profile joined events: ${joinsError.message}`);
  }

  let joinedQuests: QuestRow[] = [];
  const joinedQuestIds = [
    ...new Set(
      (joins ?? [])
        .map((join) => join.quest_id)
        .filter((questId): questId is string => Boolean(questId)),
    ),
  ];

  if (joinedQuestIds.length > 0) {
    const { data, error } = await supabase
      .from("quests")
      .select("*")
      .in("id", joinedQuestIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Could not load profile joined events: ${error.message}`);
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
  currentArea?: string,
) {
  const supabase = getSupabaseClient();
  const startTime = parseStartTime(input.startTime);
  const maxPeople = Math.min(12, Math.max(2, input.maxPeople || 4));

  const insertPayload = {
    creator_id: currentUserId,
    title: input.title,
    category: input.category,
    location: input.location,
    start_time: startTime,
    description: input.description,
    card_image_url: input.cardImageUrl ?? null,
    area: normalizeArea(currentArea),
    visibility: normalizeQuestVisibility(input.visibility),
    max_people: maxPeople,
    status: "open",
  };
  let insert = await supabase
    .from("quests")
    .insert(insertPayload)
    .select("*")
    .single();

  if (
    insertPayload.visibility === "local" &&
    isLegacyVisibilityCheckError(insert.error)
  ) {
    insert = await supabase
      .from("quests")
      .insert({
        ...insertPayload,
        visibility: legacyLocalVisibilityValue as QuestVisibility,
      })
      .select("*")
      .single();
  }

  if (
    isMissingColumnError(insert.error, "area") ||
    isMissingColumnError(insert.error, "visibility")
  ) {
    const legacyPayload = Object.fromEntries(
      Object.entries(insertPayload).filter(
        ([key]) => key !== "area" && key !== "visibility",
      ),
    );

    insert = await supabase
      .from("quests")
      .insert(legacyPayload)
      .select("*")
      .single();
  }

  const { data, error } = insert;

  if (error) {
    throw new Error(`Could not create event: ${error.message}`);
  }

  await replaceQuestInvites({
    actorId: currentUserId,
    inviteeIds: input.inviteeIds ?? [],
    questId: data.id,
    questTitle: data.title ?? input.title,
  });

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

  const updatePayload = {
    title: input.title,
    category: input.category,
    location: input.location,
    start_time: startTime,
    description: input.description,
    card_image_url: input.cardImageUrl ?? null,
    visibility: normalizeQuestVisibility(input.visibility),
    max_people: maxPeople,
  };

  let update = await supabase
    .from("quests")
    .update(updatePayload)
    .eq("id", questId)
    .eq("creator_id", currentUserId)
    .select("*");

  if (
    updatePayload.visibility === "local" &&
    isLegacyVisibilityCheckError(update.error)
  ) {
    update = await supabase
      .from("quests")
      .update({
        ...updatePayload,
        visibility: legacyLocalVisibilityValue as QuestVisibility,
      })
      .eq("id", questId)
      .eq("creator_id", currentUserId)
      .select("*");
  }

  if (isMissingColumnError(update.error, "visibility")) {
    const legacyPayload = Object.fromEntries(
      Object.entries(updatePayload).filter(([key]) => key !== "visibility"),
    );

    update = await supabase
      .from("quests")
      .update(legacyPayload)
      .eq("id", questId)
      .eq("creator_id", currentUserId)
      .select("*");
  }

  const { data, error } = update;

  const quest = data?.[0] ?? null;

  if (error || !quest) {
    throw new Error(
      `Could not update event: ${error?.message ?? "Event not found."}`,
    );
  }

  const [hydratedQuest] = await hydrateQuests([quest], currentUserId);

  if (input.inviteeIds) {
    await replaceQuestInvites({
      actorId: currentUserId,
      inviteeIds: input.inviteeIds,
      questId: quest.id,
      questTitle: quest.title ?? input.title,
    });
  }

  return hydratedQuest;
}

export async function joinQuest(questId: string, currentUserId: string) {
  void currentUserId;

  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc("join_quest_atomic", {
    target_quest_id: questId,
  });

  if (isMissingRpcError(error, "join_quest_atomic")) {
    await joinQuestLegacy(questId, currentUserId);
    return;
  }

  if (error) {
    throw new Error(mapJoinQuestError(error.message));
  }

  await acceptQuestInvite(questId, currentUserId);
}

async function joinQuestLegacy(questId: string, currentUserId: string) {
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
      `Could not load event: ${questError?.message ?? "Event not found."}`,
    );
  }

  if (joinsError) {
    throw new Error(`Could not join event: ${joinsError.message}`);
  }

  if (quest.status !== "open") {
    throw new Error("This event is no longer open.");
  }

  const joinRows = joins ?? [];
  const alreadyJoined = joinRows.some((join) => join.user_id === currentUserId);

  if (alreadyJoined) {
    return;
  }

  if (quest.creator_id === currentUserId) {
    throw new Error("You're already hosting this event.");
  }

  const goingCount = 1 + joinRows.length;
  const maxPeople = quest.max_people ?? 4;

  if (goingCount >= maxPeople) {
    throw new Error("This event is full.");
  }

  const { error } = await supabase.from("quest_joins").insert({
    quest_id: questId,
    user_id: currentUserId,
  });

  if (error && error.code !== "23505") {
    throw new Error(`Could not join event: ${error.message}`);
  }

  await acceptQuestInvite(questId, currentUserId);
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
      `Could not load event: ${questError?.message ?? "Event not found."}`,
    );
  }

  if (quest.creator_id === currentUserId) {
    throw new Error("Hosts can close an event, but cannot leave it.");
  }

  const { error } = await supabase
    .from("quest_joins")
    .delete()
    .eq("quest_id", questId)
    .eq("user_id", currentUserId);

  if (error) {
    throw new Error(`Could not leave event: ${error.message}`);
  }
}

export async function closeQuest(questId: string, currentUserId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("quests")
    .update({ status: "closed" })
    .eq("id", questId)
    .eq("creator_id", currentUserId)
    .select("*");

  if (error || !data?.[0]) {
    throw new Error(
      `Could not close event: ${error?.message ?? "Event not found."}`,
    );
  }
}

export async function uploadQuestCardImage(userId: string, file: File) {
  validateQuestCardImageFile(file);

  const supabase = getSupabaseClient();
  const extension = getQuestCardImageExtension(file.type);
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  const path = `${userId}/card-${uniqueId}.${extension}`;
  const { error } = await supabase.storage
    .from("quest-card-images")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw new Error(`Could not upload event image: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("quest-card-images").getPublicUrl(path);

  return publicUrl;
}

export function validateQuestCardImageFile(
  file: Pick<File, "size" | "type">,
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the event card.");
  }

  if (file.size > QUEST_CARD_IMAGE_MAX_BYTES) {
    throw new Error("Event image must be 8 MB or smaller.");
  }
}

async function fetchJoinedQuestIds(currentUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("quest_joins")
    .select("quest_id")
    .eq("user_id", currentUserId);

  if (error) {
    throw new Error(`Could not load joined event ids: ${error.message}`);
  }

  return (data ?? [])
    .map((join) => join.quest_id)
    .filter((questId): questId is string => Boolean(questId));
}

async function fetchInvitedQuestIds(currentUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("quest_invites")
    .select("quest_id")
    .eq("invitee_id", currentUserId)
    .neq("status", "declined");

  if (isMissingRelationError(error, "quest_invites")) {
    return [];
  }

  if (error) {
    throw new Error(`Could not load invited event ids: ${error.message}`);
  }

  return (data ?? [])
    .map((invite) => invite.quest_id)
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

  const [{ data: joins, error: joinsError }, inviteResult] = await Promise.all([
    supabase
      .from("quest_joins")
      .select("id, quest_id, user_id, created_at")
      .in("quest_id", questIds),
    supabase
      .from("quest_invites")
      .select("id, quest_id, inviter_id, invitee_id, status, created_at, updated_at")
      .in("quest_id", questIds),
  ]);

  if (joinsError) {
    throw new Error(`Could not load event joins: ${joinsError.message}`);
  }

  if (
    inviteResult.error &&
    !isMissingRelationError(inviteResult.error, "quest_invites")
  ) {
    throw new Error(`Could not load event invites: ${inviteResult.error.message}`);
  }

  const joinsByQuestId = groupJoinsByQuestId(joins ?? []);
  const invites = inviteResult.error ? [] : (inviteResult.data ?? []);
  const invitesByQuestId = groupInvitesByQuestId(invites);
  const joinerIds = [
    ...new Set(
      (joins ?? [])
        .map((join) => join.user_id)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const inviteeIds = invites
    .map((invite) => invite.invitee_id)
    .filter((userId): userId is string => Boolean(userId));
  const profileIds = [...new Set([...creatorIds, ...joinerIds, ...inviteeIds])];

  const profiles =
    profileIds.length > 0
      ? await fetchProfilesByIds(profileIds)
      : [];
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return rows.map((quest) =>
    mapQuestRow({
      currentUserId,
      invites: invitesByQuestId.get(quest.id) ?? [],
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
    .select(publicProfileSelect)
    .in("id", profileIds);
  let rows: PublicProfileRow[] = data ?? [];
  let loadError = error;

  if (isMissingColumnError(error, "area")) {
    const legacyResult = await supabase
      .from("profiles")
      .select(legacyPublicProfileSelect)
      .in("id", profileIds);

    rows = legacyResult.data ?? [];
    loadError = legacyResult.error;
  }

  if (loadError) {
    throw new Error(`Could not load event profiles: ${loadError.message}`);
  }

  return rows.map(mapProfileRow);
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

function groupInvitesByQuestId(invites: QuestInviteRow[]) {
  const grouped = new Map<string, QuestInviteRow[]>();

  for (const invite of invites) {
    if (!invite.quest_id) {
      continue;
    }

    grouped.set(invite.quest_id, [
      ...(grouped.get(invite.quest_id) ?? []),
      invite,
    ]);
  }

  return grouped;
}

function mapQuestRow({
  currentUserId,
  invites,
  joins,
  profile,
  profilesById,
  quest,
}: {
  currentUserId: string;
  invites: QuestInviteRow[];
  joins: QuestJoinRow[];
  profile: Profile | null | undefined;
  profilesById: Map<string, Profile>;
  quest: QuestRow;
}): Quest {
  const joinedByCurrentUser = joins.some(
    (join) => join.user_id === currentUserId,
  );
  const createdByCurrentUser = quest.creator_id === currentUserId;
  const invitedByCurrentUser = invites.some(
    (invite) =>
      invite.invitee_id === currentUserId && invite.status !== "declined",
  );
  const attendees = buildAttendees(joins, profile, profilesById);
  const invitedProfiles = buildInvitedProfiles(invites, profilesById);
  const startTime = formatQuestTime(quest.start_time);

  return {
    id: quest.id,
    title: quest.title ?? "Untitled event",
    category: normalizeQuestCategory(quest.category),
    status: normalizeStatus(quest.status, quest.start_time),
    location: quest.location ?? "Nearby",
    startTimeISO: quest.start_time,
    startTime,
    startTimeRelative: formatRelativeTime(quest.start_time),
    description: quest.description ?? "No extra details yet.",
    cardImageUrl: quest.card_image_url,
    creator: profile?.displayName ?? "Someone nearby",
    creatorId: quest.creator_id,
    visibility: normalizeQuestVisibility(quest.visibility),
    goingCount: 1 + joins.length,
    maxPeople: quest.max_people ?? 4,
    attendees,
    invitedProfiles,
    createdByCurrentUser,
    joinedByCurrentUser,
    invitedByCurrentUser,
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
          avatarUrl: host.avatarUrl,
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
      avatarUrl: profile.avatarUrl,
      isHost: false,
    }));

  return [...hostAttendee, ...joiners];
}

function buildInvitedProfiles(
  invites: QuestInviteRow[],
  profilesById: Map<string, Profile>,
) {
  return invites
    .filter((invite) => invite.status !== "declined")
    .map((invite) => profilesById.get(invite.invitee_id))
    .filter((profile): profile is Profile => Boolean(profile))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      handle: profile.handle,
      avatarInitials: profile.avatarInitials,
      avatarUrl: profile.avatarUrl,
    }));
}

function mapProfileRow(profile: PublicProfileRow): Profile {
  return {
    id: profile.id,
    displayName: profile.display_name ?? "Demo user",
    handle: profile.handle ?? profile.id.slice(0, 8),
    email: "email" in profile ? profile.email ?? null : null,
    phone: "phone" in profile ? profile.phone ?? null : null,
    avatarInitials: profile.avatar_initials ?? initials(profile.display_name),
    avatarUrl: profile.avatar_url,
    websiteUrl: profile.website_url,
    bio: profile.bio,
    pronouns: profile.pronouns,
    area: normalizeArea(profile.area),
    interests: profile.interests ?? [],
  };
}

async function replaceQuestInvites({
  actorId,
  inviteeIds,
  questId,
  questTitle,
}: {
  actorId: string;
  inviteeIds: string[];
  questId: string;
  questTitle: string;
}) {
  const supabase = getSupabaseClient();
  const uniqueInviteeIds = [
    ...new Set(inviteeIds.filter((inviteeId) => inviteeId !== actorId)),
  ];

  const existing = await supabase
    .from("quest_invites")
    .select("invitee_id, status")
    .eq("quest_id", questId);

  if (isMissingRelationError(existing.error, "quest_invites")) {
    return;
  }

  if (existing.error) {
    throw new Error(`Could not load event invites: ${existing.error.message}`);
  }

  const existingIds = new Set(
    (existing.data ?? [])
      .filter((row) => row.status !== "declined")
      .map((row) => row.invitee_id),
  );
  const nextIds = new Set(uniqueInviteeIds);
  const removedIds = [...existingIds].filter((inviteeId) => !nextIds.has(inviteeId));
  const addedIds = uniqueInviteeIds.filter((inviteeId) => !existingIds.has(inviteeId));

  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("quest_invites")
      .delete()
      .eq("quest_id", questId)
      .in("invitee_id", removedIds);

    if (error) {
      throw new Error(`Could not remove event invites: ${error.message}`);
    }
  }

  if (addedIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("quest_invites")
    .upsert(
      addedIds.map((inviteeId) => ({
        quest_id: questId,
        inviter_id: actorId,
        invitee_id: inviteeId,
        status: "pending",
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "quest_id,invitee_id" },
    );

  if (error && error.code !== "23505") {
    throw new Error(`Could not invite people: ${error.message}`);
  }

  await recordInviteActivity({
    actorId,
    inviteeIds: addedIds,
    questId,
    questTitle,
  });
}

async function recordInviteActivity({
  actorId,
  inviteeIds,
  questId,
  questTitle,
}: {
  actorId: string;
  inviteeIds: string[];
  questId: string;
  questTitle: string;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("activity_events").insert(
    inviteeIds.map((inviteeId) => ({
      user_id: inviteeId,
      actor_id: actorId,
      quest_id: questId,
      type: "invite",
      title: `You were invited to ${questTitle}`,
    })),
  );

  if (error) {
    throw new Error(`Could not send invite activity: ${error.message}`);
  }
}

async function acceptQuestInvite(questId: string, currentUserId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("quest_invites")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("quest_id", questId)
    .eq("invitee_id", currentUserId);

  if (isMissingRelationError(error, "quest_invites")) {
    return;
  }

  if (error) {
    throw new Error(`Could not accept invite: ${error.message}`);
  }
}

function mapJoinQuestError(message: string) {
  if (message.includes("event_closed")) {
    return "This event is no longer open.";
  }

  if (message.includes("event_full")) {
    return "This event is full.";
  }

  if (message.includes("host_cannot_join")) {
    return "You're already hosting this event.";
  }

  if (message.includes("event_not_found")) {
    return "That event is not available in your area.";
  }

  return `Could not join event: ${message}`;
}

export function normalizeQuestCategory(category: string | null): QuestCategory {
  if (category === "Errand" || category === "Sidequest") {
    return "Other";
  }

  const match = validCategories.find((option) => option === category);
  return match ?? "Social";
}

function normalizeQuestVisibility(
  visibility: string | null | undefined,
): QuestVisibility {
  if (visibility === legacyLocalVisibilityValue) {
    return "local";
  }

  const match = validVisibility.find((option) => option === visibility);
  return match ?? "local";
}

function isLegacyVisibilityCheckError(
  error:
    | {
        code?: string;
        details?: string | null;
        message?: string;
      }
    | null
    | undefined,
) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    message.includes("quests_visibility_check") ||
    (error.code === "23514" && message.includes("visibility"))
  );
}

function getQuestCardImageExtension(type: string) {
  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  return "jpg";
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
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Choose a valid start time.");
  }

  return date.toISOString();
}

export function formatQuestTime(value: string | null) {
  if (!value) {
    return "ASAP";
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
