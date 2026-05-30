export type QuestCategory =
  | "Food"
  | "Study"
  | "Fitness"
  | "Errand"
  | "Outdoors"
  | "Social";

export type QuestStatus = "open" | "closed" | "past";

export type QuestAttendee = {
  id: string;
  displayName: string;
  avatarInitials: string;
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
  creator: string;
  goingCount: number;
  maxPeople: number;
  attendees: QuestAttendee[];
  createdByCurrentUser?: boolean;
  joinedByCurrentUser?: boolean;
};

export type Profile = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarInitials: string;
  bio: string | null;
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
};

export type UpdateQuestInput = NewQuestInput;
