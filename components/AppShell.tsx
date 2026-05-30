"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AiQuestDraft from "@/components/AiQuestDraft";
import BottomNav, { type AppTab } from "@/components/BottomNav";
import CreateQuestForm from "@/components/CreateQuestForm";
import EditQuestModal from "@/components/EditQuestModal";
import QuestDetail from "@/components/QuestDetail";
import ActivityScreen from "@/components/screens/ActivityScreen";
import ExploreScreen from "@/components/screens/ExploreScreen";
import HomeScreen from "@/components/screens/HomeScreen";
import ProfileScreen from "@/components/screens/ProfileScreen";
import {
  ensureProfile,
  getAuthenticatedUser,
  sendPhoneOtp,
  signOutCurrentUser,
  subscribeToAuthChanges,
  updateProfile,
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
import { getSupabaseClient } from "@/lib/supabaseClient";
import type {
  ActivityEvent,
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
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [joiningQuestId, setJoiningQuestId] = useState<string | null>(null);
  const [leavingQuestId, setLeavingQuestId] = useState<string | null>(null);
  const [closingQuestId, setClosingQuestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const currentProfileId = currentProfile?.id ?? "";
  const isAppLocked = authState !== "signed_in" || isBooting;

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
    const [nextFeedQuests, nextMyQuests, nextActivity] = await Promise.all([
      fetchFeedQuests(userId),
      fetchMyQuests(userId),
      fetchActivityEvents(userId).catch(() => [] as ActivityEvent[]),
    ]);

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
        return;
      }

      const profile = await ensureProfile(user);
      setCurrentProfile(profile);
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
      setError(readErrorMessage(syncError));
      setAuthState("signed_out");
      setCurrentProfile(null);
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

        if (!quest.creator_id || quest.creator_id === currentProfileId) {
          return;
        }

        const profiles = await fetchProfilesByIds([quest.creator_id]);
        const hostName = profiles[0]?.displayName ?? "Someone nearby";
        await notifyLocalEvent(
          "New quest nearby",
          `${hostName} posted: ${quest.title ?? "Untitled quest"}`,
        );
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
          "Someone joined your quest",
          `${joinerName} joined ${myQuest.title}`,
        );
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
      supabase.removeChannel(channel);
    };
  }, [currentProfileId, myQuests]);

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
      const normalizedPhone = normalizePhone(phone);
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
    bio: string | null;
    interests: string[];
  }) {
    if (!currentProfile) {
      return;
    }

    try {
      setIsSavingProfile(true);
      setProfileError("");
      const updated = await updateProfile(currentProfile.id, changes);
      setCurrentProfile(updated);
    } catch (saveError) {
      setProfileError(readErrorMessage(saveError));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleJoinQuest(questId: string) {
    if (!currentProfile) {
      setActionError("Sign in before joining a quest.");
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
      setActionError("Sign in before leaving a quest.");
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
      setActionError("Sign in before closing a quest.");
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

  async function handleCreateQuest(input: NewQuestInput) {
    if (!currentProfile) {
      throw new Error("Sign in before creating a quest.");
    }

    try {
      setIsCreating(true);
      setActionError("");
      const newQuest = await createQuest(input, currentProfile.id);
      await refreshData(currentProfile.id);
      setCreateInitialValues(null);
      setCreateFormKey((key) => key + 1);
      setSelectedQuestId(newQuest.id);
      setActiveTab("home");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleEditQuest(input: NewQuestInput) {
    if (!currentProfile || !editingQuest) {
      throw new Error("Choose a quest to edit.");
    }

    try {
      setIsEditing(true);
      setActionError("");
      const quest = editingQuest;
      await updateQuest(quest.id, input, currentProfile.id);
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

  return (
    <main className="flex h-dvh flex-col bg-white text-zinc-950">
      <section className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-white sm:border-x sm:border-zinc-200">
        <header className="flex items-center border-b border-zinc-200 bg-white/85 px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+14px)] backdrop-blur-xl">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            plus1
          </h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
            <LoadingState label="Loading quests..." />
          ) : activeTab === "home" ? (
            <HomeScreen
              quests={feedQuests}
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
                <h2 className="text-xl font-semibold text-zinc-950">
                  New quest
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Start with the plan. People can decide if they are in.
                </p>
              </div>
              <AiQuestDraft onApplyDraft={handleApplyDraft} />
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

function SplashScreen() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center bg-white text-zinc-950">
      <h1 className="text-[2.75rem] font-semibold tracking-tight">plus1</h1>
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
  const [phone, setPhone] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const isVerifying = Boolean(pendingPhone);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isVerifying) {
      const normalizedPhone = normalizePhone(phone);
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
  }

  return (
    <main className="flex h-dvh flex-col bg-white px-8 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-[calc(env(safe-area-inset-top,0px)+20px)] text-zinc-950">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-sm">
          <div className="text-center">
            <h1 className="text-[2.75rem] font-semibold leading-none tracking-tight">
              plus1
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Campus hangouts, without the group text.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-3">
            {!isVerifying ? (
              <input
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                autoComplete="tel"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
              />
            ) : (
              <>
                <p className="text-center text-sm text-zinc-500">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-semibold text-zinc-700">{pendingPhone}</span>.
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
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                (!isVerifying && !phone.trim()) ||
                (isVerifying && !otpCode.trim())
              }
              className="min-h-12 w-full rounded-xl bg-zinc-950 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
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
                className="min-h-11 w-full text-center text-sm font-semibold text-zinc-500 transition hover:text-zinc-800 disabled:opacity-50"
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

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950" />
      <p className="mt-3 text-sm font-medium text-zinc-500">{label}</p>
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
    <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
      {message}
    </p>
  );
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D+/g, "");

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}
