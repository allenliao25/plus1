import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type DemoProfile = {
  slug: string;
  displayName: string;
  handle: string;
  phone: string;
  initials: string;
  bio: string;
  pronouns: string | null;
  interests: string[];
  palette: {
    bg: string;
    skin: string;
    hair: string;
    top: string;
    accent: string;
  };
};

type DemoEvent = {
  slug: string;
  hostSlug: string;
  title: string;
  category:
    | "Food"
    | "Study"
    | "Fitness"
    | "Outdoors"
    | "Social"
    | "Sidequest"
    | "Other";
  location: string;
  startsInHours: number;
  description: string;
  maxPeople: number;
};

type DemoEventSeed = [
  slug: string,
  hostSlug: string,
  title: string,
  category: DemoEvent["category"],
  location: string,
  startsInHours: number,
  description: string,
  maxPeople: number,
];

type ResolvedProfile = DemoProfile & {
  id: string;
  avatarUrl: string | null;
};

const validEventCategories = new Set<DemoEvent["category"]>([
  "Food",
  "Study",
  "Fitness",
  "Outdoors",
  "Social",
  "Sidequest",
  "Other",
]);
const validEventVisibilities = new Set(["invite_only", "friends", "local"]);
const DEMO_HANDLE_PREFIX = "demo.plus1.";
const DEMO_AREA = "Bay Area, CA";
const DEMO_EVENT_VISIBILITY = "local";
const PROFILE_BUCKET = "profile-photos";
const DEFAULT_OWNER_HANDLES = ["mnijungkook", "bawllen_", "allen.b042c128"];
const argv = new Set(process.argv.slice(2));
const shouldApply = argv.has("--apply");
const shouldCleanup = argv.has("--cleanup");
const shouldDryRun = argv.has("--dry-run") || (!shouldApply && !shouldCleanup);

loadEnvFile(".env.local");
loadEnvFile(".vercel/.env.production.local");

if ((shouldApply ? 1 : 0) + (shouldCleanup ? 1 : 0) > 1) {
  throw new Error("Choose only one mutating mode: --apply or --cleanup.");
}

