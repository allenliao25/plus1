import { useMemo, useState } from "react";
import {
  ProfileAvatar,
  ProfileEventGrid,
  ProfileStat,
} from "@/components/ProfileEventGrid";
import ProfileEditSheet, {
  type ProfileIdentityChanges,
} from "@/components/ProfileEditSheet";
import { getProfileEventStats } from "@/lib/profileEventStats";
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

  const stats = useMemo(
    () =>
      getProfileEventStats(myQuests, profile.id, {
        includeCurrentUserFlags: true,
      }),
    [myQuests, profile.id],
  );

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

          <div className="min-w-0 space-y-2.5">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-base leading-6 text-ink">
              <span className="min-w-0 max-w-full truncate font-extrabold">
                {profile.displayName}
              </span>
              {profile.pronouns ? (
                <span className="shrink-0 font-semibold text-muted">
                  {profile.pronouns}
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-3 gap-1 text-center">
              <ProfileStat
                label="Hosted"
                value={stats.hosted.length}
              />
              <ProfileStat
                label="Attended"
                value={stats.attended.length}
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
          {profile.area ? (
            <p className="text-sm text-muted">{profile.area}</p>
          ) : null}
          {profile.bio ? (
            <p className="whitespace-pre-line text-sm leading-6 text-ink-soft">
              {profile.bio}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="pressable inline-flex min-h-9 items-center justify-center rounded-lg bg-line px-3 text-sm font-extrabold text-ink hover:bg-faint"
          >
            Edit profile
          </button>
          <button
            type="button"
            onClick={handleCopyProfile}
            className="pressable inline-flex min-h-9 items-center justify-center rounded-lg bg-line px-3 text-sm font-extrabold text-ink hover:bg-faint"
          >
            Share profile
          </button>
        </div>

        {shareMessage ? (
          <p className="text-center text-xs font-semibold text-faint">
            {shareMessage}
          </p>
        ) : null}
      </section>

      <section className="-mx-5 mt-2">
        <ProfileEventGrid
          emptyBody="Your plus1 moments will show up here."
          emptyTitle="No events yet."
          quests={myQuests}
          onOpen={onOpen}
        />
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
