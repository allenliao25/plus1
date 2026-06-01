import { CalendarPlus, LayoutGrid, LogOut, UserCheck, UsersRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import ProfileEditSheet, {
  type ProfileIdentityChanges,
} from "@/components/ProfileEditSheet";
import type { FriendConnection, Profile, Quest } from "@/types/quest";

type ProfileScreenProps = {
  friends: FriendConnection[];
  profile: Profile;
  myQuests: Quest[];
  isSaving: boolean;
  saveError: string;
  onOpen: (questId: string) => void;
  onOpenPeople: () => void;
  onSignOut: () => void | Promise<void>;
  onSaveProfile: (changes: ProfileIdentityChanges) => void | Promise<void>;
};

export default function ProfileScreen({
  friends,
  profile,
  myQuests,
  isSaving,
  saveError,
  onOpen,
  onOpenPeople,
  onSignOut,
  onSaveProfile,
}: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const stats = useMemo(() => {
    const hosted = myQuests.filter((quest) => quest.createdByCurrentUser);
    const going = myQuests.filter(
      (quest) => quest.joinedByCurrentUser && !quest.createdByCurrentUser,
    );

    return { hosted, going };
  }, [myQuests]);

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
        <div className="grid grid-cols-[7rem_1fr] items-center gap-5">
          <ProfileAvatar key={profile.avatarUrl ?? profile.avatarInitials} profile={profile} />

          <div className="min-w-0 space-y-4">
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold leading-6 text-zinc-950">
                {profile.displayName}
                {profile.pronouns ? (
                  <span className="ml-2 font-semibold text-zinc-500">
                    {profile.pronouns}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center">
              <ProfileStat
                icon={<CalendarPlus size={18} strokeWidth={2.1} aria-hidden="true" />}
                label="Hosted events"
                value={stats.hosted.length}
              />
              <ProfileStat
                icon={<UserCheck size={18} strokeWidth={2.1} aria-hidden="true" />}
                label="Attended events"
                value={stats.going.length}
              />
              <ProfileStat
                icon={<UsersRound size={18} strokeWidth={2.1} aria-hidden="true" />}
                label="Friends"
                value={friends.length}
                onClick={onOpenPeople}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[15px] font-bold text-zinc-500">
            {profile.area}
          </p>
          {profile.bio ? (
            <p className="whitespace-pre-line text-[15px] leading-6 text-zinc-700">
              {profile.bio}
            </p>
          ) : null}
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

      <section className="border-t border-zinc-200 pt-3">
        <div className="flex h-9 items-center justify-center text-zinc-950">
          <LayoutGrid size={22} strokeWidth={2.15} aria-label="Profile events grid" />
        </div>

        {myQuests.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {myQuests.map((quest) => (
              <QuestTile key={quest.id} quest={quest} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="py-14 text-center">
            <p className="text-sm font-bold text-zinc-800">
              No events yet.
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

function ProfileStat({
  icon,
  label,
  onClick,
  value,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  value: number;
}) {
  const content = (
    <>
      <span className="flex h-6 items-center justify-center text-zinc-500">
        {icon}
      </span>
      <span className="mt-1 block text-xl font-extrabold leading-none text-zinc-950">
        {value}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={`${value} ${label}`}
        onClick={onClick}
        className="rounded-2xl py-1.5 transition hover:bg-zinc-100/70 active:scale-95"
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-label={`${value} ${label}`} className="py-1.5">
      {content}
    </div>
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
