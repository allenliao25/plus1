import { Search } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import PeopleList from "@/components/PeopleList";
import QuestList from "@/components/QuestList";
import { questCategories } from "@/data/demoQuests";
import { searchPeople } from "@/lib/friendService";
import type { PeopleSearchResult, Profile, Quest } from "@/types/quest";

type FeedCategory = Quest["category"] | "All" | "Friends";
type ExploreMode = "events" | "people";
type PeopleSearchState = {
  error: string;
  isSearching: boolean;
  results: PeopleSearchResult[];
};

type ExploreScreenProps = {
  actionProfileId: string | null;
  acceptedFriendIds: string[];
  currentProfile: Profile;
  joiningQuestId: string | null;
  quests: Quest[];
  suggestedPeople: PeopleSearchResult[];
  onAcceptFriend: (friendshipId: string) => void | Promise<void>;
  onCancelFriendRequest: (friendshipId: string) => void | Promise<void>;
  onDeclineFriend: (friendshipId: string) => void | Promise<void>;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onOpenProfile: (profileId: string) => void;
  onRemoveFriend: (friendshipId: string) => void | Promise<void>;
  onSendFriendRequest: (profileId: string) => void | Promise<void>;
};

const initialPeopleSearchState: PeopleSearchState = {
  error: "",
  isSearching: false,
  results: [],
};

function peopleSearchReducer(
  state: PeopleSearchState,
  action: Partial<PeopleSearchState>,
) {
  return { ...state, ...action };
}

export default function ExploreScreen(props: ExploreScreenProps) {
  return useExploreScreenContent(props);
}

function useExploreScreenContent({
  acceptedFriendIds,
  actionProfileId,
  currentProfile,
  joiningQuestId,
  onAcceptFriend,
  onCancelFriendRequest,
  onDeclineFriend,
  onJoin,
  onOpen,
  onOpenProfile,
  onRemoveFriend,
  onSendFriendRequest,
  quests,
  suggestedPeople,
}: ExploreScreenProps) {
  const [mode, setMode] = useState<ExploreMode>("events");
  const [category, setCategory] = useState<FeedCategory>("All");
  const [eventSearch, setEventSearch] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleSearchState, updatePeopleSearchState] = useReducer(
    peopleSearchReducer,
    initialPeopleSearchState,
  );
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

  const normalizedPeopleSearch = peopleSearch.trim();
  const peopleToShow =
    normalizedPeopleSearch.length >= 2
      ? peopleSearchState.results
      : suggestedPeople;

  useEffect(() => {
    if (normalizedPeopleSearch.length < 2) {
      return;
    }

    let isStale = false;
    const timeout = window.setTimeout(() => {
      updatePeopleSearchState({ isSearching: true });
      searchPeople(currentProfile.id, normalizedPeopleSearch)
        .then((results) => {
          if (isStale) {
            return;
          }

          updatePeopleSearchState({
            error: "",
            isSearching: false,
            results,
          });
        })
        .catch((caught) => {
          if (isStale) {
            return;
          }

          updatePeopleSearchState({
            error:
              caught instanceof Error ? caught.message : "Could not search people.",
            isSearching: false,
            results: [],
          });
        });
    }, 250);

    return () => {
      isStale = true;
      window.clearTimeout(timeout);
    };
  }, [currentProfile.id, normalizedPeopleSearch]);

  return (
    <div className="space-y-5">
      <div className="glass-panel grid grid-cols-2 rounded-full border p-1">
        <ModeButton
          isActive={mode === "events"}
          label="Events"
          onClick={() => setMode("events")}
        />
        <ModeButton
          isActive={mode === "people"}
          label="People"
          onClick={() => setMode("people")}
        />
      </div>

      {mode === "events" ? (
        <>
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
        </>
      ) : (
        <section className="space-y-3">
          <label className="glass-panel flex min-h-12 items-center gap-2 rounded-full border px-4 text-zinc-500 transition focus-within:border-zinc-300 focus-within:bg-white/92">
            <Search size={17} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              value={peopleSearch}
              onChange={(event) => setPeopleSearch(event.target.value)}
              placeholder="Search name or @handle"
              className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-medium text-zinc-950 outline-none placeholder:text-zinc-500"
            />
          </label>

          {normalizedPeopleSearch.length < 2 ? (
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-zinc-400">
                Suggested nearby
              </p>
              {peopleToShow.length === 0 ? (
                <p className="glass-panel rounded-[1.35rem] border p-4 text-sm font-semibold text-zinc-500">
                  No suggestions yet.
                </p>
              ) : null}
            </div>
          ) : peopleSearchState.isSearching ? (
            <p className="glass-panel rounded-[1.35rem] border p-4 text-sm font-semibold text-zinc-500">
              Searching…
            </p>
          ) : peopleSearchState.error ? (
            <p className="rounded-[1.35rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
              {peopleSearchState.error}
            </p>
          ) : peopleToShow.length === 0 ? (
            <p className="glass-panel rounded-[1.35rem] border p-4 text-sm font-semibold text-zinc-500">
              No matching people.
            </p>
          ) : null}

          <PeopleList
            actionProfileId={actionProfileId}
            people={peopleToShow}
            onAcceptFriend={onAcceptFriend}
            onCancelFriendRequest={onCancelFriendRequest}
            onDeclineFriend={onDeclineFriend}
            onOpenProfile={onOpenProfile}
            onRemoveFriend={onRemoveFriend}
            onSendFriendRequest={onSendFriendRequest}
          />
        </section>
      )}
    </div>
  );
}

function ModeButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`min-h-10 rounded-full text-sm font-extrabold transition ${
        isActive ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500 hover:bg-white/48"
      }`}
    >
      {label}
    </button>
  );
}
