import QuestList from "@/components/QuestList";
import type { Quest } from "@/types/quest";

type HomeScreenProps = {
  quests: Quest[];
  joiningQuestId: string | null;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onCreate: () => void;
};

export default function HomeScreen({
  quests,
  joiningQuestId,
  onJoin,
  onOpen,
  onCreate,
}: HomeScreenProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Open quests</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          Find something low-pressure to do with people nearby.
        </p>
      </div>
      <QuestList
        joiningQuestId={joiningQuestId}
        quests={quests}
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
