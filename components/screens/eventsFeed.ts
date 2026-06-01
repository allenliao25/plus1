import { questCategories } from "@/data/demoQuests";
import type { Profile, Quest, QuestCategory } from "@/types/quest";

export type EventsFeedFilter = "For you" | "Tonight" | "Friends" | QuestCategory;

type EventsFeedModelInput = {
  acceptedFriendIds: string[];
  profile: Profile;
  quests: Quest[];
  selectedFilter: EventsFeedFilter;
  now?: Date;
};

export function buildEventsFeedModel({
  acceptedFriendIds,
  profile,
  quests,
  selectedFilter,
  now = new Date(),
}: EventsFeedModelInput) {
  const acceptedFriendIdSet = new Set(acceptedFriendIds);
  const rankedQuests = rankEventsQuests(quests, profile, acceptedFriendIdSet, now);
  const filteredQuests = filterEventsQuests(
    rankedQuests,
    acceptedFriendIdSet,
    selectedFilter,
    now,
  );

  return {
    filteredQuests,
    totalCount: filteredQuests.length,
  };
}

export function getEventsFilterOptions(): EventsFeedFilter[] {
  return ["For you", "Tonight", "Friends", ...questCategories];
}

export function rankEventsQuests(
  quests: Quest[],
  profile: Profile,
  acceptedFriendIdSet: Set<string>,
  now = new Date(),
) {
  return quests
    .filter((quest) => quest.status === "open")
    .map((quest, index) => ({
      index,
      quest: withInterestMatch(quest, profile),
      score: scoreEventsQuest(quest, profile, acceptedFriendIdSet, now),
    }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const timeDelta =
        readQuestTime(left.quest, now) - readQuestTime(right.quest, now);

      return timeDelta || left.index - right.index;
    })
    .map(({ quest }) => quest);
}

export function filterEventsQuests(
  quests: Quest[],
  acceptedFriendIdSet: Set<string>,
  filter: EventsFeedFilter,
  now = new Date(),
) {
  return quests.filter((quest) => {
    if (filter === "For you") {
      return true;
    }

    if (filter === "Tonight") {
      return isTonightQuest(quest, now);
    }

    if (filter === "Friends") {
      return isFriendEvent(quest, acceptedFriendIdSet);
    }

    return quest.category === filter;
  });
}

export function isTonightQuest(quest: Quest, now = new Date()) {
  if (!quest.startTimeISO) {
    return true;
  }

  const startTime = new Date(quest.startTimeISO);

  if (Number.isNaN(startTime.getTime())) {
    return false;
  }

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  return startTime >= dayStart && startTime <= dayEnd;
}

function scoreEventsQuest(
  quest: Quest,
  profile: Profile,
  acceptedFriendIdSet: Set<string>,
  now: Date,
) {
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);
  let score = 0;

  if (quest.visibility === "local") {
    score += 300;
  }

  if (profile.interests.includes(quest.category)) {
    score += 230;
  }

  if (isFriendEvent(quest, acceptedFriendIdSet)) {
    score += 150;
  }

  if (isTonightQuest(quest, now)) {
    score += 175;
  }

  score += getSoonScore(quest, now);

  if (quest.cardImageUrl) {
    score += 95;
  }

  score += Math.min(openSpots, 6) * 10;

  if (quest.joinedByCurrentUser) {
    score -= 220;
  }

  if (quest.createdByCurrentUser) {
    score -= 260;
  }

  if (openSpots <= 0) {
    score -= 180;
  }

  return score;
}

function isFriendEvent(quest: Quest, acceptedFriendIdSet: Set<string>) {
  return (
    quest.visibility === "friends" ||
    Boolean(quest.creatorId && acceptedFriendIdSet.has(quest.creatorId))
  );
}

function getSoonScore(quest: Quest, now: Date) {
  if (!quest.startTimeISO) {
    return 120;
  }

  const startTime = new Date(quest.startTimeISO);

  if (Number.isNaN(startTime.getTime())) {
    return 0;
  }

  const diffHours = (startTime.getTime() - now.getTime()) / 3_600_000;

  if (diffHours < 0) {
    return 0;
  }

  if (diffHours <= 2) {
    return 150;
  }

  if (diffHours <= 6) {
    return 110;
  }

  if (diffHours <= 24) {
    return 70;
  }

  if (diffHours <= 72) {
    return 30;
  }

  return 0;
}

function withInterestMatch(quest: Quest, profile: Profile): Quest {
  return {
    ...quest,
    matchesCurrentUserInterests: profile.interests.includes(quest.category),
  };
}

function readQuestTime(quest: Quest, now: Date) {
  if (!quest.startTimeISO) {
    return now.getTime();
  }

  const startTime = new Date(quest.startTimeISO).getTime();
  return Number.isNaN(startTime) ? Number.MAX_SAFE_INTEGER : startTime;
}
