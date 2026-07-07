import test from "node:test";
import assert from "node:assert/strict";
import {
  getQuestActionState,
  shouldShowChatAffordance,
} from "@/components/JoinButton";
import type { Quest } from "@/types/quest";

function buildQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: "quest-1",
    title: "Sunset run",
    category: "Fitness",
    status: "open",
    location: "Marina Green",
    startTimeISO: null,
    startTime: "Tonight",
    startTimeRelative: null,
    description: "",
    cardImageUrl: null,
    creator: "Allen",
    creatorId: "host-1",
    visibility: "local",
    goingCount: 2,
    maxPeople: null,
    attendees: [],
    ...overrides,
  };
}

test("getQuestActionState reports joined events as already in", () => {
  const state = getQuestActionState(
    buildQuest({ joinedByCurrentUser: true }),
    false,
  );
  assert.deepEqual(state, {
    label: "You're in",
    isDisabled: true,
    isPrimary: false,
  });
});

test("getQuestActionState treats hosted events as joined", () => {
  const state = getQuestActionState(
    buildQuest({ createdByCurrentUser: true }),
    false,
  );
  assert.equal(state.label, "You're in");
  assert.equal(state.isDisabled, true);
});

test("getQuestActionState disables closed events", () => {
  const state = getQuestActionState(buildQuest({ status: "closed" }), false);
  assert.deepEqual(state, {
    label: "Closed",
    isDisabled: true,
    isPrimary: false,
  });
});

test("getQuestActionState labels past events", () => {
  const state = getQuestActionState(buildQuest({ status: "past" }), false);
  assert.equal(state.label, "Past");
  assert.equal(state.isDisabled, true);
});

test("getQuestActionState blocks full events", () => {
  const state = getQuestActionState(
    buildQuest({ goingCount: 4, maxPeople: 4 }),
    false,
  );
  assert.deepEqual(state, {
    label: "Full",
    isDisabled: true,
    isPrimary: false,
  });
});

test("getQuestActionState shows joining while the request is in flight", () => {
  const state = getQuestActionState(buildQuest(), true);
  assert.deepEqual(state, {
    label: "Joining...",
    isDisabled: true,
    isPrimary: false,
  });
});

test("getQuestActionState offers a joinable primary action", () => {
  const state = getQuestActionState(buildQuest(), false);
  assert.deepEqual(state, {
    label: "Join",
    isDisabled: false,
    isPrimary: true,
  });
});

test("shouldShowChatAffordance true for a joined open event with a handler", () => {
  assert.equal(
    shouldShowChatAffordance(buildQuest({ joinedByCurrentUser: true }), true),
    true,
  );
});

test("shouldShowChatAffordance true for a hosted open event with a handler", () => {
  assert.equal(
    shouldShowChatAffordance(buildQuest({ createdByCurrentUser: true }), true),
    true,
  );
});

test("shouldShowChatAffordance false without a chat handler", () => {
  assert.equal(
    shouldShowChatAffordance(buildQuest({ joinedByCurrentUser: true }), false),
    false,
  );
});

test("shouldShowChatAffordance false when the user has not joined", () => {
  assert.equal(shouldShowChatAffordance(buildQuest(), true), false);
});

test("shouldShowChatAffordance false for local demo quests (no real thread)", () => {
  assert.equal(
    shouldShowChatAffordance(
      buildQuest({
        id: "local-demo-quest-lake-lag-walk",
        joinedByCurrentUser: true,
      }),
      true,
    ),
    false,
  );
});

test("shouldShowChatAffordance false when the event is no longer open", () => {
  assert.equal(
    shouldShowChatAffordance(
      buildQuest({ joinedByCurrentUser: true, status: "closed" }),
      true,
    ),
    false,
  );
  assert.equal(
    shouldShowChatAffordance(
      buildQuest({ createdByCurrentUser: true, status: "past" }),
      true,
    ),
    false,
  );
});
