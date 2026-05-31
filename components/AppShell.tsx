"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AtSign, UserRound } from "lucide-react";
import AiQuestDraft from "@/components/AiQuestDraft";
import BottomNav, { type AppTab } from "@/components/BottomNav";
import CreateQuestForm from "@/components/CreateQuestForm";
import EditQuestModal from "@/components/EditQuestModal";
import QuestDetail from "@/components/QuestDetail";
import ActivityScreen from "@/components/screens/ActivityScreen";
import ExploreScreen from "@/components/screens/ExploreScreen";
import HomeScreen from "@/components/screens/HomeScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import { questCategories } from "@/data/demoQuests";
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
  joinQuest,
  leaveQuest,
  updateQuest,
  uploadQuestCardImage,
} from "@/lib/questService";
import {
  fetchActivityEvents,
  markActivityRead,
  recordActivityEvents,
} from "@/lib/activityService";
import {
  notifyLocalEvent,
  registerPushToken,
  requestLocalNotificationPermission,
} from "@/lib/notifications";
import { getQuestIdFromSearch } from "@/lib/questLinks";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type {
  ActivityEvent,
  QuestCardImageChanges,
  NewQuestInput,
  Profile,
  Quest,
} from "@/types/quest";

type AuthState = "loading" | "signed_out" | "signed_in";

