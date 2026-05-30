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
  avatarInitials: string;
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