const demoProfiles: DemoProfile[] = [
  {
    slug: "kook",
    displayName: "Kook Min",
    handle: "demo.plus1.kook",
    phone: "+15559001001",
    initials: "KM",
    bio: "Night-market food runs, film photos, and low-key karaoke tables.",
    pronouns: "he/him",
    interests: ["Food", "Social", "Outdoors"],
    palette: {
      bg: "#dbeafe",
      skin: "#d7a579",
      hair: "#16181d",
      top: "#2f2a85",
      accent: "#7dd3fc",
    },
  },
  {
    slug: "tay",
    displayName: "Tay Reed",
    handle: "demo.plus1.tay",
    phone: "+15559001002",
    initials: "TR",
    bio: "Always down for coffee walks, lyric debates, and cozy study rooms.",
    pronouns: "she/her",
    interests: ["Study", "Social", "Food"],
    palette: {
      bg: "#fef3c7",
      skin: "#f1c27d",
      hair: "#d7a05f",
      top: "#b91c1c",
      accent: "#f472b6",
    },
  },
  {
    slug: "ari",
    displayName: "Ari Vale",
    handle: "demo.plus1.ari",
    phone: "+15559001003",
    initials: "AV",
    bio: "Matcha, pilates, pop playlists, and spontaneous dessert plans.",
    pronouns: "she/her",
    interests: ["Fitness", "Food", "Social"],
    palette: {
      bg: "#fae8ff",
      skin: "#c98f67",
      hair: "#4a2f27",
      top: "#f0abfc",
      accent: "#ffffff",
    },
  },
  {
    slug: "sabrina",
    displayName: "Sabrina Lane",
    handle: "demo.plus1.sabrina",
    phone: "+15559001004",
    initials: "SL",
    bio: "Espresso before everything. Loves concerts, thrifting, and brunch.",
    pronouns: "she/her",
    interests: ["Food", "Social", "Other"],
    palette: {
      bg: "#fee2e2",
      skin: "#e0a36f",
      hair: "#f5d08a",
      top: "#111827",
      accent: "#f97316",
    },
  },
  {
    slug: "sol",
    displayName: "Sol Ana",
    handle: "demo.plus1.sol",
    phone: "+15559001005",
    initials: "SA",
    bio: "R&B playlists, farmers markets, deep talks, and sunset hikes.",
    pronouns: "she/her",
    interests: ["Outdoors", "Social", "Food"],
    palette: {
      bg: "#dcfce7",
      skin: "#9f6a48",
      hair: "#2d1b16",
      top: "#065f46",
      accent: "#facc15",
    },
  },
  {
    slug: "benito",
    displayName: "Benito Cruz",
    handle: "demo.plus1.benito",
    phone: "+15559001006",
    initials: "BC",
    bio: "Beach volleyball energy, late dinners, and loud car playlists.",
    pronouns: "he/him",
    interests: ["Fitness", "Food", "Social"],
    palette: {
      bg: "#ccfbf1",
      skin: "#b9794c",
      hair: "#1f2937",
      top: "#0f766e",
      accent: "#f59e0b",
    },
  },
  {
    slug: "driz",
    displayName: "Noah Brooks",
    handle: "demo.plus1.driz",
    phone: "+15559001007",
    initials: "NB",
    bio: "Pickup hoops, moody playlists, and ordering for the table.",
    pronouns: "he/him",
    interests: ["Fitness", "Food", "Social"],
    palette: {
      bg: "#e0e7ff",
      skin: "#8f5f3d",
      hair: "#111827",
      top: "#1d4ed8",
      accent: "#60a5fa",
    },
  },
  {
    slug: "olivia",
    displayName: "Liv Morgan",
    handle: "demo.plus1.liv",
    phone: "+15559001008",
    initials: "LM",
    bio: "Study sprints, sad-girl playlists, and boba after deadlines.",
    pronouns: "she/her",
    interests: ["Study", "Food", "Social"],
    palette: {
      bg: "#ede9fe",
      skin: "#d9a170",
      hair: "#2f1b14",
      top: "#7c3aed",
      accent: "#c4b5fd",
    },
  },
  {
    slug: "ty",
    displayName: "Tyler Bloom",
    handle: "demo.plus1.ty",
    phone: "+15559001009",
    initials: "TB",
    bio: "Design nerd, bike rides, weird movies, and farmers market mornings.",
    pronouns: "he/him",
    interests: ["Outdoors", "Other", "Social"],
    palette: {
      bg: "#ffedd5",
      skin: "#6f4428",
      hair: "#0f172a",
      top: "#ea580c",
      accent: "#fef08a",
    },
  },
  {
    slug: "billie",
    displayName: "Billie Ray",
    handle: "demo.plus1.billie",
    phone: "+15559001010",
    initials: "BR",
    bio: "Quiet corners, night walks, green rooms, and experimental music.",
    pronouns: "they/them",
    interests: ["Outdoors", "Other", "Social"],
    palette: {
      bg: "#d9f99d",
      skin: "#efbd8c",
      hair: "#172554",
      top: "#365314",
      accent: "#84cc16",
    },
  },
  {
    slug: "ri",
    displayName: "Ria Fenty",
    handle: "demo.plus1.ria",
    phone: "+15559001011",
    initials: "RF",
    bio: "Good food, sharp outfits, and showing up exactly when it gets fun.",
    pronouns: "she/her",
    interests: ["Food", "Social", "Other"],
    palette: {
      bg: "#fce7f3",
      skin: "#7c4a33",
      hair: "#111111",
      top: "#be123c",
      accent: "#fb7185",
    },
  },
  {
    slug: "dua",
    displayName: "Dua Park",
    handle: "demo.plus1.dua",
    phone: "+15559001012",
    initials: "DP",
    bio: "Dance floors, tennis rallies, gallery nights, and dessert menus.",
    pronouns: "she/her",
    interests: ["Fitness", "Social", "Other"],
    palette: {
      bg: "#cffafe",
      skin: "#c68656",
      hair: "#3f1f17",
      top: "#0891b2",
      accent: "#f9a8d4",
    },
  },
  {
    slug: "kendrick",
    displayName: "Ken Lamar",
    handle: "demo.plus1.ken",
    phone: "+15559001013",
    initials: "KL",
    bio: "Poetry nights, pickup games, and actual focus during study blocks.",
    pronouns: "he/him",
    interests: ["Study", "Fitness", "Social"],
    palette: {
      bg: "#e5e7eb",
      skin: "#5b3726",
      hair: "#0f0f0f",
      top: "#374151",
      accent: "#f59e0b",
    },
  },
  {
    slug: "rosie",
    displayName: "Rosie Moon",
    handle: "demo.plus1.rosie",
    phone: "+15559001014",
    initials: "RM",
    bio: "Cafe hopping, dance practice, and finding the best photo booth.",
    pronouns: "she/her",
    interests: ["Food", "Fitness", "Social"],
    palette: {
      bg: "#fbcfe8",
      skin: "#f0b98d",
      hair: "#f6d7ad",
      top: "#831843",
      accent: "#f472b6",
    },
  },
  {
    slug: "haru",
    displayName: "Haru Styles",
    handle: "demo.plus1.haru",
    phone: "+15559001015",
    initials: "HS",
    bio: "Vinyl nights, long walks, matcha, and impromptu dinner tables.",
    pronouns: "he/him",
    interests: ["Outdoors", "Food", "Social"],
    palette: {
      bg: "#ecfccb",
      skin: "#d8a06e",
      hair: "#5a3927",
      top: "#166534",
      accent: "#fef3c7",
    },
  },
  {
    slug: "miley",
    displayName: "Mila Cyrus",
    handle: "demo.plus1.mila",
    phone: "+15559001016",
    initials: "MC",
    bio: "Climbing gym regular, raspy karaoke, and breakfast for dinner.",
    pronouns: "she/her",
    interests: ["Fitness", "Food", "Outdoors"],
    palette: {
      bg: "#fef9c3",
      skin: "#e0a46f",
      hair: "#b77949",
      top: "#a16207",
      accent: "#ef4444",
    },
  },
  {
    slug: "weeknd",
    displayName: "Abel Stone",
    handle: "demo.plus1.abel",
    phone: "+15559001017",
    initials: "AS",
    bio: "Late-night study playlists, moody lighting, and diner pancakes.",
    pronouns: "he/him",
    interests: ["Study", "Food", "Social"],
    palette: {
      bg: "#fee2e2",
      skin: "#8b5639",
      hair: "#18181b",
      top: "#991b1b",
      accent: "#fca5a5",
    },
  },
  {
    slug: "meg",
    displayName: "Megan H.",
    handle: "demo.plus1.meg",
    phone: "+15559001018",
    initials: "MH",
    bio: "Leg day, hot food, big laughs, and never skipping the aux.",
    pronouns: "she/her",
    interests: ["Fitness", "Food", "Social"],
    palette: {
      bg: "#f5d0fe",
      skin: "#7f4a32",
      hair: "#121212",
      top: "#a21caf",
      accent: "#facc15",
    },
  },
  {
    slug: "lorde",
    displayName: "Ella North",
    handle: "demo.plus1.ella",
    phone: "+15559001019",
    initials: "EN",
    bio: "Library windows, long essays, beach air, and tiny concerts.",
    pronouns: "she/her",
    interests: ["Study", "Outdoors", "Other"],
    palette: {
      bg: "#d1fae5",
      skin: "#d19a6e",
      hair: "#2a1712",
      top: "#047857",
      accent: "#a7f3d0",
    },
  },
  {
    slug: "bruno",
    displayName: "Bruno Vale",
    handle: "demo.plus1.bruno",
    phone: "+15559001020",
    initials: "BV",
    bio: "Dancey playlists, grill nights, and making any group chat louder.",
    pronouns: "he/him",
    interests: ["Food", "Social", "Fitness"],
    palette: {
      bg: "#fed7aa",
      skin: "#a86943",
      hair: "#1c1917",
      top: "#7c2d12",
      accent: "#fb923c",
    },
  },
];

