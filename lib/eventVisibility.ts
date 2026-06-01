import type { Quest, QuestVisibility } from "@/types/quest";

export type EventVisibilityContext = {
  currentUserId: string;
  currentArea: string;
  friendIds: string[];
  invitedQuestIds: string[];
  joinedQuestIds: string[];
};

export function canViewQuestForContext(
  quest: Pick<
    Quest,
    "id" | "creatorId" | "visibility" | "createdByCurrentUser" | "joinedByCurrentUser"
  > & { area?: string | null },
  context: EventVisibilityContext,
) {
  if (
    quest.createdByCurrentUser ||
    quest.joinedByCurrentUser ||
    quest.creatorId === context.currentUserId ||
    context.joinedQuestIds.includes(quest.id) ||
    context.invitedQuestIds.includes(quest.id)
  ) {
    return true;
  }

  if (quest.visibility === "local") {
    return !quest.area || quest.area === context.currentArea;
  }

  if (quest.visibility === "friends" && quest.creatorId) {
    return context.friendIds.includes(quest.creatorId);
  }

  return false;
}

export function normalizeVisibilityLabel(visibility: QuestVisibility) {
  if (visibility === "invite_only") {
    return "Invite-only";
  }

  if (visibility === "friends") {
    return "Friends";
  }

  return "Local";
}
