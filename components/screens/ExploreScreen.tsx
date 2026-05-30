import { useMemo, useState } from "react";
import QuestList from "@/components/QuestList";
import { questCategories } from "@/data/demoQuests";
import type { Quest } from "@/types/quest";

type FeedCategory = Quest["category"] | "All";

type ExploreScreenProps = {
  quests: Quest[];
  joiningQuestId: string | null;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function ExploreScreen({
  quests,
  joiningQuestId,
  onJoin,
  onOpen,
}: ExploreScreenProps) {
  const [category, setCategory] = useState<FeedCategory>("All");
  const [search, setSearch] = useState("");

  const categories = useMemo<FeedCategory[]>(
    () => ["All", ...questCategories],
    [],
  );

  const filteredQuests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return quests.filter((quest) => {
      const matchesCategory =
        category === "All" || quest.category === category;
      const matchesQuery =
        !query ||
        quest.title.toLowerCase().includes(query) ||
        quest.location.toLowerCase().includes(query) ||
        quest.description.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [category, quests, search]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Explore</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          Search and filter events by category, place, or vibe.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search events, places, keywords"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((option) => {
          const isActive = category === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              className={`min-h-11 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
              }`}
            >
              {option}
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
