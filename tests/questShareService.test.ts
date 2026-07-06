import test from "node:test";
import assert from "node:assert/strict";
import {
  canCreatePublicSharePreview,
  createQuestShareLink,
  fetchPublicQuestShare,
  mapGuestJoinError,
  mapPublicQuestShareRow,
} from "@/lib/questShareService";

test("canCreatePublicSharePreview allows private preview creation only for hosts", () => {
  assert.equal(
    canCreatePublicSharePreview({
      visibility: "local",
      createdByCurrentUser: false,
    }),
    true,
  );
  assert.equal(
    canCreatePublicSharePreview({
      visibility: "friends",
      createdByCurrentUser: true,
    }),
    true,
  );
  assert.equal(
    canCreatePublicSharePreview({
      visibility: "invite_only",
      createdByCurrentUser: false,
    }),
    false,
  );
});

test("mapPublicQuestShareRow exposes only public share payload fields", () => {
  const share = mapPublicQuestShareRow({
    token: "abc123",
    quest_id: "quest-1",
    title: "Night market",
    category: "Food",
    location: "Downtown",
    start_time: null,
    description: "Soup dumplings.",
    card_image_url: null,
    visibility: "local",
    status: "open",
    host_display_name: "Maya",
    host_handle: "maya",
    going_count: 2,
    max_people: 6,
    created_at: "2026-05-31T12:00:00Z",
  });

  assert.deepEqual(Object.keys(share).sort(), [
    "cardImageUrl",
    "category",
    "createdAtISO",
    "description",
    "goingCount",
    "hostDisplayName",
    "hostHandle",
    "location",
    "maxPeople",
    "questId",
    "startTime",
    "startTimeISO",
    "startTimeRelative",
    "status",
    "title",
    "token",
    "visibility",
  ]);
  assert.equal("phone" in share, false);
  assert.equal("email" in share, false);
  assert.equal("attendees" in share, false);
  assert.equal("invitedProfiles" in share, false);
});

test("mapPublicQuestShareRow maps legacy sidequest category", () => {
  const share = mapPublicQuestShareRow({
    token: "abc123",
    quest_id: "quest-1",
    title: "Supply run",
    category: "Errand",
    location: "Downtown",
    start_time: null,
    description: "Quick pickup.",
    card_image_url: null,
    visibility: "local",
    status: "open",
    host_display_name: "Maya",
    host_handle: "maya",
    going_count: 2,
    max_people: 6,
    created_at: "2026-05-31T12:00:00Z",
  });

  assert.equal(share.category, "Sidequest");
});

test("mapPublicQuestShareRow normalizes stale overcapacity rows", () => {
  const share = mapPublicQuestShareRow({
    token: "abc123",
    quest_id: "quest-1",
    title: "Night market",
    category: "Food",
    location: "Downtown",
    start_time: null,
    description: "Soup dumplings.",
    card_image_url: null,
    visibility: "local",
    status: "open",
    host_display_name: "Maya",
    host_handle: "maya",
    going_count: 6,
    max_people: 5,
    created_at: "2026-05-31T12:00:00Z",
  });

  assert.equal(share.goingCount, 6);
  assert.equal(share.maxPeople, 6);
});

test("mapPublicQuestShareRow preserves no-cap shares", () => {
  const share = mapPublicQuestShareRow({
    token: "abc123",
    quest_id: "quest-1",
    title: "Pickup run",
    category: "Fitness",
    location: "Court",
    start_time: null,
    description: "Run a few games.",
    card_image_url: null,
    visibility: "local",
    status: "open",
    host_display_name: "Maya",
    host_handle: "maya",
    going_count: 6,
    max_people: null,
    created_at: "2026-05-31T12:00:00Z",
  });

  assert.equal(share.goingCount, 6);
  assert.equal(share.maxPeople, null);
});

test("mapGuestJoinError maps RPC exceptions to friendly guest messages", () => {
  assert.equal(
    mapGuestJoinError("guest_name_required"),
    "Add your first name to RSVP.",
  );
  assert.equal(
    mapGuestJoinError("new row violates check: event_full"),
    "This event is full.",
  );
  assert.equal(mapGuestJoinError("event_closed"), "The host closed this event.");
  assert.equal(
    mapGuestJoinError("event_started"),
    "This event has already started.",
  );
  assert.equal(
    mapGuestJoinError("guest_cap_reached"),
    "This event has reached its guest limit. Ask the host for an app invite.",
  );
  assert.equal(
    mapGuestJoinError("share_unavailable"),
    "This event link is no longer active.",
  );
  assert.equal(
    mapGuestJoinError("some unexpected db error"),
    "Could not save your RSVP. Try again.",
  );
});

test("local demo events create public preview links without Supabase UUIDs", async () => {
  const shareLink = await createQuestShareLink("local-demo-quest-dish-sunset");

  assert.deepEqual(shareLink, {
    token: "demo-quest-dish-sunset",
    created: false,
  });

  const share = await fetchPublicQuestShare(shareLink.token);

  assert.equal(share?.questId, "local-demo-quest-dish-sunset");
  assert.equal(share?.title, "Sunset loop at the Dish");
  assert.equal(share?.category, "Outdoors");
});
