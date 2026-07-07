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
  onOpenChat: (questId: string) => void;
};

export default function EventsScreen({
  acceptedFriendIds,
  joiningQuestId,
  onJoin,
  onOpen,
  onOpenChat,
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
    <div className="-mx-5 space-y-2">
      <div className="snap-start border-b border-line bg-white px-5 pb-3 pt-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-caps text-faint">
              Discover
            </p>
            <h2 className="text-lg font-black leading-6 tracking-normal text-ink">
              Events for you
            </h2>
          </div>
          <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-black text-white">
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
                className={`pressable min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-black ${
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
        <div className="space-y-4 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+8.75rem)] pt-2">
          {feedModel.filteredQuests.map((quest) => (
            <EventDiscoveryCard
              key={quest.id}
              isJoining={joiningQuestId === quest.id}
              quest={quest}
              onJoin={onJoin}
              onOpen={onOpen}
              onOpenChat={onOpenChat}
            />
          ))}
        </div>
      )}
    </div>
  );
}