const demoEventSeeds: DemoEventSeed[] = [
  ["dumpling-after-dark", "kook", "Dumplings after dark", "Food", "Downtown Palo Alto", 4, "Ordering way too many plates and sharing rides back.", 8],
  ["espresso-study", "sabrina", "Espresso study table", "Study", "Coupa Green Library", 3, "Quiet pomodoro blocks with a pastry break after the first hour.", 6],
  ["aoerc-leg-day", "meg", "AOERC leg day", "Fitness", "AOERC", 6, "Beginner-friendly lift, machines first, stretching after.", 5],
  ["dish-golden-hour", "sol", "Golden hour at the Dish", "Outdoors", "Stanford Dish", 7, "Easy loop, photo stops, and no racing up the hill.", 10],
  ["coho-open-mic", "haru", "CoHo open mic table", "Social", "CoHo", 8, "Saving seats early and cheering for anyone brave enough to perform.", 7],
  ["thrift-loop", "ty", "Menlo thrift loop", "Sidequest", "Menlo Park", 28, "Looking for jackets, weird lamps, and dorm room upgrades.", 6],
  ["boba-debug", "olivia", "Boba debug sprint", "Study", "Huang Basement", 5, "Bring one bug, leave with either a fix or emotional support.", 5],
  ["pickleball-rookies", "benito", "Rookie pickleball", "Fitness", "Wilbur Courts", 9, "We have two extra paddles and extremely forgiving rules.", 4],
  ["lake-lag-reset", "billie", "Lake Lag reset walk", "Outdoors", "Lake Lagunita", 2, "Tiny reset walk before the evening gets packed.", 6],
  ["late-night-pancakes", "weeknd", "Late-night pancakes", "Food", "Palo Alto Creamery", 13, "Breakfast food at the wrong time with the right people.", 8],
  ["vinyl-listening", "tay", "Vinyl listening night", "Social", "Stern Lounge", 30, "Bring one song rec and prepare to defend it dramatically.", 9],
  ["ceramics-dropin", "lorde", "Ceramics drop-in", "Sidequest", "Roble Arts Gym", 34, "Making tiny imperfect bowls. No experience needed.", 5],
  ["farmers-market", "ri", "Farmers market breakfast", "Food", "California Ave", 40, "Pastries first, fruit second, coffee always.", 7],
  ["whiteboard-algos", "kendrick", "Whiteboard algorithms review", "Study", "Huang Basement", 24, "Graphs, DP, and interview practice without the panic.", 6],
  ["sunset-tennis", "dua", "Sunset tennis rallies", "Fitness", "Taube Courts", 26, "Casual rallies, no scorekeeping unless the vibes demand it.", 4],
  ["photo-walk", "rosie", "Campus photo walk", "Outdoors", "Main Quad", 11, "Portraits, architecture, and golden-hour overthinking.", 8],
  ["indie-movie", "ty", "Indie movie vote", "Social", "Stern Lounge", 32, "Low-stakes movie vote, popcorn provided, blankets encouraged.", 10],
  ["ramen-ride", "benito", "Ramen ride-share", "Food", "Ramen Nagi", 18, "Splitting rides and debating which broth wins.", 6],
  ["essay-cafe", "lorde", "Essay cafe lock-in", "Study", "Blue Bottle Palo Alto", 21, "Two focused hours, then everyone gets to complain for five minutes.", 5],
  ["morning-yoga", "ari", "Morning yoga reset", "Fitness", "EVGR Lawn", 16, "Slow flow, beginner friendly, bring a towel or mat.", 8],
  ["dish-power-walk", "miley", "Dish power walk", "Outdoors", "Stanford Dish", 48, "Fast-ish pace, podcast recs, back before lunch.", 7],
  ["karaoke-table", "kook", "Karaoke table", "Social", "Music Tunnel KTV", 54, "No judgment, only harmonies and dramatic bridges.", 8],
  ["bookstore-browse", "lorde", "Bookstore browse", "Other", "Kepler's Books", 60, "Browsing first, recommendations after, coffee nearby.", 5],
  ["taco-night", "bruno", "Taco night run", "Food", "Sancho's Taqueria", 22, "Ordering family-style and trying at least one new salsa.", 9],
  ["chem-review", "tay", "Chem review sprint", "Study", "Green Library", 27, "Practice problems, shared notes, and a strict snack policy.", 6],
  ["bouldering-basics", "miley", "Bouldering basics", "Fitness", "Stanford Climbing Wall", 29, "Intro routes and cheering for every attempt.", 5],
  ["baylands-birds", "sol", "Baylands bird walk", "Outdoors", "Palo Alto Baylands", 52, "Slow walk, binoculars optional, nature facts encouraged.", 6],
  ["game-night", "driz", "Board game night", "Social", "Lagunita Lounge", 33, "Fast games first, chaotic alliances later.", 10],
  ["record-store", "billie", "Record store crawl", "Sidequest", "The Record Man", 70, "Digging through bins and making each other buy one wildcard.", 5],
  ["brunch-table", "sabrina", "Brunch table for six", "Food", "Joanie's Cafe", 38, "Pancakes, omelets, gossip, and no one leaves hungry.", 6],
  ["cs-office-hours", "kendrick", "Unofficial CS office hours", "Study", "Gates B12", 10, "Peer help for whoever is stuck. Bring your laptop charged.", 8],
  ["track-intervals", "dua", "Track intervals", "Fitness", "Cobb Track", 14, "Short intervals, plenty of rest, all speeds welcome.", 8],
  ["quad-picnic", "rosie", "Main Quad picnic", "Outdoors", "Main Quad", 20, "Blankets, snacks, and pretending we are not checking email.", 10],
  ["playlist-swap", "weeknd", "Playlist swap", "Social", "EVGR Lounge", 36, "Everyone adds three songs. Skips require a speech.", 8],
  ["gallery-popin", "ri", "Gallery pop-in", "Other", "Anderson Collection", 44, "A quick art reset and then coffee nearby.", 6],
  ["sushi-counter", "ari", "Sushi counter hunt", "Food", "Sushi Tomo", 46, "Small group dinner and a very serious roll ranking.", 5],
  ["stats-review", "lorde", "Stats review circle", "Study", "Huang Basement", 58, "Confidence intervals, practice exams, and shared whiteboards.", 6],
  ["soccer-pickup", "bruno", "Casual soccer pickup", "Fitness", "Roble Field", 17, "Short-sided games, rotating teams, all skill levels.", 12],
  ["windy-hill", "haru", "Windy Hill mini hike", "Outdoors", "Windy Hill Preserve", 72, "Morning hike, carpool coordination, bring water.", 8],
  ["mocktail-night", "meg", "Mocktail night", "Social", "Mirrielees Lounge", 64, "Making dramatic drinks with zero actual bartending skill.", 9],
];

