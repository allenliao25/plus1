"use client";

import {
  FormEvent,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AtSign,
  Bell,
  ChevronLeft,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  UserRound,
} from "lucide-react";
import RootPageCarousel, {
  type RootPageCarouselHandle,
} from "@/components/RootPageCarousel";
import AiQuestDraft from "@/components/AiQuestDraft";
import BottomNav, { type AppTab } from "@/components/BottomNav";
import CreateQuestForm from "@/components/CreateQuestForm";
import EditQuestModal from "@/components/EditQuestModal";
import QuestDetail from "@/components/QuestDetail";
import SafeImage from "@/components/SafeImage";
import ActivityScreen from "@/components/screens/ActivityScreen";
import ChatThreadScreen from "@/components/screens/ChatThreadScreen";
import EventsScreen from "@/components/screens/EventsScreen";
import HomeScreen from "@/components/screens/HomeScreen";
import InboxScreen from "@/components/screens/InboxScreen";
import PeopleScreen from "@/components/screens/PeopleScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import PublicProfileScreen from "@/components/screens/PublicProfileScreen";
import { questCategories } from "@/data/demoQuests";
import { AREA_OPTIONS, DEFAULT_AREA } from "@/lib/area";
import {
  buildLocalDemoQuests,
  getInitialLocalDemoJoinedQuestIds,
  isLocalDemoQuestId,
  shouldShowLocalDemoQuests,
} from "@/data/localDemoQuests";
import {
  completeProfileSetup,
  ensureProfile,
  getAuthenticatedUser,
  isLikelyAutoDisplayName,
  isValidHandle,
  isValidUsPhoneParts,
  normalizeHandle,
  normalizePhoneNumber,
  normalizeUsPhoneParts,
  sendPhoneOtp,
  signOutCurrentUser,
  subscribeToAuthChanges,
  updateProfile,
  uploadProfilePhoto,
  verifyPhoneOtp,
} from "@/lib/authService";
import {
  closeQuest,
  createQuest,
  fetchFeedQuests,
  fetchMyQuests,
  fetchProfilesByIds,
  fetchVisibleProfileQuests,
  joinQuest,
  leaveQuest,
  updateQuest,
  uploadQuestCardImage,
} from "@/lib/questService";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchOutgoingFriendRequests,
  fetchPublicProfile,
  fetchSuggestedFriends,
  removeFriend,
  sendFriendRequest,
} from "@/lib/friendService";
import {
  fetchActivityEvents,
  markActivityRead,
  recordActivityEvents,
} from "@/lib/activityService";
import {
  countUnreadThreads,
  fetchMessageThreads,
  fetchThreadMessages,
  getOrCreateDirectThread,
  getOrCreateEventThread,
  markThreadRead,
  sendMessage,
} from "@/lib/messageService";
import {
  notifyLocalEvent,
  registerPushToken,
  requestLocalNotificationPermission,
} from "@/lib/notifications";
import { getQuestIdFromSearch } from "@/lib/questLinks";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type {
  ActivityEvent,
  ChatMessage,
  FriendConnection,
  MessageThread,
  QuestCardImageChanges,
  NewQuestInput,
  PeopleSearchResult,
  Profile,
  Quest,
  QuestInviteProfile,
  SmartQuestDraft,
} from "@/types/quest";

type AuthState = "loading" | "signed_out" | "signed_in";
type RootPage = Exclude<AppTab, "create">;

const rootPages: RootPage[] = ["home", "events", "people", "profile"];

type AppShellProps = {
  initialAiAvailable?: boolean | null;
};

type SelectedProfileState = {
  isLoading: boolean;
  profile: PeopleSearchResult | null;
  quests: Quest[];
};

type InAppBanner = {
  id: string;
  kind: "activity" | "message";
  title: string;
  body: string | null;
  avatarInitials?: string | null;
  avatarLabel?: string | null;
  avatarUrl?: string | null;
  threadId?: string;
  questId?: string | null;
  actorId?: string | null;
};

const initialSelectedProfileState: SelectedProfileState = {
  isLoading: false,
  profile: null,
  quests: [],
};

function selectedProfileReducer(
  state: SelectedProfileState,
  action: Partial<SelectedProfileState>,
) {
  return { ...state, ...action };
}

export default function AppShell({ initialAiAvailable = null }: AppShellProps) {
  return useAppShellContent({ initialAiAvailable });
}

