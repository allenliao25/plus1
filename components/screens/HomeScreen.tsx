import { useMemo, useState, useSyncExternalStore } from "react";
import { Grid2X2, Rows3 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import HomeGridPreview from "@/components/HomeGridPreview";
import HomeQuestRow from "@/components/HomeQuestRow";
import HomeSpotlightCard from "@/components/HomeSpotlightCard";
import type { Profile, Quest } from "@/types/quest";
import {
  buildHomeFeedModel,
  filterHomeQuests,
  getDefaultHomeFilter,
  getHomeFilterOptions,
  type HomeFeedFilter,
  type HomeLayoutMode,
} from "./homeFeed";

type HomeScreenProps = {
  quests: Quest[];
  profile: Profile;
  joiningQuestId: string | null;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onCreate: () => void;
};

export default function HomeScreen({
  quests,
  profile,
  joiningQuestId,
  onJoin,
  onOpen,
  onCreate,
}: HomeScreenProps) {
  const [selectedFilter, setSelectedFilter] = useState<HomeFeedFilter | null>(
    null,
  );
  const [layoutMode, setLayoutMode] = useState<HomeLayoutMode>("hybrid");
  const hasPreviewParam = useSyncExternalStore(
    subscribeToUrlChanges,
    readHomePreviewParam,
    () => false,
  );

  const filterOptions = useMemo(
    () => getHomeFilterOptions(quests, profile),
    [profile, quests],
  );
  const defaultFilter = useMemo(
    () => getDefaultHomeFilter(quests, profile),
    [profile, quests],
  );
  const validSelectedFilter =
    selectedFilter && filterOptions.includes(selectedFilter)
      ? selectedFilter
      : null;
  const activeFilter = validSelectedFilter ?? defaultFilter;
  const feedModel = useMemo(
    () =>
      buildHomeFeedModel({
        profile,
        quests,
        selectedFilter: activeFilter,
      }),
    [activeFilter, profile, quests],
  );
  const canPreviewGrid =
    process.env.NODE_ENV !== "production" || hasPreviewParam;
  const activeLayoutMode = canPreviewGrid ? layoutMode : "hybrid";

  if (quests.length === 0) {
    return (
      <div className="space-y-5">
        <HomeHeader matchCount={0} />
        <EmptyState
          title="No open events right now"
          body="Create one and it will appear here for people nearby."
          actionLabel="Create an event"
          onAction={onCreate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <HomeHeader matchCount={feedModel.forYouCount} />

      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filterOptions.map((filter) => {
          const isActive = activeFilter === filter;
          const count = getFilterCount(filter, quests, profile);

          return (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              aria-pressed={isActive}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                isActive
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              <span>{filter}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[0.64rem] ${
                  isActive ? "bg-white/16 text-white" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {canPreviewGrid ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
            Preview
          </p>
          <div className="grid grid-cols-2 rounded-full border border-zinc-200 bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setLayoutMode("hybrid")}
              aria-label="Hybrid home layout"
              aria-pressed={activeLayoutMode === "hybrid"}
              className={`grid h-8 w-10 place-items-center rounded-full transition ${
                activeLayoutMode === "hybrid"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              <Rows3 size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("grid")}
              aria-label="Shorts grid preview"
              aria-pressed={activeLayoutMode === "grid"}
              className={`grid h-8 w-10 place-items-center rounded-full transition ${
                activeLayoutMode === "grid"
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500"
              }`}
            >
              <Grid2X2 size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {feedModel.filteredQuests.length === 0 ? (
        <EmptyState
          title={`No ${activeFilter.toLowerCase()} events yet`}
          body="Try all open events or create the next move."
          actionLabel="Show all"
          onAction={() => setSelectedFilter("All")}
        />
      ) : activeLayoutMode === "grid" ? (
        <HomeGridPreview
          joiningQuestId={joiningQuestId}
          quests={feedModel.filteredQuests}
          onJoin={onJoin}
          onOpen={onOpen}
        />
      ) : (
        <div className="space-y-3">
          {feedModel.spotlightQuest ? (
            <HomeSpotlightCard
              isJoining={joiningQuestId === feedModel.spotlightQuest.id}
              quest={feedModel.spotlightQuest}
              onJoin={onJoin}
              onOpen={onOpen}
            />
          ) : null}

          {feedModel.rowQuests.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-950">
                  More nearby
                </h3>
                <span className="text-xs font-bold text-zinc-400">
                  {feedModel.rowQuests.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {feedModel.rowQuests.map((quest) => (
                  <HomeQuestRow
                    key={quest.id}
                    isJoining={joiningQuestId === quest.id}
                    quest={quest}
                    onJoin={onJoin}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HomeHeader({ matchCount }: { matchCount: number }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          For you
        </p>
        <h2 className="mt-1 text-2xl font-bold leading-none tracking-tight text-zinc-950">
          Tonight&apos;s move
        </h2>
      </div>
      {matchCount > 0 ? (
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
          {matchCount} match{matchCount === 1 ? "" : "es"}
        </span>
      ) : null}
    </div>
  );
}

function getFilterCount(
  filter: HomeFeedFilter,
  quests: Quest[],
  profile: Profile,
) {
  return filterHomeQuests(quests, profile, filter).length;
}

function subscribeToUrlChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function readHomePreviewParam() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("homePreview") === "1";
}
