import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCapacitySummary,
  formatGoingLabel,
  formatOpenSpotsLabel,
  getOpenSpotsForScore,
  isQuestFull,
} from "@/lib/questCapacity";
import type { Quest } from "@/types/quest";

test("capacity labels preserve capped event copy", () => {
  const quest = makeQuest({ goingCount: 3, maxPeople: 5 });

  assert.equal(formatGoingLabel(quest), "3/5 going");
  assert.equal(formatOpenSpotsLabel(quest), "2 open");
  assert.equal(formatCapacitySummary(quest), "3/5 going · 2 open");
  assert.equal(isQuestFull(quest), false);
});

test("capacity labels treat null max as open capacity", () => {
  const quest = makeQuest({ goingCount: 8, maxPeople: null });

  assert.equal(formatGoingLabel(quest), "8 going");
  assert.equal(formatOpenSpotsLabel(quest), "Open");
  assert.equal(formatCapacitySummary(quest), "8 going · Open");
  assert.equal(isQuestFull(quest), false);
  assert.equal(getOpenSpotsForScore(quest), 6);
});

function makeQuest(changes: Partial<Quest> = {}): Quest {
  return {
    attendees: [],
    cardImageUrl: null,
    category: "Social",
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
