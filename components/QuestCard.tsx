import QuestStatusBadge from "@/components/QuestStatusBadge";
import type { Quest } from "@/types/quest";

type QuestCardProps = {
  isJoining?: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  compact?: boolean;
};

export default function QuestCard({
  isJoining = false,
  quest,
  onJoin,
  onOpen,
  compact = false,
}: QuestCardProps) {
  const isJoinable = quest.status === "open";
  const isFull = isJoinable && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);
  const isPersonalMatch = Boolean(quest.matchesCurrentUserInterests);

  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              {quest.category}
            </span>
            {isPersonalMatch ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                For you
              </span>
            ) : null}
            <QuestStatusBadge quest={quest} />
            <span className="text-xs font-medium text-zinc-500">
              {quest.startTimeRelative ?? quest.startTime}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-snug text-zinc-950">
            {quest.title}
          </h3>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            {quest.location}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-zinc-950">
            {quest.goingCount}/{quest.maxPeople}
          </p>
          <p className="text-[0.7rem] font-medium text-zinc-500">going</p>
        </div>
      </div>

      {!compact ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600">
          {quest.description}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpen(quest.id)}
          className="min-h-11 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => onJoin(quest.id)}
          disabled={!isJoinable || isFull || isJoined || isJoining}
          className={`min-h-11 flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
            isJoined
              ? "bg-emerald-50 text-emerald-700"
              : !isJoinable
                ? "bg-zinc-100 text-zinc-500"
              : isJoining
                ? "bg-zinc-200 text-zinc-500"
              : isFull
                ? "bg-zinc-100 text-zinc-400"
                : "bg-zinc-950 text-white hover:bg-zinc-800"
          }`}
        >
          {isJoined
            ? "You're in"
            : !isJoinable
              ? quest.status === "closed"
                ? "Closed"
                : "Past"
            : isJoining
              ? "Joining..."
              : isFull
                ? "Full"
                : "I'm down"}
        </button>
      </div>
    </article>
  );
}
