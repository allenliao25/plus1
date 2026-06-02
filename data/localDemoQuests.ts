import type {
  Profile,
  PublicQuestShare,
  Quest,
  QuestAttendee,
  QuestCategory,
} from "@/types/quest";

export const LOCAL_DEMO_QUEST_ID_PREFIX = "local-demo-quest-";
export const LOCAL_DEMO_SHARE_TOKEN_PREFIX = "demo-quest-";

const initialJoinedQuestIds = new Set([
  `${LOCAL_DEMO_QUEST_ID_PREFIX}aoerc-lift`,
  `${LOCAL_DEMO_QUEST_ID_PREFIX}lake-lag-walk`,
]);

type LocalDemoQuestSeed = {
  id: string;
  title: string;
  category: QuestCategory;
  location: string;
  startsInHours: number;
  description: string;
  creator: string;
  creatorInitials: string;
  goingCount: number;
  maxPeople: number;
};

const localDemoQuestSeeds: LocalDemoQuestSeed[] = [
  {
    id: "aoerc-lift",
    title: "Work out at Near",
    category: "Fitness",
    location: "AOERC",
    startsInHours: 25,
    description: "Upper body lift, light cardio after, beginner friendly.",
    creator: "Allen",
    creatorInitials: "AL",
    goingCount: 1,
    maxPeople: 4,
  },
  {
    id: "late-night-dumplings",
    title: "Late night dumpling run",
    category: "Food",
    location: "Downtown Palo Alto",
    startsInHours: 5,
    description: "Splitting rides and ordering way too many soup dumplings.",
    creator: "Maya",
    creatorInitials: "MY",
    goingCount: 2,
    maxPeople: 6,
  },
  {
    id: "green-library-sprint",
    title: "CS problem set sprint",
    category: "Study",
    location: "Green Library",
    startsInHours: 3,
    description: "Quiet table, 50 minute focus blocks, snack break at the hour.",
    creator: "Priya",
    creatorInitials: "PR",
    goingCount: 3,
    maxPeople: 5,
  },
  {
    id: "dish-sunset",
    title: "Sunset loop at the Dish",
    category: "Outdoors",
    location: "Stanford Dish",
    startsInHours: 7,
    description: "Easy pace, golden hour photos, back before dinner.",
    creator: "Chris",
    creatorInitials: "CH",
    goingCount: 4,
    maxPeople: 8,
  },
  {
    id: "coho-open-mic",
    title: "CoHo open mic table",
    category: "Social",
    location: "CoHo",
    startsInHours: 30,
    description: "Grab seats early, cheer for friends, maybe perform if brave.",
    creator: "Jordan",
    creatorInitials: "JD",
    goingCount: 5,
    maxPeople: 7,
  },
  {
    id: "ceramics-drop-in",
    title: "Try the ceramics studio",
    category: "Sidequest",
    location: "Roble Arts Gym",
    startsInHours: 50,
    description: "No experience needed, just making tiny imperfect bowls.",
    creator: "Nina",
    creatorInitials: "NN",
    goingCount: 1,
    maxPeople: 4,
  },
  {
    id: "farmers-market",
    title: "Farmers market breakfast",
    category: "Food",
    location: "California Ave",
    startsInHours: 62,
    description: "Pastries first, fruit second, coffee always.",
    creator: "Sam",
    creatorInitials: "SM",
    goingCount: 2,
    maxPeople: 5,
  },
  {
    id: "lake-lag-walk",
    title: "Walk around Lake Lag",
    category: "Outdoors",
    location: "Lake Lagunita",
    startsInHours: 2,
    description: "Tiny reset walk before the evening gets packed.",
    creator: "Leah",
    creatorInitials: "LH",
    goingCount: 2,
    maxPeople: 4,
  },
  {
    id: "pickleball-courts",
    title: "Beginner pickleball",
    category: "Fitness",
    location: "Wilbur Courts",
    startsInHours: 9,
    description: "We have two paddles extra. Mostly here for rallies.",
    creator: "Evan",
    creatorInitials: "EV",
    goingCount: 3,
    maxPeople: 4,
  },
  {
    id: "movie-night",
    title: "Indie movie night",
    category: "Social",
    location: "Stern Lounge",
    startsInHours: 28,
    description: "Low stakes movie vote, popcorn provided, blankets encouraged.",
    creator: "Talia",
    creatorInitials: "TA",
    goingCount: 6,
    maxPeople: 10,
  },
  {
    id: "whiteboard-review",
    title: "Whiteboard algorithms review",
    category: "Study",
    location: "Huang Basement",
    startsInHours: 74,
    description: "Graphs, DP, and interview-style practice without the stress.",
    creator: "Diego",
    creatorInitials: "DG",
    goingCount: 2,
    maxPeople: 6,
  },
  {
    id: "thrift-other",
    title: "Thrift store sidequest",
    category: "Other",
    location: "Menlo Park",
    startsInHours: 48,
    description: "Looking for weird lamps, jackets, and dorm room treasures.",
    creator: "Riley",
    creatorInitials: "RY",
    goingCount: 3,
    maxPeople: 5,
  },
];

