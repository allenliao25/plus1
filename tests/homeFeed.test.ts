import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHomeFeedModel,
  filterHomeQuests,
  getDefaultHomeFilter,
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

test("home filters return category, Tonight, and For you sets", () => {
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
    filterHomeQuests(quests, profile, "Tonight", now).map((quest) => quest.id),
    ["food-asap", "study-tonight"],
  );
  assert.deepEqual(
    filterHomeQuests(quests, profile, "For you", now).map((quest) => quest.id),
    ["food-asap", "study-tonight"],
  );
  assert.deepEqual(
    filterHomeQuests(quests, profile, "Social", now).map((quest) => quest.id),
    ["social-tomorrow"],
  );
});

test("home model defaults to For you, then Tonight, then All", () => {
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

  assert.equal(getDefaultHomeFilter(tomorrowOnly, interestedProfile, now), "All");
  assert.equal(getDefaultHomeFilter(tonightOnly, neutralProfile, now), "Tonight");
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
    selectedFilter: "All",
    now,
  });

  assert.equal(model.spotlightQuest?.id, "food");
  assert.deepEqual(
    model.rowQuests.map((quest) => quest.id),
    ["study"],
  );
});

function makeProfile(changes: Partial<Profile> = {}): Profile {
  return {
    avatarInitials: "AL",
    avatarUrl: null,
    bio: null,
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
    description: "Bring a plus one.",
    goingCount: 1,
    id: "quest-1",
    location: "Campus",
    maxPeople: 4,
    startTime: "Thu, Jan 15, 6:00 PM",
    startTimeISO: "2026-01-15T18:00:00.000Z",
    startTimeRelative: "Starts in 1h",
    status: "open",
    title: "Study break",
    ...changes,
  };
}
