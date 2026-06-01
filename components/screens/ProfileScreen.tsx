import { LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import FriendActionControls from "@/components/FriendActionControls";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import ProfileEditSheet, {
  type ProfileIdentityChanges,
} from "@/components/ProfileEditSheet";
import type { FriendConnection, Profile, Quest } from "@/types/quest";

type ProfileTab = "hosted" | "going" | "friends" | "past";

type ProfileScreenProps = {
  actionProfileId: string | null;
  friends: FriendConnection[];
  profile: Profile;
  myQuests: Quest[];
  joiningQuestId: string | null;
  isSaving: boolean;
  saveError: string;
  onAcceptFriend: (friendshipId: string) => void | Promise<void>;
  onCancelFriendRequest: (friendshipId: string) => void | Promise<void>;
  onDeclineFriend: (friendshipId: string) => void | Promise<void>;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onOpenProfile: (profileId: string) => void;
  onRemoveFriend: (friendshipId: string) => void | Promise<void>;
  onSendFriendRequest: (profileId: string) => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  onSaveProfile: (changes: ProfileIdentityChanges) => void | Promise<void>;
};

export default function ProfileScreen({
  actionProfileId,
  friends,
  profile,
  myQuests,
  isSaving,
  saveError,
  onAcceptFriend,
  onCancelFriendRequest,
  onDeclineFriend,
  onOpen,
  onOpenProfile,
  onRemoveFriend,
  onSendFriendRequest,
  onSignOut,
  onSaveProfile,
}: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("hosted");
  const [isEditing, setIsEditing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const sections = useMemo(() => {
    const hosted = myQuests.filter((quest) => quest.createdByCurrentUser);
    const going = myQuests.filter(
      (quest) => quest.joinedByCurrentUser && !quest.createdByCurrentUser,
    );
    const past = myQuests.filter((quest) => quest.status !== "open");

    return { hosted, going, past };
  }, [myQuests]);

  const activeQuests = activeTab === "friends" ? [] : sections[activeTab];

  async function handleCopyProfile() {
    const text = `${profile.displayName} (@${profile.handle}) on plus1`;
    setShareMessage("");

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareMessage("Profile copied.");
        return;
      }

      if (navigator.share) {
        await navigator.share({ title: profile.displayName, text });
        setShareMessage("Profile shared.");
      }
    } catch {
      setShareMessage("Could not copy profile.");
    }
  }

  return (
    <div className="space-y-5 pb-3">
      <section className="space-y-4">
        <div className="grid grid-cols-[6.75rem_1fr] items-center gap-5">
          <ProfileAvatar key={profile.avatarUrl ?? profile.avatarInitials} profile={profile} />

          <div className="grid grid-cols-4 gap-2 text-center">
            <Stat label="hosted" value={sections.hosted.length} />
            <Stat label="going" value={sections.going.length} />
            <Stat label="friends" value={friends.length} />
            <Stat label="past" value={sections.past.length} />
          </div>
        </div>

        <div>
          <p className="text-[15px] font-bold text-zinc-950">
            {profile.displayName}
          </p>
          {profile.pronouns ? (
            <p className="mt-0.5 text-[15px] font-semibold text-zinc-500">
              {profile.pronouns}
            </p>
          ) : null}
          <p className="mt-0.5 text-[15px] font-semibold text-zinc-500">
            {profile.area}
          </p>
          {profile.bio ? (
            <p className="mt-1 whitespace-pre-line text-[15px] leading-6 text-zinc-700">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-1 text-[15px] leading-6 text-zinc-400">
              No bio yet.
            </p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_1fr_2.75rem] gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="glass-chip inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-extrabold text-zinc-950 transition hover:bg-white/80"
          >
            Edit profile
          </button>
          <button
            type="button"
            onClick={handleCopyProfile}
            className="glass-chip inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-extrabold text-zinc-950 transition hover:bg-white/80"
          >
            Share
          </button>
          <button
            type="button"
            onClick={() => onSignOut()}
            aria-label="Sign out"
            className="glass-chip grid min-h-10 place-items-center rounded-lg border text-zinc-950 transition hover:bg-white/80"
          >
            <LogOut size={17} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>

        {shareMessage ? (
          <p className="text-center text-xs font-semibold text-zinc-400">
            {shareMessage}
          </p>
        ) : null}
      </section>

      <section className="border-t border-zinc-200">
        <div className="glass-panel mt-3 grid grid-cols-4 rounded-full border p-1">
          <TabButton
            isActive={activeTab === "hosted"}
            label="Hosted"
            onClick={() => setActiveTab("hosted")}
          />
          <TabButton
            isActive={activeTab === "going"}
            label="Going"
            onClick={() => setActiveTab("going")}
          />
          <TabButton
            isActive={activeTab === "friends"}
            label="Friends"
            onClick={() => setActiveTab("friends")}
          />
          <TabButton
            isActive={activeTab === "past"}
            label="Past"
            onClick={() => setActiveTab("past")}
          />
        </div>

        {activeTab === "friends" ? (
          friends.length > 0 ? (
            <div className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-[1.35rem] border border-zinc-200 bg-white/76">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(friend.profile.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <FriendAvatar friend={friend} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-zinc-950">
                        {friend.profile.displayName}
                      </span>
                      <span className="block truncate text-xs font-bold text-zinc-400">
                        @{friend.profile.handle}
                      </span>
                    </span>
                  </button>
                  <FriendActionControls
                    friendshipId={friend.id}
                    isBusy={actionProfileId === friend.profile.id}
                    profileId={friend.profile.id}
                    state={friend.state}
                    onAccept={onAcceptFriend}
                    onCancel={onCancelFriendRequest}
                    onDecline={onDeclineFriend}
                    onRemove={onRemoveFriend}
                    onRequest={onSendFriendRequest}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <p className="text-sm font-bold text-zinc-800">
                No friends yet.
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Search from the People tab to build your circle.
              </p>
            </div>
          )
        ) : activeQuests.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {activeQuests.map((quest) => (
              <QuestTile key={quest.id} quest={quest} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="py-14 text-center">
            <p className="text-sm font-bold text-zinc-800">
              No {activeTab} events yet.
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Your plus1 moments will show up here.
            </p>
          </div>
        )}
      </section>

      {isEditing ? (
        <ProfileEditSheet
          key={`${profile.id}:${profile.handle}:${profile.displayName}:${profile.area}`}
          profile={profile}
          isSaving={isSaving}
          saveError={saveError}
          onCancel={() => setIsEditing(false)}
          onSave={async (changes) => {
            await onSaveProfile(changes);
            setIsEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}

function FriendAvatar({ friend }: { friend: FriendConnection }) {
  if (friend.profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={friend.profile.avatarUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }

  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-950 text-xs font-extrabold text-white">
      {friend.profile.avatarInitials}
    </span>
  );
}

function ProfileAvatar({ profile }: { profile: Profile }) {
  const [didImageFail, setDidImageFail] = useState(false);

  if (profile.avatarUrl && !didImageFail) {
    return (
      <span className="block aspect-square h-28 w-28 overflow-hidden rounded-full bg-zinc-100 shadow-sm ring-1 ring-zinc-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt=""
          onError={() => setDidImageFail(true)}
          className="block h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className="grid aspect-square h-28 w-28 place-items-center overflow-hidden rounded-full bg-zinc-950 text-3xl font-bold text-white shadow-sm">
      {profile.avatarInitials}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xl font-bold text-zinc-950">{value}</p>
      <p className="mt-0.5 text-xs font-bold text-zinc-500">{label}</p>
    </div>
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
      className={`min-h-10 rounded-full text-xs font-bold uppercase tracking-[0.12em] transition ${
        isActive
          ? "bg-zinc-950 text-white shadow-sm"
          : "text-zinc-400 hover:bg-white/48 hover:text-zinc-600"
      }`}
    >
      {label}
    </button>
  );
}

function QuestTile({
  quest,
  onOpen,
}: {
  quest: Quest;
  onOpen: (questId: string) => void;
}) {
  const when = quest.startTimeRelative ?? quest.startTime;
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = `${quest.goingCount}/${quest.maxPeople} going · ${openSpots} open`;

  return (
    <button
      type="button"
      onClick={() => onOpen(quest.id)}
      data-category={quest.category}
      className="holo-thumb group relative aspect-square overflow-hidden bg-zinc-100 text-left transition active:scale-[0.98]"
      aria-label={`Open ${quest.title}`}
    >
      {quest.cardImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={quest.cardImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <QuestCategoryArtwork
          category={quest.category}
          className="absolute inset-0 h-full w-full"
        />
      )}
      <div className="absolute inset-0 bg-black/10" />
      <div className="glass-overlay absolute inset-x-1.5 bottom-1.5 rounded-xl border p-2.5">
        <p className="line-clamp-2 text-xs font-bold leading-4 text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.76)]">
          {quest.title}
        </p>
        <p className="mt-1 line-clamp-2 text-[0.62rem] font-semibold leading-3 text-white/78 [text-shadow:0_2px_8px_rgba(0,0,0,0.72)]">
          {context}
        </p>
        <p className="mt-1 truncate text-[0.62rem] font-bold leading-3 text-white/88 [text-shadow:0_2px_8px_rgba(0,0,0,0.72)]">
          {socialProof}
        </p>
      </div>
      {quest.status !== "open" ? (
        <span className="glass-chip absolute right-1.5 top-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase text-zinc-700">
          {quest.status}
        </span>
      ) : null}
    </button>
  );
}