const demoEvents: DemoEvent[] = demoEventSeeds.map(
  ([
    slug,
    hostSlug,
    title,
    category,
    location,
    startsInHours,
    description,
    maxPeople,
  ]) => ({
    slug,
    hostSlug,
    title,
    category,
    location,
    startsInHours,
    description,
    maxPeople,
  }),
);

async function main() {
  validateFixtures();

  if (shouldDryRun) {
    printDryRunSummary();
    return;
  }

  const supabase = createAdminClient();

  if (shouldCleanup) {
    await cleanupDemoData(supabase);
    return;
  }

  const owner = await findDemoOwner(supabase);
  const profiles = await ensureDemoProfiles(supabase);
  await ensureDemoEventsAndSocialGraph(supabase, profiles, owner);
  console.log("Seed complete.");
}

function createAdminClient() {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findDemoOwner(supabase: SupabaseClient) {
  const configuredHandle = process.env.PLUS1_DEMO_OWNER_HANDLE?.trim();
  const handles = configuredHandle
    ? [configuredHandle]
    : DEFAULT_OWNER_HANDLES;

  for (const handle of handles) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, area")
      .eq("handle", handle)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not find demo owner ${handle}: ${error.message}`);
    }

    if (data?.id) {
      console.log(`Using demo owner @${data.handle}.`);
      return data as {
        id: string;
        display_name: string | null;
        handle: string;
        area: string | null;
      };
    }
  }

  console.log("No demo owner profile found; seeding standalone demo network.");
  return null;
}

async function ensureDemoProfiles(supabase: SupabaseClient) {
  const resolved: ResolvedProfile[] = [];

  for (const profile of demoProfiles) {
    const id = await ensureAuthUserAndProfile(supabase, profile);
    const avatarUrl = await uploadAvatar(supabase, id, profile);

    await checked(
      supabase
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id),
      `update avatar for ${profile.handle}`,
    );

    resolved.push({ ...profile, id, avatarUrl });
  }

  console.log(`Profiles ready: ${resolved.length}.`);
  return resolved;
}

async function ensureAuthUserAndProfile(
  supabase: SupabaseClient,
  profile: DemoProfile,
) {
  const existing = await getProfileByHandle(supabase, profile.handle);

  if (existing?.id) {
    await checked(
      supabase
        .from("profiles")
        .update(profilePayload(profile))
        .eq("id", existing.id),
      `update profile ${profile.handle}`,
    );
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    phone: profile.phone,
    phone_confirm: true,
    user_metadata: {
      demo_seed: true,
      full_name: profile.displayName,
      handle: profile.handle,
    },
  });

  if (error && /already|registered|exists/i.test(error.message)) {
    const userId = await findAuthUserIdByPhone(supabase, profile.phone);

    if (userId) {
      await checked(
        supabase.from("profiles").upsert({
          id: userId,
          ...profilePayload(profile),
        }),
        `upsert profile ${profile.handle}`,
      );
      return userId;
    }
  }

  if (error || !data.user?.id) {
    throw new Error(
      `Could not create auth user ${profile.handle}: ${
        error?.message ?? "missing user id"
      }`,
    );
  }

  await checked(
    supabase.from("profiles").upsert({
      id: data.user.id,
      ...profilePayload(profile),
    }),
    `upsert profile ${profile.handle}`,
  );

  return data.user.id;
}

function profilePayload(profile: DemoProfile) {
  return {
    display_name: profile.displayName,
    handle: profile.handle,
    phone: profile.phone,
    avatar_initials: profile.initials,
    bio: profile.bio,
    pronouns: profile.pronouns,
    area: DEMO_AREA,
    interests: profile.interests,
    updated_at: new Date().toISOString(),
  };
}

async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  profile: DemoProfile,
) {
  const path = `${userId}/demo-avatar.svg`;
  const avatar = buildAvatarSvg(profile);

  await checked(
    supabase.storage.from(PROFILE_BUCKET).upload(path, avatar, {
      cacheControl: "3600",
      contentType: "image/svg+xml",
      upsert: true,
    }),
    `upload avatar ${profile.handle}`,
  );

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);

  return `${publicUrl}?v=demo-seed-1`;
}

async function ensureDemoEventsAndSocialGraph(
  supabase: SupabaseClient,
  profiles: ResolvedProfile[],
  owner: { id: string; display_name: string | null; handle: string } | null,
) {
  const profilesBySlug = new Map(profiles.map((profile) => [profile.slug, profile]));
  const events = demoEvents.map((event, index) => {
    const host = profilesBySlug.get(event.hostSlug);

    if (!host) {
      throw new Error(`Missing host fixture ${event.hostSlug}`);
    }

    return {
      id: eventId(event.slug),
      creator_id: host.id,
      title: event.title,
      category: event.category,
      location: event.location,
      start_time: hoursFromNow(event.startsInHours),
      description: event.description,
      card_image_url: null,
      area: DEMO_AREA,
      visibility: DEMO_EVENT_VISIBILITY,
      max_people: event.maxPeople,
      status: "open",
      created_at: hoursFromNow(-index - 1),
    };
  });

  await upsertDemoEvents(supabase, events);

  const joins = buildQuestJoins(profiles, owner?.id ?? null);
  await checked(
    supabase.from("quest_joins").upsert(joins, {
      onConflict: "quest_id,user_id",
    }),
    "upsert demo joins",
  );

  const friendships = buildFriendships(profiles, owner?.id ?? null);
  await clearDemoFriendships(supabase, profiles.map((profile) => profile.id));
  await checked(supabase.from("friendships").insert(friendships), "insert demo friendships");

  await seedDirectMessages(supabase, profiles, owner?.id ?? null);
  await seedEventMessages(supabase, profiles);
  await seedActivity(supabase, profiles, owner?.id ?? null);

  console.log(
    `Events ready: ${events.length}; joins: ${joins.length}; friendships: ${friendships.length}.`,
  );
}

async function upsertDemoEvents(
  supabase: SupabaseClient,
  events: {
    id: string;
    creator_id: string;
    title: string;
    category: DemoEvent["category"];
    location: string;
    start_time: string;
    description: string;
    card_image_url: null;
    area: string;
    visibility: string;
    max_people: number;
    status: string;
    created_at: string;
  }[],
) {
  let result = await supabase.from("quests").upsert(events);

  if (isLegacyVisibilityCheckError(result.error)) {
    console.log("Production still expects legacy local visibility; retrying demo events with campus.");
    result = await supabase.from("quests").upsert(
      events.map((event) => ({
        ...event,
        visibility: "campus",
      })),
    );
  }

  await checked(Promise.resolve(result), "upsert demo events");
}

function buildQuestJoins(profiles: ResolvedProfile[], ownerId: string | null) {
  const joins: { quest_id: string; user_id: string; created_at: string }[] = [];

  demoEvents.forEach((event, eventIndex) => {
    const host = profiles.find((profile) => profile.slug === event.hostSlug);
    const candidates = profiles.filter((profile) => profile.id !== host?.id);
    const attendeeCount = Math.max(1, Math.min(event.maxPeople - 1, 2 + (eventIndex % 5)));

    for (let i = 0; i < attendeeCount; i += 1) {
      const profile = candidates[(eventIndex + i * 3) % candidates.length];
      joins.push({
        quest_id: eventId(event.slug),
        user_id: profile.id,
        created_at: hoursFromNow(-eventIndex - i - 2),
      });
    }

    if (ownerId && eventIndex % 4 === 0 && !joins.some(
      (join) => join.quest_id === eventId(event.slug) && join.user_id === ownerId,
    )) {
      joins.push({
        quest_id: eventId(event.slug),
        user_id: ownerId,
        created_at: hoursFromNow(-eventIndex - 5),
      });
    }
  });

  return joins;
}

function buildFriendships(profiles: ResolvedProfile[], ownerId: string | null) {
  const pairs = new Map<string, { requester_id: string; addressee_id: string }>();

  function addPair(leftId: string, rightId: string) {
    if (leftId === rightId) {
      return;
    }

    const [requester_id, addressee_id] = [leftId, rightId].sort();
    pairs.set(`${requester_id}:${addressee_id}`, { requester_id, addressee_id });
  }

  profiles.forEach((profile, index) => {
    addPair(profile.id, profiles[(index + 1) % profiles.length].id);
    if (index % 2 === 0) {
      addPair(profile.id, profiles[(index + 4) % profiles.length].id);
    }
    if (ownerId && index < 12) {
      addPair(ownerId, profile.id);
    }
  });

  return [...pairs.values()].map((pair, index) => ({
    ...pair,
    status: "accepted",
    created_at: hoursFromNow(-72 - index),
    updated_at: hoursFromNow(-24 - index),
  }));
}

async function seedDirectMessages(
  supabase: SupabaseClient,
  profiles: ResolvedProfile[],
  ownerId: string | null,
) {
  if (!ownerId) {
    return;
  }

  const chatPartners = profiles.slice(0, 4);
  const messageBodies = [
    ["Are you still down for dumplings later?", "Yes, saving this in plus1 now."],
    ["That study table looks useful.", "Pull up. I reserved the quiet corner."],
    ["Do you need a ride to the hike?", "Maybe, I can split gas."],
    ["Open mic table is getting full.", "I joined before it disappears."],
  ];

  for (const [index, partner] of chatPartners.entries()) {
    const threadId = directThreadId(ownerId, partner.id);
    const directKey = directMessageKey(ownerId, partner.id);
    const participants = [
      { thread_id: threadId, user_id: ownerId, last_read_at: hoursFromNow(-1) },
      { thread_id: threadId, user_id: partner.id, last_read_at: null },
    ];
    const messages = messageBodies[index].map((body, messageIndex) => ({
      id: messageId(`direct-${partner.slug}-${messageIndex}`),
      thread_id: threadId,
      sender_id: messageIndex % 2 === 0 ? partner.id : ownerId,
      body,
      created_at: hoursFromNow(-6 + messageIndex),
    }));

    await checked(
      supabase.from("message_threads").upsert({
        id: threadId,
        kind: "direct",
        direct_key: directKey,
        quest_id: null,
        created_by: ownerId,
        created_at: hoursFromNow(-7),
        updated_at: hoursFromNow(-1),
        last_message_at: messages[messages.length - 1].created_at,
      }),
      `upsert direct thread ${partner.handle}`,
    );
    await checked(
      supabase.from("message_thread_participants").upsert(participants, {
        onConflict: "thread_id,user_id",
      }),
      `upsert direct participants ${partner.handle}`,
    );
    await checked(
      supabase.from("messages").upsert(messages),
      `upsert direct messages ${partner.handle}`,
    );
  }
}

async function seedEventMessages(
  supabase: SupabaseClient,
  profiles: ResolvedProfile[],
) {
  const eventMessages: [eventSlug: string, bodies: string[]][] = [
    ["dumpling-after-dark", ["I can grab a table if we get there before 9.", "I am voting spicy wontons first."]],
    ["coho-open-mic", ["Saving two seats near the front.", "Someone has to do a duet."]],
    ["quad-picnic", ["I can bring fruit and napkins.", "Blanket secured."]],
    ["mocktail-night", ["Who owns a shaker?", "No shaker, but I have confidence."]],
  ];

  for (const [eventSlug, bodies] of eventMessages) {
    const event = demoEvents.find((demoEvent) => demoEvent.slug === eventSlug);

    if (!event) {
      continue;
    }

    const threadId = eventThreadId(eventSlug);
    const questId = eventId(eventSlug);
    const host = profiles.find((profile) => profile.slug === event.hostSlug);
    const participants = profiles
      .filter((profile, index) => profile.id === host?.id || index % 4 === 0)
      .slice(0, 6)
      .map((profile) => ({
        thread_id: threadId,
        user_id: profile.id,
        last_read_at: null,
      }));
    const messages = bodies.map((body, index) => ({
      id: messageId(`event-${eventSlug}-${index}`),
      thread_id: threadId,
      sender_id: participants[index % participants.length].user_id,
      body,
      created_at: hoursFromNow(-12 + index),
    }));

    await checked(
      supabase.from("message_threads").upsert({
        id: threadId,
        kind: "event",
        quest_id: questId,
        direct_key: null,
        created_by: host?.id ?? participants[0].user_id,
        created_at: hoursFromNow(-14),
        updated_at: hoursFromNow(-10),
        last_message_at: messages[messages.length - 1].created_at,
      }),
      `upsert event thread ${eventSlug}`,
    );
    await checked(
      supabase.from("message_thread_participants").upsert(participants, {
        onConflict: "thread_id,user_id",
      }),
      `upsert event participants ${eventSlug}`,
    );
    await checked(
      supabase.from("messages").upsert(messages),
      `upsert event messages ${eventSlug}`,
    );
  }
}

async function seedActivity(
  supabase: SupabaseClient,
  profiles: ResolvedProfile[],
  ownerId: string | null,
) {
  if (!ownerId) {
    return;
  }

  const activities = profiles.slice(0, 8).map((profile, index) => ({
    id: activityId(profile.slug),
    user_id: ownerId,
    actor_id: profile.id,
    quest_id: eventId(demoEvents[index].slug),
    type: "join",
    title: `${profile.displayName} joined ${demoEvents[index].title}`,
    body: null,
    read_at: index < 3 ? null : hoursFromNow(-1),
    created_at: hoursFromNow(-index - 1),
  }));

  await checked(supabase.from("activity_events").upsert(activities), "upsert owner activity");
}

async function cleanupDemoData(supabase: SupabaseClient) {
  const { data: demoRows, error } = await supabase
    .from("profiles")
    .select("id, handle")
    .like("handle", `${DEMO_HANDLE_PREFIX}%`);

  if (error) {
    throw new Error(`Could not load demo profiles for cleanup: ${error.message}`);
  }

  const demoIds = (demoRows ?? []).map((profile) => profile.id as string);
  const questIds = demoEvents.map((event) => eventId(event.slug));

  if (demoIds.length === 0) {
    console.log("No demo profiles found. Cleaning deterministic demo events only.");
  }

  const threadIds = await collectDemoThreadIds(supabase, demoIds, questIds);

  if (threadIds.length > 0) {
    await checked(supabase.from("messages").delete().in("thread_id", threadIds), "delete demo messages");
    await checked(
      supabase.from("message_thread_participants").delete().in("thread_id", threadIds),
      "delete demo message participants",
    );
    await checked(supabase.from("message_threads").delete().in("id", threadIds), "delete demo threads");
  }

  if (demoIds.length > 0) {
    await checked(
      supabase
        .from("activity_events")
        .delete()
        .or(`user_id.in.(${demoIds.join(",")}),actor_id.in.(${demoIds.join(",")})`),
      "delete demo activity",
    );
    await checked(
      supabase
        .from("friendships")
        .delete()
        .or(`requester_id.in.(${demoIds.join(",")}),addressee_id.in.(${demoIds.join(",")})`),
      "delete demo friendships",
    );
    await checked(
      supabase.from("quest_joins").delete().in("user_id", demoIds),
      "delete demo joins by user",
    );
  }

  await checked(
    supabase.from("quest_share_links").delete().in("quest_id", questIds),
    "delete demo share links",
  );
  await checked(supabase.from("quest_invites").delete().in("quest_id", questIds), "delete demo invites");
  await checked(supabase.from("quest_joins").delete().in("quest_id", questIds), "delete demo joins");
  await checked(supabase.from("quests").delete().in("id", questIds), "delete demo events");

  for (const id of demoIds) {
    await supabase.storage.from(PROFILE_BUCKET).remove([`${id}/demo-avatar.svg`]);
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);

    if (deleteAuthError) {
      throw new Error(`Could not delete auth user ${id}: ${deleteAuthError.message}`);
    }
  }

  console.log(`Cleanup complete. Removed ${demoIds.length} demo profiles and ${questIds.length} deterministic demo events.`);
}

async function clearDemoFriendships(supabase: SupabaseClient, demoIds: string[]) {
  if (demoIds.length === 0) {
    return;
  }

  await checked(
    supabase
      .from("friendships")
      .delete()
      .or(`requester_id.in.(${demoIds.join(",")}),addressee_id.in.(${demoIds.join(",")})`),
    "clear existing demo friendships",
  );
}

async function collectDemoThreadIds(
  supabase: SupabaseClient,
  demoIds: string[],
  questIds: string[],
) {
  const ids = new Set<string>();

  const { data: questThreads, error: questThreadError } = await supabase
    .from("message_threads")
    .select("id")
    .in("quest_id", questIds);

  if (questThreadError) {
    throw new Error(`Could not load demo event threads: ${questThreadError.message}`);
  }

  for (const row of questThreads ?? []) {
    ids.add(row.id as string);
  }

  if (demoIds.length === 0) {
    return [...ids];
  }

  const { data: createdThreads, error: createdThreadError } = await supabase
    .from("message_threads")
    .select("id")
    .in("created_by", demoIds);

  if (createdThreadError) {
    throw new Error(`Could not load demo-created threads: ${createdThreadError.message}`);
  }

  for (const row of createdThreads ?? []) {
    ids.add(row.id as string);
  }

  const { data: participantRows, error: participantError } = await supabase
    .from("message_thread_participants")
    .select("thread_id")
    .in("user_id", demoIds);

  if (participantError) {
    throw new Error(`Could not load demo participant threads: ${participantError.message}`);
  }

  for (const row of participantRows ?? []) {
    ids.add(row.thread_id as string);
  }

  return [...ids];
}

function buildAvatarSvg(profile: DemoProfile) {
  const { bg, skin, hair, top, accent } = profile.palette;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#111827" flood-opacity="0.20"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="136" fill="url(#bg)"/>
  <circle cx="405" cy="105" r="76" fill="#ffffff" opacity="0.28"/>
  <circle cx="103" cy="390" r="92" fill="#ffffff" opacity="0.20"/>
  <g filter="url(#softShadow)">
    <path d="M123 461c16-93 75-143 133-143s117 50 133 143H123z" fill="${top}"/>
    <path d="M178 199c0-67 35-111 80-111s80 44 80 111v53c0 63-36 111-80 111s-80-48-80-111v-53z" fill="${skin}"/>
    <path d="M170 202c6-77 45-127 97-127 45 0 88 39 88 102 0 9-1 22-4 33-40-12-75-33-103-64-18 34-42 56-78 68v-12z" fill="${hair}"/>
    <path d="M169 220c-18 3-29 18-25 37 4 21 18 33 37 34l-12-71z" fill="${skin}"/>
    <path d="M343 220c18 3 29 18 25 37-4 21-18 33-37 34l12-71z" fill="${skin}"/>
    <path d="M214 263c26 22 62 22 88 0" fill="none" stroke="#351c15" stroke-width="10" stroke-linecap="round" opacity="0.45"/>
    <circle cx="225" cy="222" r="8" fill="#1f2937"/>
    <circle cx="291" cy="222" r="8" fill="#1f2937"/>
    <path d="M244 244c8 7 20 7 28 0" fill="none" stroke="#6b3d2d" stroke-width="7" stroke-linecap="round" opacity="0.45"/>
  </g>
  <text x="256" y="468" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#ffffff" opacity="0.82">${escapeSvg(profile.initials)}</text>
</svg>`);
}