export default function AppShell() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [feedQuests, setFeedQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [createInitialValues, setCreateInitialValues] =
    useState<NewQuestInput | null>(null);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [openedQuestLinkId, setOpenedQuestLinkId] = useState<string | null>(
    null,
  );
  const [isAiAvailable, setIsAiAvailable] = useState<boolean | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isCompletingProfileSetup, setIsCompletingProfileSetup] =
    useState(false);
  const [profileSetupError, setProfileSetupError] = useState("");
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [joiningQuestId, setJoiningQuestId] = useState<string | null>(null);
  const [leavingQuestId, setLeavingQuestId] = useState<string | null>(null);
  const [closingQuestId, setClosingQuestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const currentProfileId = currentProfile?.id ?? "";
  const isAppLocked = authState !== "signed_in" || isBooting;

  useStableKeyboardViewport();

  const allVisibleQuests = useMemo(() => {
    const questsById = new Map<string, Quest>();

    for (const quest of [...feedQuests, ...myQuests]) {
      questsById.set(quest.id, quest);
    }

    return [...questsById.values()];
  }, [feedQuests, myQuests]);

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

  const unreadActivityCount = useMemo(
    () => activityEvents.filter((event) => !event.isRead).length,
    [activityEvents],
  );

  const refreshData = useCallback(async (userId: string) => {
    const [nextFeedQuests, nextMyQuests, loadedActivity] = await Promise.all([
      fetchFeedQuests(userId),
      fetchMyQuests(userId),
      fetchActivityEvents(userId).catch(() => [] as ActivityEvent[]),
    ]);
    const reminderEvents = buildQuestReminderEvents(
      userId,
      nextMyQuests,
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

    setFeedQuests(nextFeedQuests);
    setMyQuests(nextMyQuests);
    setActivityEvents(nextActivity);
  }, []);

  const syncAuthAndData = useCallback(async () => {
    setIsBooting(true);
    setError("");

    try {
      const user = await getAuthenticatedUser();

      if (!user) {
        setAuthState("signed_out");
        setAuthError("");
        setAuthMessage("");
        setCurrentProfile(null);
        setFeedQuests([]);
        setMyQuests([]);
        setActivityEvents([]);
        setSelectedQuestId(null);
        setEditingQuestId(null);
        setOpenedQuestLinkId(null);
        setNeedsProfileSetup(false);
        setProfileSetupError("");
        return;
      }

      const profile = await ensureProfile(user);
      const shouldCompleteProfileSetup = isLikelyAutoDisplayName(
        profile.displayName,
      );
      setCurrentProfile(profile);
      setNeedsProfileSetup(shouldCompleteProfileSetup);
      setProfileSetupError("");
      setAuthState("signed_in");
      setAuthError("");
      setAuthMessage("");

      try {
        setIsLoadingQuests(true);
        await refreshData(profile.id);
      } catch (refreshError) {
        setError(readErrorMessage(refreshError));
      } finally {
        setIsLoadingQuests(false);
      }

      void registerPushToken(profile.id).catch(() => {
        // Push token registration is best-effort during development.
      });
    } catch (syncError) {
      const message = readErrorMessage(syncError);
      setError(message);
      setAuthError(message);
      setAuthMessage("");
      setAuthState("signed_out");
      setCurrentProfile(null);
      setNeedsProfileSetup(false);
      setProfileSetupError("");
    } finally {
      setIsBooting(false);
    }
  }, [refreshData]);

  useEffect(() => {
    requestLocalNotificationPermission().catch(() => {
      // Ignore permission prompt failures on unsupported platforms.
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/ai/status")
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as {
          configured?: unknown;
        } | null;

        if (isMounted) {
          setIsAiAvailable(Boolean(payload?.configured));
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsAiAvailable(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncAuthAndData();
    }, 0);

    const unsubscribe = subscribeToAuthChanges(() => {
      void syncAuthAndData();
    });

    return () => {
      window.clearTimeout(timer);
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

    function scheduleFeedRefresh() {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refreshData(currentProfileId).catch(() => {
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
        };

        scheduleFeedRefresh();

        if (!quest.creator_id || quest.creator_id === currentProfileId) {
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
        event: "INSERT",
        schema: "public",
        table: "activity_events",
        filter: `user_id=eq.${currentProfileId}`,
      },
      async () => {
        const nextActivity = await fetchActivityEvents(currentProfileId).catch(
          () => null,
        );

        if (nextActivity) {
          setActivityEvents(nextActivity);
        }
      },
    );

    channel.subscribe();

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      supabase.removeChannel(channel);
    };
  }, [currentProfileId, myQuests, refreshData]);

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
        setOpenedQuestLinkId(questId);
        setActionError("That shared event is not available in your feed.");
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("quest");
      window.history.replaceState({}, "", url.toString());
      setOpenedQuestLinkId(questId);
      setActionError("");
      setSelectedQuestId(linkedQuest.id);
      setActiveTab("home");
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

  function handleTabChange(tab: AppTab) {
    if (isAppLocked) {
      return;
    }

    setSelectedQuestId(null);
    setActionError("");
    setActiveTab(tab);

    if (tab === "activity" && currentProfileId && unreadActivityCount > 0) {
      void markActivityRead(currentProfileId).catch(() => {
        // Marking read is best-effort; the feed still renders.
      });
      setActivityEvents((events) =>
        events.map((event) => ({ ...event, isRead: true })),
      );
    }
  }

  function handleApplyDraft(draft: NewQuestInput) {
    setCreateInitialValues(draft);
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

  async function handleSaveProfile(changes: {
    displayName: string;
    handle: string;
    avatarFile?: File | null;
    websiteUrl: string | null;
    bio: string | null;
    interests: string[];
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
    } catch (setupError) {
      setProfileSetupError(readErrorMessage(setupError));
    } finally {
      setIsCompletingProfileSetup(false);
    }
  }

  async function handleJoinQuest(questId: string) {
    if (!currentProfile) {
      setActionError("Sign in before joining an event.");
      return;
    }

    try {
      setJoiningQuestId(questId);
      setActionError("");
      await joinQuest(questId, currentProfile.id);
      await recordJoinActivity(questId, currentProfile);
      await refreshData(currentProfile.id);
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
      await leaveQuest(questId, currentProfile.id);
      await refreshData(currentProfile.id);
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
      const quest = allVisibleQuests.find((item) => item.id === questId);
      await closeQuest(questId, currentProfile.id);
      if (quest) {
        await recordQuestUpdateActivity(quest, currentProfile, "close");
      }
      await refreshData(currentProfile.id);
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
      );
      await refreshData(currentProfile.id);
      setCreateInitialValues(null);
      setCreateFormKey((key) => key + 1);
      setSelectedQuestId(newQuest.id);
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
      await recordQuestUpdateActivity(quest, currentProfile, "edit");
      await refreshData(currentProfile.id);
      setEditingQuestId(null);
    } finally {
      setIsEditing(false);
    }
  }

  function recordJoinActivity(questId: string, profile: Profile) {
    const quest = allVisibleQuests.find((item) => item.id === questId);
    const host = quest?.attendees.find((attendee) => attendee.isHost);

    if (!quest || !host || host.id === profile.id) {
      return Promise.resolve();
    }

    return recordActivityEvents([
      {
        userId: host.id,
        actorId: profile.id,
        questId: quest.id,
        type: "join",
        title: `${profile.displayName} joined ${quest.title}`,
      },
    ]).catch(() => {
      // Activity is a best-effort feed.
    });
  }

  function recordQuestUpdateActivity(
    quest: Quest,
    profile: Profile,
    type: "edit" | "close",
  ) {
    const recipients = quest.attendees
      .filter((attendee) => !attendee.isHost && attendee.id !== profile.id)
      .map((attendee) => attendee.id);

    if (recipients.length === 0) {
      return Promise.resolve();
    }

    const title =
      type === "close"
        ? `${quest.title} was closed`
        : `${quest.title} was updated`;

    return recordActivityEvents(
      recipients.map((userId) => ({
        userId,
        actorId: profile.id,
        questId: quest.id,
        type,
        title,
      })),
    ).catch(() => {
      // Activity is a best-effort feed.
    });
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
      await refreshData(currentProfileId);
    } catch (retryError) {
      setError(readErrorMessage(retryError));
    } finally {
      setIsLoadingQuests(false);
    }
  }

  const showLoading = isLoadingQuests && activeTab !== "create";

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
        initialInterests={currentProfile.interests}
        isSubmitting={isCompletingProfileSetup}
        error={profileSetupError}
        onComplete={handleCompleteProfile}
      />
    );
  }

  return (
    <main
      className="app-viewport flex flex-col bg-white text-zinc-950"
      style={STABLE_VIEWPORT_STYLE}
    >
      <section className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-white sm:border-x sm:border-zinc-200">
        <header className="flex items-center border-b border-zinc-200 bg-white/85 px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+14px)] backdrop-blur-xl">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            plus1
          </h1>
        </header>

        <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error ? <ErrorState message={error} onRetry={handleRetry} /> : null}
          {actionError ? <ActionError message={actionError} /> : null}

          {isBooting ? (
            <LoadingState label="Loading your account..." />
          ) : selectedQuest ? (
            <QuestDetail
              isClosing={closingQuestId === selectedQuest.id}
              isJoining={joiningQuestId === selectedQuest.id}
              isLeaving={leavingQuestId === selectedQuest.id}
              quest={selectedQuest}
              onBack={() => setSelectedQuestId(null)}
              onClose={handleCloseQuest}
              onEdit={(quest) => setEditingQuestId(quest.id)}
              onJoin={handleJoinQuest}
              onLeave={handleLeaveQuest}
            />
          ) : showLoading ? (
            <LoadingState label="Loading events..." />
          ) : activeTab === "home" ? (
            <HomeScreen
              quests={feedQuests}
              profile={currentProfile!}
              joiningQuestId={joiningQuestId}
              onCreate={() => handleTabChange("create")}
              onJoin={handleJoinQuest}
              onOpen={setSelectedQuestId}
            />
          ) : activeTab === "explore" ? (
            <ExploreScreen
              quests={feedQuests}
              joiningQuestId={joiningQuestId}
              onJoin={handleJoinQuest}
              onOpen={setSelectedQuestId}
            />
          ) : activeTab === "create" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-950">
                  New event
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Start with the plan. People can decide if they are in.
                </p>
              </div>
              <AiQuestDraft
                isAvailable={isAiAvailable}
                onApplyDraft={handleApplyDraft}
              />
              <CreateQuestForm
                key={createFormKey}
                initialValues={createInitialValues ?? undefined}
                isSubmitting={isCreating}
                onCreateQuest={handleCreateQuest}
              />
            </div>
          ) : activeTab === "activity" ? (
            <ActivityScreen
              events={activityEvents}
              onBrowse={() => handleTabChange("home")}
              onOpenQuest={setSelectedQuestId}
            />
          ) : currentProfile ? (
            <ProfileScreen
              profile={currentProfile}
              myQuests={myQuests}
              joiningQuestId={joiningQuestId}
              isSaving={isSavingProfile}
              saveError={profileError}
              onJoin={handleJoinQuest}
              onOpen={setSelectedQuestId}
              onSaveProfile={handleSaveProfile}
              onSignOut={handleSignOut}
            />
          ) : null}
        </div>

        <BottomNav
          activeTab={activeTab}
          isDisabled={isAppLocked}
          profileAvatarInitials={currentProfile?.avatarInitials}
          profileAvatarUrl={currentProfile?.avatarUrl}
          unreadActivityCount={unreadActivityCount}
          onTabChange={handleTabChange}
        />
      </section>
      {editingQuest ? (
        <EditQuestModal
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
const STABLE_VIEWPORT_STYLE = { height: "var(--plus1-app-height, 100vh)" };

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
    visualViewport?.addEventListener("scroll", scheduleApply);

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

function SplashScreen() {
  return (
    <main
      className="app-viewport flex flex-col items-center justify-center bg-white text-zinc-950"
      style={STABLE_VIEWPORT_STYLE}
    >
      <h1 className="text-[2.75rem] font-bold tracking-tight">plus1</h1>
      <div className="mt-6 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950" />
    </main>
  );
}

function AuthScreen({
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

function ProfileSetupScreen({
  initialDisplayName,
  initialHandle,
  initialInterests,
  isSubmitting,
  error,
  onComplete,
}: {
  initialDisplayName: string;
  initialHandle: string;
  initialInterests: string[];
  isSubmitting: boolean;
  error: string;
  onComplete: (changes: {
    displayName: string;
    handle: string;
    interests: string[];
  }) => Promise<void> | void;
}) {
  const [displayName, setDisplayName] = useState(() =>
    isLikelyAutoDisplayName(initialDisplayName) ? "" : initialDisplayName,
  );
  const [handle, setHandle] = useState(initialHandle);
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
            Pick the name people see and the @handle they can recognize.
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
            {isSubmitting ? "Saving..." : "Continue"}
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
    activityEvents
      .filter((event) => event.type === "reminder" && event.questId)
      .map((event) => event.questId),
  );

  return quests
    .filter((quest) => {
      if (
        quest.status !== "open" ||
        !quest.startTimeISO ||
        existingReminderQuestIds.has(quest.id)
      ) {
        return false;
      }

      const startMs = new Date(quest.startTimeISO).getTime();
      return (
        Number.isFinite(startMs) &&
        startMs > now &&
        startMs - now <= reminderWindowMs
      );
    })
    .map((quest) => ({
      userId,
      actorId: userId,
      questId: quest.id,
      type: "reminder" as const,
      title: `${quest.title} starts soon`,
      body: `${quest.startTimeRelative ?? quest.startTime} at ${quest.location}.`,
    }));
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950" />
      <p className="mt-3 text-sm font-semibold text-zinc-500">{label}</p>
    </div>
  );
}

function ErrorState({
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

function ActionError({ message }: { message: string }) {
  return (
    <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
      {message}
    </p>
  );
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
