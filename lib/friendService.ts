import { normalizeArea } from "@/lib/area";
import { isMissingRelationError } from "@/lib/schemaCompat";
import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import type {
  FriendConnection,
  FriendshipState,
  PeopleSearchResult,
  PublicProfile,
  QuestInviteProfile,
} from "@/types/quest";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];

const publicProfileSelect =
  "id, display_name, handle, avatar_initials, avatar_url, website_url, bio, pronouns, area, interests";

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
  | "area"
  | "interests"
>;

export async function searchPeople(currentUserId: string, query: string) {
  const normalizedQuery = normalizePeopleQuery(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const supabase = getSupabaseClient();
  const [{ data, error }, friendships] = await Promise.all([
    supabase
      .from("profiles")
      .select(publicProfileSelect)
      .or(
        `display_name.ilike.%${normalizedQuery}%,handle.ilike.%${normalizedQuery}%`,
      )
      .neq("id", currentUserId)
      .limit(20),
    fetchFriendshipRows(currentUserId),
  ]);

  if (error) {
    throw new Error(`Could not search people: ${error.message}`);
  }

  return (data ?? []).map((profile) =>
    mapPeopleSearchResult(profile, currentUserId, friendships),
  );
}

export async function searchProfilesForInvite(
  currentUserId: string,
  query: string,
) {
  return (await searchPeople(currentUserId, query)).map(mapInviteProfile);
}

export async function fetchFriends(currentUserId: string) {
  const rows = await fetchFriendshipRows(currentUserId);
  return hydrateFriendConnections(
    rows.filter((row) => row.status === "accepted"),
    currentUserId,
  );
}

export async function fetchIncomingFriendRequests(currentUserId: string) {
  const rows = await fetchFriendshipRows(currentUserId);
  return hydrateFriendConnections(
    rows.filter(
      (row) => row.status === "pending" && row.addressee_id === currentUserId,
    ),
    currentUserId,
  );
}

export async function fetchOutgoingFriendRequests(currentUserId: string) {
  const rows = await fetchFriendshipRows(currentUserId);
  return hydrateFriendConnections(
    rows.filter(
      (row) => row.status === "pending" && row.requester_id === currentUserId,
    ),
    currentUserId,
  );
}

export async function fetchSuggestedFriends(
  currentUserId: string,
  currentArea: string,
) {
  const supabase = getSupabaseClient();
  const friendships = await fetchFriendshipRows(currentUserId);
  const relatedUserIds = new Set(
    friendships.flatMap((row) => [row.requester_id, row.addressee_id]),
  );
  const { data, error } = await supabase
    .from("profiles")
    .select(publicProfileSelect)
    .eq("area", normalizeArea(currentArea))
    .neq("id", currentUserId)
    .limit(12);

  if (error) {
    throw new Error(`Could not load suggested friends: ${error.message}`);
  }

  return (data ?? [])
    .filter((profile) => !relatedUserIds.has(profile.id))
    .map((profile) => mapPeopleSearchResult(profile, currentUserId, friendships));
}

export async function fetchPublicProfile(
  profileId: string,
  currentUserId: string,
) {
  const supabase = getSupabaseClient();
  const [{ data, error }, friendships] = await Promise.all([
    supabase
      .from("profiles")
      .select(publicProfileSelect)
      .eq("id", profileId)
      .maybeSingle(),
    fetchFriendshipRows(currentUserId),
  ]);

  if (error || !data) {
    throw new Error(
      `Could not load profile: ${error?.message ?? "Profile not found."}`,
    );
  }

  return mapPeopleSearchResult(data, currentUserId, friendships);
}

export async function sendFriendRequest(
  requesterId: string,
  addresseeId: string,
  requesterName: string,
) {
  if (requesterId === addresseeId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const existing = await fetchFriendshipBetween(requesterId, addresseeId);

  if (existing?.status === "accepted") {
    return;
  }

  if (existing?.status === "pending") {
    if (existing.addressee_id === requesterId) {
      await acceptFriendRequest(existing.id, requesterId, requesterName);
    }
    return;
  }

  if (existing?.status === "declined") {
    await removeFriend(existing.id);
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("friendships").insert({
    requester_id: requesterId,
    addressee_id: addresseeId,
    status: "pending",
  });

  if (isMissingRelationError(error, "friendships")) {
    throw new Error("Friends are not enabled for this database yet.");
  }

  if (error && error.code !== "23505") {
    throw new Error(`Could not send friend request: ${error.message}`);
  }

  if (!error) {
    await recordFriendActivity({
      actorId: requesterId,
      body: null,
      title: `${requesterName} sent you a friend request`,
      type: "friend_request",
      userId: addresseeId,
    });
  }
}

export async function acceptFriendRequest(
  friendshipId: string,
  currentUserId: string,
  currentUserName: string,
) {
  const row = await fetchFriendshipById(friendshipId);

  if (!row || row.addressee_id !== currentUserId) {
    throw new Error("Could not accept friend request.");
  }

  if (row.status === "accepted") {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", friendshipId);

  if (error) {
    throw new Error(`Could not accept friend request: ${error.message}`);
  }

  await recordFriendActivity({
    actorId: currentUserId,
    body: null,
    title: `${currentUserName} accepted your friend request`,
    type: "friend_accept",
    userId: row.requester_id,
  });
}

export async function declineFriendRequest(
  friendshipId: string,
  currentUserId: string,
) {
  const row = await fetchFriendshipById(friendshipId);

  if (!row || row.addressee_id !== currentUserId) {
    throw new Error("Could not decline friend request.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", friendshipId);

  if (error) {
    throw new Error(`Could not decline friend request: ${error.message}`);
  }
}

export async function removeFriend(friendshipId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    throw new Error(`Could not remove friend: ${error.message}`);
  }
}

export async function cancelFriendRequest(friendshipId: string) {
  await removeFriend(friendshipId);
}

export function resolveFriendshipState(
  row: Pick<FriendshipRow, "requester_id" | "addressee_id" | "status"> | null,
  currentUserId: string,
  profileId: string,
): FriendshipState {
  if (currentUserId === profileId) {
    return "self";
  }

  if (!row) {
    return "none";
  }

  if (row.status === "accepted") {
    return "friends";
  }

  if (row.status === "declined") {
    return "declined";
  }

  return row.addressee_id === currentUserId ? "incoming" : "outgoing";
}

async function fetchFriendshipRows(currentUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

  if (isMissingRelationError(error, "friendships")) {
    return [];
  }

  if (error) {
    throw new Error(`Could not load friends: ${error.message}`);
  }

  return data ?? [];
}

async function fetchFriendshipBetween(leftUserId: string, rightUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .or(
      `and(requester_id.eq.${leftUserId},addressee_id.eq.${rightUserId}),and(requester_id.eq.${rightUserId},addressee_id.eq.${leftUserId})`,
    )
    .limit(1)
    .maybeSingle();

  if (isMissingRelationError(error, "friendships")) {
    return null;
  }

  if (error) {
    throw new Error(`Could not load friend request: ${error.message}`);
  }

  return data;
}

async function fetchFriendshipById(friendshipId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at, updated_at")
    .eq("id", friendshipId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load friend request: ${error.message}`);
  }

  return data;
}

async function hydrateFriendConnections(
  rows: FriendshipRow[],
  currentUserId: string,
) {
  const otherUserIds = rows.map((row) =>
    row.requester_id === currentUserId ? row.addressee_id : row.requester_id,
  );

  if (otherUserIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(publicProfileSelect)
    .in("id", otherUserIds);

  if (error) {
    throw new Error(`Could not load friend profiles: ${error.message}`);
  }

  const profilesById = new Map(
    (data ?? []).map((profile) => [profile.id, mapPublicProfile(profile)]),
  );

  return rows
    .map((row): FriendConnection | null => {
      const profileId =
        row.requester_id === currentUserId ? row.addressee_id : row.requester_id;
      const profile = profilesById.get(profileId);

      if (!profile) {
        return null;
      }

      return {
        id: row.id,
        status: row.status,
        requesterId: row.requester_id,
        addresseeId: row.addressee_id,
        state: resolveFriendshipState(row, currentUserId, profile.id),
        profile,
      };
    })
    .filter((connection): connection is FriendConnection => Boolean(connection))
    .sort((left, right) =>
      left.profile.displayName.localeCompare(right.profile.displayName),
    );
}

function mapPeopleSearchResult(
  profile: PublicProfileRow,
  currentUserId: string,
  friendships: FriendshipRow[],
): PeopleSearchResult {
  const row =
    friendships.find(
      (friendship) =>
        (friendship.requester_id === currentUserId &&
          friendship.addressee_id === profile.id) ||
        (friendship.requester_id === profile.id &&
          friendship.addressee_id === currentUserId),
    ) ?? null;

  return {
    ...mapPublicProfile(profile),
    friendshipId: row?.id ?? null,
    friendshipState: resolveFriendshipState(row, currentUserId, profile.id),
    friendshipStatus: row?.status ?? null,
    requesterId: row?.requester_id ?? null,
    addresseeId: row?.addressee_id ?? null,
  };
}

function mapPublicProfile(profile: PublicProfileRow): PublicProfile {
  const displayName = profile.display_name ?? "Someone";

  return {
    id: profile.id,
    displayName,
    handle: profile.handle,
    avatarInitials: profile.avatar_initials ?? initials(displayName),
    avatarUrl: profile.avatar_url,
    websiteUrl: profile.website_url,
    bio: profile.bio,
    pronouns: profile.pronouns,
    area: normalizeArea(profile.area),
    interests: profile.interests ?? [],
  };
}

function mapInviteProfile(profile: PublicProfile): QuestInviteProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    handle: profile.handle,
    avatarInitials: profile.avatarInitials,
    avatarUrl: profile.avatarUrl,
  };
}

function normalizePeopleQuery(query: string) {
  return query
    .trim()
    .replace(/^@/, "")
    .replace(/[,%()]/g, "");
}

function initials(name: string | null) {
  return (name ?? "Someone")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function recordFriendActivity({
  actorId,
  body,
  title,
  type,
  userId,
}: {
  actorId: string;
  body: string | null;
  title: string;
  type: "friend_request" | "friend_accept";
  userId: string;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("activity_events").insert({
    user_id: userId,
    actor_id: actorId,
    quest_id: null,
    type,
    title,
    body,
  });

  if (error) {
    throw new Error(`Could not send friend activity: ${error.message}`);
  }
}
