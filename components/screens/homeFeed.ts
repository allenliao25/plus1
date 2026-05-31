import { questCategories } from "@/data/demoQuests";
import type { Profile, Quest, QuestCategory } from "@/types/quest";

export type HomeFeedFilter = "All" | "Tonight" | "For you" | QuestCategory;
export type HomeLayoutMode = "hybrid" | "grid";

type HomeFeedModelInput = {
  quests: Quest[];
  profile: Profile;
  selectedFilter: HomeFeedFilter;
  now?: Date;
};

export function buildHomeFeedModel({
  quests,
  profile,
  selectedFilter,
  now = new Date(),
}: HomeFeedModelInput) {
  const rankedQuests = rankHomeQuests(quests, profile, now);
  const filteredQuests = filterHomeQuests(
    rankedQuests,
    profile,
    selectedFilter,
    now,
  );
  const spotlightQuest = selectHomeSpotlight(filteredQuests, profile, now);
  const rowQuests = spotlightQuest
    ? filteredQuests.filter((quest) => quest.id !== spotlightQuest.id)
    : filteredQuests;

  return {
    filteredQuests,
    forYouCount: countForYouQuests(quests, profile),
    rowQuests,
    spotlightQuest,
    tonightCount: countTonightQuests(quests, now),
  };
}

export function getDefaultHomeFilter(
  quests: Quest[],
  profile: Profile,
  now = new Date(),
): HomeFeedFilter {
  if (countForYouQuests(quests, profile) > 0) {
    return "For you";
  }

  if (countTonightQuests(quests, now) > 0) {
    return "Tonight";
  }

  return "All";
}

export function getHomeFilterOptions(
  quests: Quest[],
  profile: Profile,
): HomeFeedFilter[] {
  const populatedCategories = questCategories.filter((category) =>
    quests.some((quest) => quest.category === category),
  );
  const filters: HomeFeedFilter[] = ["All", "Tonight"];

  if (profile.interests.length > 0) {
    filters.push("For you");
  }

  return [...filters, ...populatedCategories];
}

export function rankHomeQuests(
  quests: Quest[],
  profile: Profile,
  now = new Date(),
) {
  return quests
    .map((quest, index) => ({
      index,
      quest: withInterestMatch(quest, profile),
      score: scoreHomeQuest(quest, profile, now),
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

export function filterHomeQuests(
  quests: Quest[],
  profile: Profile,
  filter: HomeFeedFilter,
  now = new Date(),
) {
  return quests.filter((quest) => {
    if (filter === "All") {
      return true;
    }

    if (filter === "Tonight") {
      return isTonightQuest(quest, now);
    }

    if (filter === "For you") {
      return profile.interests.includes(quest.category);
    }

    return quest.category === filter;
  });
}

export function selectHomeSpotlight(
  quests: Quest[],
  profile: Profile,
  now = new Date(),
) {
  const rankedQuests = rankHomeQuests(quests, profile, now);
  const freshJoinableQuests = rankedQuests.filter(isFreshJoinableQuest);
  const candidateQuests =
    freshJoinableQuests.length > 0 ? freshJoinableQuests : rankedQuests;

  return candidateQuests[0] ?? null;
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

function scoreHomeQuest(quest: Quest, profile: Profile, now: Date) {
  const isInterestMatch = profile.interests.includes(quest.category);
  const hasImage = Boolean(quest.cardImageUrl);
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);
  let score = 0;

  if (isFreshJoinableQuest(quest)) {
    score += 260;
  } else if (isOpenQuest(quest) && !isFullQuest(quest)) {
    score += 80;
  }

  if (isInterestMatch) {
    score += 220;
  }

  if (isTonightQuest(quest, now)) {
    score += 190;
  }

  score += getSoonScore(quest, now);

  if (hasImage) {
    score += 55;
  }

  return score + Math.min(openSpots, 6) * 4;
}

function getSoonScore(quest: Quest, now: Date) {
  if (!quest.startTimeISO) {
    return 130;
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
    return 115;
  }

  if (diffHours <= 24) {
    return 70;
  }

  if (diffHours <= 72) {
    return 25;
  }

  return 0;
}

function withInterestMatch(quest: Quest, profile: Profile): Quest {
  return {
    ...quest,
    matchesCurrentUserInterests: profile.interests.includes(quest.category),
  };
}

function countForYouQuests(quests: Quest[], profile: Profile) {
  return quests.filter((quest) => profile.interests.includes(quest.category))
    .length;
}

function countTonightQuests(quests: Quest[], now: Date) {
  return quests.filter((quest) => isTonightQuest(quest, now)).length;
}

function isFreshJoinableQuest(quest: Quest) {
  return (
    isOpenQuest(quest) &&
    !isFullQuest(quest) &&
    !quest.joinedByCurrentUser &&
    !quest.createdByCurrentUser
  );
}

function isOpenQuest(quest: Quest) {
  return quest.status === "open";
}

function isFullQuest(quest: Quest) {
  return quest.goingCount >= quest.maxPeople;
}

function readQuestTime(quest: Quest, now: Date) {
  if (!quest.startTimeISO) {
    return now.getTime();
  }

  const startTime = new Date(quest.startTimeISO).getTime();
  return Number.isNaN(startTime) ? Number.MAX_SAFE_INTEGER : startTime;
}
