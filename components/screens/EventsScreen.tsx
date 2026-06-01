import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import QuestList from "@/components/QuestList";
import { questCategories } from "@/data/demoQuests";
import type { Quest } from "@/types/quest";

type FeedCategory = Quest["category"] | "All" | "Friends";

type EventsScreenProps = {
  acceptedFriendIds: string[];
  joiningQuestId: string | null;
  quests: Quest[];
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function EventsScreen({
  acceptedFriendIds,
  joiningQuestId,
  onJoin,
  onOpen,
  quests,
}: EventsScreenProps) {
  const [category, setCategory] = useState<FeedCategory>("All");
  const [eventSearch, setEventSearch] = useState("");
  const acceptedFriendIdSet = useMemo(
    () => new Set(acceptedFriendIds),
    [acceptedFriendIds],
  );
  const categories = useMemo<FeedCategory[]>(
    () => ["All", "Friends", ...questCategories],
    [],
  );

  const filteredQuests = useMemo(() => {
    const query = eventSearch.trim().toLowerCase();

    return quests.filter((quest) => {
      const isFriendEvent =
        quest.visibility === "friends" ||
        Boolean(quest.creatorId && acceptedFriendIdSet.has(quest.creatorId));
      const matchesCategory =
        category === "All" ||
        (category === "Friends" ? isFriendEvent : quest.category === category);
      const matchesQuery =
        !query ||
        quest.title.toLowerCase().includes(query) ||
        quest.location.toLowerCase().includes(query) ||
        quest.description.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [acceptedFriendIdSet, category, eventSearch, quests]);

  return (
    <div className="space-y-5">
      <label className="glass-panel flex min-h-12 items-center gap-2 rounded-full border px-4 text-zinc-500 transition focus-within:border-zinc-300 focus-within:bg-white/92">
        <Search size={17} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={eventSearch}
          onChange={(event) => setEventSearch(event.target.value)}
          placeholder="Search events, places, keywords"
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-medium text-zinc-950 outline-none placeholder:text-zinc-500"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((option) => {
          const isActive = category === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              className={`min-h-11 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition ${
                isActive
                  ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                  : "glass-chip border text-zinc-700 hover:bg-white/80"
              }`}
            >
              {option === "Friends" ? "Friends' events" : option}
            </button>
          );
        })}
      </div>

      <QuestList
        joiningQuestId={joiningQuestId}
        quests={filteredQuests}
        variant="compact"
        emptyBody="Try a different category or search term."
        emptyTitle="No events match"
        onJoin={onJoin}
        onOpen={onOpen}
      />
    </div>
  );
}
