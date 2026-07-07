import { Search } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import PeopleList from "@/components/PeopleList";
import { searchPeople } from "@/lib/friendService";
import type { PeopleSearchResult, Profile } from "@/types/quest";

type PeopleScreenProps = {
  actionProfileId: string | null;
  currentProfile: Profile;
  suggestedPeople: PeopleSearchResult[];
  onAcceptFriend: (friendshipId: string) => void | Promise<void>;
  onCancelFriendRequest: (friendshipId: string) => void | Promise<void>;
  onDeclineFriend: (friendshipId: string) => void | Promise<void>;
  onOpenProfile: (profileId: string) => void;
  onRemoveFriend: (friendshipId: string) => void | Promise<void>;
  onSendFriendRequest: (profileId: string) => void | Promise<void>;
};

type PeopleSearchState = {
  error: string;
  isSearching: boolean;
  results: PeopleSearchResult[];
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

export default function PeopleScreen({
  actionProfileId,
  currentProfile,
  onAcceptFriend,
  onCancelFriendRequest,
  onDeclineFriend,
  onOpenProfile,
  onRemoveFriend,
  onSendFriendRequest,
  suggestedPeople,
}: PeopleScreenProps) {
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleSearchState, updatePeopleSearchState] = useReducer(
    peopleSearchReducer,
    initialPeopleSearchState,
  );
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
    <section className="space-y-3 pt-2">
      <label className="glass-panel flex min-h-12 items-center gap-2 rounded-full border px-4 text-muted transition focus-within:border-faint focus-within:bg-white/90">
        <Search size={17} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={peopleSearch}
          onChange={(event) => setPeopleSearch(event.target.value)}
          placeholder="Search name or @handle"
          className="min-w-0 flex-1 bg-transparent py-3 text-md font-medium text-ink outline-none placeholder:text-muted"
        />
      </label>

      {normalizedPeopleSearch.length < 2 ? (
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-caps text-faint">
            Suggested nearby
          </p>
          {peopleToShow.length === 0 ? (
            <p className="glass-panel rounded-card border p-4 text-sm font-semibold text-muted">
              No suggestions yet.
            </p>
          ) : null}
        </div>
      ) : peopleSearchState.isSearching ? (
        <p className="glass-panel rounded-card border p-4 text-sm font-semibold text-muted">
          Searching…
        </p>
      ) : peopleSearchState.error ? (
        <p className="rounded-card border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
          {peopleSearchState.error}
        </p>
      ) : peopleToShow.length === 0 ? (
        <p className="glass-panel rounded-card border p-4 text-sm font-semibold text-muted">
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
  );
}
