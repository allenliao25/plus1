import type { Quest } from "@/types/quest";
import { isQuestFull } from "@/lib/questCapacity";

type BadgeConfig = {
  label: string;
  className: string;
};

export default function QuestStatusBadge({ quest }: { quest: Quest }) {
  const badge = getQuestBadgeConfig(quest);

  if (!badge) {
    return null;
  }

  return (
    <span className={`glass-chip rounded-full border px-2.5 py-1 text-xs font-bold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function getQuestBadgeConfig(quest: Quest): BadgeConfig | null {
  const isFull = isQuestFull(quest);

  if (quest.createdByCurrentUser) {
    return {
      label: "Hosting",
      className: "text-zinc-950",
    };
  }

  if (quest.joinedByCurrentUser) {
    return {
      label: "Going",
      className: "text-emerald-700",
    };
  }

  if (quest.status === "closed") {
    return {
      label: "Closed",
      className: "text-zinc-700",
    };
  }

  if (quest.status === "past") {
    return {
      label: "Past",
      className: "text-zinc-600",
    };
  }

  if (isFull) {
    return {
      label: "Full",
      className: "text-amber-800",
    };
  }

  return null;
}
