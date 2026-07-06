export type QuestCategory =
  | "Food"
  | "Study"
  | "Fitness"
  | "Outdoors"
  | "Social"
  | "Sidequest"
  | "Other";

export type QuestStatus = "open" | "closed" | "past";
export type QuestVisibility = "invite_only" | "friends" | "local";
export type FriendshipStatus = "pending" | "accepted" | "declined";
export type FriendshipState =
  | "self"
  | "none"
  | "incoming"
  | "outgoing"
  | "friends"
  | "declined";

export type QuestAttendee = {
  id: string;
  displayName: string;
  avatarInitials: string;
  avatarUrl: string | null;
  isHost: boolean;
  isGuest?: boolean;
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
  creatorId: string | null;
  visibility: QuestVisibility;
  goingCount: number;
  maxPeople: number | null;
  attendees: QuestAttendee[];
  invitedProfiles?: QuestInviteProfile[];
  createdByCurrentUser?: boolean;
  joinedByCurrentUser?: boolean;
  invitedByCurrentUser?: boolean;
  matchesCurrentUserInterests?: boolean;
};

export type QuestInviteProfile = {
  id: string;
  displayName: string;
  handle: string;
  avatarInitials: string;
  avatarUrl: string | null;
};

export type PublicProfile = QuestInviteProfile & {
  area: string;
  bio: string | null;
  pronouns: string | null;
  websiteUrl: string | null;
  interests: string[];
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
  area: string;
  interests: string[];
};

export type FriendConnection = {
  id: string;
  status: FriendshipStatus;
  requesterId: string;
  addresseeId: string;
  state: FriendshipState;
  profile: PublicProfile;
};

export type PeopleSearchResult = PublicProfile & {
  friendshipId: string | null;
  friendshipState: FriendshipState;
  friendshipStatus: FriendshipStatus | null;
  requesterId: string | null;
  addresseeId: string | null;
};

export type ActivityEventType =
  | "join"
  | "edit"
  | "close"
  | "reminder"
  | "invite"
  | "friend_request"
  | "friend_accept";

export type ActivityActor = QuestInviteProfile;

export type ActivityQuestSummary = {
  id: string;
  title: string;
  category: QuestCategory;
  cardImageUrl: string | null;
};

export type ActivityFriendRequest = {
  friendshipId: string;
  status: FriendshipStatus;
};

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  title: string;
  body: string | null;
  actorId: string | null;
  actor: ActivityActor | null;
  questId: string | null;
  quest: ActivityQuestSummary | null;
  friendRequest: ActivityFriendRequest | null;
  createdAtISO: string | null;
  createdAtRelative: string | null;
  isRead: boolean;
};

export type MessageThreadKind = "direct" | "event";

export type MessageThreadQuestSummary = {
  id: string;
  title: string;
  category: QuestCategory;
  cardImageUrl: string | null;
};

export type MessageThread = {
  id: string;
  kind: MessageThreadKind;
  questId: string | null;
  quest: MessageThreadQuestSummary | null;
  participants: QuestInviteProfile[];
  title: string;
  subtitle: string | null;
  preview: string;
  lastMessageAtISO: string | null;
  lastMessageAtRelative: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId: string;
  sender: QuestInviteProfile | null;
  body: string;
  createdAtISO: string | null;
  createdAtRelative: string | null;
  isMine: boolean;
};

export type NewQuestInput = {
  title: string;
  category: QuestCategory;
  location: string;
  startTime: string;
  description: string;
  maxPeople: number | null;
  cardImageUrl?: string | null;
  visibility?: QuestVisibility;
  inviteeIds?: string[];
};

export type SmartQuestDraft = NewQuestInput & {
  inviteHints?: string[];
  inviteeProfiles?: QuestInviteProfile[];
  selfInviteHints?: string[];
  unresolvedInviteHints?: string[];
};

export type UpdateQuestInput = NewQuestInput;

export type QuestCardImageChanges = {
  cardImageFile?: File | null;
  removeCardImage?: boolean;
};

export type PublicQuestShare = {
  token: string;
  questId: string;
  title: string;
  category: QuestCategory;
  location: string;
  startTimeISO: string | null;
  startTime: string;
  startTimeRelative: string | null;
  description: string;
  cardImageUrl: string | null;
  visibility: QuestVisibility;
  status: QuestStatus;
  hostDisplayName: string;
  hostHandle: string | null;
  goingCount: number;
  maxPeople: number | null;
  createdAtISO: string | null;
};