function useAppShellContent({ initialAiAvailable }: AppShellProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [feedQuests, setFeedQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [messageThreads, setMessageThreads] = useState<MessageThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [friends, setFriends] = useState<FriendConnection[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<
    FriendConnection[]
  >([]);
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<
    FriendConnection[]
  >([]);
  const [suggestedPeople, setSuggestedPeople] = useState<PeopleSearchResult[]>(
    [],
  );
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [selectedProfileState, updateSelectedProfileState] = useReducer(
    selectedProfileReducer,
    initialSelectedProfileState,
  );
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [createInitialValues, setCreateInitialValues] =
    useState<NewQuestInput | null>(null);
  const [createInitialInvitees, setCreateInitialInvitees] = useState<
    QuestInviteProfile[]
  >([]);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [openedQuestLinkId, setOpenedQuestLinkId] = useState<string | null>(
    null,
  );
  const [isAiAvailable] = useState<boolean | null>(initialAiAvailable ?? null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isCompletingProfileSetup, setIsCompletingProfileSetup] =
    useState(false);
  const [profileSetupError, setProfileSetupError] = useState("");
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [localDemoJoinedQuestIds, setLocalDemoJoinedQuestIds] = useState(
    getInitialLocalDemoJoinedQuestIds,
  );
  const [joiningQuestId, setJoiningQuestId] = useState<string | null>(null);
  const [friendActionProfileId, setFriendActionProfileId] = useState<
    string | null
  >(null);
  const [leavingQuestId, setLeavingQuestId] = useState<string | null>(null);
  const [closingQuestId, setClosingQuestId] = useState<string | null>(null);
  const [utilityView, setUtilityView] = useState<"activity" | "inbox" | null>(
    null,
  );
  const [inAppBanner, setInAppBanner] = useState<InAppBanner | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const authSyncIdRef = useRef(0);
  const loadedProfileIdRef = useRef<string | null>(null);
  const rootCarouselRef = useRef<RootPageCarouselHandle>(null);
  const currentProfileRef = useRef<Profile | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const utilityViewRef = useRef<"activity" | "inbox" | null>(null);
  const visibleQuestsRef = useRef<Quest[]>([]);
  const chatMessagesSignatureRef = useRef("");
  const messageThreadsRef = useRef<MessageThread[]>([]);
  const messageThreadAlertStateRef = useRef<Map<string, string>>(new Map());

  const currentProfileId = currentProfile?.id ?? "";
  const selectedPublicProfile = selectedProfileState.profile;
  const selectedProfileQuests = selectedProfileState.quests;
  const isLoadingPublicProfile = selectedProfileState.isLoading;
  const isInitialContentLoading =
    authState === "signed_in" && isLoadingQuests && !hasLoadedInitialData;
  const isAppLocked =
    authState !== "signed_in" || isBooting || isInitialContentLoading;

  useStableKeyboardViewport();

  const allVisibleQuests = useMemo(() => {
    const questsById = new Map<string, Quest>();

    for (const quest of [...feedQuests, ...myQuests, ...selectedProfileQuests]) {
      questsById.set(quest.id, quest);
    }

    return [...questsById.values()];
  }, [feedQuests, myQuests, selectedProfileQuests]);

  const selectedQuest = useMemo(
    () =>
      allVisibleQuests.find((quest) => quest.id === selectedQuestId) ?? null,
    [allVisibleQuests, selectedQuestId],
  );

  const editingQuest = useMemo(
    () =>
      allVisibleQuests.find((quest) => quest.id === editingQuestId) ?? null,
    [allVisibleQuests, editingQuestId],
  );

  const selectedThread = useMemo(
    () =>
      messageThreads.find((thread) => thread.id === selectedThreadId) ?? null,
    [messageThreads, selectedThreadId],
  );

  const unreadActivityCount = useMemo(
    () => activityEvents.filter((event) => !event.isRead).length,
    [activityEvents],
  );
  const unreadMessageCount = useMemo(
    () => countUnreadThreads(messageThreads),
    [messageThreads],
  );
  const acceptedFriendIds = useMemo(
    () => friends.map((friend) => friend.profile.id),
    [friends],
  );
  const friendInviteProfiles = useMemo(
    () => friends.map((friend) => friend.profile),
    [friends],
  );

  function syncMessageThreadAlertState(threads: MessageThread[]) {
    messageThreadAlertStateRef.current = new Map(
      threads.map((thread) => [thread.id, buildMessageThreadAlertState(thread)]),
    );
  }

  const refreshData = useCallback(async (profile: Profile) => {
    const userId = profile.id;
    const [nextFeedQuests, nextMyQuests, loadedActivity] = await Promise.all([
      fetchFeedQuests(userId, profile.area),
      fetchMyQuests(userId),
      fetchActivityEvents(userId).catch(() => [] as ActivityEvent[]),
    ]);
    const localDemoQuests = shouldShowLocalDemoQuests()
      ? buildLocalDemoQuests(profile, localDemoJoinedQuestIds)
      : [];
    const localDemoQuestIds = new Set(localDemoQuests.map((quest) => quest.id));
    const mergedFeedQuests = [
      ...localDemoQuests,
      ...nextFeedQuests.filter((quest) => !localDemoQuestIds.has(quest.id)),
    ];
    const mergedMyQuests = [
      ...nextMyQuests,
      ...localDemoQuests.filter(
        (quest) => quest.joinedByCurrentUser || quest.createdByCurrentUser,
      ),
    ];
    const reminderEvents = buildQuestReminderEvents(
      userId,
      mergedMyQuests,
      loadedActivity,
    );
    let nextActivity = loadedActivity;

    if (reminderEvents.length > 0) {
      await recordActivityEvents(reminderEvents).catch(() => {
        // Reminders are a polish layer; the core feed should still render.
      });
      nextActivity = await fetchActivityEvents(userId).catch(
        () => loadedActivity,
      );
    }

    setFeedQuests(mergedFeedQuests);
    setMyQuests(mergedMyQuests);
    setActivityEvents(nextActivity);
  }, [localDemoJoinedQuestIds]);

  const refreshSocialData = useCallback(async (profile: Profile) => {
    const [nextFriends, nextIncoming, nextOutgoing, nextSuggested] =
      await Promise.all([
        fetchFriends(profile.id),
        fetchIncomingFriendRequests(profile.id),
        fetchOutgoingFriendRequests(profile.id),
        fetchSuggestedFriends(profile.id, profile.area).catch(
          () => [] as PeopleSearchResult[],
        ),
      ]);

    setFriends(nextFriends);
    setIncomingFriendRequests(nextIncoming);
    setOutgoingFriendRequests(nextOutgoing);
    setSuggestedPeople(nextSuggested);
  }, []);

  const refreshMessages = useCallback(async (profile: Profile) => {
    const nextThreads = await fetchMessageThreads(profile.id).catch(
      () => [] as MessageThread[],
    );

    setMessageThreads(nextThreads);
    messageThreadsRef.current = nextThreads;
    syncMessageThreadAlertState(nextThreads);
    return nextThreads;
  }, []);

  const syncAuthAndData = useCallback(async () => {
    const syncId = authSyncIdRef.current + 1;
    authSyncIdRef.current = syncId;
    const isStaleSync = () => authSyncIdRef.current !== syncId;

    setIsBooting(true);
    setError("");

    try {
      const stoppedAfterUserLookup = isStaleSync();
      if (stoppedAfterUserLookup) {
        return;
      }

      const user = await getAuthenticatedUser();

      const stoppedAfterUserResult = user !== undefined && isStaleSync();
      if (stoppedAfterUserResult) {
        return;
      }

      if (!user) {
        setAuthState("signed_out");
        setAuthError("");
        setAuthMessage("");
        setCurrentProfile(null);
        setFeedQuests([]);
        setMyQuests([]);
        setActivityEvents([]);
        setMessageThreads([]);
        setSelectedThreadId(null);
        setChatMessages([]);
        setFriends([]);
        setIncomingFriendRequests([]);
        setOutgoingFriendRequests([]);
        setSuggestedPeople([]);
        setSelectedQuestId(null);
        setSelectedProfileId(null);
        updateSelectedProfileState({ isLoading: false, profile: null, quests: [] });
        setEditingQuestId(null);
        setOpenedQuestLinkId(null);
        setNeedsProfileSetup(false);
        setProfileSetupError("");
        setHasLoadedInitialData(false);
        setIsLoadingQuests(false);
        loadedProfileIdRef.current = null;
        return;
      }

      const profile = await ensureProfile(user);

      const stoppedAfterProfileLookup = Boolean(profile) && isStaleSync();
      if (stoppedAfterProfileLookup) {
        return;
      }

      const shouldCompleteProfileSetup = isLikelyAutoDisplayName(
        profile.displayName,
      );
      const isSameLoadedProfile = loadedProfileIdRef.current === profile.id;

      if (!isSameLoadedProfile) {
        setHasLoadedInitialData(false);
        setFeedQuests([]);
        setMyQuests([]);
        setActivityEvents([]);
        setMessageThreads([]);
        setSelectedThreadId(null);
        setChatMessages([]);
        setFriends([]);
        setIncomingFriendRequests([]);
        setOutgoingFriendRequests([]);
        setSuggestedPeople([]);
        setSelectedProfileId(null);
        updateSelectedProfileState({ isLoading: false, profile: null, quests: [] });
      }

      setCurrentProfile(profile);
      setNeedsProfileSetup(shouldCompleteProfileSetup);
      setProfileSetupError("");
      setIsLoadingQuests(true);
      setAuthState("signed_in");
      setAuthError("");
      setAuthMessage("");
      setIsBooting(false);

      try {
        const stoppedBeforeRefresh = isStaleSync();
        if (stoppedBeforeRefresh) {
          return;
        }

        const refreshResults = await Promise.all([
          refreshData(profile),
          refreshSocialData(profile),
          refreshMessages(profile),
        ]);

        const stoppedAfterRefresh = Boolean(refreshResults) && isStaleSync();
        if (stoppedAfterRefresh) {
          return;
        }

        loadedProfileIdRef.current = profile.id;
        setHasLoadedInitialData(true);
      } catch (refreshError) {
        if (isStaleSync()) {
          return;
        }

        setError(readErrorMessage(refreshError));
      } finally {
        if (!isStaleSync()) {
          setIsLoadingQuests(false);
        }
      }

      void registerPushToken(profile.id).catch(() => {
        // Push token registration is best-effort during development.
      });
    } catch (syncError) {
      if (isStaleSync()) {
        return;
      }

      const message = readErrorMessage(syncError);
      setError(message);
      setAuthError(message);
      setAuthMessage("");
      setAuthState("signed_out");
      setCurrentProfile(null);
      setFeedQuests([]);
      setMyQuests([]);
      setActivityEvents([]);
      setMessageThreads([]);
      setSelectedThreadId(null);
      setChatMessages([]);
      setFriends([]);
      setIncomingFriendRequests([]);
      setOutgoingFriendRequests([]);
      setSuggestedPeople([]);
      setSelectedProfileId(null);
      updateSelectedProfileState({ isLoading: false, profile: null, quests: [] });
      setNeedsProfileSetup(false);
      setProfileSetupError("");
      setHasLoadedInitialData(false);
      setIsLoadingQuests(false);
      loadedProfileIdRef.current = null;
    } finally {
      if (!isStaleSync()) {
        setIsBooting(false);
      }
    }
  }, [refreshData, refreshMessages, refreshSocialData]);

  const showInAppBanner = useCallback((banner: Omit<InAppBanner, "id">) => {
    setInAppBanner({
      ...banner,
      id: `${banner.kind}-${Date.now()}`,
    });
  }, []);

  const refreshMessagesWithBannerCheck = useCallback(async (profile: Profile) => {
    const previousAlertState = messageThreadAlertStateRef.current;
    const nextThreads = await fetchMessageThreads(profile.id).catch(
      () => [] as MessageThread[],
    );
    const activeThreadId = selectedThreadIdRef.current;

    setMessageThreads(nextThreads);
    messageThreadsRef.current = nextThreads;

    for (const thread of nextThreads) {
      const nextAlertState = buildMessageThreadAlertState(thread);
      const previousThreadState = previousAlertState.get(thread.id);
      const hasNewUnreadState =
        thread.unreadCount > 0 &&
        nextAlertState !== previousThreadState &&
        thread.id !== activeThreadId &&
        !thread.preview.startsWith("You:");

      if (hasNewUnreadState) {
        showInAppBanner({
          ...buildMessageBannerAvatar(thread),
          kind: "message",
          threadId: thread.id,
          title: thread.title,
          body: thread.preview,
        });
        break;
      }
    }

    syncMessageThreadAlertState(nextThreads);
    return nextThreads;
  }, [showInAppBanner]);

  useEffect(() => {
    requestLocalNotificationPermission().catch(() => {
      // Ignore permission prompt failures on unsupported platforms.
    });
  }, []);

  useEffect(() => {
    currentProfileRef.current = currentProfile;
    selectedThreadIdRef.current = selectedThreadId;
    utilityViewRef.current = utilityView;
    visibleQuestsRef.current = allVisibleQuests;
    messageThreadsRef.current = messageThreads;
    chatMessagesSignatureRef.current = buildChatMessagesSignature(chatMessages);
  }, [
    allVisibleQuests,
    chatMessages,
    currentProfile,
    messageThreads,
    selectedThreadId,
    utilityView,
  ]);

  useEffect(() => {
    if (!inAppBanner) {
      return;
    }

    const timer = window.setTimeout(() => {
      setInAppBanner((current) =>
        current?.id === inAppBanner.id ? null : current,
      );
    }, 4_200);

    return () => window.clearTimeout(timer);
  }, [inAppBanner]);

  useEffect(() => {
    if (!currentProfile || !selectedThreadId) {
      return;
    }

    let isStopped = false;
    let isRefreshing = false;

    async function refreshVisibleChat() {
      if (
        isStopped ||
        isRefreshing ||
        document.visibilityState !== "visible" ||
        !currentProfileRef.current ||
        !selectedThreadIdRef.current
      ) {
        return;
      }

      isRefreshing = true;
      const activeProfile = currentProfileRef.current;
      const activeThreadId = selectedThreadIdRef.current;

      try {
        const nextMessages = await fetchThreadMessages(
          activeThreadId,
          activeProfile.id,
        );
        const nextSignature = buildChatMessagesSignature(nextMessages);

        if (nextSignature !== chatMessagesSignatureRef.current) {
          chatMessagesSignatureRef.current = nextSignature;
          setChatMessages(nextMessages);
          await markThreadRead(activeThreadId, activeProfile.id).catch(() => {
            // Foreground polling should never block on read receipts.
          });
          await refreshMessages(activeProfile).catch(() => []);
        }
      } catch {
        // Realtime/polling is best-effort; manual refresh/reopen remains available.
      } finally {
        isRefreshing = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshVisibleChat();
    }, 2_000);

    void refreshVisibleChat();

    return () => {
      isStopped = true;
      window.clearInterval(intervalId);
    };
  }, [currentProfile, refreshMessages, selectedThreadId]);

  useEffect(() => {
    if (!currentProfile) {
      return;
    }

    let isStopped = false;
    let isRefreshing = false;

    async function refreshThreadSummaries() {
      if (
        isStopped ||
        isRefreshing ||
        document.visibilityState !== "visible" ||
        !currentProfileRef.current
      ) {
        return;
      }

      isRefreshing = true;

      try {
        await refreshMessagesWithBannerCheck(currentProfileRef.current);
      } catch {
        // Message banners are a foreground polish layer.
      } finally {
        isRefreshing = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshThreadSummaries();
    }, 4_000);

    return () => {
      isStopped = true;
      window.clearInterval(intervalId);
    };
  }, [currentProfile, refreshMessagesWithBannerCheck]);

  function handleInAppBannerPress(banner: InAppBanner) {
    setInAppBanner(null);

    if (banner.kind === "message" && banner.threadId) {
      void handleOpenThread(banner.threadId);
      return;
    }

    if (banner.questId) {
      const canOpenQuest = visibleQuestsRef.current.some(
        (quest) => quest.id === banner.questId,
      );

      if (canOpenQuest) {
        handleOpenQuest(banner.questId);
        return;
      }
    }

    if (banner.actorId) {
      handleOpenProfile(banner.actorId);
      return;
    }

    handleOpenActivity();
  }

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((event) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT"
      ) {
        void syncAuthAndData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [syncAuthAndData]);

  useEffect(() => {
    if (!currentProfileId) {
      return;
    }

    const supabase = getSupabaseClient();
    const channel = supabase.channel(`plus1-mobile-events-${currentProfileId}`);
    let refreshTimer: number | undefined;
    let socialRefreshTimer: number | undefined;
    let messageRefreshTimer: number | undefined;

    function scheduleFeedRefresh() {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        if (!currentProfile) {
          return;
        }

        void refreshData(currentProfile).catch(() => {
          // Realtime refresh is best-effort; manual Retry remains available.
        });
      }, 250);
    }

    function scheduleSocialRefresh() {
      if (socialRefreshTimer) {
        window.clearTimeout(socialRefreshTimer);
      }

      socialRefreshTimer = window.setTimeout(() => {
        if (!currentProfile) {
          return;
        }

        void Promise.all([
          refreshSocialData(currentProfile),
          refreshData(currentProfile),
        ]).catch(() => {
          // Realtime refresh is best-effort; manual Retry remains available.
        });
      }, 250);
    }

    function scheduleMessageRefresh() {
      if (messageRefreshTimer) {
        window.clearTimeout(messageRefreshTimer);
      }

      messageRefreshTimer = window.setTimeout(() => {
        if (!currentProfile) {
          return;
        }

        void refreshMessages(currentProfile).catch(() => {
          // Realtime refresh is best-effort; manual Retry remains available.
        });
      }, 250);
    }

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "quests",
      },
      async (payload) => {
        const quest = payload.new as {
          title?: string | null;
          creator_id?: string | null;
          area?: string | null;
        };

        scheduleFeedRefresh();

        if (
          !quest.creator_id ||
          quest.creator_id === currentProfileId ||
          quest.area !== currentProfile?.area
        ) {
          return;
        }

        const profiles = await fetchProfilesByIds([quest.creator_id]);
        const hostName = profiles[0]?.displayName ?? "Someone nearby";
        await notifyLocalEvent(
          "New event nearby",
          `${hostName} posted: ${quest.title ?? "Untitled event"}`,
        );
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "quests",
      },
      () => {
        scheduleFeedRefresh();
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "quest_joins",
      },
      async (payload) => {
        const join = payload.new as {
          quest_id?: string | null;
          user_id?: string | null;
        };

        scheduleFeedRefresh();

        if (!join.quest_id || !join.user_id || join.user_id === currentProfileId) {
          return;
        }

        const myQuest = myQuests.find(
          (quest) => quest.id === join.quest_id && quest.createdByCurrentUser,
        );

        if (!myQuest) {
          return;
        }

        const profiles = await fetchProfilesByIds([join.user_id]);
        const joinerName = profiles[0]?.displayName ?? "Someone";
        await notifyLocalEvent(
          "Someone joined your event",
          `${joinerName} joined ${myQuest.title}`,
        );
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "quest_joins",
      },
      () => {
        scheduleFeedRefresh();
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "quest_invites",
      },
      () => {
        scheduleFeedRefresh();
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "friendships",
      },
      (payload) => {
        const next = payload.new as {
          requester_id?: string | null;
          addressee_id?: string | null;
        };
        const old = payload.old as {
          requester_id?: string | null;
          addressee_id?: string | null;
        };
        const isRelevant =
          next.requester_id === currentProfileId ||
          next.addressee_id === currentProfileId ||
          old.requester_id === currentProfileId ||
          old.addressee_id === currentProfileId;

        if (isRelevant) {
          scheduleSocialRefresh();
        }
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_threads",
      },
      () => {
        scheduleMessageRefresh();
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_thread_participants",
      },
      () => {
        scheduleMessageRefresh();
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      async (payload) => {
        const message = payload.new as {
          body?: string | null;
          sender_id?: string | null;
          thread_id?: string | null;
        };
        const activeProfile = currentProfileRef.current;

        if (!message.thread_id || !activeProfile) {
          return;
        }

        if (message.thread_id === selectedThreadIdRef.current) {
          const nextMessages = await fetchThreadMessages(
            message.thread_id,
            activeProfile.id,
          ).catch(() => null);

          if (nextMessages) {
            setChatMessages(nextMessages);
            await markThreadRead(message.thread_id, activeProfile.id).catch(() => {
              // Read receipts should never block live chat updates.
            });
            await refreshMessages(activeProfile).catch(() => []);
          }

          return;
        }

        const nextThreads = await refreshMessages(activeProfile).catch(
          () => [] as MessageThread[],
        );
        const targetThread = nextThreads.find(
          (thread) => thread.id === message.thread_id,
        );

        if (
          targetThread &&
          message.sender_id !== activeProfile.id &&
          targetThread.unreadCount > 0
        ) {
          showInAppBanner({
            ...buildMessageBannerAvatar(targetThread),
            kind: "message",
            threadId: targetThread.id,
            title: targetThread.title,
            body: targetThread.preview,
          });
        }
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "activity_events",
        filter: `user_id=eq.${currentProfileId}`,
      },
      async (payload) => {
        const activity = payload.new as {
          actor_id?: string | null;
          body?: string | null;
          id?: string | null;
          quest_id?: string | null;
          title?: string | null;
        };
        const nextActivity = await fetchActivityEvents(currentProfileId).catch(
          () => null,
        );

        if (nextActivity) {
          setActivityEvents(nextActivity);
        }

        if (utilityViewRef.current === "activity") {
          return;
        }

        const createdActivity =
          nextActivity?.find((event) => event.id === activity.id) ?? null;

        showInAppBanner({
          kind: "activity",
          actorId: createdActivity?.actorId ?? activity.actor_id ?? null,
          questId: createdActivity?.questId ?? activity.quest_id ?? null,
          title: createdActivity?.title ?? activity.title ?? "New activity",
          body: createdActivity?.body ?? activity.body ?? null,
        });
      },
    );

    channel.subscribe((status, error) => {
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        console.warn("[plus1] Realtime channel issue", status, error);
      }
    });

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      if (socialRefreshTimer) {
        window.clearTimeout(socialRefreshTimer);
      }
      if (messageRefreshTimer) {
        window.clearTimeout(messageRefreshTimer);
      }
      void channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [
    currentProfile,
    currentProfileId,
    myQuests,
    refreshData,
    refreshMessages,
    refreshSocialData,
    showInAppBanner,
  ]);

  function showUnavailableSharedQuest(questId: string) {
    setOpenedQuestLinkId(questId);
    setActionError("That shared event is not available in your feed.");
  }

  function openSharedQuest(questId: string, linkedQuestId: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete("quest");
    window.history.replaceState({}, "", url.toString());
    setOpenedQuestLinkId(questId);
    setActionError("");
    setUtilityView(null);
    setSelectedThreadId(null);
    setSelectedQuestId(linkedQuestId);
    setActiveTab("home");
  }

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      authState !== "signed_in" ||
      isBooting ||
      isLoadingQuests
    ) {
      return;
    }

    const questId = getQuestIdFromSearch(window.location.search);

    if (!questId || openedQuestLinkId === questId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const linkedQuest = allVisibleQuests.find(
        (quest) => quest.id === questId,
      );

      if (!linkedQuest) {
        showUnavailableSharedQuest(questId);
        return;
      }

      openSharedQuest(questId, linkedQuest.id);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    allVisibleQuests,
    authState,
    isBooting,
    isLoadingQuests,
    openedQuestLinkId,
  ]);

  useEffect(() => {
    if (!selectedProfileId || !currentProfile) {
      const timer = window.setTimeout(() => {
        updateSelectedProfileState({ isLoading: false, profile: null, quests: [] });
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }

    let isStale = false;
    const loadingTimer = window.setTimeout(() => {
      updateSelectedProfileState({ isLoading: true });
    }, 0);

    Promise.all([
      fetchPublicProfile(selectedProfileId, currentProfile.id),
      fetchVisibleProfileQuests(selectedProfileId, currentProfile.id),
    ])
      .then(([profile, quests]) => {
        if (isStale) {
          return;
        }

        updateSelectedProfileState({ profile, quests });
        setActionError("");
      })
      .catch((profileError) => {
        if (isStale) {
          return;
        }

        updateSelectedProfileState({ profile: null, quests: [] });
        setActionError(readErrorMessage(profileError));
      })
      .finally(() => {
        if (!isStale) {
          updateSelectedProfileState({ isLoading: false });
        }
      });

    return () => {
      isStale = true;
      window.clearTimeout(loadingTimer);
    };
  }, [currentProfile, selectedProfileId]);

  function handleOpenProfile(profileId: string) {
    setSelectedQuestId(null);
    setSelectedThreadId(null);
    setUtilityView(null);
    setSelectedProfileId(profileId);
    setActionError("");
  }

  function handleOpenQuest(questId: string) {
    setSelectedProfileId(null);
    setSelectedThreadId(null);
    setUtilityView(null);
    setSelectedQuestId(questId);
    setActionError("");
  }

  function clearActiveSurface() {
    setSelectedQuestId(null);
    setSelectedProfileId(null);
    setSelectedThreadId(null);
    setChatMessages([]);
    setUtilityView(null);
    setActionError("");
  }

  function openRootPage(page: RootPage) {
    if (isAppLocked) {
      return;
    }

    const currentPage = getCurrentRootPage(activeTab);
    if (page !== currentPage) {
      clearActiveSurface();
    }

    setUtilityView(null);
    setActiveTab(page);
  }

  function handleTabChange(tab: AppTab) {
    if (isAppLocked) {
      return;
    }

    if (tab !== "create") {
      openRootPage(tab);
      return;
    }

    clearActiveSurface();
    setActiveTab("create");
  }

  const handleRootPageIndexChange = useCallback(
    (index: number) => {
      const page = rootPages[index];
      if (!page) {
        return;
      }

      const currentPage = getCurrentRootPage(activeTab);
      if (page === currentPage) {
        return;
      }

      startTransition(() => {
        clearActiveSurface();
        setUtilityView(null);
        setActiveTab(page);
      });
    },
    [activeTab],
  );

  function handleOpenActivity() {
    setSelectedQuestId(null);
    setSelectedProfileId(null);
    setSelectedThreadId(null);
    setChatMessages([]);
    setUtilityView("activity");
    setActionError("");

    if (currentProfileId && unreadActivityCount > 0) {
      void markActivityRead(currentProfileId).catch(() => {
        // Marking read is best-effort; the feed still renders.
      });
      setActivityEvents((events) =>
        events.map((event) => ({ ...event, isRead: true })),
      );
    }
  }

  async function handleOpenInbox() {
    if (!currentProfile) {
      return;
    }

    setActionError("");
    await refreshMessages(currentProfile);
    setSelectedQuestId(null);
    setSelectedProfileId(null);
    setSelectedThreadId(null);
    setUtilityView("inbox");
  }

  async function handleOpenThread(threadId: string) {
    if (!currentProfile) {
      return;
    }

    try {
      setIsLoadingMessages(true);
      setActionError("");
      setUtilityView("inbox");
      setSelectedQuestId(null);
      setSelectedProfileId(null);
      setSelectedThreadId(threadId);
      const nextMessages = await fetchThreadMessages(threadId, currentProfile.id);
      setChatMessages(nextMessages);
      await markThreadRead(threadId, currentProfile.id).catch(() => {
        // Read receipts should never block opening a chat.
      });
      await refreshMessages(currentProfile);
    } catch (messageError) {
      setActionError(readErrorMessage(messageError));
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleMessageProfile(profileId: string) {
    if (!currentProfile) {
      return;
    }

    try {
      setIsLoadingMessages(true);
      setActionError("");
      const threadId = await getOrCreateDirectThread(profileId);
      await handleOpenThread(threadId);
    } catch (messageError) {
      setActionError(readErrorMessage(messageError));
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleOpenEventChat(questId: string) {
    if (!currentProfile) {
      return;
    }

    try {
      setIsLoadingMessages(true);
      setActionError("");
      const threadId = await getOrCreateEventThread(questId);
      await handleOpenThread(threadId);
    } catch (messageError) {
      setActionError(readErrorMessage(messageError));
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleSendChatMessage(body: string) {
    if (!currentProfile || !selectedThreadId) {
      return;
    }

    try {
      setIsSendingMessage(true);
      setActionError("");
      await sendMessage(selectedThreadId, currentProfile.id, body);
      const nextMessages = await fetchThreadMessages(
        selectedThreadId,
        currentProfile.id,
      );
      setChatMessages(nextMessages);
      await markThreadRead(selectedThreadId, currentProfile.id).catch(() => {
        // Read receipts should never block sending a chat.
      });
      await refreshMessages(currentProfile);
    } catch (messageError) {
      setActionError(readErrorMessage(messageError));
    } finally {
      setIsSendingMessage(false);
    }
  }

  function handleApplyDraft(draft: SmartQuestDraft) {
    setCreateInitialValues(draft);
    setCreateInitialInvitees(draft.inviteeProfiles ?? []);
    setCreateFormKey((key) => key + 1);
  }

  async function handleSendPhoneCode(phone: string) {
    try {
      setIsSigningIn(true);
      setAuthError("");
      setAuthMessage("");
      const normalizedPhone = normalizePhoneNumber(phone);
      await sendPhoneOtp(normalizedPhone);
      setAuthMessage(`Code sent to ${normalizedPhone}.`);
      return true;
    } catch (signInError) {
      setAuthError(readErrorMessage(signInError));
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleVerifyPhoneCode(phone: string, token: string) {
    try {
      setIsSigningIn(true);
      setAuthError("");
      setAuthMessage("");
      await verifyPhoneOtp(phone, token);
      setAuthMessage("Code verified. Signing you in...");
      return true;
    } catch (verifyError) {
      setAuthError(readErrorMessage(verifyError));
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    try {
      setActionError("");
      await signOutCurrentUser();
    } catch (signOutError) {
      setActionError(readErrorMessage(signOutError));
    }
  }

  function getFriendActionProfileId(friendshipId: string) {
    const connection = [
      ...friends,
      ...incomingFriendRequests,
      ...outgoingFriendRequests,
    ].find((friend) => friend.id === friendshipId);

    return connection?.profile.id ?? null;
  }

  async function refreshAfterFriendAction() {
    if (!currentProfile) {
      return;
    }

    await Promise.all([
      refreshSocialData(currentProfile),
      refreshData(currentProfile),
      refreshMessages(currentProfile),
    ]);

    if (selectedProfileId) {
      const [profile, quests] = await Promise.all([
        fetchPublicProfile(selectedProfileId, currentProfile.id),
        fetchVisibleProfileQuests(selectedProfileId, currentProfile.id),
      ]);
      updateSelectedProfileState({ profile, quests });
    }
  }

  async function handleSendFriendRequest(profileId: string) {
    if (!currentProfile) {
      return;
    }

    try {
      setFriendActionProfileId(profileId);
      setActionError("");
      await sendFriendRequest(currentProfile.id, profileId, currentProfile.displayName);
      await refreshAfterFriendAction();
    } catch (friendError) {
      setActionError(readErrorMessage(friendError));
    } finally {
      setFriendActionProfileId(null);
    }
  }

  async function handleAcceptFriend(friendshipId: string) {
    if (!currentProfile) {
      return;
    }

    const profileId = getFriendActionProfileId(friendshipId);

    try {
      setFriendActionProfileId(profileId);
      setActionError("");
      await acceptFriendRequest(
        friendshipId,
        currentProfile.id,
        currentProfile.displayName,
      );
      await refreshAfterFriendAction();
    } catch (friendError) {
      setActionError(readErrorMessage(friendError));
    } finally {
      setFriendActionProfileId(null);
    }
  }

  async function handleDeclineFriend(friendshipId: string) {
    if (!currentProfile) {
      return;
    }

    const profileId = getFriendActionProfileId(friendshipId);

    try {
      setFriendActionProfileId(profileId);
      setActionError("");
      await declineFriendRequest(friendshipId, currentProfile.id);
      await refreshAfterFriendAction();
    } catch (friendError) {
      setActionError(readErrorMessage(friendError));
    } finally {
      setFriendActionProfileId(null);
    }
  }

  async function handleCancelFriendRequest(friendshipId: string) {
    const profileId = getFriendActionProfileId(friendshipId);

    try {
      setFriendActionProfileId(profileId);
      setActionError("");
      await cancelFriendRequest(friendshipId);
      await refreshAfterFriendAction();
    } catch (friendError) {
      setActionError(readErrorMessage(friendError));
    } finally {
      setFriendActionProfileId(null);
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    const profileId = getFriendActionProfileId(friendshipId);

    try {
      setFriendActionProfileId(profileId);
      setActionError("");
      await removeFriend(friendshipId);
      await refreshAfterFriendAction();
    } catch (friendError) {
      setActionError(readErrorMessage(friendError));
    } finally {
      setFriendActionProfileId(null);
    }
  }

  async function handleSaveProfile(changes: {
    displayName: string;
    handle: string;
    avatarFile?: File | null;
    bio: string | null;
    pronouns: string | null;
    area: string;
  }) {
    if (!currentProfile) {
      return;
    }

    try {
      setIsSavingProfile(true);
      setProfileError("");
      const avatarUrl = changes.avatarFile
        ? await uploadProfilePhoto(currentProfile.id, changes.avatarFile)
        : undefined;
      const updated = await updateProfile(currentProfile.id, {
        ...changes,
        avatarUrl,
      });
      setCurrentProfile(updated);
      await refreshSocialData(updated);
    } catch (saveError) {
      const message = readErrorMessage(saveError);
      setProfileError(message);
      throw new Error(message);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleCompleteProfile(changes: {
    displayName: string;
    handle: string;
    area: string;
    interests: string[];
  }) {
    if (!currentProfile) {
      return;
    }

    try {
      setIsCompletingProfileSetup(true);
      setProfileSetupError("");
      const updated = await completeProfileSetup(currentProfile.id, changes);
      setCurrentProfile(updated);
      setNeedsProfileSetup(false);
      await refreshSocialData(updated);
    } catch (setupError) {
      setProfileSetupError(readErrorMessage(setupError));
    } finally {
      setIsCompletingProfileSetup(false);
    }
  }

  function applyLocalDemoJoinedQuestIds(joinedQuestIds: string[]) {
    if (!currentProfile || !shouldShowLocalDemoQuests()) {
      return;
    }

    const localDemoQuests = buildLocalDemoQuests(
      currentProfile,
      joinedQuestIds,
    );

    setFeedQuests((quests) => [
      ...localDemoQuests,
      ...quests.filter((quest) => !isLocalDemoQuestId(quest.id)),
    ]);
    setMyQuests((quests) => [
      ...quests.filter((quest) => !isLocalDemoQuestId(quest.id)),
      ...localDemoQuests.filter(
        (quest) => quest.joinedByCurrentUser || quest.createdByCurrentUser,
      ),
    ]);
  }

  async function handleJoinQuest(questId: string) {
    if (!currentProfile) {
      setActionError("Sign in before joining an event.");
      return;
    }

    try {
      setJoiningQuestId(questId);
      setActionError("");
      if (isLocalDemoQuestId(questId)) {
        const nextJoinedQuestIds = localDemoJoinedQuestIds.includes(questId)
          ? localDemoJoinedQuestIds
          : [...localDemoJoinedQuestIds, questId];

        setLocalDemoJoinedQuestIds(nextJoinedQuestIds);
        applyLocalDemoJoinedQuestIds(nextJoinedQuestIds);
        return;
      }

      await joinQuest(questId, currentProfile.id);
      await Promise.all([refreshData(currentProfile), refreshMessages(currentProfile)]);
    } catch (joinError) {
      setActionError(readErrorMessage(joinError));
    } finally {
      setJoiningQuestId(null);
    }
  }

  async function handleLeaveQuest(questId: string) {
    if (!currentProfile) {
      setActionError("Sign in before leaving an event.");
      return;
    }

    try {
      setLeavingQuestId(questId);
      setActionError("");
      if (isLocalDemoQuestId(questId)) {
        const nextJoinedQuestIds = localDemoJoinedQuestIds.filter(
          (id) => id !== questId,
        );

        setLocalDemoJoinedQuestIds(nextJoinedQuestIds);
        applyLocalDemoJoinedQuestIds(nextJoinedQuestIds);
        setSelectedQuestId(null);
        return;
      }

      await leaveQuest(questId, currentProfile.id);
      await Promise.all([refreshData(currentProfile), refreshMessages(currentProfile)]);
      setSelectedQuestId(null);
    } catch (leaveError) {
      setActionError(readErrorMessage(leaveError));
    } finally {
      setLeavingQuestId(null);
    }
  }

  async function handleCloseQuest(questId: string) {
    if (!currentProfile) {
      setActionError("Sign in before closing an event.");
      return;
    }

    try {
      setClosingQuestId(questId);
      setActionError("");
      await closeQuest(questId, currentProfile.id);
      await refreshData(currentProfile);
      setSelectedQuestId(null);
    } catch (closeError) {
      setActionError(readErrorMessage(closeError));
    } finally {
      setClosingQuestId(null);
    }
  }

  async function handleCreateQuest(
    input: NewQuestInput,
    cardImageFile?: File | null,
  ) {
    if (!currentProfile) {
      throw new Error("Sign in before creating an event.");
    }

    try {
      setIsCreating(true);
      setActionError("");
      const cardImageUrl = cardImageFile
        ? await uploadQuestCardImage(currentProfile.id, cardImageFile)
        : null;
      const newQuest = await createQuest(
        { ...input, cardImageUrl },
        currentProfile.id,
        currentProfile.area,
      );
      await refreshData(currentProfile);
      setCreateInitialValues(null);
      setCreateInitialInvitees([]);
      setCreateFormKey((key) => key + 1);
      setSelectedQuestId(newQuest.id);
      setUtilityView(null);
      setActiveTab("home");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleEditQuest(
    input: NewQuestInput,
    imageChanges?: QuestCardImageChanges,
  ) {
    if (!currentProfile || !editingQuest) {
      throw new Error("Choose an event to edit.");
    }

    try {
      setIsEditing(true);
      setActionError("");
      const quest = editingQuest;
      let cardImageUrl = imageChanges?.removeCardImage
        ? null
        : quest.cardImageUrl;

      if (imageChanges?.cardImageFile) {
        cardImageUrl = await uploadQuestCardImage(
          currentProfile.id,
          imageChanges.cardImageFile,
        );
      }

      await updateQuest(
        quest.id,
        { ...input, cardImageUrl },
        currentProfile.id,
      );
      await refreshData(currentProfile);
      setEditingQuestId(null);
    } finally {
      setIsEditing(false);
    }
  }

  async function handleRetry() {
    try {
      setError("");
      setActionError("");

      if (!currentProfileId || authState !== "signed_in") {
        await syncAuthAndData();
        return;
      }

      setIsLoadingQuests(true);
      if (currentProfile) {
        await Promise.all([
          refreshData(currentProfile),
          refreshMessages(currentProfile),
          refreshSocialData(currentProfile),
        ]);
      }
      loadedProfileIdRef.current = currentProfileId;
      setHasLoadedInitialData(true);
    } catch (retryError) {
      setError(readErrorMessage(retryError));
    } finally {
      setIsLoadingQuests(false);
    }
  }

  if (authState === "loading") {
    return <SplashScreen />;
  }

  if (authState === "signed_out") {
    return (
      <AuthScreen
        error={authError}
        isSubmitting={isSigningIn}
        message={authMessage}
        onSendCode={handleSendPhoneCode}
        onVerifyCode={handleVerifyPhoneCode}
      />
    );
  }

  if (needsProfileSetup && currentProfile) {
    return (
      <ProfileSetupScreen
        initialDisplayName={currentProfile.displayName}
        initialHandle={currentProfile.handle}
        initialArea={currentProfile.area}
        initialInterests={currentProfile.interests}
        isSubmitting={isCompletingProfileSetup}
        error={profileSetupError}
        onComplete={handleCompleteProfile}
      />
    );
  }

  const headerTitle = selectedQuest
    ? selectedQuest.title
    : selectedThreadId
      ? selectedThread?.title ?? "Messages"
    : selectedProfileId
      ? selectedPublicProfile
        ? `@${selectedPublicProfile.handle}`
        : "Profile"
    : utilityView === "activity"
      ? "Activity"
    : utilityView === "inbox"
      ? "Messages"
    : activeTab === "home"
      ? "plus1"
      : activeTab === "events"
        ? "Events"
        : activeTab === "people"
          ? "People"
        : activeTab === "create"
          ? "New event"
          : currentProfile
            ? `@${currentProfile.handle}`
            : "Profile";

  const isHomeRoot =
    activeTab === "home" &&
    !selectedQuest &&
    !selectedProfileId &&
    !selectedThreadId &&
    !utilityView;
  const currentRootPage = getCurrentRootPage(activeTab);
  const currentRootPageIndex = rootPages.indexOf(currentRootPage);
  const isRootTrackActive =
    !selectedQuest &&
    !selectedProfileId &&
    !selectedThreadId &&
    activeTab !== "create" &&
    utilityView === null;
  const activeSurfaceKey = selectedThreadId
    ? `thread:${selectedThreadId}`
    : selectedQuest
      ? `quest:${selectedQuest.id}`
      : selectedProfileId
        ? `profile:${selectedProfileId}`
        : utilityView
          ? `utility:${utilityView}`
          : `tab:${activeTab}`;
  const isChatSurface = Boolean(selectedThreadId);
  const nonRootSurfaceClass = isChatSurface
    ? "min-h-0 flex-1 overflow-hidden px-5 pt-5"
    : `app-scroll min-h-0 flex-1 overflow-y-auto px-5 ${BOTTOM_NAV_SCROLL_PADDING} pt-5`;

  function statusMessages() {
    return (
      <>
        {error ? <ErrorState message={error} onRetry={handleRetry} /> : null}
        {actionError ? <ActionError message={actionError} /> : null}
      </>
    );
  }

  function rootContentForPage(page: RootPage) {
    if (isInitialContentLoading && !error) {
      return (
        <>
          {statusMessages()}
          <TabSkeleton activeTab={page} />
        </>
      );
    }

    return (
      <>
        {statusMessages()}
        {page === "home" ? (
          <HomeScreen
            quests={feedQuests}
            profile={currentProfile!}
            joiningQuestId={joiningQuestId}
            onCreate={() => handleTabChange("create")}
            onJoin={handleJoinQuest}
            onOpen={handleOpenQuest}
          />
        ) : page === "events" ? (
          <EventsScreen
            acceptedFriendIds={acceptedFriendIds}
            quests={feedQuests}
            joiningQuestId={joiningQuestId}
            profile={currentProfile!}
            onJoin={handleJoinQuest}
            onOpen={handleOpenQuest}
          />
        ) : page === "people" ? (
          <PeopleScreen
            actionProfileId={friendActionProfileId}
            currentProfile={currentProfile!}
            suggestedPeople={suggestedPeople}
            onAcceptFriend={handleAcceptFriend}
            onCancelFriendRequest={handleCancelFriendRequest}
            onDeclineFriend={handleDeclineFriend}
            onOpenProfile={handleOpenProfile}
            onRemoveFriend={handleRemoveFriend}
            onSendFriendRequest={handleSendFriendRequest}
          />
        ) : currentProfile ? (
          <ProfileScreen
            friends={friends}
            profile={currentProfile}
            myQuests={myQuests}
            isSaving={isSavingProfile}
            saveError={profileError}
            onOpen={handleOpenQuest}
            onOpenPeople={() => handleTabChange("people")}
            onSaveProfile={handleSaveProfile}
          />
        ) : null}
      </>
    );
  }

  function rootHeaderForPage(page: RootPage) {
    const isHomePanel = page === "home";
    const isProfilePanel = page === "profile";
    const hideTitle = page === "events" || page === "people";
    const title =
      page === "home"
        ? "plus1"
        : page === "events"
          ? "Events"
          : page === "people"
            ? "People"
            : currentProfile
              ? `@${currentProfile.handle}`
              : "Profile";

    return (
      <AppHeader
        actions={
          isHomePanel ? (
            <HomeHeaderActions
              unreadActivityCount={unreadActivityCount}
              unreadMessageCount={unreadMessageCount}
              onOpenActivity={handleOpenActivity}
              onOpenInbox={() => {
                void handleOpenInbox();
              }}
            />
          ) : isProfilePanel ? (
            <ProfileHeaderActions onSignOut={handleSignOut} />
          ) : null
        }
        compactLargeTitle={isProfilePanel}
        hideTitle={hideTitle}
        isBrand={isHomePanel}
        title={title}
        titleAlign="large"
      />
    );
  }

  function nonRootContent() {
    return (
      <>
        {statusMessages()}

        {isInitialContentLoading && !error ? (
          <TabSkeleton activeTab={activeTab} />
        ) : selectedThreadId ? (
          <ChatThreadScreen
            currentUserId={currentProfileId}
            isLoading={isLoadingMessages}
            isSending={isSendingMessage}
            messages={chatMessages}
            thread={selectedThread}
            onSend={handleSendChatMessage}
          />
        ) : selectedQuest ? (
          <QuestDetail
            isClosing={closingQuestId === selectedQuest.id}
            isJoining={joiningQuestId === selectedQuest.id}
            isLeaving={leavingQuestId === selectedQuest.id}
            quest={selectedQuest}
            onClose={handleCloseQuest}
            onEdit={(quest) => setEditingQuestId(quest.id)}
            onOpenChat={handleOpenEventChat}
            onJoin={handleJoinQuest}
            onLeave={handleLeaveQuest}
            onOpenProfile={handleOpenProfile}
          />
        ) : selectedProfileId ? (
          <PublicProfileScreen
            actionProfileId={friendActionProfileId}
            isLoading={isLoadingPublicProfile}
            profile={selectedPublicProfile}
            quests={selectedProfileQuests}
            onAcceptFriend={handleAcceptFriend}
            onCancelFriendRequest={handleCancelFriendRequest}
            onDeclineFriend={handleDeclineFriend}
            onOpenQuest={handleOpenQuest}
            onRemoveFriend={handleRemoveFriend}
            onMessageProfile={handleMessageProfile}
            onSendFriendRequest={handleSendFriendRequest}
          />
        ) : utilityView === "activity" ? (
          <ActivityScreen
            actionProfileId={friendActionProfileId}
            events={activityEvents}
            incomingFriendRequests={incomingFriendRequests}
            onAcceptFriend={handleAcceptFriend}
            onBrowse={() => handleTabChange("home")}
            onDeclineFriend={handleDeclineFriend}
            onOpenProfile={handleOpenProfile}
            onOpenQuest={handleOpenQuest}
          />
        ) : utilityView === "inbox" ? (
          <InboxScreen
            friends={friends}
            isLoading={isLoadingMessages}
            threads={messageThreads}
            onMessageFriend={handleMessageProfile}
            onOpenThread={handleOpenThread}
          />
        ) : activeTab === "create" ? (
          <div className="space-y-5">
            <AiQuestDraft
              currentProfile={currentProfile!}
              currentUserId={currentProfileId}
              isAvailable={isAiAvailable}
              onApplyDraft={handleApplyDraft}
            />
            <CreateQuestForm
              key={createFormKey}
              currentUserId={currentProfileId}
              friendProfiles={friendInviteProfiles}
              initialInvitees={createInitialInvitees}
              initialValues={createInitialValues ?? undefined}
              isSubmitting={isCreating}
              onCreateQuest={handleCreateQuest}
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <main
      className="app-viewport flex flex-col bg-zinc-50 text-zinc-950"
      style={STABLE_VIEWPORT_STYLE}
    >
      <section className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-white sm:border-x sm:border-zinc-200">
        {isRootTrackActive ? (
          <RootPageCarousel
            ref={rootCarouselRef}
            activeIndex={currentRootPageIndex}
            onActiveIndexChange={handleRootPageIndexChange}
            pages={rootPages}
            renderPanel={(page) => (
              <section className="flex h-full flex-col overflow-hidden bg-white">
                {rootHeaderForPage(page)}
                <div
                  className={`app-scroll min-h-0 flex-1 overflow-y-auto px-5 ${BOTTOM_NAV_SCROLL_PADDING} ${
                    page === "events"
                      ? "pt-0 snap-y snap-mandatory"
                      : page === "people"
                        ? "pt-0"
                        : "pt-3"
                  }`}
                >
                  {rootContentForPage(page)}
                </div>
              </section>
            )}
          />
        ) : (
          <>
            <AppHeader
              actions={
                isHomeRoot ? (
                  <HomeHeaderActions
                    unreadActivityCount={unreadActivityCount}
                    unreadMessageCount={unreadMessageCount}
                    onOpenActivity={handleOpenActivity}
                    onOpenInbox={() => {
                      void handleOpenInbox();
                    }}
                  />
                ) : null
              }
              isBrand={isHomeRoot}
              title={headerTitle}
              onBack={
                selectedQuest
                  ? () => setSelectedQuestId(null)
                  : selectedThreadId
                    ? () => {
                        setSelectedThreadId(null);
                        setChatMessages([]);
                        setUtilityView("inbox");
                      }
                    : selectedProfileId
                      ? () => setSelectedProfileId(null)
                      : utilityView
                        ? () => setUtilityView(null)
                        : undefined
              }
            />

            <div
              key={activeSurfaceKey}
              className={nonRootSurfaceClass}
            >
              {nonRootContent()}
            </div>
          </>
        )}

        {!isChatSurface ? (
          <BottomNav
            activeTab={activeTab}
            homeUnreadCount={unreadActivityCount + unreadMessageCount}
            isDisabled={isAppLocked}
            profileAvatarInitials={currentProfile?.avatarInitials}
            profileAvatarUrl={currentProfile?.avatarUrl}
            onTabChange={handleTabChange}
          />
        ) : null}
      </section>
      {inAppBanner ? (
        <AppNotificationBanner
          banner={inAppBanner}
          onOpen={() => handleInAppBannerPress(inAppBanner)}
          onDismiss={() => setInAppBanner(null)}
        />
      ) : null}
      {editingQuest ? (
        <EditQuestModal
          currentUserId={currentProfileId}
          friendProfiles={friendInviteProfiles}
          isSubmitting={isEditing}
          quest={editingQuest}
          onCancel={() => setEditingQuestId(null)}
          onSave={handleEditQuest}
        />
      ) : null}
    </main>
  );
}

const KEYBOARD_HEIGHT_GAP = 120;
const BOTTOM_NAV_SCROLL_PADDING =
  "pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]";
const STABLE_VIEWPORT_STYLE = {
  minHeight: "var(--plus1-app-height, 100vh)",
};

function getCurrentRootPage(activeTab: AppTab): RootPage {
  return activeTab === "create" ? "home" : activeTab;
}

function AppHeader({
  actions,
  compactLargeTitle = false,
  hideTitle = false,
  isBrand,
  leading,
  onBack,
  title,
  titleAlign = "center",
}: {
  actions?: ReactNode;
  compactLargeTitle?: boolean;
  hideTitle?: boolean;
  isBrand: boolean;
  leading?: ReactNode;
  onBack?: () => void;
  title: string;
  titleAlign?: "center" | "large" | "left";
}) {
  if (hideTitle && titleAlign === "large") {
    return (
      <header className="shrink-0 bg-white pt-[calc(env(safe-area-inset-top,0px)+6px)]">
        {actions ? (
          <div className="flex items-center justify-end px-5 pb-1">{actions}</div>
        ) : null}
      </header>
    );
  }

  if (hideTitle) {
    return (
      <header className="shrink-0 bg-white px-4 pb-1 pt-[calc(env(safe-area-inset-top,0px)+6px)]">
        <div className="flex min-h-10 items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="glass-chip grid size-10 shrink-0 place-items-center rounded-full border text-zinc-950 transition hover:bg-white/80"
            >
              <ChevronLeft size={28} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
          {actions ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </header>
    );
  }

  if (titleAlign === "large") {
    return (
      <header className="shrink-0 bg-white px-5 pb-2 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <div
          className={`flex items-start justify-between gap-3 ${
            compactLargeTitle ? "min-h-[2.75rem]" : "min-h-[3.65rem]"
          }`}
        >
          <h1
            className={`min-w-0 flex-1 truncate font-bold tracking-tight text-zinc-950 ${
              compactLargeTitle
                ? "text-xl leading-tight"
                : "text-[2.75rem] leading-none"
            }`}
          >
            {title}
          </h1>
          {actions ? (
            <div className="mt-1.5 flex shrink-0 items-center">{actions}</div>
          ) : null}
        </div>
      </header>
    );
  }

  if (titleAlign === "left") {
    return (
      <header className="glass-bar flex shrink-0 items-center justify-between gap-3 border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {leading}
          <h1 className="min-w-0 truncate text-xl font-bold tracking-tight text-zinc-950">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </header>
    );
  }

  return (
    <header
      className={`glass-bar relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] ${
        isBrand ? "min-h-[calc(env(safe-area-inset-top,0px)+4.35rem)]" : ""
      }`}
    >
      <div className="flex min-w-0 justify-start">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="glass-chip grid size-10 shrink-0 place-items-center rounded-full border text-zinc-950 transition hover:bg-white/80"
          >
            <ChevronLeft size={28} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <h1
        className={`min-w-0 max-w-full truncate text-center font-bold tracking-tight text-zinc-950 ${
          isBrand ? "text-2xl" : "text-xl"
        }`}
      >
        {title}
      </h1>
      <div className="flex min-w-0 justify-end">
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

function AppNotificationBanner({
  banner,
  onDismiss,
  onOpen,
}: {
  banner: InAppBanner;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const Icon = banner.kind === "message" ? MessageCircle : Bell;
  const shouldShowAvatar = banner.kind === "message" && banner.avatarInitials;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+10px)] z-50 mx-auto max-w-[456px] px-1">
      <div className="glass-bar pointer-events-auto flex w-full items-center gap-2 rounded-2xl border p-2 shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-left transition active:scale-[0.99]"
        >
          {shouldShowAvatar ? (
            <BannerAvatar banner={banner} />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-950 text-white">
              <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-zinc-950">
              {banner.title}
            </span>
            {banner.body ? (
              <span className="mt-0.5 block truncate text-xs font-semibold text-zinc-500">
                {banner.body}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold text-zinc-400 transition hover:bg-white/70 hover:text-zinc-700"
        >
          x
        </button>
      </div>
    </div>
  );
}

function BannerAvatar({ banner }: { banner: InAppBanner }) {
  const initials = banner.avatarInitials?.trim().slice(0, 2).toUpperCase() || "?";

  if (banner.avatarUrl) {
    return (
      <SafeImage
        src={banner.avatarUrl}
        alt={banner.avatarLabel ? `${banner.avatarLabel} profile photo` : ""}
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }

  return (
    <span
      aria-label={banner.avatarLabel ?? undefined}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-950 text-[0.7rem] font-extrabold text-white ring-1 ring-zinc-200"
    >
      {initials}
    </span>
  );
}

export function HomeHeaderActions({
  onOpenActivity,
  onOpenInbox,
  unreadActivityCount,
  unreadMessageCount,
}: {
  onOpenActivity: () => void;
  onOpenInbox: () => void;
  unreadActivityCount: number;
  unreadMessageCount: number;
}) {
  return (
    <div className="glass-chip inline-flex h-12 items-center rounded-full border px-1.5 text-zinc-950">
      <HeaderIconButton
        count={unreadActivityCount}
        label="Activity"
        onClick={onOpenActivity}
      >
        <Bell size={21} strokeWidth={2.15} aria-hidden="true" />
      </HeaderIconButton>
      <span
        aria-hidden="true"
        className="h-6 w-px bg-zinc-200/90"
      />
      <HeaderIconButton
        count={unreadMessageCount}
        label="Messages"
        onClick={onOpenInbox}
      >
        <MessageCircle size={21} strokeWidth={2.15} aria-hidden="true" />
      </HeaderIconButton>
    </div>
  );
}

export function ProfileHeaderActions({
  onSignOut,
}: {
  onSignOut: () => void | Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
        className="glass-chip grid size-10 place-items-center rounded-full border text-zinc-950 transition hover:bg-white/80 active:scale-95"
      >
        <Menu size={21} strokeWidth={2.15} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              void onSignOut();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50 active:bg-zinc-100"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function HeaderIconButton({
  children,
  count,
  label,
  onClick,
}: {
  children: ReactNode;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative grid h-10 w-11 place-items-center rounded-full text-zinc-950 transition hover:bg-white/70 active:scale-95"
    >
      {children}
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[0.6rem] font-extrabold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}

function useStableKeyboardViewport() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    const visualViewport = window.visualViewport;
    let stableHeight = readViewportHeight();
    let stableWidth = readViewportWidth();
    let rafId = 0;
    let focusOutTimer: number | undefined;

    function readViewportHeight() {
      return Math.round(
        Math.max(
          window.innerHeight,
          visualViewport?.height ?? 0,
          root.clientHeight,
        ),
      );
    }

    function readViewportWidth() {
      return Math.round(visualViewport?.width ?? window.innerWidth);
    }

    function hasFocusedTextField() {
      const activeElement = document.activeElement;

      return (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement &&
          activeElement.isContentEditable)
      );
    }

    function applyViewportHeight() {
      rafId = 0;

      const currentHeight = readViewportHeight();
      const currentWidth = readViewportWidth();
      const widthChanged = Math.abs(currentWidth - stableWidth) > 48;
      const focusedTextField = hasFocusedTextField();
      const keyboardLooksOpen =
        focusedTextField && stableHeight - currentHeight > KEYBOARD_HEIGHT_GAP;

      if (widthChanged) {
        stableWidth = currentWidth;
        stableHeight = currentHeight;
      } else if (!keyboardLooksOpen) {
        const heightDelta = Math.abs(currentHeight - stableHeight);
        const isLikelyBrowserChrome = heightDelta <= KEYBOARD_HEIGHT_GAP;

        if (currentHeight > stableHeight || isLikelyBrowserChrome) {
          stableHeight = currentHeight;
        }
      }

      root.style.setProperty("--plus1-app-height", `${stableHeight}px`);
      root.classList.toggle("plus1-keyboard-open", keyboardLooksOpen);
    }

    function scheduleApply() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      rafId = window.requestAnimationFrame(applyViewportHeight);
    }

    function handleFocusOut() {
      window.clearTimeout(focusOutTimer);
      focusOutTimer = window.setTimeout(scheduleApply, 80);
    }

    scheduleApply();
    window.addEventListener("resize", scheduleApply);
    window.addEventListener("orientationchange", scheduleApply);
    window.addEventListener("focusin", scheduleApply);
    window.addEventListener("focusout", handleFocusOut);
    visualViewport?.addEventListener("resize", scheduleApply);
    visualViewport?.addEventListener("scroll", scheduleApply, { passive: true });

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearTimeout(focusOutTimer);
      root.classList.remove("plus1-keyboard-open");
      root.style.removeProperty("--plus1-app-height");
      window.removeEventListener("resize", scheduleApply);
      window.removeEventListener("orientationchange", scheduleApply);
      window.removeEventListener("focusin", scheduleApply);
      window.removeEventListener("focusout", handleFocusOut);
      visualViewport?.removeEventListener("resize", scheduleApply);
      visualViewport?.removeEventListener("scroll", scheduleApply);
    };
  }, []);
}

export function SplashScreen() {
  return (
    <main
      className="app-viewport flex flex-col items-center justify-center bg-white text-zinc-950"
      style={STABLE_VIEWPORT_STYLE}
    >
      <h1 className="text-[2.75rem] font-bold tracking-tight">plus1</h1>
      <div className="mt-6 size-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950" />
    </main>
  );
}

export function AuthScreen({
  isSubmitting,
  message,
  error,
  onSendCode,
  onVerifyCode,
}: {
  isSubmitting: boolean;
  message: string;
  error: string;
  onSendCode: (phone: string) => Promise<boolean>;
  onVerifyCode: (phone: string, token: string) => Promise<boolean>;
}) {
  const [areaCode, setAreaCode] = useState("");
  const [localNumber, setLocalNumber] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const isVerifying = Boolean(pendingPhone);
  const phonePartsAreValid = isValidUsPhoneParts(areaCode, localNumber);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isVerifying) {
      const normalizedPhone = normalizeUsPhoneParts(areaCode, localNumber);
      const didSendCode = await onSendCode(normalizedPhone);

      if (didSendCode) {
        setPendingPhone(normalizedPhone);
        setOtpCode("");
      }

      return;
    }

    const didVerifyCode = await onVerifyCode(pendingPhone, otpCode.trim());

    if (didVerifyCode) {
      setOtpCode("");
    }
  }

  function handleUseDifferentPhone() {
    setPendingPhone("");
    setOtpCode("");
    setAreaCode("");
    setLocalNumber("");
  }

  return (
    <main
      className="app-viewport flex flex-col bg-white px-8 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-[calc(env(safe-area-inset-top,0px)+20px)] text-zinc-950"
      style={STABLE_VIEWPORT_STYLE}
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-sm">
          <div className="text-center">
            <h1 className="text-[2.75rem] font-bold leading-none tracking-tight">
              plus1
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Hangouts, without the group text.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-3">
            {!isVerifying ? (
              <>
                <div className="flex gap-3">
                  <input
                    type="tel"
                    required
                    value={areaCode}
                    onChange={(event) =>
                      setAreaCode(
                        event.target.value.replace(/\D+/g, "").slice(0, 3),
                      )
                    }
                    placeholder="510"
                    autoComplete="tel-area-code"
                    inputMode="numeric"
                    aria-label="Area code"
                    className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-center text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
                  />
                  <input
                    type="tel"
                    required
                    value={localNumber}
                    onChange={(event) =>
                      setLocalNumber(
                        event.target.value.replace(/\D+/g, "").slice(0, 7),
                      )
                    }
                    placeholder="4961239"
                    autoComplete="tel-local"
                    inputMode="numeric"
                    aria-label="Phone number"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
                  />
                </div>
                <p className="text-center text-xs leading-5 text-zinc-400">
                  US numbers: 3-digit area code, then 7-digit number. Demo:{" "}
                  <span className="font-semibold text-zinc-500">800</span> +{" "}
                  <span className="font-semibold text-zinc-500">5550123</span>.
                </p>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-zinc-500">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-bold text-zinc-700">{pendingPhone}</span>.
                </p>
                <input
                  type="text"
                  required
                  value={otpCode}
                  onChange={(event) =>
                    setOtpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))
                  }
                  placeholder="Verification code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Verification code"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-center text-lg tracking-[0.4em] text-zinc-950 outline-none transition placeholder:text-base placeholder:tracking-normal placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
                />
              </>
            )}

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                (!isVerifying && !phonePartsAreValid) ||
                (isVerifying && !otpCode.trim())
              }
              className="min-h-12 w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isSubmitting
                ? isVerifying
                  ? "Verifying..."
                  : "Sending code..."
                : isVerifying
                  ? "Verify code"
                  : "Text me a code"}
            </button>

            {isVerifying ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleUseDifferentPhone}
                className="min-h-11 w-full text-center text-sm font-bold text-zinc-500 transition hover:text-zinc-800 disabled:opacity-50"
              >
                Use a different number
              </button>
            ) : null}
          </form>
        </div>
      </div>

      <p className="mx-auto max-w-xs text-center text-xs leading-5 text-zinc-400">
        {isVerifying
          ? "Didn't get a code? Double-check your number and try again."
          : "We'll text you a one-time code. New here? Your account is created automatically."}
      </p>
    </main>
  );
}

export function ProfileSetupScreen({
  initialDisplayName,
  initialHandle,
  initialArea,
  initialInterests,
  isSubmitting,
  error,
  onComplete,
}: {
  initialDisplayName: string;
  initialHandle: string;
  initialArea: string;
  initialInterests: string[];
  isSubmitting: boolean;
  error: string;
  onComplete: (changes: {
    displayName: string;
    handle: string;
    area: string;
    interests: string[];
  }) => Promise<void> | void;
}) {
  const [displayName, setDisplayName] = useState(() =>
    isLikelyAutoDisplayName(initialDisplayName) ? "" : initialDisplayName,
  );
  const [handle, setHandle] = useState(initialHandle);
  const [area, setArea] = useState(initialArea || DEFAULT_AREA);
  const [selectedInterests, setSelectedInterests] = useState(initialInterests);

  const normalizedDisplayName = displayName.trim().replace(/\s+/g, " ");
  const normalizedHandle = normalizeHandle(handle);
  const isValidDisplayName = normalizedDisplayName.length >= 2;
  const canSubmit =
    isValidDisplayName && isValidHandle(normalizedHandle) && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    await onComplete({
      displayName: normalizedDisplayName,
      handle: normalizedHandle,
      area,
      interests: selectedInterests,
    });
  }

  function toggleInterest(interest: string) {
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  }

  return (
    <main
      className="app-viewport flex flex-col bg-white px-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-[calc(env(safe-area-inset-top,0px)+20px)] text-zinc-950"
      style={STABLE_VIEWPORT_STYLE}
    >
      <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center">
        <div className="text-center">
          <h1 className="text-[2.5rem] font-bold leading-none tracking-tight">
            plus1
          </h1>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-zinc-950">
            Finish your profile
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Pick the name people see, the @handle they can recognize, and your local area.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-zinc-800">
              Display name
            </span>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 transition focus-within:border-zinc-400 focus-within:bg-white">
              <UserRound
                size={18}
                strokeWidth={1.9}
                className="shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <input
                type="text"
                required
                maxLength={32}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                className="min-w-0 flex-1 bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-zinc-800">Handle</span>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 transition focus-within:border-zinc-400 focus-within:bg-white">
              <AtSign
                size={18}
                strokeWidth={1.9}
                className="shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <input
                type="text"
                required
                maxLength={31}
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                placeholder="your.handle"
                autoCapitalize="none"
                autoCorrect="off"
                className="min-w-0 flex-1 bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </div>
            <span className="mt-1 block text-xs font-semibold text-zinc-400">
              3-30 characters. Letters, numbers, periods, and underscores.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-zinc-800">Local area</span>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 transition focus-within:border-zinc-400 focus-within:bg-white">
              <MapPin
                size={18}
                strokeWidth={1.9}
                className="shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <select
                value={area}
                onChange={(event) => setArea(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-zinc-950 outline-none"
              >
                {AREA_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <div>
            <p className="text-sm font-bold text-zinc-800">Interests</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {questCategories.map((interest) => {
                const isSelected = selectedInterests.includes(interest);

                return (
                  <button
                    key={interest}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => toggleInterest(interest)}
                    className={`min-h-11 rounded-full border px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white"
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
            <span className="mt-1 block text-xs font-semibold text-zinc-400">
              Choose a few so plus1 can float matching events first.
            </span>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="min-h-12 w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isSubmitting ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

function buildQuestReminderEvents(
  userId: string,
  quests: Quest[],
  activityEvents: ActivityEvent[],
) {
  const now = Date.now();
  const reminderWindowMs = 2 * 60 * 60 * 1000;
  const existingReminderQuestIds = new Set(
    activityEvents.reduce<string[]>((questIds, event) => {
      if (event.type === "reminder" && event.questId) {
        questIds.push(event.questId);
      }

      return questIds;
    }, []),
  );

  return quests.reduce<Parameters<typeof recordActivityEvents>[0]>((events, quest) => {
    if (
      quest.status !== "open" ||
      !quest.startTimeISO ||
      existingReminderQuestIds.has(quest.id)
    ) {
      return events;
    }

    const startMs = new Date(quest.startTimeISO).getTime();
    const isDueSoon =
      Number.isFinite(startMs) &&
      startMs > now &&
      startMs - now <= reminderWindowMs;

    if (!isDueSoon) {
      return events;
    }

    events.push({
      userId,
      actorId: userId,
      questId: quest.id,
      type: "reminder" as const,
      title: `${quest.title} starts soon`,
      body: `${quest.startTimeRelative ?? quest.startTime} at ${quest.location}.`,
    });

    return events;
  }, []);
}

export function TabSkeleton({ activeTab }: { activeTab: AppTab }) {
  if (activeTab === "events") {
    return <ExploreSkeleton />;
  }

  if (activeTab === "create") {
    return <CreateSkeleton />;
  }

  if (activeTab === "people") {
    return <PeopleSkeleton />;
  }

  if (activeTab === "profile") {
    return <ProfileSkeleton />;
  }

  return <HomeSkeleton />;
}

export function HomeSkeleton() {
  return (
    <output aria-label="Loading events" className="space-y-5 animate-pulse">
      <span className="sr-only">Loading events</span>
      <div className="flex items-center gap-2">
        <div className="h-7 w-24 rounded-full bg-zinc-100" />
        <div className="h-7 w-16 rounded-full bg-zinc-100" />
      </div>
      <div className="space-y-5">
        <SkeletonQuestCard variant="immersive" />
        <SkeletonQuestCard variant="compact" />
      </div>
    </output>
  );
}

export function ExploreSkeleton() {
  return (
    <output aria-label="Loading explore" className="space-y-5 animate-pulse">
      <span className="sr-only">Loading explore</span>
      <div className="space-y-2">
        <div className="h-7 w-24 rounded-full bg-zinc-100" />
        <div className="h-4 w-64 max-w-full rounded-full bg-zinc-100" />
      </div>
      <div className="h-12 rounded-full bg-zinc-100" />
      <div className="flex gap-2 overflow-hidden pb-1">
        <div className="h-11 w-16 shrink-0 rounded-full bg-zinc-100" />
        <div className="h-11 w-20 shrink-0 rounded-full bg-zinc-100" />
        <div className="h-11 w-24 shrink-0 rounded-full bg-zinc-100" />
        <div className="h-11 w-20 shrink-0 rounded-full bg-zinc-100" />
      </div>
      <div className="space-y-3">
        <SkeletonQuestCard variant="compact" />
        <SkeletonQuestCard variant="compact" />
      </div>
    </output>
  );
}

export function PeopleSkeleton() {
  return (
    <output aria-label="Loading people" className="space-y-5 animate-pulse">
      <span className="sr-only">Loading people</span>
      <div className="h-12 rounded-full bg-zinc-100" />
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-3">
            <div className="size-12 shrink-0 rounded-full bg-zinc-100" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 rounded-full bg-zinc-100" />
              <div className="h-3 w-24 rounded-full bg-zinc-100" />
            </div>
            <div className="h-9 w-20 rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </output>
  );
}

export function CreateSkeleton() {
  return (
    <output aria-label="Loading create" className="space-y-5 animate-pulse">
      <span className="sr-only">Loading create</span>
      <div className="space-y-2">
        <div className="h-7 w-28 rounded-full bg-zinc-100" />
        <div className="h-4 w-72 max-w-full rounded-full bg-zinc-100" />
      </div>
      <div className="rounded-3xl border border-zinc-200 bg-white p-4">
        <div className="h-5 w-36 rounded-full bg-zinc-100" />
        <div className="mt-4 h-24 rounded-2xl bg-zinc-100" />
        <div className="mt-4 h-11 rounded-full bg-zinc-100" />
      </div>
      <div className="space-y-4">
        <div className="h-12 rounded-2xl bg-zinc-100" />
        <div className="h-12 rounded-2xl bg-zinc-100" />
        <div className="h-24 rounded-2xl bg-zinc-100" />
      </div>
    </output>
  );
}

export function ProfileSkeleton() {
  return (
    <output aria-label="Loading profile" className="space-y-4 pb-3 animate-pulse">
      <span className="sr-only">Loading profile</span>
      <section className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] items-center gap-4">
          <div className="size-20 rounded-full bg-zinc-100" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-1.5">
                <div className="mx-auto h-5 w-6 rounded-full bg-zinc-100" />
                <div className="mx-auto h-2.5 w-12 rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-5 w-36 rounded-full bg-zinc-100" />
          <div className="h-4 w-full rounded-full bg-zinc-100" />
          <div className="h-4 w-2/3 rounded-full bg-zinc-100" />
          <div className="h-3.5 w-28 rounded-full bg-zinc-100" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-9 rounded-lg bg-zinc-100" />
          <div className="h-9 rounded-lg bg-zinc-100" />
        </div>
      </section>
      <section className="-mx-5 mt-2">
        <div className="grid grid-cols-3 gap-[1px] bg-zinc-200">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="aspect-square bg-zinc-100" />
          ))}
        </div>
      </section>
    </output>
  );
}

export function SkeletonQuestCard({ variant }: { variant: "immersive" | "compact" }) {
  const isImmersive = variant === "immersive";

  return (
    <article
      className={`relative overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm ${
        isImmersive ? "aspect-[4/5] rounded-[1.75rem]" : "aspect-[5/4] rounded-[1.35rem]"
      }`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#e4e4e7,#fafafa_44%,#d4d4d8)]" />
      <div className="absolute left-3 top-3 flex gap-1.5">
        <div className="h-7 w-20 rounded-full bg-white/70" />
        <div className="h-7 w-16 rounded-full bg-white/60" />
      </div>
      <div className="absolute inset-x-3 bottom-3 rounded-[1.15rem] border border-white/80 bg-white/72 p-3 shadow-sm">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="space-y-2">
              <div className="h-7 w-11/12 rounded-full bg-zinc-200" />
              {isImmersive ? (
                <div className="h-7 w-3/5 rounded-full bg-zinc-200" />
              ) : null}
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-4 w-20 rounded-full bg-zinc-200" />
              <div className="h-4 w-24 rounded-full bg-zinc-200" />
            </div>
          </div>
          <div className="h-10 w-24 rounded-full bg-zinc-200" />
        </div>
      </div>
    </article>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-800">Supabase needs attention</p>
      <p className="mt-1 text-sm leading-6 text-red-700">{message}</p>
      <button
        type="button"
        onClick={() => onRetry()}
        className="mt-3 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
      >
        Retry
      </button>
    </div>
  );
}

export function ActionError({ message }: { message: string }) {
  return (
    <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
      {message}
    </p>
  );
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function buildChatMessagesSignature(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.id}:${message.createdAtISO ?? ""}`)
    .join("|");
}

function buildMessageThreadAlertState(thread: MessageThread) {
  return `${thread.unreadCount}:${thread.lastMessageAtISO ?? ""}:${thread.preview}`;
}

function buildMessageBannerAvatar(thread: MessageThread) {
  const participant = thread.participants[0];

  return {
    avatarInitials: participant?.avatarInitials ?? null,
    avatarLabel: participant?.displayName ?? null,
    avatarUrl: participant?.avatarUrl ?? null,
  };
}
