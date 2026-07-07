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
  onOpenChat?: (questId: string) => void;
  onEmptyAction?: () => void;
  variant?: "immersive" | "compact";
};

export default function QuestList({
  joiningQuestId,
  quests,
  emptyTitle,
  emptyBody,
  emptyActionLabel,
  onJoin,
  onOpen,
  onOpenChat,
  onEmptyAction,
  variant = "compact",
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
    <div className={variant === "immersive" ? "space-y-5" : "space-y-3"}>
      {quests.map((quest) => (
        <QuestCard
          key={quest.id}
          isJoining={joiningQuestId === quest.id}
          quest={quest}
          onJoin={onJoin}
          onOpen={onOpen}
          onOpenChat={onOpenChat}
          variant={variant}
        />
      ))}
    </div>
  );
}
