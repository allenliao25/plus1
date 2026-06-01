import test from "node:test";
import assert from "node:assert/strict";
import { canViewQuestForContext } from "@/lib/eventVisibility";
import type { Quest } from "@/types/quest";

const context = {
  currentUserId: "viewer",
  currentArea: "Demo Area",
  friendIds: ["friend-host"],
  invitedQuestIds: ["invited-event"],
  joinedQuestIds: ["joined-event"],
};

test("local events preserve same-area visibility", () => {
  assert.equal(
    canViewQuestForContext(makeQuest({ visibility: "local", area: "Demo Area" }), context),
    true,
  );
  assert.equal(
    canViewQuestForContext(makeQuest({ visibility: "local", area: "Other Area" }), context),
    false,
  );
});

test("invite-only events are hidden unless the user is invited, joined, or host", () => {
  assert.equal(
    canViewQuestForContext(makeQuest({ visibility: "invite_only" }), context),
    false,
  );
  assert.equal(
    canViewQuestForContext(
      makeQuest({ id: "invited-event", visibility: "invite_only" }),
      context,
    ),
    true,
  );
  assert.equal(
    canViewQuestForContext(
      makeQuest({ id: "joined-event", visibility: "invite_only" }),
      context,
    ),
    true,
  );
});

test("friends-only events are visible to accepted mutual friends and invitees", () => {
  assert.equal(
    canViewQuestForContext(
      makeQuest({ creatorId: "friend-host", visibility: "friends" }),
      context,
    ),
    true,
  );
  assert.equal(
    canViewQuestForContext(
      makeQuest({ creatorId: "stranger-host", visibility: "friends" }),
      context,
    ),
    false,
  );
  assert.equal(
    canViewQuestForContext(
      makeQuest({
        creatorId: "stranger-host",
        id: "invited-event",
        visibility: "friends",
      }),
      context,
    ),
    true,
  );
});

function makeQuest(changes: Partial<Quest> & { area?: string } = {}) {
  return {
    id: "event-1",
    creatorId: "host",
    visibility: "local",
    area: "Demo Area",
    createdByCurrentUser: false,
    joinedByCurrentUser: false,
    ...changes,
  };
}