function printDryRunSummary() {
  const joins = buildQuestJoins(demoProfiles.map((profile) => ({
    ...profile,
    id: stableUuid(`dry-profile:${profile.slug}`),
    avatarUrl: null,
  })), stableUuid("dry-owner"));
  const friendships = buildFriendships(demoProfiles.map((profile) => ({
    ...profile,
    id: stableUuid(`dry-profile:${profile.slug}`),
    avatarUrl: null,
  })), stableUuid("dry-owner"));

  console.log("Production demo seed dry run");
  console.log(`Profiles planned: ${demoProfiles.length}`);
  console.log(`Avatar uploads planned: ${demoProfiles.length}`);
  console.log(`Events planned: ${demoEvents.length}`);
  console.log(`Joins planned: ${joins.length}`);
  console.log(`Friendships planned: ${friendships.length}`);
  console.log("Direct message threads planned: 4 if owner profile exists");
  console.log("Event message threads planned: 4");
  console.log(`Cleanup handle target: ${DEMO_HANDLE_PREFIX}*`);
  console.log("Mutating modes require --apply or --cleanup.");
}

function validateFixtures() {
  assertUnique(demoProfiles.map((profile) => profile.handle), "profile handles");
  assertUnique(demoProfiles.map((profile) => profile.phone), "profile phones");
  assertUnique(demoProfiles.map((profile) => profile.slug), "profile slugs");
  assertUnique(demoEvents.map((event) => event.slug), "event slugs");

  if (!validEventVisibilities.has(DEMO_EVENT_VISIBILITY)) {
    throw new Error(
      `Demo event visibility must match the current schema: ${DEMO_EVENT_VISIBILITY}`,
    );
  }

  for (const profile of demoProfiles) {
    if (!profile.handle.startsWith(DEMO_HANDLE_PREFIX)) {
      throw new Error(`Demo handle must start with ${DEMO_HANDLE_PREFIX}: ${profile.handle}`);
    }
  }

  for (const event of demoEvents) {
    if (!demoProfiles.some((profile) => profile.slug === event.hostSlug)) {
      throw new Error(`Event ${event.slug} has unknown host ${event.hostSlug}`);
    }

    if (!validEventCategories.has(event.category)) {
      throw new Error(`Event ${event.slug} has invalid category ${event.category}`);
    }

    if (event.maxPeople < 3 || event.maxPeople > 12) {
      throw new Error(`Event ${event.slug} has invalid capacity ${event.maxPeople}`);
    }
  }
}

