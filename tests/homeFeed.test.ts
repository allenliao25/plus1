import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHomeFeedModel,
  filterHomeQuests,
  getDefaultHomeFilter,
  getHomeFilterOptions,
  isHomeRecommendedQuest,
  selectHomeSpotlight,
} from "@/components/screens/homeFeed";
import type { Profile, Quest, QuestCategory } from "@/types/quest";

const now = new Date("2026-01-15T18:00:00.000Z");

test("selectHomeSpotlight favors an interest match starting soon", () => {
  const profile = makeProfile({ interests: ["Food"] });
  const soonFood = makeQuest({
    id: "soon-food",
    category: "Food",
    startTimeISO: "2026-01-15T19:00:00.000Z",
  });
  const laterSocial = makeQuest({
    id: "later-social",
    category: "Social",
    cardImageUrl: "https://example.com/social.jpg",
    startTimeISO: "2026-01-17T19:00:00.000Z",
  });

  assert.equal(
    selectHomeSpotlight([laterSocial, soonFood], profile, now)?.id,
    "soon-food",
  );
});

test("selectHomeSpotlight skips full, joined, and hosted events when a joinable option exists", () => {
  const profile = makeProfile({ interests: ["Food", "Study"] });
  const fullMatch = makeQuest({
    id: "full-match",
    category: "Food",
    goingCount: 4,
    maxPeople: 4,
    startTimeISO: "2026-01-15T18:30:00.000Z",
  });
  const joinedMatch = makeQuest({
    id: "joined-match",
    category: "Study",
    joinedByCurrentUser: true,
    startTimeISO: "2026-01-15T19:00:00.000Z",
  });
  const hostedMatch = makeQuest({
    id: "hosted-match",
    category: "Food",
    createdByCurrentUser: true,
    startTimeISO: "2026-01-15T19:30:00.000Z",
  });
  const joinableOption = makeQuest({
    id: "joinable-option",
    category: "Social",
    startTimeISO: "2026-01-16T18:00:00.000Z",
  });

  assert.equal(
    selectHomeSpotlight(
      [fullMatch, joinedMatch, hostedMatch, joinableOption],
      profile,
      now,
    )?.id,
    "joinable-option",
  );
});

test("home filters return ranked for you picks and category sets", () => {
  const profile = makeProfile({ interests: ["Food", "Study"] });
  const foodAsap = makeQuest({
    id: "food-asap",
    category: "Food",
    startTimeISO: null,
  });
  const studyTonight = makeQuest({
    id: "study-tonight",
    category: "Study",
    startTimeISO: "2026-01-15T20:00:00.000Z",
  });
  const socialTomorrow = makeQuest({
    id: "social-tomorrow",
    category: "Social",
    startTimeISO: "2026-01-16T20:00:00.000Z",
  });
  const quests = [foodAsap, studyTonight, socialTomorrow];

  assert.deepEqual(
    filterHomeQuests(quests, profile, "For you", now).map((quest) => quest.id),
    ["food-asap", "study-tonight", "social-tomorrow"],
  );
  assert.deepEqual(
    filterHomeQuests(quests, profile, "Social", now).map((quest) => quest.id),
    ["social-tomorrow"],
  );
});

test("home recommendation eligibility excludes unavailable events", () => {
  assert.equal(
    isHomeRecommendedQuest(makeQuest({ id: "full", goingCount: 4, maxPeople: 4 })),
    false,
  );
  assert.equal(
    isHomeRecommendedQuest(makeQuest({ id: "closed", status: "closed" })),
    false,
  );
  assert.equal(
    isHomeRecommendedQuest(makeQuest({ id: "past", status: "past" })),
    false,
  );
  assert.equal(
    isHomeRecommendedQuest(makeQuest({ id: "joined", joinedByCurrentUser: true })),
    false,
  );
  assert.equal(
    isHomeRecommendedQuest(makeQuest({ id: "hosted", createdByCurrentUser: true })),
    false,
  );
  assert.equal(isHomeRecommendedQuest(makeQuest({ id: "joinable" })), true);
});

