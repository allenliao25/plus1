"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BottomNav, { type AppTab } from "@/components/BottomNav";
import CreateQuestForm from "@/components/CreateQuestForm";
import QuestCard from "@/components/QuestCard";
import QuestDetail from "@/components/QuestDetail";
import {
  createQuest,
  fetchDemoProfiles,
  fetchFeedQuests,
  fetchMyQuests,
  joinQuest,
} from "@/lib/questService";
import type { NewQuestInput, Profile, Quest } from "@/types/quest";

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>("feed");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState("");
  const [feedQuests, setFeedQuests] = useState<Quest[]>([]);
  const [myQuests, setMyQuests] = useState<Quest[]>([]);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joiningQuestId, setJoiningQuestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const currentProfile = useMemo(
    () => profiles.find((profile) => profile.id === currentProfileId) ?? null,
    [currentProfileId, profiles],
  );

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

  const loadProfiles = useCallback(async () => {
    try {
      const demoProfiles = await fetchDemoProfiles();

      setProfiles(demoProfiles);
      setIsLoadingQuests(true);
      setCurrentProfileId((currentProfile) =>
        demoProfiles.some((profile) => profile.id === currentProfile)
          ? currentProfile
          : demoProfiles[0]?.id ?? "",
      );
    } catch (loadError) {
      setError(readErrorMessage(loadError));
    } finally {
      setIsBooting(false);
    }
  }, []);

  const refreshQuests = useCallback(async (userId: string) => {
    const [nextFeedQuests, nextMyQuests] = await Promise.all([
      fetchFeedQuests(userId),
      fetchMyQuests(userId),
    ]);

    setFeedQuests(nextFeedQuests);
    setMyQuests(nextMyQuests);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadProfiles();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProfiles]);

  useEffect(() => {
    if (!currentProfileId) {
      return;
    }

    let isActive = true;

    async function loadQuests() {
      try {
        await refreshQuests(currentProfileId);

        if (!isActive) {
          return;
        }
      } catch (loadError) {
        if (isActive) {
          setError(readErrorMessage(loadError));
        }
      } finally {
        if (isActive) {
          setIsLoadingQuests(false);
        }
      }
    }

    const timer = window.setTimeout(() => {
      loadQuests();
    }, 0);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
    };
  }, [currentProfileId, refreshQuests]);

  function handleTabChange(tab: AppTab) {
    setSelectedQuestId(null);
    setActionError("");
    setActiveTab(tab);
  }

  async function handleJoinQuest(questId: string) {
    if (!currentProfile) {
      setActionError("Choose a demo user before joining a quest.");
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

  async function handleCreateQuest(input: NewQuestInput) {
    if (!currentProfile) {
      throw new Error("Choose a demo user before creating a quest.");
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

  async function handleRetry() {
    try {
      setError("");

      if (!currentProfileId) {
        await loadProfiles();
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
    <main className="min-h-screen bg-[#f6f4ef] px-4 py-4 text-zinc-950 sm:px-6 sm:py-6">
      <section className="mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-[#fbfaf7] shadow-xl shadow-zinc-900/10 sm:min-h-[840px]">
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
            <button
              type="button"
              onClick={() => handleTabChange("create")}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Create
            </button>
          </div>

          <DemoUserSwitcher
            currentProfileId={currentProfileId}
            isDisabled={isBooting}
            profiles={profiles}
            onChange={(profileId) => {
              setSelectedQuestId(null);
              setError("");
              setIsLoadingQuests(true);
              setCurrentProfileId(profileId);
            }}
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error ? <ErrorState message={error} onRetry={handleRetry} /> : null}
          {actionError ? <ActionError message={actionError} /> : null}

          {isBooting ? (
            <LoadingState label="Connecting to Supabase..." />
          ) : selectedQuest ? (
            <QuestDetail
              isJoining={joiningQuestId === selectedQuest.id}
              quest={selectedQuest}
              onBack={() => setSelectedQuestId(null)}
              onJoin={handleJoinQuest}
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
                <QuestList
                  joiningQuestId={joiningQuestId}
                  quests={feedQuests}
                  emptyTitle="No open quests right now"
                  emptyBody="Create one and it will appear here for people nearby."
                  onJoin={handleJoinQuest}
                  onOpen={setSelectedQuestId}
                />
              ) : null}

              {activeTab === "create" ? (
                <CreateQuestForm
                  isSubmitting={isCreating}
                  onCreateQuest={handleCreateQuest}
                />
              ) : null}

              {!isLoadingQuests && activeTab === "mine" ? (
                <QuestList
                  joiningQuestId={joiningQuestId}
                  quests={myQuests}
                  emptyTitle="Nothing yet"
                  emptyBody="Join a quest or create one to start your list."
                  onJoin={handleJoinQuest}
                  onOpen={setSelectedQuestId}
                  compact
                />
              ) : null}
            </div>
          )}
        </div>

        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      </section>
    </main>
  );
}

function DemoUserSwitcher({
  currentProfileId,
  isDisabled,
  onChange,
  profiles,
}: {
  currentProfileId: string;
  isDisabled: boolean;
  onChange: (profileId: string) => void;
  profiles: Profile[];
}) {
  if (profiles.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
        Demo user
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {profiles.map((profile) => {
          const isActive = profile.id === currentProfileId;

          return (
            <button
              key={profile.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(profile.id)}
              className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              {profile.displayName}
            </button>
          );
        })}
      </div>
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
  onJoin,
  onOpen,
  compact = false,
}: {
  joiningQuestId: string | null;
  quests: Quest[];
  emptyTitle: string;
  emptyBody: string;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  compact?: boolean;
}) {
  if (quests.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-6 text-center">
        <h3 className="text-base font-semibold text-zinc-950">{emptyTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{emptyBody}</p>
      </div>
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

  return "Quests you created or joined during this session.";
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
