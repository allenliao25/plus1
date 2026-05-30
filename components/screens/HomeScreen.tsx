import QuestList from "@/components/QuestList";
import type { Profile, Quest } from "@/types/quest";

type HomeScreenProps = {
  quests: Quest[];
  profile: Profile;
  joiningQuestId: string | null;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onCreate: () => void;
};

export default function HomeScreen({
  quests,
  profile,
  joiningQuestId,
  onJoin,
  onOpen,
  onCreate,
}: HomeScreenProps) {
  const interestMatches = quests.filter((quest) =>
    profile.interests.includes(quest.category),
  );
  const sortedQuests = [...quests]
    .sort((left, right) => {
      const leftMatch = profile.interests.includes(left.category) ? 0 : 1;
      const rightMatch = profile.interests.includes(right.category) ? 0 : 1;
      return leftMatch - rightMatch;
    })
    .map((quest) => ({
      ...quest,
      matchesCurrentUserInterests: profile.interests.includes(quest.category),
    }));

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-zinc-950">Open quests</h2>
          {interestMatches.length > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {interestMatches.length} for you
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          Find something low-pressure to do with people nearby.
        </p>
      </div>
      <QuestList
        joiningQuestId={joiningQuestId}
        quests={sortedQuests}
        emptyActionLabel="Create a quest"
        emptyBody="Create one and it will appear here for people nearby."
        emptyTitle="No open quests right now"
        onEmptyAction={onCreate}
        onJoin={onJoin}
        onOpen={onOpen}
      />
    </div>
  );
}
