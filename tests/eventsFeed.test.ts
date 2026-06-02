import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventsFeedModel,
  filterEventsQuests,
  getEventsFilterOptions,
  rankEventsQuests,
} from "@/components/screens/eventsFeed";
import type { Profile, Quest, QuestCategory } from "@/types/quest";

const now = new Date("2026-01-15T18:00:00.000Z");

test("events feed ranks public interest matches with images before weaker picks", () => {
  const profile = makeProfile({ interests: ["Food"] });
  const publicFood = makeQuest({
    id: "public-food",
    category: "Food",
    cardImageUrl: "https://example.com/food.jpg",
    startTimeISO: "2026-01-15T20:00:00.000Z",
  });
  const publicSocial = makeQuest({
    id: "public-social",
    category: "Social",
    startTimeISO: "2026-01-16T20:00:00.000Z",
  });

  assert.deepEqual(
    rankEventsQuests([publicSocial, publicFood], profile, new Set(), now).map(
      (quest) => quest.id,
    ),
    ["public-food", "public-social"],
  );
});

test("events feed keeps joined and hosted events finite but lower priority", () => {
  const profile = makeProfile({ interests: ["Food"] });
  const fresh = makeQuest({
    id: "fresh",
    category: "Food",
    startTimeISO: "2026-01-15T20:00:00.000Z",
  });
  const joined = makeQuest({
    id: "joined",
    category: "Food",
    joinedByCurrentUser: true,
    startTimeISO: "2026-01-15T19:00:00.000Z",
  });
  const hosted = makeQuest({
    id: "hosted",
    category: "Food",
    createdByCurrentUser: true,
    startTimeISO: "2026-01-15T18:30:00.000Z",
  });

  assert.deepEqual(
    rankEventsQuests([hosted, joined, fresh], profile, new Set(), now).map(
      (quest) => quest.id,
    ),
    ["fresh", "joined", "hosted"],
  );
});

test("events filters include tonight, friends, and category surfaces", () => {
  const friendIds = new Set(["friend-1"]);
  const tonight = makeQuest({
    id: "tonight",
    category: "Study",
    startTimeISO: "2026-01-15T21:00:00.000Z",
  });
  const friendEvent = makeQuest({
    id: "friend-event",
    category: "Social",
    creatorId: "friend-1",
    startTimeISO: "2026-01-16T21:00:00.000Z",
  });
  const food = makeQuest({
    id: "food",
    category: "Food",
    startTimeISO: "2026-01-17T21:00:00.000Z",
  });
  const quests = [tonight, friendEvent, food];

  assert.deepEqual(
    filterEventsQuests(quests, friendIds, "Tonight", now).map(
      (quest) => quest.id,
    ),
    ["tonight"],
  );
  assert.deepEqual(
    filterEventsQuests(quests, friendIds, "Friends", now).map(
      (quest) => quest.id,
    ),
    ["friend-event"],
  );
  assert.deepEqual(
    filterEventsQuests(quests, friendIds, "Food", now).map((quest) => quest.id),
    ["food"],
  );
});

test("events model filters out closed events and marks interest matches", () => {
  const profile = makeProfile({ interests: ["Outdoors"] });
  const outdoors = makeQuest({ id: "outdoors", category: "Outdoors" });
  const closed = makeQuest({
    id: "closed",
    category: "Outdoors",
    status: "closed",
  });
  const model = buildEventsFeedModel({
    acceptedFriendIds: [],
    profile,
    quests: [closed, outdoors],
    selectedFilter: "For you",
    now,
  });

  assert.deepEqual(
    model.filteredQuests.map((quest) => quest.id),
    ["outdoors"],
  );
  assert.equal(model.filteredQuests[0]?.matchesCurrentUserInterests, true);
});

test("events filters are fixed with discovery options first", () => {
  assert.deepEqual(getEventsFilterOptions(), [
    "For you",
    "Tonight",
    "Friends",
    "Food",
    "Study",
    "Fitness",
    "Outdoors",
    "Social",
    "Sidequest",
    "Other",
  ]);
});

function makeProfile(changes: Partial<Profile> = {}): Profile {
  return {
    avatarInitials: "AL",
    avatarUrl: null,
    bio: null,
    area: "Demo Area",
    displayName: "Allen",
    email: null,
    handle: "allen",
    id: "profile-1",
    interests: [],
    phone: null,
    pronouns: null,
    websiteUrl: null,
    ...changes,
  };
}

function makeQuest(changes: Partial<Quest> = {}): Quest {
  const category = changes.category ?? ("Social" satisfies QuestCategory);

  return {
    attendees: [],
    cardImageUrl: null,
    category,
    creator: "Maya",
    creatorId: "profile-2",
    description: "Bring a plus one.",
    goingCount: 1,
    id: "quest-1",
    location: "Nearby",
    maxPeople: 4,
    startTime: "Thu, Jan 15, 6:00 PM",
    startTimeISO: "2026-01-15T18:00:00.000Z",
    startTimeRelative: "Starts in 1h",
    status: "open",
    title: "Study break",
    visibility: "local",
    ...changes,
  };
}
