import { Copy, Edit3, Link2, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import ProfileEditSheet, {
  type ProfileIdentityChanges,
} from "@/components/ProfileEditSheet";
import type { Profile, Quest } from "@/types/quest";

type ProfileTab = "hosted" | "going" | "past";

type ProfileScreenProps = {
  profile: Profile;
  myQuests: Quest[];
  joiningQuestId: string | null;
  isSaving: boolean;
  saveError: string;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onSignOut: () => void | Promise<void>;
  onSaveProfile: (changes: ProfileIdentityChanges) => void | Promise<void>;
};

export default function ProfileScreen({
  profile,
  myQuests,
  isSaving,
  saveError,
  onOpen,
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

  const activeQuests = sections[activeTab];

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
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-zinc-950">
            {profile.handle}
          </h2>
          <button
            type="button"
            onClick={() => onSignOut()}
            aria-label="Sign out"
            className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 text-zinc-600 transition hover:bg-zinc-50"
          >
            <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-[6.75rem_1fr] items-center gap-5">
          <ProfileAvatar profile={profile} />

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="hosted" value={sections.hosted.length} />
            <Stat label="going" value={sections.going.length} />
            <Stat label="past" value={sections.past.length} />
          </div>
        </div>

        <div>
          <p className="text-base font-semibold text-zinc-950">
            {profile.displayName}
          </p>
          {profile.bio ? (
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-zinc-700">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              No bio yet.
            </p>
          )}
          <p className="mt-1 text-sm font-medium text-zinc-400">
            @{profile.handle}
          </p>
          {profile.websiteUrl ? (
            <a
              href={profile.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-sm font-semibold text-zinc-950"
            >
              <Link2 size={15} strokeWidth={1.9} aria-hidden="true" />
              <span className="truncate">{formatWebsite(profile.websiteUrl)}</span>
            </a>
          ) : null}
          {profile.interests.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            <Edit3 size={16} strokeWidth={1.9} aria-hidden="true" />
            Edit profile
          </button>
          <button
            type="button"
            onClick={handleCopyProfile}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
            Copy profile
          </button>
        </div>

        {shareMessage ? (
          <p className="text-center text-xs font-semibold text-zinc-400">
            {shareMessage}
          </p>
        ) : null}
      </section>

      <section className="border-t border-zinc-200">
        <div className="grid grid-cols-3">
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
            isActive={activeTab === "past"}
            label="Past"
            onClick={() => setActiveTab("past")}
          />
        </div>

        {activeQuests.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {activeQuests.map((quest) => (
              <QuestTile key={quest.id} quest={quest} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="py-14 text-center">
            <p className="text-sm font-semibold text-zinc-700">
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
          key={`${profile.id}:${profile.handle}:${profile.displayName}`}
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
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt=""
        className="h-28 w-28 rounded-full object-cover shadow-sm"
      />
    );
  }

  return (
    <span className="grid h-28 w-28 place-items-center rounded-full bg-zinc-950 text-3xl font-semibold text-white shadow-sm">
      {profile.avatarInitials}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xl font-semibold text-zinc-950">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function formatWebsite(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "");
  } catch {
    return value;
  }
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
      className={`min-h-12 border-t-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
        isActive
          ? "border-zinc-950 text-zinc-950"
          : "border-transparent text-zinc-400 hover:text-zinc-600"
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
        <div className="holo-thumb-fallback absolute inset-0" />
      )}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.58rem] font-bold uppercase text-zinc-700">
        {quest.category}
      </span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2">
        <p className="line-clamp-2 text-xs font-semibold leading-4 text-white">
          {quest.title}
        </p>
        <p className="mt-1 truncate text-[0.65rem] font-medium text-white/70">
          {quest.startTimeRelative ?? quest.startTime} / {quest.goingCount}/{quest.maxPeople}
        </p>
      </div>
      {quest.status !== "open" ? (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-zinc-700">
          {quest.status}
        </span>
      ) : null}
    </button>
  );
}
