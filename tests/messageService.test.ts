import test from "node:test";
import assert from "node:assert/strict";
import {
  buildThreadTitle,
  canOpenEventChat,
  countUnreadThreads,
  normalizeMessageBody,
  splitThreadsByKind,
} from "@/lib/messageService";
import type { MessageThread, QuestInviteProfile } from "@/types/quest";

const currentUserId = "00000000-0000-0000-0000-000000000001";
const friend: QuestInviteProfile = {
  id: "00000000-0000-0000-0000-000000000002",
  displayName: "Mina Chen",
  handle: "mina",
  avatarInitials: "MC",
  avatarUrl: null,
};

test("buildThreadTitle labels direct threads with the other friend", () => {
  assert.equal(
    buildThreadTitle({
      currentUserId,
      kind: "direct",
      participants: [
        { ...friend, id: currentUserId, displayName: "Allen" },
        friend,
      ],
      quest: null,
    }),
    "Mina Chen",
  );
});

test("buildThreadTitle labels event threads with the event title", () => {
  assert.equal(
    buildThreadTitle({
      currentUserId,
      kind: "event",
      participants: [friend],
      quest: {
        id: "event-1",
        title: "Late night boba",
        category: "Food",
        cardImageUrl: null,
      },
    }),
    "Late night boba",
  );
});

test("splitThreadsByKind and countUnreadThreads summarize inbox badges", () => {
  const threads: MessageThread[] = [
    makeThread("direct-1", "direct", 2),
    makeThread("event-1", "event", 0),
    makeThread("event-2", "event", 1),
  ];

  assert.deepEqual(
    splitThreadsByKind(threads).direct.map((thread) => thread.id),
    ["direct-1"],
  );
  assert.deepEqual(
    splitThreadsByKind(threads).event.map((thread) => thread.id),
    ["event-1", "event-2"],
  );
  assert.equal(countUnreadThreads(threads), 2);
});

test("normalizeMessageBody trims and clamps messages", () => {
  assert.equal(normalizeMessageBody("  see you there  "), "see you there");
  assert.equal(normalizeMessageBody("a".repeat(1005)).length, 1000);
});

test("canOpenEventChat only allows open joined or hosted events", () => {
  assert.equal(
    canOpenEventChat({
      status: "open",
      createdByCurrentUser: true,
      joinedByCurrentUser: false,
    }),
    true,
  );
  assert.equal(
    canOpenEventChat({
      status: "open",
      createdByCurrentUser: false,
      joinedByCurrentUser: true,
    }),
    true,
  );
  assert.equal(
    canOpenEventChat({
      status: "closed",
      createdByCurrentUser: true,
      joinedByCurrentUser: false,
    }),
    false,
  );
});

function makeThread(
  id: string,
  kind: MessageThread["kind"],
  unreadCount: number,
): MessageThread {
  return {
    id,
    kind,
    questId: kind === "event" ? id : null,
    quest: null,
    participants: [],
    title: id,
    subtitle: null,
    preview: "hello",
    lastMessageAtISO: null,
    lastMessageAtRelative: null,
    unreadCount,
  };
}
