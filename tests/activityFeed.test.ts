import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityLine,
  groupActivityEvents,
} from "@/lib/activityFeed";
import type { ActivityEvent } from "@/types/quest";

test("groupActivityEvents buckets activity like a social notification feed", () => {
  const now = new Date("2026-05-31T12:00:00");
  const today = makeActivityEvent({ id: "today", createdAtISO: "2026-05-31T09:00:00" });
  const yesterday = makeActivityEvent({
    id: "yesterday",
    createdAtISO: "2026-05-30T21:00:00",
  });
  const lastWeek = makeActivityEvent({
    id: "last-week",
    createdAtISO: "2026-05-27T21:00:00",
  });

  assert.deepEqual(
    groupActivityEvents([today, yesterday, lastWeek], now).map((section) => ({
      title: section.title,
      ids: section.events.map((event) => event.id),
    })),
    [
      { title: "Today", ids: ["today"] },
      { title: "Yesterday", ids: ["yesterday"] },
      { title: "Last 7 days", ids: ["last-week"] },
    ],
  );
});

test("buildActivityLine emphasizes actor handles and event context", () => {
  const event = makeActivityEvent({
    type: "invite",
    title: "You were invited to Night market",
    actor: {
      id: "actor-1",
      displayName: "Maya Chen",
      handle: "maya.chen",
      avatarInitials: "MC",
      avatarUrl: null,
    },
    quest: {
      id: "quest-1",
      title: "Night market",
      category: "Food",
      cardImageUrl: null,
    },
  });

  assert.deepEqual(buildActivityLine(event), {
    actorHandle: "@maya.chen",
    action: "invited you to Night market.",
    detail: null,
  });
});

test("buildActivityLine clarifies handled friend requests", () => {
  const event = makeActivityEvent({
    type: "friend_request",
    title: "Maya sent you a friend request",
    actor: {
      id: "actor-1",
      displayName: "Maya Chen",
      handle: "maya.chen",
      avatarInitials: "MC",
      avatarUrl: null,
    },
  });

  assert.deepEqual(buildActivityLine(event), {
    actorHandle: "@maya.chen",
    action: "sent you a friend request.",
    detail: "This request is no longer pending.",
  });
});

function makeActivityEvent(
  overrides: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    id: "activity-1",
    type: "join",
    title: "Maya joined Night market",
    body: null,
    actorId: "actor-1",
    actor: null,
    questId: "quest-1",
    quest: null,
    friendRequest: null,
    createdAtISO: "2026-05-31T09:00:00",
    createdAtRelative: "3h",
    isRead: false,
    ...overrides,
  };
}
