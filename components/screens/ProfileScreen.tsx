import { useMemo, useState } from "react";
import QuestList from "@/components/QuestList";
import { questCategories } from "@/data/demoQuests";
import type { Profile, Quest } from "@/types/quest";

type ProfileScreenProps = {
  profile: Profile;
  myQuests: Quest[];
  joiningQuestId: string | null;
  isSaving: boolean;
  saveError: string;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onSignOut: () => void | Promise<void>;
  onSaveProfile: (changes: {
    bio: string | null;
    interests: string[];
  }) => void | Promise<void>;
};

export default function ProfileScreen({
  profile,
  myQuests,
  joiningQuestId,
  isSaving,
  saveError,
  onJoin,
  onOpen,
  onSignOut,
  onSaveProfile,
}: ProfileScreenProps) {
  const [bio, setBio] = useState(profile.bio ?? "");
  const [interests, setInterests] = useState<string[]>(profile.interests);

  const sections = useMemo(() => {
    const hosting = myQuests.filter(
      (quest) => quest.createdByCurrentUser && quest.status === "open",
    );
    const going = myQuests.filter(
      (quest) =>
        quest.joinedByCurrentUser &&
        !quest.createdByCurrentUser &&
        quest.status === "open",
    );
    const past = myQuests.filter((quest) => quest.status !== "open");

    return { hosting, going, past };
  }, [myQuests]);

  const hostedCount = useMemo(
    () => myQuests.filter((quest) => quest.createdByCurrentUser).length,
    [myQuests],
  );
  const joinedCount = useMemo(
    () =>
      myQuests.filter(
        (quest) => quest.joinedByCurrentUser && !quest.createdByCurrentUser,
      ).length,
    [myQuests],
  );

  const isDirty =
    bio.trim() !== (profile.bio ?? "").trim() ||
    !sameInterests(interests, profile.interests);

  function toggleInterest(category: string) {
    setInterests((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-700">
            {profile.avatarInitials}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-zinc-950">
              {profile.displayName}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {maskPhone(profile.phone) ?? profile.email ?? "No contact info"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Hosted" value={hostedCount} />
          <Stat label="Joined" value={joinedCount} />
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
          About you
        </h3>

        <label className="block">
          <span className="text-sm font-semibold text-zinc-700">Bio</span>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="A short vibe so people know who they're meeting."
            rows={3}
            className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
          />
        </label>

        <div>
          <p className="text-sm font-semibold text-zinc-700">Interests</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {questCategories.map((category) => {
              const isSelected = interests.includes(category);

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleInterest(category)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isSelected
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        {saveError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {saveError}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={() =>
            onSaveProfile({ bio: bio.trim() || null, interests })
          }
          className="min-h-11 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {isSaving ? "Saving..." : "Save profile"}
        </button>
      </section>

      <QuestSection
        title="Hosting"
        quests={sections.hosting}
        joiningQuestId={joiningQuestId}
        onJoin={onJoin}
        onOpen={onOpen}
      />
      <QuestSection
        title="Going"
        quests={sections.going}
        joiningQuestId={joiningQuestId}
        onJoin={onJoin}
        onOpen={onOpen}
      />
      <QuestSection
        title="Past"
        quests={sections.past}
        joiningQuestId={joiningQuestId}
        onJoin={onJoin}
        onOpen={onOpen}
      />

      <button
        type="button"
        onClick={() => onSignOut()}
        className="min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
      >
        Sign out
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3 text-center">
      <p className="text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}

function QuestSection({
  title,
  quests,
  joiningQuestId,
  onJoin,
  onOpen,
}: {
  title: string;
  quests: Quest[];
  joiningQuestId: string | null;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
}) {
  if (quests.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {title}
      </h3>
      <QuestList
        compact
        joiningQuestId={joiningQuestId}
        quests={quests}
        emptyBody=""
        emptyTitle=""
        onJoin={onJoin}
        onOpen={onOpen}
      />
    </section>
  );
}

function maskPhone(phone: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D+/g, "");

  if (digits.length < 4) {
    return phone;
  }

  return `(***) ***-${digits.slice(-4)}`;
}

function sameInterests(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}
