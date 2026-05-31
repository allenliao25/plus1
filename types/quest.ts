export type QuestCategory =
  | "Food"
  | "Study"
  | "Fitness"
  | "Outdoors"
  | "Social"
  | "Sidequest";

export type QuestStatus = "open" | "closed" | "past";

export type QuestAttendee = {
  id: string;
  displayName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  isHost: boolean;
};

export type Quest = {
  id: string;
  title: string;
  category: QuestCategory;
  status: QuestStatus;
  location: string;
  startTimeISO: string | null;
  startTime: string;
  startTimeRelative: string | null;
  description: string;
  cardImageUrl: string | null;
  creator: string;
  goingCount: number;
  maxPeople: number;
  attendees: QuestAttendee[];
  createdByCurrentUser?: boolean;
  joinedByCurrentUser?: boolean;
  matchesCurrentUserInterests?: boolean;
};

export type Profile = {
  id: string;
  displayName: string;
  handle: string;
  email: string | null;
  phone: string | null;
  avatarInitials: string;
  avatarUrl: string | null;
  websiteUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  interests: string[];
};

export type ActivityEventType = "join" | "edit" | "close" | "reminder";

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  title: string;
  body: string | null;
  questId: string | null;
  createdAtISO: string | null;
  createdAtRelative: string | null;
  isRead: boolean;
};

export type NewQuestInput = {
  title: string;
  category: QuestCategory;
  location: string;
  startTime: string;
  description: string;
  maxPeople: number;
  cardImageUrl?: string | null;
};

export type UpdateQuestInput = NewQuestInput;

export type QuestCardImageChanges = {
  cardImageFile?: File | null;
  removeCardImage?: boolean;
};