function assertUnique(values: string[], label: string) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${label}: ${[...new Set(duplicates)].join(", ")}`);
  }
}

async function getProfileByHandle(supabase: SupabaseClient, handle: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle")
    .eq("handle", handle)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load profile ${handle}: ${error.message}`);
  }

  return data as { id: string; handle: string } | null;
}

async function findAuthUserIdByPhone(supabase: SupabaseClient, phone: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Could not search auth users: ${error.message}`);
    }

    const match = data.users.find((user) => user.phone === phone);

    if (match) {
      return match.id;
    }

    if (data.users.length < 100) {
      return null;
    }
  }

  return null;
}

async function checked<T extends { error: unknown }>(
  promise: PromiseLike<T>,
  label: string,
) {
  const result = await promise;

  if (result.error) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : JSON.stringify(result.error);
    throw new Error(`${label}: ${message}`);
  }

  return result;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required env var ${name}.`);
  }

  return value;
}

function isLegacyVisibilityCheckError(
  error:
    | {
        code?: string;
        details?: string | null;
        message?: string;
      }
    | null
    | undefined,
) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`;
  return (
    message.includes("quests_visibility_check") ||
    (error.code === "23514" && message.includes("visibility"))
  );
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function eventId(slug: string) {
  return stableUuid(`plus1-demo-event:${slug}`);
}

function eventThreadId(slug: string) {
  return stableUuid(`plus1-demo-event-thread:${slug}`);
}

function directThreadId(leftId: string, rightId: string) {
  return stableUuid(`plus1-demo-direct-thread:${directMessageKey(leftId, rightId)}`);
}

function messageId(seed: string) {
  return stableUuid(`plus1-demo-message:${seed}`);
}

function activityId(seed: string) {
  return stableUuid(`plus1-demo-activity:${seed}`);
}

function directMessageKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join(":");
}

function stableUuid(seed: string) {
  const hash = createHash("sha256").update(seed).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
