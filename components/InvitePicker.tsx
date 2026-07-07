import { Search, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import SafeImage from "@/components/SafeImage";
import { searchProfilesForInvite } from "@/lib/friendService";
import type { QuestInviteProfile } from "@/types/quest";

type InvitePickerProps = {
  currentUserId: string;
  disabled?: boolean;
  friendProfiles?: QuestInviteProfile[];
  selectedProfiles: QuestInviteProfile[];
  onChange: (profiles: QuestInviteProfile[]) => void;
};

const EMPTY_FRIEND_PROFILES: QuestInviteProfile[] = [];

type InviteSearchState = {
  error: string;
  isSearching: boolean;
  results: QuestInviteProfile[];
};

const initialInviteSearchState: InviteSearchState = {
  error: "",
  isSearching: false,
  results: [],
};

function inviteSearchReducer(
  state: InviteSearchState,
  action: Partial<InviteSearchState>,
) {
  return { ...state, ...action };
}

export default function InvitePicker({
  currentUserId,
  disabled = false,
  friendProfiles = EMPTY_FRIEND_PROFILES,
  selectedProfiles,
  onChange,
}: InvitePickerProps) {
  const [query, setQuery] = useState("");
  const [searchState, updateSearchState] = useReducer(
    inviteSearchReducer,
    initialInviteSearchState,
  );
  const normalizedQuery = query.trim();
  const selectedIds = useMemo(
    () => new Set(selectedProfiles.map((profile) => profile.id)),
    [selectedProfiles],
  );
  const availableFriends = useMemo(
    () => friendProfiles.filter((profile) => !selectedIds.has(profile.id)),
    [friendProfiles, selectedIds],
  );

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      return;
    }

    let isStale = false;

    const timeout = window.setTimeout(() => {
      updateSearchState({ isSearching: true });
      searchProfilesForInvite(currentUserId, normalizedQuery)
        .then((profiles) => {
          if (isStale) {
            return;
          }

          const friendIds = new Set(friendProfiles.map((profile) => profile.id));
          updateSearchState({
            error: "",
            isSearching: false,
            results: profiles
              .filter((profile) => !selectedIds.has(profile.id))
              .sort((left, right) => {
                const leftIsFriend = friendIds.has(left.id);
                const rightIsFriend = friendIds.has(right.id);

                if (leftIsFriend === rightIsFriend) {
                  return left.displayName.localeCompare(right.displayName);
                }

                return leftIsFriend ? -1 : 1;
              }),
          });
        })
        .catch((caught) => {
          if (isStale) {
            return;
          }

          updateSearchState({
            error:
              caught instanceof Error
                ? caught.message
                : "Could not search people.",
            isSearching: false,
            results: [],
          });
        });
    }, 250);

    return () => {
      isStale = true;
      window.clearTimeout(timeout);
    };
  }, [currentUserId, friendProfiles, normalizedQuery, selectedIds]);

  function addProfile(profile: QuestInviteProfile) {
    onChange([...selectedProfiles, profile]);
    setQuery("");
    updateSearchState({ results: [] });
  }

  function removeProfile(profileId: string) {
    onChange(selectedProfiles.filter((profile) => profile.id !== profileId));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-ink-soft">Invite people</p>
        {selectedProfiles.length > 0 ? (
          <span className="text-xs font-bold text-faint">
            {selectedProfiles.length} selected
          </span>
        ) : null}
      </div>

      <label className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-white px-3 transition focus-within:border-faint">
        <Search
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="shrink-0 text-faint"
        />
        <input
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or @handle"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-ink outline-none placeholder:text-faint disabled:opacity-50"
        />
      </label>

      {selectedProfiles.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedProfiles.map((profile) => (
            <span
              key={profile.id}
              className="glass-chip inline-flex max-w-full items-center gap-2 rounded-full border py-1 pl-1 pr-2 text-xs font-bold text-ink-soft"
            >
              <Avatar profile={profile} />
              <span className="min-w-0 truncate">@{profile.handle}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeProfile(profile.id)}
                className="grid size-6 shrink-0 place-items-center rounded-full text-faint transition hover:bg-white hover:text-ink-soft disabled:opacity-50"
                aria-label={`Remove ${profile.displayName}`}
              >
                <X size={13} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {normalizedQuery.length < 2 && availableFriends.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white">
          <p className="border-b border-surface-2 px-3 py-2 text-xs font-extrabold uppercase tracking-caps text-faint">
            Friends
          </p>
          <div className="divide-y divide-surface-2">
            {availableFriends.map((profile) => (
              <button
                key={profile.id}
                type="button"
                disabled={disabled}
                onClick={() => addProfile(profile)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2 disabled:opacity-50"
              >
                <Avatar profile={profile} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">
                    {profile.displayName}
                  </span>
                  <span className="block truncate text-xs font-semibold text-faint">
                    @{profile.handle}
                  </span>
                </span>
                <span className="ml-auto rounded-full bg-surface-2 px-2 py-1 text-xs font-extrabold text-muted">
                  Friend
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {normalizedQuery.length >= 2 ? (
        <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white">
          {searchState.isSearching ? (
            <p className="p-3 text-sm font-semibold text-muted">
              Searching…
            </p>
          ) : searchState.error ? (
            <p className="p-3 text-sm font-bold text-red-600">
              {searchState.error}
            </p>
          ) : searchState.results.length > 0 ? (
            <div className="divide-y divide-surface-2">
              {searchState.results.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => addProfile(profile)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2 disabled:opacity-50"
                >
                  <Avatar profile={profile} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">
                      {profile.displayName}
                    </span>
                    <span className="block truncate text-xs font-semibold text-faint">
                      @{profile.handle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="p-3 text-sm font-semibold text-muted">
              No matching people.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ profile }: { profile: QuestInviteProfile }) {
  const [didImageFail, setDidImageFail] = useState(false);

  if (profile.avatarUrl && !didImageFail) {
    return (
      <SafeImage
        src={profile.avatarUrl}
        alt=""
        width={32}
        height={32}
        onError={() => setDidImageFail(true)}
        className="size-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">
      {profile.avatarInitials}
    </span>
  );
}
