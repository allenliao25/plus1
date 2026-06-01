import FriendActionControls from "@/components/FriendActionControls";
import QuestList from "@/components/QuestList";
import type { PeopleSearchResult, Quest } from "@/types/quest";
import { MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

type PublicProfileTab = "hosted" | "going" | "past";

type PublicProfileScreenProps = {
  actionProfileId: string | null;
  isLoading?: boolean;
  profile: PeopleSearchResult | null;
  quests: Quest[];
  onAcceptFriend: (friendshipId: string) => void | Promise<void>;
  onCancelFriendRequest: (friendshipId: string) => void | Promise<void>;
  onDeclineFriend: (friendshipId: string) => void | Promise<void>;
  onJoin: (questId: string) => void | Promise<void>;
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
  onJoin,
  onMessageProfile,
  onOpenQuest,
  onRemoveFriend,
  onSendFriendRequest,
  profile,
  quests,
}: PublicProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<PublicProfileTab>("hosted");
  const sections = useMemo(() => {
    const hosted = quests.filter((quest) => quest.creatorId === profile?.id);
    const going = quests.filter(
      (quest) =>
        quest.creatorId !== profile?.id &&
        quest.attendees.some(
          (attendee) => attendee.id === profile?.id && !attendee.isHost,
        ),
    );
    const past = quests.filter((quest) => quest.status !== "open");

    return { hosted, going, past };
  }, [profile?.id, quests]);

  const activeQuests = sections[activeTab];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="glass-panel h-44 animate-pulse rounded-[1.75rem] border" />
        <div className="glass-panel h-64 animate-pulse rounded-[1.75rem] border" />
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
    <div className="space-y-5 pb-3">
      <section className="glass-panel rounded-[1.75rem] border p-5">
        <div className="flex items-start gap-4">
          <ProfileAvatar profile={profile} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold text-zinc-950">
              {profile.displayName}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-zinc-500">
              @{profile.handle}
            </p>
            {profile.pronouns ? (
              <p className="mt-0.5 text-sm font-semibold text-zinc-500">
                {profile.pronouns}
              </p>
            ) : null}
            <p className="mt-0.5 text-sm font-semibold text-zinc-500">
              {profile.area}
            </p>
          </div>
          <FriendActionControls
            friendshipId={profile.friendshipId}
            isBusy={actionProfileId === profile.id}
            profileId={profile.id}
            state={profile.friendshipState}
            onAccept={onAcceptFriend}
            onCancel={onCancelFriendRequest}
            onDecline={onDeclineFriend}
            onRemove={onRemoveFriend}
            onRequest={onSendFriendRequest}
          />
        </div>

        {profile.friendshipState === "friends" ? (
          <button
            type="button"
            onClick={() => onMessageProfile(profile.id)}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-extrabold text-white transition active:scale-95"
          >
            <MessageCircle size={17} strokeWidth={2.2} aria-hidden="true" />
            Message
          </button>
        ) : null}

        {profile.bio ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-700">
            {profile.bio}
          </p>
        ) : null}

        {profile.interests.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
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

      <section className="space-y-3">
        <div className="glass-panel grid grid-cols-3 rounded-full border p-1">
          <TabButton
            isActive={activeTab === "hosted"}
            label={`Hosted ${sections.hosted.length}`}
            onClick={() => setActiveTab("hosted")}
          />
          <TabButton
            isActive={activeTab === "going"}
            label={`Going ${sections.going.length}`}
            onClick={() => setActiveTab("going")}
          />
          <TabButton
            isActive={activeTab === "past"}
            label={`Past ${sections.past.length}`}
            onClick={() => setActiveTab("past")}
          />
        </div>

        <QuestList
          emptyBody="Visible events for this person will show up here."
          emptyTitle={`No ${activeTab} events`}
          joiningQuestId={null}
          quests={activeQuests}
          onJoin={onJoin}
          onOpen={onOpenQuest}
        />
      </section>
    </div>
  );
}

function ProfileAvatar({ profile }: { profile: PeopleSearchResult }) {
  const [didImageFail, setDidImageFail] = useState(false);

  if (profile.avatarUrl && !didImageFail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt=""
        onError={() => setDidImageFail(true)}
        className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }

  return (
    <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-zinc-950 text-2xl font-extrabold text-white">
      {profile.avatarInitials}
    </span>
  );
}

function TabButton({
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
      className={`min-h-10 rounded-full text-xs font-extrabold transition ${
        isActive ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500"
      }`}
    >
      {label}
    </button>
  );
}
