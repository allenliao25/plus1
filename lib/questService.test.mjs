import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const testPassword = process.env.PLUS1_TEST_PASSWORD;
const actorEmails = [
  process.env.PLUS1_TEST_EMAIL_HOST,
  process.env.PLUS1_TEST_EMAIL_JOINER,
  process.env.PLUS1_TEST_EMAIL_THIRD,
].filter(Boolean);

const shouldRun =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  Boolean(testPassword) &&
  actorEmails.length >= 2;

function getClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function signIn(email) {
  const client = getClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: testPassword,
  });

  if (error || !data.user) {
    throw new Error(`Could not sign in ${email}: ${error?.message ?? "unknown"}`);
  }

  return { client, userId: data.user.id };
}

async function setArea(email, area) {
  const { client, userId } = await signIn(email);
  const { error } = await client
    .from("profiles")
    .update({ area })
    .eq("id", userId);

  if (error) {
    throw new Error(`Could not set area for ${email}: ${error.message}`);
  }
}

async function createQuestAsHost(
  hostEmail,
  title,
  maxPeople,
  area = "Test Area",
  visibility = "local",
) {
  const { client, userId } = await signIn(hostEmail);
  const { data, error } = await client
    .from("quests")
    .insert({
      creator_id: userId,
      title,
      category: "Social",
      location: "Test area",
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      description: "test quest",
      area,
      visibility,
      max_people: maxPeople,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Could not create test quest: ${error?.message ?? "unknown"}`);
  }

  return { questId: data.id };
}

async function inviteUserToQuest(hostEmail, questId, inviteeEmail) {
  const [{ client, userId: inviterId }, { userId: inviteeId }] =
    await Promise.all([signIn(hostEmail), signIn(inviteeEmail)]);
  const { error } = await client.from("quest_invites").insert({
    quest_id: questId,
    inviter_id: inviterId,
    invitee_id: inviteeId,
    status: "pending",
  });

  if (error) {
    throw new Error(`Could not create invite: ${error.message}`);
  }
}

async function acceptFriendRequest(requesterEmail, addresseeEmail) {
  const { client: requesterClient, userId: requesterId } =
    await signIn(requesterEmail);
  const { client: addresseeClient, userId: addresseeId } =
    await signIn(addresseeEmail);
  const { data, error } = await requesterClient
    .from("friendships")
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: "pending",
    })
    .select("id")
    .single();

  let friendshipId = data?.id ?? null;

  if (error?.code === "23505") {
    const existing = await requesterClient
      .from("friendships")
      .select("id, status")
      .or(
        `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`,
      )
      .single();

    friendshipId = existing.data?.id ?? null;
    if (existing.data?.status === "accepted") {
      return friendshipId;
    }
    if (existing.data?.status === "declined") {
      const remove = await requesterClient
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (remove.error) {
        throw new Error(`Could not reset friendship: ${remove.error.message}`);
      }

      return acceptFriendRequest(requesterEmail, addresseeEmail);
    }
  } else if (error || !data) {
    throw new Error(`Could not create friendship: ${error?.message ?? "unknown"}`);
  }

  const update = await addresseeClient
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);

  if (update.error) {
    throw new Error(`Could not accept friendship: ${update.error.message}`);
  }

  return friendshipId;
}

async function createPendingFriendRequest(requesterEmail, addresseeEmail) {
  const { client: requesterClient, userId: requesterId } =
    await signIn(requesterEmail);
  const { userId: addresseeId } = await signIn(addresseeEmail);
  const { data, error } = await requesterClient
    .from("friendships")
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const existing = await requesterClient
      .from("friendships")
      .select("id")
      .or(
        `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`,
      )
      .single();

    if (!existing.data?.id) {
      throw new Error("Could not find existing pending friendship");
    }

    const remove = await requesterClient
      .from("friendships")
      .delete()
      .eq("id", existing.data.id);

    if (remove.error) {
      throw new Error(`Could not reset friendship: ${remove.error.message}`);
    }

    return createPendingFriendRequest(requesterEmail, addresseeEmail);
  }

  if (error || !data) {
    throw new Error(
      `Could not create pending friendship: ${error?.message ?? "unknown"}`,
    );
  }

  return data.id;
}

async function joinQuestScenario({ actorEmail, targetQuestTitle, expectError }) {
  const { client, userId } = await signIn(actorEmail);
  void userId;

  const { data: quest, error: questError } = await client
    .from("quests")
    .select("id")
    .eq("title", targetQuestTitle)
    .single();

  if (questError || !quest) {
    throw new Error(
      `Could not find quest ${targetQuestTitle}: ${questError?.message ?? "unknown"}`,
    );
  }

  const { error } = await client.rpc("join_quest_atomic", {
    target_quest_id: quest.id,
  });

  if (!expectError) {
    assert.equal(error, null, `unexpected join error: ${error?.message ?? "unknown"}`);
    return;
  }

  assert.ok(error, "expected join to fail");
  assert.match(error.message, new RegExp(expectError), "unexpected error message");
}

test("RLS prevents over-capacity joins", async (t) => {
  if (!shouldRun) {
    t.skip("Missing Supabase test env vars");
    return;
  }

  const [hostEmail, joinerEmail, thirdEmail] = actorEmails;
  const title = `plus1-capacity-${Date.now()}`;
  await Promise.all(
    [hostEmail, joinerEmail, thirdEmail]
      .filter(Boolean)
      .map((email) => setArea(email, "Test Area")),
  );
  await createQuestAsHost(hostEmail, title, 2);

  await joinQuestScenario({ actorEmail: joinerEmail, targetQuestTitle: title });

  if (thirdEmail) {
    await joinQuestScenario({
      actorEmail: thirdEmail,
      targetQuestTitle: title,
      expectError: "event_full",
    });
  }
});

test("RLS prevents host from joining own quest", async (t) => {
  if (!shouldRun) {
    t.skip("Missing Supabase test env vars");
    return;
  }

  const [hostEmail] = actorEmails;
  const title = `plus1-hostjoin-${Date.now()}`;
  await setArea(hostEmail, "Test Area");
  await createQuestAsHost(hostEmail, title, 4);

  await joinQuestScenario({
    actorEmail: hostEmail,
    targetQuestTitle: title,
    expectError: "host_cannot_join",
  });
});

test("atomic join prevents outside-area joins", async (t) => {
  if (!shouldRun || actorEmails.length < 3) {
    t.skip("Missing Supabase test env vars");
    return;
  }

  const [hostEmail, joinerEmail, thirdEmail] = actorEmails;
  const title = `plus1-area-${Date.now()}`;
  await Promise.all([
    setArea(hostEmail, "Test Area A"),
    setArea(joinerEmail, "Test Area A"),
    setArea(thirdEmail, "Test Area B"),
  ]);
  await createQuestAsHost(hostEmail, title, 4, "Test Area A");

  await joinQuestScenario({ actorEmail: joinerEmail, targetQuestTitle: title });

  await joinQuestScenario({
    actorEmail: thirdEmail,
    targetQuestTitle: title,
    expectError: "not find quest|JSON object requested|event_not_found",
  });
});

test("invite-only events are visible and joinable only for invitees", async (t) => {
  if (!shouldRun || actorEmails.length < 3) {
    t.skip("Missing Supabase test env vars");
    return;
  }

  const [hostEmail, joinerEmail, thirdEmail] = actorEmails;
  const title = `plus1-invite-only-${Date.now()}`;
  await Promise.all([
    setArea(hostEmail, "Test Area"),
    setArea(joinerEmail, "Test Area"),
    setArea(thirdEmail, "Test Area"),
  ]);
  const { questId } = await createQuestAsHost(
    hostEmail,
    title,
    4,
    "Test Area",
    "invite_only",
  );
  await inviteUserToQuest(hostEmail, questId, joinerEmail);

  await joinQuestScenario({ actorEmail: joinerEmail, targetQuestTitle: title });
  await joinQuestScenario({
    actorEmail: thirdEmail,
    targetQuestTitle: title,
    expectError: "not find quest|JSON object requested|event_not_found",
  });
});

test("friends-only events are visible to accepted mutual friends", async (t) => {
  if (!shouldRun || actorEmails.length < 3) {
    t.skip("Missing Supabase test env vars");
    return;
  }

  const [hostEmail, joinerEmail, thirdEmail] = actorEmails;
  const title = `plus1-friends-${Date.now()}`;
  await Promise.all([
    setArea(hostEmail, "Test Area"),
    setArea(joinerEmail, "Test Area"),
    setArea(thirdEmail, "Test Area"),
  ]);
  await acceptFriendRequest(hostEmail, joinerEmail);
  await createQuestAsHost(hostEmail, title, 4, "Test Area", "friends");

  await joinQuestScenario({ actorEmail: joinerEmail, targetQuestTitle: title });
  await joinQuestScenario({
    actorEmail: thirdEmail,
    targetQuestTitle: title,
    expectError: "not find quest|JSON object requested|event_not_found",
  });
});

test("pending and removed friendships do not unlock friends-only events", async (t) => {
  if (!shouldRun || actorEmails.length < 3) {
    t.skip("Missing Supabase test env vars");
    return;
  }

  const [hostEmail, joinerEmail, thirdEmail] = actorEmails;
  const pendingTitle = `plus1-pending-friends-${Date.now()}`;
  const removedTitle = `plus1-removed-friends-${Date.now()}`;
  await Promise.all([
    setArea(hostEmail, "Test Area"),
    setArea(joinerEmail, "Test Area"),
    setArea(thirdEmail, "Test Area"),
  ]);

  await createPendingFriendRequest(hostEmail, joinerEmail);
  await createQuestAsHost(hostEmail, pendingTitle, 4, "Test Area", "friends");
  await joinQuestScenario({
    actorEmail: joinerEmail,
    targetQuestTitle: pendingTitle,
    expectError: "not find quest|JSON object requested|event_not_found",
  });

  const friendshipId = await acceptFriendRequest(hostEmail, thirdEmail);
  const { client: hostClient } = await signIn(hostEmail);
  const remove = await hostClient.from("friendships").delete().eq("id", friendshipId);

  if (remove.error) {
    throw new Error(`Could not remove friendship: ${remove.error.message}`);
  }

  await createQuestAsHost(hostEmail, removedTitle, 4, "Test Area", "friends");
  await joinQuestScenario({
    actorEmail: thirdEmail,
    targetQuestTitle: removedTitle,
    expectError: "not find quest|JSON object requested|event_not_found",
  });
});