export function getInitialLocalDemoJoinedQuestIds() {
  return [...initialJoinedQuestIds];
}

export function isLocalDemoQuestId(questId: string) {
  return questId.startsWith(LOCAL_DEMO_QUEST_ID_PREFIX);
}

export function isLocalDemoQuestShareToken(token: string) {
  return token.startsWith(LOCAL_DEMO_SHARE_TOKEN_PREFIX);
}

export function buildLocalDemoQuestShareToken(questId: string) {
  return `${LOCAL_DEMO_SHARE_TOKEN_PREFIX}${stripLocalDemoQuestIdPrefix(questId)}`;
}

export function getLocalDemoQuestIdFromShareToken(token: string) {
  if (!isLocalDemoQuestShareToken(token)) {
    return null;
  }

  const seedId = token.slice(LOCAL_DEMO_SHARE_TOKEN_PREFIX.length).trim();
  return seedId ? `${LOCAL_DEMO_QUEST_ID_PREFIX}${seedId}` : null;
}

export function getLocalDemoPublicQuestShare(token: string): PublicQuestShare | null {
  const questId = getLocalDemoQuestIdFromShareToken(token);

  if (!questId) {
    return null;
  }

  const seedId = stripLocalDemoQuestIdPrefix(questId);
  const seed = localDemoQuestSeeds.find((questSeed) => questSeed.id === seedId);

  if (!seed) {
    return null;
  }

  const startTime = buildStartTime(seed.startsInHours);

  return {
    token,
    questId,
    title: seed.title,
    category: seed.category,
    location: seed.location,
    startTimeISO: startTime.iso,
    startTime: startTime.display,
    startTimeRelative: startTime.relative,
    description: seed.description,
    cardImageUrl: null,
    visibility: "local",
    status: "open",
    hostDisplayName: seed.creator,
    hostHandle: null,
    goingCount: seed.goingCount,
    maxPeople: seed.maxPeople,
    createdAtISO: null,
  };
}

export function shouldShowLocalDemoQuests() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function buildLocalDemoQuests(
  currentProfile: Profile,
  joinedQuestIds: string[],
) {
  const joinedIds = new Set(joinedQuestIds);
  const currentUserAttendee: QuestAttendee = {
    id: currentProfile.id,
    displayName: currentProfile.displayName,
    avatarInitials: currentProfile.avatarInitials,
    avatarUrl: currentProfile.avatarUrl,
    isHost: false,
  };

  return localDemoQuestSeeds.map((seed): Quest => {
    const id = `${LOCAL_DEMO_QUEST_ID_PREFIX}${seed.id}`;
    const isJoined = joinedIds.has(id);
    const hostAttendee: QuestAttendee = {
      id: `${id}-host`,
      displayName: seed.creator,
      avatarInitials: seed.creatorInitials,
      avatarUrl: null,
      isHost: true,
    };
    const startTime = buildStartTime(seed.startsInHours);
    const goingCount = Math.min(seed.maxPeople, seed.goingCount + (isJoined ? 1 : 0));

    return {
      id,
      title: seed.title,
      category: seed.category,
      status: "open",
      location: seed.location,
      startTimeISO: startTime.iso,
      startTime: startTime.display,
      startTimeRelative: startTime.relative,
      description: seed.description,
      cardImageUrl: null,
      creator: seed.creator,
      creatorId: `${id}-host`,
      visibility: "local",
      goingCount,
      maxPeople: seed.maxPeople,
      attendees: isJoined ? [hostAttendee, currentUserAttendee] : [hostAttendee],
      createdByCurrentUser: false,
      joinedByCurrentUser: isJoined,
      matchesCurrentUserInterests: currentProfile.interests.includes(seed.category),
    };
  });
}

function buildStartTime(startsInHours: number) {
  const start = new Date(Date.now() + startsInHours * 60 * 60 * 1000);

  return {
    iso: start.toISOString(),
    display: start.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    relative: formatRelativeStart(startsInHours),
  };
}

function formatRelativeStart(startsInHours: number) {
  if (startsInHours < 24) {
    return `Starts in ${startsInHours}h`;
  }

  const days = Math.round(startsInHours / 24);
  return `Starts in ${days}d`;
}

function stripLocalDemoQuestIdPrefix(questId: string) {
  return questId.startsWith(LOCAL_DEMO_QUEST_ID_PREFIX)
    ? questId.slice(LOCAL_DEMO_QUEST_ID_PREFIX.length)
    : questId;
}