test("home model filters to joinable recommendations before category filtering", () => {
  const profile = makeProfile({ interests: ["Food", "Study", "Social"] });
  const quests = [
    makeQuest({ id: "full-food", category: "Food", goingCount: 4, maxPeople: 4 }),
    makeQuest({ id: "closed-study", category: "Study", status: "closed" }),
    makeQuest({ id: "past-social", category: "Social", status: "past" }),
    makeQuest({ id: "joined-food", category: "Food", joinedByCurrentUser: true }),
    makeQuest({ id: "hosted-study", category: "Study", createdByCurrentUser: true }),
    makeQuest({ id: "joinable-food", category: "Food" }),
    makeQuest({ id: "joinable-social", category: "Social" }),
  ];

  const forYouModel = buildHomeFeedModel({
    profile,
    quests,
    selectedFilter: "For you",
    now,
  });
  const foodModel = buildHomeFeedModel({
    profile,
    quests,
    selectedFilter: "Food",
    now,
  });

  assert.deepEqual(
    forYouModel.filteredQuests.map((quest) => quest.id),
    ["joinable-food", "joinable-social"],
  );
  assert.deepEqual(
    foodModel.filteredQuests.map((quest) => quest.id),
    ["joinable-food"],
  );
});

test("home filters are fixed with For you first", () => {
  const profile = makeProfile({ interests: [] });

  assert.deepEqual(getHomeFilterOptions([], profile), [
    "For you",
    "Food",
    "Study",
    "Fitness",
    "Outdoors",
    "Social",
    "Sidequest",
    "Other",
  ]);
});

test("home model always defaults to For you", () => {
  const interestedProfile = makeProfile({ interests: ["Food"] });
  const neutralProfile = makeProfile({ interests: [] });
  const tomorrowOnly = [
    makeQuest({
      id: "tomorrow",
      category: "Social",
      startTimeISO: "2026-01-16T20:00:00.000Z",
    }),
  ];
  const tonightOnly = [
    makeQuest({
      id: "tonight",
      category: "Social",
      startTimeISO: "2026-01-15T20:00:00.000Z",
    }),
  ];

  assert.equal(getDefaultHomeFilter(tomorrowOnly, interestedProfile, now), "For you");
  assert.equal(getDefaultHomeFilter(tonightOnly, neutralProfile, now), "For you");
  assert.equal(
    getDefaultHomeFilter(
      [
        makeQuest({
          id: "food",
          category: "Food",
          startTimeISO: "2026-01-16T20:00:00.000Z",
        }),
      ],
      interestedProfile,
      now,
    ),
    "For you",
  );
});

test("buildHomeFeedModel removes the spotlight from the compact rows", () => {
  const profile = makeProfile({ interests: ["Food"] });
  const food = makeQuest({ id: "food", category: "Food" });
  const study = makeQuest({ id: "study", category: "Study" });
  const model = buildHomeFeedModel({
    profile,
    quests: [study, food],
    selectedFilter: "For you",
    now,
  });

  assert.equal(model.spotlightQuest?.id, "food");
  assert.deepEqual(
    model.rowQuests.map((quest) => quest.id),
    ["study"],
  );
});

test("home spotlight and rows are drawn from joinable recommendations", () => {
  const profile = makeProfile({ interests: ["Food"] });
  const fullFood = makeQuest({
    id: "full-food",
    category: "Food",
    goingCount: 4,
    maxPeople: 4,
    startTimeISO: "2026-01-15T18:30:00.000Z",
  });
  const joinedFood = makeQuest({
    id: "joined-food",
    category: "Food",
    joinedByCurrentUser: true,
    startTimeISO: "2026-01-15T19:00:00.000Z",
  });
  const joinableFood = makeQuest({
    id: "joinable-food",
    category: "Food",
    startTimeISO: "2026-01-15T20:00:00.000Z",
  });
  const joinableSocial = makeQuest({
    id: "joinable-social",
    category: "Social",
    startTimeISO: "2026-01-16T20:00:00.000Z",
  });

  const model = buildHomeFeedModel({
    profile,
    quests: [fullFood, joinedFood, joinableSocial, joinableFood],
    selectedFilter: "For you",
    now,
  });

  assert.equal(model.spotlightQuest?.id, "joinable-food");
  assert.deepEqual(
    model.rowQuests.map((quest) => quest.id),
    ["joinable-social"],
  );
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
