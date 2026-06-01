import { useMemo, useState } from "react";
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
    <div className="space-y-4 pb-3">
      <section className="space-y-4">
        <div className="grid grid-cols-[5rem_1fr] items-center gap-4">
          <ProfileAvatar key={profile.avatarUrl ?? profile.avatarInitials} profile={profile} />

          <div className="min-w-0">
            <div className="grid grid-cols-3 gap-1 text-center">
              <ProfileStat
                label="Hosted"
                value={stats.hosted.length}
              />
              <ProfileStat
                label="Attended"
                value={stats.going.length}
              />
              <ProfileStat
                label="Friends"
                value={friends.length}
                onClick={onOpenPeople}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="truncate text-[17px] font-extrabold leading-6 text-zinc-950">
            {profile.displayName}
            {profile.pronouns ? (
              <span className="ml-2 font-semibold text-zinc-500">
                {profile.pronouns}
              </span>
            ) : null}
          </p>
          {profile.area ? (
            <p className="text-sm text-zinc-500">{profile.area}</p>
          ) : null}
          {profile.bio ? (
            <p className="whitespace-pre-line text-sm leading-6 text-zinc-700">
              {profile.bio}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-zinc-100 px-3 text-sm font-bold text-zinc-950 transition active:scale-[0.98]"
          >
            Edit profile
          </button>
          <button
            type="button"
            onClick={handleCopyProfile}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-zinc-100 px-3 text-sm font-bold text-zinc-950 transition active:scale-[0.98]"
          >
            Share
          </button>
        </div>

        {shareMessage ? (
          <p className="text-center text-xs font-semibold text-zinc-400">
            {shareMessage}
          </p>
        ) : null}
      </section>

      <section className="-mx-5 mt-2">
        {myQuests.length > 0 ? (
          <div className="grid grid-cols-3 gap-[1px] bg-zinc-200">
            {myQuests.map((quest) => (
              <QuestTile key={quest.id} quest={quest} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-bold text-zinc-800">No events yet.</p>
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
      <span className="block aspect-square h-20 w-20 overflow-hidden rounded-full bg-zinc-100 shadow-sm ring-1 ring-zinc-200">
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
    <span className="grid aspect-square h-20 w-20 place-items-center overflow-hidden rounded-full bg-zinc-950 text-2xl font-bold text-white shadow-sm">
      {profile.avatarInitials}
    </span>
  );
}

function ProfileStat({
  label,
  onClick,
  value,
}: {
  label: string;
  onClick?: () => void;
  value: number;
}) {
  const content = (
    <>
      <span className="block text-lg font-extrabold leading-none text-zinc-950">
        {value}
      </span>
      <span className="mt-1 block text-xs font-semibold text-zinc-500">
        {label}
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
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
      <p className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[11px] font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
        {quest.title}
      </p>
      {quest.status !== "open" ? (
        <span className="glass-chip absolute right-1.5 top-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase text-zinc-700">
          {quest.status}
        </span>
      ) : null}
    </button>
  );
}
