import { useMemo, useState, useSyncExternalStore } from "react";
import { Grid2X2, Rows3 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import HomeGridPreview from "@/components/HomeGridPreview";
import HomeQuestRow from "@/components/HomeQuestRow";
import HomeSpotlightCard from "@/components/HomeSpotlightCard";
import type { Profile, Quest } from "@/types/quest";
import {
  buildHomeFeedModel,
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
  onOpenChat: (questId: string) => void;
  onCreate: () => void;
};

export default function HomeScreen({
  quests,
  profile,
  joiningQuestId,
  onJoin,
  onOpen,
  onOpenChat,
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
  const canPreviewGrid = hasPreviewParam;
  const activeLayoutMode = canPreviewGrid ? layoutMode : "hybrid";

  if (quests.length === 0) {
    return (
      <div className="space-y-5">
        <HomeFilterRail
          activeFilter={activeFilter}
          filters={filterOptions}
          onSelect={setSelectedFilter}
        />
        <EmptyState
          title="No recommended events right now"
          body="Create one and it will appear here for people nearby."
          actionLabel="Create an event"
          onAction={onCreate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <HomeFilterRail
        activeFilter={activeFilter}
        filters={filterOptions}
        onSelect={setSelectedFilter}
      />

      {canPreviewGrid ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-caps text-faint">
            Preview
          </p>
          <div className="glass-panel grid grid-cols-2 rounded-full border p-1">
            <button
              type="button"
              onClick={() => setLayoutMode("hybrid")}
              aria-label="Hybrid home layout"
              aria-pressed={activeLayoutMode === "hybrid"}
              className={`grid h-8 w-10 place-items-center rounded-full transition ${
                activeLayoutMode === "hybrid"
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted"
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
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted"
              }`}
            >
              <Grid2X2 size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {feedModel.filteredQuests.length === 0 ? (
        <EmptyState
          title={`No joinable ${activeFilter.toLowerCase()} events right now`}
          body="Browse Events for the fuller list, or create the next plan nearby."
          actionLabel="Show For you"
          onAction={() => setSelectedFilter("For you")}
        />
      ) : activeLayoutMode === "grid" ? (
        <HomeGridPreview
          joiningQuestId={joiningQuestId}
          quests={feedModel.filteredQuests}
          onJoin={onJoin}
          onOpen={onOpen}
          onOpenChat={onOpenChat}
        />
      ) : (
        <div className="space-y-3">
          {feedModel.spotlightQuest ? (
            <HomeSpotlightCard
              isJoining={joiningQuestId === feedModel.spotlightQuest.id}
              quest={feedModel.spotlightQuest}
              onJoin={onJoin}
              onOpen={onOpen}
              onOpenChat={onOpenChat}
            />
          ) : null}

          {feedModel.rowQuests.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">
                  More nearby
                </h3>
                <span className="text-xs font-bold text-faint">
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
                    onOpenChat={onOpenChat}
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

function HomeFilterRail({
  activeFilter,
  filters,
  onSelect,
}: {
  activeFilter: HomeFeedFilter;
  filters: HomeFeedFilter[];
  onSelect: (filter: HomeFeedFilter) => void;
}) {
  return (
    <div className="horizontal-scroll-contained -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {filters.map((filter) => {
        const isActive = activeFilter === filter;

        return (
          <button
            key={filter}
            type="button"
            onClick={() => onSelect(filter)}
            aria-pressed={isActive}
            className={`pressable min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-md font-extrabold ${
              isActive
                ? "border-ink bg-ink text-white shadow-sm"
                : "glass-chip border text-ink-soft hover:bg-white/80"
            }`}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
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
