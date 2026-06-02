import { useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import EventDiscoveryCard from "@/components/EventDiscoveryCard";
import type { Profile, Quest } from "@/types/quest";
import {
  buildEventsFeedModel,
  getEventsFilterOptions,
  type EventsFeedFilter,
} from "./eventsFeed";

type EventsScreenProps = {
  acceptedFriendIds: string[];
  joiningQuestId: string | null;
  profile: Profile;
  quests: Quest[];
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function EventsScreen({
  acceptedFriendIds,
  joiningQuestId,
  onJoin,
  onOpen,
  profile,
  quests,
}: EventsScreenProps) {
  const [selectedFilter, setSelectedFilter] =
    useState<EventsFeedFilter>("For you");
  const filters = useMemo(() => getEventsFilterOptions(), []);

  const feedModel = useMemo(
    () =>
      buildEventsFeedModel({
        acceptedFriendIds,
        profile,
        quests,
        selectedFilter,
      }),
    [acceptedFriendIds, profile, quests, selectedFilter],
  );

  return (
    <div className="-mx-5 space-y-4">
      <div className="border-b border-zinc-100 bg-white px-5 pb-3 pt-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-zinc-400">
              Discover
            </p>
            <h2 className="text-lg font-black leading-6 tracking-normal text-zinc-950">
              Events for you
            </h2>
          </div>
          <span className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-black text-white">
            {feedModel.totalCount}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((filter) => {
            const isActive = selectedFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                aria-pressed={isActive}
                className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[0.82rem] font-black transition active:scale-[0.98] ${
                  isActive
                    ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                    : "glass-chip border text-zinc-700 hover:bg-white/80"
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {feedModel.filteredQuests.length === 0 ? (
        <div className="px-5 pt-2">
          <EmptyState
            title="No public events yet"
            body="Try another filter or start the first plan nearby."
            actionLabel="Show For you"
            onAction={() => setSelectedFilter("For you")}
          />
        </div>
      ) : (
        <div className="space-y-4 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+8.75rem)] pt-8">
          {feedModel.filteredQuests.map((quest) => (
            <EventDiscoveryCard
              key={quest.id}
              isJoining={joiningQuestId === quest.id}
              quest={quest}
              onJoin={onJoin}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}
