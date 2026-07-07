import HolographicQuestCard from "@/components/HolographicQuestCard";
import type { Quest } from "@/types/quest";

type QuestCardProps = {
  isJoining?: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onOpenChat?: (questId: string) => void;
  variant?: "immersive" | "compact";
};

export default function QuestCard({
  isJoining = false,
  quest,
  onJoin,
  onOpen,
  onOpenChat,
  variant = "compact",
}: QuestCardProps) {
  return (
    <HolographicQuestCard
      isJoining={isJoining}
      quest={quest}
      variant={variant}
      onJoin={onJoin}
      onOpen={onOpen}
      onOpenChat={onOpenChat}
    />
  );
}
