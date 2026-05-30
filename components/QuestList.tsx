import EmptyState from "@/components/EmptyState";
import QuestCard from "@/components/QuestCard";
import type { Quest } from "@/types/quest";

type QuestListProps = {
  joiningQuestId: string | null;
  quests: Quest[];
  emptyTitle: string;
  emptyBody: string;
  emptyActionLabel?: string;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onEmptyAction?: () => void;
  compact?: boolean;
};

export default function QuestList({
  joiningQuestId,
  quests,
  emptyTitle,
  emptyBody,
  emptyActionLabel,
  onJoin,
  onOpen,
  onEmptyAction,
  compact = false,
}: QuestListProps) {
  if (quests.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        body={emptyBody}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      {quests.map((quest) => (
        <QuestCard
          key={quest.id}
          isJoining={joiningQuestId === quest.id}
          quest={quest}
          onJoin={onJoin}
          onOpen={onOpen}
          compact={compact}
        />
      ))}
    </div>
  );
}
