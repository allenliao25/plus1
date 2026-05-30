import type { Quest } from "@/types/quest";

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
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

function getQuestBadgeConfig(quest: Quest): BadgeConfig | null {
  const isFull = quest.goingCount >= quest.maxPeople;

  if (quest.createdByCurrentUser) {
    return {
      label: "Hosting",
      className: "bg-zinc-950 text-white",
    };
  }

  if (quest.joinedByCurrentUser) {
    return {
      label: "Going",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (quest.status === "closed") {
    return {
      label: "Closed",
      className: "bg-zinc-200 text-zinc-700",
    };
  }

  if (quest.status === "past") {
    return {
      label: "Past",
      className: "bg-zinc-100 text-zinc-600",
    };
  }

  if (isFull) {
    return {
      label: "Full",
      className: "bg-amber-100 text-amber-800",
    };
  }

  return null;
}
