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

async function createQuestAsHost(hostEmail, title, maxPeople) {
  const { client, userId } = await signIn(hostEmail);
  const { data, error } = await client
    .from("quests")
    .insert({
      creator_id: userId,
      title,
      category: "Social",
      location: "Test campus",
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      description: "test quest",
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

async function joinQuestScenario({ actorEmail, targetQuestTitle, expectError }) {
  const { client, userId } = await signIn(actorEmail);
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

  const { error } = await client.from("quest_joins").insert({
    quest_id: quest.id,
    user_id: userId,
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
  await createQuestAsHost(hostEmail, title, 2);

  await joinQuestScenario({ actorEmail: joinerEmail, targetQuestTitle: title });

  if (thirdEmail) {
    await joinQuestScenario({
      actorEmail: thirdEmail,
      targetQuestTitle: title,
      expectError: "row-level security|violates",
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
  await createQuestAsHost(hostEmail, title, 4);

  await joinQuestScenario({
    actorEmail: hostEmail,
    targetQuestTitle: title,
    expectError: "row-level security|violates",
  });
});
