import {
  buildLocalDemoQuestShareToken,
  getLocalDemoPublicQuestShare,
  isLocalDemoQuestId,
  isLocalDemoQuestShareToken,
} from "@/data/localDemoQuests";
import { getSupabaseClient, type Database } from "@/lib/supabaseClient";
import type {
  PublicQuestShare,
  Quest,
  QuestCategory,
  QuestStatus,
  QuestVisibility,
} from "@/types/quest";

type PublicQuestShareRow =
  Database["public"]["Functions"]["get_public_quest_share"]["Returns"][number];

const validCategories: QuestCategory[] = [
  "Food",
  "Study",
  "Fitness",
  "Outdoors",
  "Social",
  "Sidequest",
  "Other",
];
const shareTimeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const validVisibility: QuestVisibility[] = ["invite_only", "friends", "local"];

export async function createQuestShareLink(questId: string) {
  if (isLocalDemoQuestId(questId)) {
    return {
      token: buildLocalDemoQuestShareToken(questId),
      created: false,
    };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("create_quest_share_link", { target_quest_id: questId })
    .single();

  if (error) {
    throw new Error(mapShareLinkError(error.message));
  }

  if (!data || typeof data !== "object" || !("token" in data)) {
    throw new Error("Could not create share link.");
  }

  return data as { token: string; created: boolean };
}

export async function fetchPublicQuestShare(token: string) {
  if (isLocalDemoQuestShareToken(token)) {
    return getLocalDemoPublicQuestShare(token);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("get_public_quest_share", { share_token: token })
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load shared event: ${error.message}`);
  }

  return data ? mapPublicQuestShareRow(data as PublicQuestShareRow) : null;
}

export type GuestJoinResult = {
  claimToken: string;
  goingCount: number;
};

export async function guestJoinViaShare(
  shareToken: string,
  guestName: string,
): Promise<GuestJoinResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .rpc("guest_join_via_share", {
      share_token: shareToken,
      guest_name: guestName,
    })
    .single();

  if (error) {
    throw new Error(mapGuestJoinError(error.message));
  }

  if (!data || typeof data !== "object" || !("claim_token" in data)) {
    throw new Error("Could not save your RSVP. Try again.");
  }

  const row = data as { claim_token: string; going_count: number };
  return {
    claimToken: row.claim_token,
    goingCount: Number(row.going_count ?? 0),
  };
}

export async function guestCancelViaToken(claimToken: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("guest_cancel_via_token", {
    claim_token: claimToken,
  });

  if (error) {
    throw new Error("Could not cancel your RSVP. Try again.");
  }

  return Boolean(data);
}

export function mapGuestJoinError(message: string): string {
  if (message.includes("guest_name_required")) {
    return "Add your first name to RSVP.";
  }

  if (message.includes("event_full")) {
    return "This event is full.";
  }

  if (message.includes("event_closed")) {
    return "The host closed this event.";
  }

  if (message.includes("event_started")) {
    return "This event has already started.";
  }

  if (message.includes("guest_cap_reached")) {
    return "This event has reached its guest limit. Ask the host for an app invite.";
  }

  if (message.includes("share_unavailable")) {
    return "This event link is no longer active.";
  }

  return "Could not save your RSVP. Try again.";
}

export function canCreatePublicSharePreview(
  quest: Pick<Quest, "visibility" | "createdByCurrentUser">,
) {
  return quest.visibility === "local" || Boolean(quest.createdByCurrentUser);
}

export function mapPublicQuestShareRow(
  row: PublicQuestShareRow,
): PublicQuestShare {
  const goingCount = Number(row.going_count ?? 0);
  const maxPeople =
    row.max_people === null ? null : Math.max(row.max_people ?? 4, goingCount);

  return {
    token: row.token,
    questId: row.quest_id,
    title: row.title || "Untitled event",
    category: normalizeQuestCategory(row.category),
    location: row.location || "Location TBD",
    startTimeISO: row.start_time,
    startTime: formatQuestTime(row.start_time),
    startTimeRelative: formatRelativeTime(row.start_time),
    description: row.description || "Join this event on plus1.",
    cardImageUrl: row.card_image_url,
    visibility: normalizeQuestVisibility(row.visibility),
    status: normalizeStatus(row.status, row.start_time),
    hostDisplayName: row.host_display_name || "Host",
    hostHandle: row.host_handle,
    goingCount,
    maxPeople,
    createdAtISO: row.created_at,
  };
}

function mapShareLinkError(message: string) {
  if (message.includes("Only the host")) {
    return "Only the host can enable public sharing for this private event.";
  }

  if (message.includes("cannot share")) {
    return "You cannot share this event.";
  }

  if (message.includes("not found")) {
    return "That event is no longer available.";
  }

  if (message.includes("Sign in")) {
    return "Sign in to share this event.";
  }

  return `Could not create share link: ${message}`;
}

function normalizeQuestCategory(category: string | null): QuestCategory {
  if (category === "Errand") {
    return "Sidequest";
  }

  const match = validCategories.find((option) => option === category);
  return match ?? "Social";
}

function normalizeQuestVisibility(
  visibility: string | null | undefined,
): QuestVisibility {
  const match = validVisibility.find((option) => option === visibility);
  return match ?? "local";
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

function formatQuestTime(value: string | null) {
  if (!value) {
    return "ASAP";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time TBD";
  }

  return shareTimeFormatter.format(date);
}
