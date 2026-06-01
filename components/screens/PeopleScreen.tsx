import { Search } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [peopleResults, setPeopleResults] = useState<PeopleSearchResult[]>([]);
  const [isSearchingPeople, setIsSearchingPeople] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const normalizedPeopleSearch = peopleSearch.trim();
  const peopleToShow =
    normalizedPeopleSearch.length >= 2 ? peopleResults : suggestedPeople;

  useEffect(() => {
    if (normalizedPeopleSearch.length < 2) {
      return;
    }

    let isStale = false;
    const timeout = window.setTimeout(() => {
      setIsSearchingPeople(true);
      searchPeople(currentProfile.id, normalizedPeopleSearch)
        .then((results) => {
          if (isStale) {
            return;
          }

          setPeopleResults(results);
          setPeopleError("");
        })
        .catch((caught) => {
          if (isStale) {
            return;
          }

          setPeopleResults([]);
          setPeopleError(
            caught instanceof Error ? caught.message : "Could not search people.",
          );
        })
        .finally(() => {
          if (!isStale) {
            setIsSearchingPeople(false);
          }
        });
    }, 250);

    return () => {
      isStale = true;
      window.clearTimeout(timeout);
    };
  }, [currentProfile.id, normalizedPeopleSearch]);

  return (
    <section className="space-y-3 pt-2">
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
      ) : isSearchingPeople ? (
        <p className="glass-panel rounded-[1.35rem] border p-4 text-sm font-semibold text-zinc-500">
          Searching...
        </p>
      ) : peopleError ? (
        <p className="rounded-[1.35rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">
          {peopleError}
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
  );
}
