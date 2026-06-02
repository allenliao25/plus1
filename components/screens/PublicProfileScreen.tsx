import FriendActionControls from "@/components/FriendActionControls";
import {
  ProfileAvatar,
  ProfileEventGrid,
  ProfileStat,
} from "@/components/ProfileEventGrid";
import { getProfileEventStats } from "@/lib/profileEventStats";
import type { PeopleSearchResult, Quest } from "@/types/quest";
import { MessageCircle } from "lucide-react";
import { useMemo } from "react";

type PublicProfileScreenProps = {
  actionProfileId: string | null;
  isLoading?: boolean;
  profile: PeopleSearchResult | null;
  quests: Quest[];
  onAcceptFriend: (friendshipId: string) => void | Promise<void>;
  onCancelFriendRequest: (friendshipId: string) => void | Promise<void>;
  onDeclineFriend: (friendshipId: string) => void | Promise<void>;
  onOpenQuest: (questId: string) => void;
  onRemoveFriend: (friendshipId: string) => void | Promise<void>;
  onMessageProfile: (profileId: string) => void | Promise<void>;
  onSendFriendRequest: (profileId: string) => void | Promise<void>;
};

export default function PublicProfileScreen({
  actionProfileId,
  isLoading = false,
  onAcceptFriend,
  onCancelFriendRequest,
  onDeclineFriend,
  onMessageProfile,
  onOpenQuest,
  onRemoveFriend,
  onSendFriendRequest,
  profile,
  quests,
}: PublicProfileScreenProps) {
  const stats = useMemo(
    () => (profile ? getProfileEventStats(quests, profile.id) : null),
    [profile, quests],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-[1.75rem] bg-zinc-100" />
        <div className="-mx-5 grid grid-cols-3 gap-[1px] bg-zinc-200">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse bg-zinc-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-[1.75rem] border border-zinc-200 bg-white/76 p-5 text-center">
        <p className="text-sm font-bold text-zinc-900">Profile unavailable.</p>
        <p className="mt-1 text-sm text-zinc-500">
          This person may no longer be visible.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-3">
      <section className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] items-center gap-4">
          <ProfileAvatar profile={profile} />

          <div className="min-w-0 space-y-2.5">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[17px] leading-6 text-zinc-950">
              <span className="min-w-0 max-w-full truncate font-extrabold">
                {profile.displayName}
              </span>
              {profile.pronouns ? (
                <span className="shrink-0 font-semibold text-zinc-500">
                  {profile.pronouns}
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-3 gap-1 text-center">
              <ProfileStat
                label="Hosted"
                value={stats?.hosted.length ?? 0}
              />
              <ProfileStat
                label="Attended"
                value={stats?.attended.length ?? 0}
              />
              <ProfileStat
                label="Events"
                value={stats?.events.length ?? 0}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          {profile.area ? (
            <p className="text-sm text-zinc-500">{profile.area}</p>
          ) : null}
          {profile.bio ? (
            <p className="whitespace-pre-line text-sm leading-6 text-zinc-700">
              {profile.bio}
            </p>
          ) : null}
        </div>

        <div
          className={
            profile.friendshipState === "friends"
              ? "grid grid-cols-2 gap-2"
              : "grid gap-2"
          }
        >
          <FriendActionControls
            friendshipId={profile.friendshipId}
            isBusy={actionProfileId === profile.id}
            profileId={profile.id}
            state={profile.friendshipState}
            variant="profile"
            onAccept={onAcceptFriend}
            onCancel={onCancelFriendRequest}
            onDecline={onDeclineFriend}
            onRemove={onRemoveFriend}
            onRequest={onSendFriendRequest}
          />
          {profile.friendshipState === "friends" ? (
            <button
              type="button"
              onClick={() => onMessageProfile(profile.id)}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-3 text-sm font-bold text-zinc-950 transition active:scale-[0.98]"
            >
              <MessageCircle size={16} strokeWidth={2.2} aria-hidden="true" />
              Message
            </button>
          ) : null}
        </div>

        {profile.interests.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-extrabold text-zinc-600"
              >
                {interest}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="-mx-5 mt-2">
        <ProfileEventGrid
          emptyBody="Visible events for this person will show up here."
          emptyTitle="No visible events yet."
          quests={quests}
          onOpen={onOpenQuest}
        />
      </section>
    </div>
  );
}
