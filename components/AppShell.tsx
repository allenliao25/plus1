"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import BottomNav, { type AppTab } from "@/components/BottomNav";
import CreateQuestForm from "@/components/CreateQuestForm";
import EditQuestModal from "@/components/EditQuestModal";
import EmptyState from "@/components/EmptyState";
import QuestCard from "@/components/QuestCard";
import QuestDetail from "@/components/QuestDetail";
import {
  ensureProfile,
  getAuthenticatedUser,
  signInWithEmailLink,
  signOutCurrentUser,
  subscribeToAuthChanges,
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
  notifyLocalEvent,
  registerPushToken,
  requestLocalNotificationPermission,
} from "@/lib/notifications";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { NewQuestInput, Profile, Quest } from "@/types/quest";

type AuthState = "loading" | "signed_out" | "signed_in";
type FeedCategory = Quest["category"] | "All";

export default function AppShell() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("feed");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [feedQuests, setFeedQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [feedCategoryFilter, setFeedCategoryFilter] = useState<FeedCategory>("All");
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const feedCategories = useMemo<FeedCategory[]>(
    () => ["All", ...new Set(feedQuests.map((quest) => quest.category))],
    [feedQuests],
  );

  const filteredFeedQuests = useMemo(() => {
    if (feedCategoryFilter === "All") {
      return feedQuests;
    }

    return feedQuests.filter((quest) => quest.category === feedCategoryFilter);
  }, [feedCategoryFilter, feedQuests]);

  const myQuestSections = useMemo(() => {
    const hosting = myQuests.filter(
      (quest) => quest.createdByCurrentUser && quest.status === "open",
    );
    const going = myQuests.filter(
      (quest) =>
        quest.joinedByCurrentUser &&
        !quest.createdByCurrentUser &&
        quest.status === "open",
    );
    const closed = myQuests.filter((quest) => quest.status === "closed");
    const past = myQuests.filter((quest) => quest.status === "past");

    return { hosting, going, closed, past };
  }, [myQuests]);

  const refreshQuests = useCallback(async (userId: string) => {
    const [nextFeedQuests, nextMyQuests] = await Promise.all([
      fetchFeedQuests(userId),
      fetchMyQuests(userId),
    ]);

    setFeedQuests(nextFeedQuests);
    setMyQuests(nextMyQuests);
  }, []);

  const syncAuthAndData = useCallback(async () => {
    try {
      setIsBooting(true);
      setError("");
      const user = await getAuthenticatedUser();

      if (!user) {
        setAuthState("signed_out");
        setCurrentProfile(null);
        setFeedQuests([]);
        setMyQuests([]);
        setSelectedQuestId(null);
        setEditingQuestId(null);
        return;
      }

      const profile = await ensureProfile(user);
      setCurrentProfile(profile);
      setAuthState("signed_in");
      await registerPushToken(profile.id).catch(() => {
        // Push token registration can fail silently during development.
      });
      setIsLoadingQuests(true);
      await refreshQuests(profile.id);
    } catch (syncError) {
      setError(readErrorMessage(syncError));
      setAuthState("signed_out");
    } finally {
      setIsBooting(false);
      setIsLoadingQuests(false);
    }
  }, [refreshQuests]);

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
  }

  async function handleSendSignInLink(email: string) {
    try {
      setIsSigningIn(true);
      setAuthError("");
      setAuthMessage("");
      await signInWithEmailLink(email);
      setAuthMessage("Check your email for the sign-in link.");
    } catch (signInError) {
      setAuthError(readErrorMessage(signInError));
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

  async function handleJoinQuest(questId: string) {
    if (!currentProfile) {
      setActionError("Sign in before joining a quest.");
      return;
    }

    try {
      setJoiningQuestId(questId);
      setActionError("");
      await joinQuest(questId, currentProfile.id);
      await refreshQuests(currentProfile.id);
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
      await refreshQuests(currentProfile.id);
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
      await closeQuest(questId, currentProfile.id);
      await refreshQuests(currentProfile.id);
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
      await refreshQuests(currentProfile.id);
      setSelectedQuestId(newQuest.id);
      setActiveTab("mine");
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
      await updateQuest(editingQuest.id, input, currentProfile.id);
      await refreshQuests(currentProfile.id);
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
      await refreshQuests(currentProfileId);
    } catch (retryError) {
      setError(readErrorMessage(retryError));
    } finally {
      setIsLoadingQuests(false);
    }
  }

  const screenTitle =
    activeTab === "feed"
      ? "Open quests"
      : activeTab === "create"
        ? "New quest"
        : "My quests";

  return (
    <main className="min-h-dvh bg-[#f6f4ef] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-[calc(env(safe-area-inset-top,0px)+16px)] text-zinc-950 sm:px-6 sm:pb-6 sm:pt-6">
      <section className="mx-auto flex min-h-[calc(100dvh-(env(safe-area-inset-top,0px)+env(safe-area-inset-bottom,0px)+32px))] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-[#fbfaf7] shadow-xl shadow-zinc-900/10 sm:min-h-[840px]">
        <header className="border-b border-zinc-200 bg-white px-5 pb-4 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                Campus hangouts, without the group text.
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                plus1
              </h1>
            </div>
            {authState === "signed_in" ? (
              <button
                type="button"
                disabled={isAppLocked}
                onClick={() => handleTabChange("create")}
                className="min-h-11 rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create
              </button>
            ) : null}
          </div>

          {authState === "signed_in" && currentProfile ? (
            <AccountBar profile={currentProfile} onSignOut={handleSignOut} />
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error ? <ErrorState message={error} onRetry={handleRetry} /> : null}
          {actionError ? <ActionError message={actionError} /> : null}

          {authState === "loading" ? (
            <LoadingState label="Checking account..." />
          ) : authState === "signed_out" ? (
            <AuthGate
              error={authError}
              isSubmitting={isSigningIn}
              message={authMessage}
              onSubmit={handleSendSignInLink}
            />
          ) : isBooting ? (
            <LoadingState label="Connecting to Supabase..." />
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
          ) : (
            <div className="space-y-5">
              <ScreenHeading
                title={screenTitle}
                description={getScreenDescription(activeTab)}
              />

              {isLoadingQuests ? (
                <LoadingState label="Loading quests..." />
              ) : null}

              {!isLoadingQuests && activeTab === "feed" ? (
                <div className="space-y-3">
                  <CategoryFilter
                    activeCategory={feedCategoryFilter}
                    categories={feedCategories}
                    onSelect={setFeedCategoryFilter}
                  />
                  <QuestList
                    joiningQuestId={joiningQuestId}
                    quests={filteredFeedQuests}
                    emptyActionLabel="Create a quest"
                    emptyBody="Create one and it will appear here for people nearby."
                    emptyTitle="No open quests right now"
                    onEmptyAction={() => handleTabChange("create")}
                    onJoin={handleJoinQuest}
                    onOpen={setSelectedQuestId}
                  />
                </div>
              ) : null}

              {activeTab === "create" ? (
                <CreateQuestForm
                  isSubmitting={isCreating}
                  onCreateQuest={handleCreateQuest}
                />
              ) : null}

              {!isLoadingQuests && activeTab === "mine" ? (
                <div className="space-y-5">
                  {myQuests.length === 0 ? (
                    <EmptyState
                      title="Nothing yet"
                      body="Join a quest or create one to start your list."
                      actionLabel="Browse feed"
                      onAction={() => handleTabChange("feed")}
                    />
                  ) : (
                    <>
                      <QuestSection
                        title="Hosting"
                        quests={myQuestSections.hosting}
                        joiningQuestId={joiningQuestId}
                        onJoin={handleJoinQuest}
                        onOpen={setSelectedQuestId}
                        compact
                      />
                      <QuestSection
                        title="Going"
                        quests={myQuestSections.going}
                        joiningQuestId={joiningQuestId}
                        onJoin={handleJoinQuest}
                        onOpen={setSelectedQuestId}
                        compact
                      />
                      <QuestSection
                        title="Closed"
                        quests={myQuestSections.closed}
                        joiningQuestId={joiningQuestId}
                        onJoin={handleJoinQuest}
                        onOpen={setSelectedQuestId}
                        compact
                      />
                      <QuestSection
                        title="Past"
                        quests={myQuestSections.past}
                        joiningQuestId={joiningQuestId}
                        onJoin={handleJoinQuest}
                        onOpen={setSelectedQuestId}
                        compact
                      />
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <BottomNav
          activeTab={activeTab}
          isDisabled={isAppLocked}
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

function AuthGate({
  isSubmitting,
  message,
  error,
  onSubmit,
}: {
  isSubmitting: boolean;
  message: string;
  error: string;
  onSubmit: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(email.trim());
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-zinc-950">Sign in to plus1</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-500">
        Use your email to get a magic link.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-zinc-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@stanford.edu"
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </label>
        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting || !email.trim()}
          className="min-h-11 w-full rounded-2xl bg-zinc-950 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {isSubmitting ? "Sending link..." : "Send sign-in link"}
        </button>
      </form>
    </div>
  );
}

function AccountBar({
  profile,
  onSignOut,
}: {
  profile: Profile;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
          {profile.avatarInitials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">
            {profile.displayName}
          </p>
          <p className="truncate text-xs text-zinc-500">{profile.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSignOut()}
        className="min-h-11 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
      >
        Sign out
      </button>
    </div>
  );
}

function ScreenHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}

function QuestList({
  joiningQuestId,
  quests,
  emptyTitle,
  emptyBody,
  emptyActionLabel,
  onJoin,
  onOpen,
  onEmptyAction,
  compact = false,
}: {
  joiningQuestId: string | null;
  quests: Quest[];
  emptyTitle: string;
  emptyBody: string;
  emptyActionLabel?: string;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onEmptyAction?: () => void;
  compact?: boolean;
}) {
  if (quests.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        body={emptyBody}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      {quests.map((quest) => (
        <QuestCard
          key={quest.id}
          isJoining={joiningQuestId === quest.id}
          quest={quest}
          onJoin={onJoin}
          onOpen={onOpen}
          compact={compact}
        />
      ))}
    </div>
  );
}

function QuestSection({
  title,
  quests,
  joiningQuestId,
  onJoin,
  onOpen,
  compact = false,
}: {
  title: string;
  quests: Quest[];
  joiningQuestId: string | null;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  compact?: boolean;
}) {
  if (quests.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {title}
      </h3>
      <QuestList
        compact={compact}
        joiningQuestId={joiningQuestId}
        quests={quests}
        emptyBody=""
        emptyTitle=""
        onJoin={onJoin}
        onOpen={onOpen}
      />
    </section>
  );
}

function CategoryFilter({
  activeCategory,
  categories,
  onSelect,
}: {
  activeCategory: FeedCategory;
  categories: FeedCategory[];
  onSelect: (category: FeedCategory) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {categories.map((category) => {
        const isActive = activeCategory === category;

        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            className={`min-h-11 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
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

function getScreenDescription(tab: AppTab) {
  if (tab === "feed") {
    return "Find something low-pressure to do with people nearby.";
  }

  if (tab === "create") {
    return "Start with the plan. People can decide if they are in.";
  }

  return "Quests you are hosting or joining from this account.";
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
