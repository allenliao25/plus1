import assert from "node:assert/strict";
import test from "node:test";
import { getProfileEventStats } from "@/lib/profileEventStats";
import type { Quest, QuestAttendee } from "@/types/quest";

test("profile event stats separate hosted and attended visible events", () => {
  const stats = getProfileEventStats(
    [
      makeQuest({ id: "hosted", creatorId: "profile-1" }),
      makeQuest({
        id: "attended",
        attendees: [makeAttendee("profile-1", false)],
        creatorId: "profile-2",
      }),
      makeQuest({
        id: "past-hosted",
        creatorId: "profile-1",
        status: "past",
      }),
      makeQuest({
        id: "unrelated",
        attendees: [makeAttendee("profile-3", false)],
        creatorId: "profile-2",
      }),
    ],
    "profile-1",
  );

  assert.deepEqual(
    stats.hosted.map((quest) => quest.id),
    ["hosted", "past-hosted"],
  );
  assert.deepEqual(
    stats.attended.map((quest) => quest.id),
    ["attended"],
  );
  assert.equal(stats.events.length, 4);
});

test("profile event stats do not double-count host attendee rows as attended", () => {
  const stats = getProfileEventStats(
    [
      makeQuest({
        id: "host-attendee",
        attendees: [makeAttendee("profile-1", true)],
        creatorId: "profile-1",
      }),
    ],
    "profile-1",
  );

  assert.equal(stats.hosted.length, 1);
  assert.equal(stats.attended.length, 0);
});

test("profile event stats only use current-user flags when requested", () => {
  const currentUserQuest = makeQuest({
    id: "current-user-hosted",
    createdByCurrentUser: true,
    creatorId: "current-user",
  });

  assert.equal(
    getProfileEventStats([currentUserQuest], "profile-1").hosted.length,
    0,
  );
  assert.equal(
    getProfileEventStats([currentUserQuest], "profile-1", {
      includeCurrentUserFlags: true,
    }).hosted.length,
    1,
  );
});

function makeAttendee(id: string, isHost: boolean): QuestAttendee {
  return {
    id,
    displayName: "Attendee",
    avatarInitials: "AT",
    avatarUrl: null,
    isHost,
  };
}

function makeQuest(changes: Partial<Quest> = {}): Quest {
  return {
    id: "quest-1",
    title: "Dinner",
    category: "Food",
    status: "open",
    location: "Yaga",
    startTimeISO: null,
    startTime: "Tonight",
    startTimeRelative: "Starts in 2h",
    description: "Food with people.",
    cardImageUrl: null,
    creator: "Allen Liao",
    creatorId: "profile-1",
    visibility: "local",
    goingCount: 1,
    maxPeople: 4,
    attendees: [],
    ...changes,
  };
}
