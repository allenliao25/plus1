export type QuestCategory =
  | "Food"
  | "Study"
  | "Fitness"
  | "Errand"
  | "Outdoors"
  | "Social";

export type Quest = {
  id: string;
  title: string;
  category: QuestCategory;
  location: string;
  startTime: string;
  description: string;
  creator: string;
  goingCount: number;
  maxPeople: number;
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
