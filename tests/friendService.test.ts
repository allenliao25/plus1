import test from "node:test";
import assert from "node:assert/strict";
import { resolveFriendshipState } from "@/lib/friendService";

test("resolveFriendshipState maps no relationship and self", () => {
  assert.equal(resolveFriendshipState(null, "user-1", "user-2"), "none");
  assert.equal(resolveFriendshipState(null, "user-1", "user-1"), "self");
});

test("resolveFriendshipState treats accepted friendships as mutual", () => {
  assert.equal(
    resolveFriendshipState(
      {
        requester_id: "user-1",
        addressee_id: "user-2",
        status: "accepted",
      },
      "user-2",
      "user-1",
    ),
    "friends",
  );
});

test("resolveFriendshipState distinguishes incoming and outgoing requests", () => {
  const request = {
    requester_id: "user-1",
    addressee_id: "user-2",
    status: "pending" as const,
  };

  assert.equal(resolveFriendshipState(request, "user-2", "user-1"), "incoming");
  assert.equal(resolveFriendshipState(request, "user-1", "user-2"), "outgoing");
});

test("resolveFriendshipState preserves declined state", () => {
  assert.equal(
    resolveFriendshipState(
      {
        requester_id: "user-1",
        addressee_id: "user-2",
        status: "declined",
      },
      "user-1",
      "user-2",
    ),
    "declined",
  );
});
