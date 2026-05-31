import { CalendarDays, ChevronRight, MapPin, Users } from "lucide-react";
import type { Quest } from "@/types/quest";

type HomeQuestRowProps = {
  isJoining: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function HomeQuestRow({
  isJoining,
  quest,
  onJoin,
  onOpen,
}: HomeQuestRowProps) {
  const actionState = getActionState(quest, isJoining);
  const when = quest.startTimeRelative ?? quest.startTime;

  return (
    <article
      data-category={quest.category}
      className="event-card relative overflow-hidden rounded-[1.15rem] border border-zinc-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none relative z-20 grid grid-cols-[4.75rem_1fr_auto] items-center gap-3">
        <div className="holo-thumb aspect-square overflow-hidden rounded-[0.95rem] bg-zinc-950">
          {quest.cardImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quest.cardImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="holo-thumb-fallback h-full w-full" />
          )}
        </div>

        <div className="min-w-0 py-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-[0.66rem] font-bold uppercase tracking-[0.12em] text-zinc-400">
              {quest.category}
            </span>
            {quest.matchesCurrentUserInterests ? (
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[0.62rem] font-bold text-zinc-600">
                For you
              </span>
            ) : null}
          </div>
          <h3 className="mt-1 line-clamp-2 text-[1.02rem] font-bold leading-[1.08] tracking-normal text-zinc-950">
            {quest.title}
          </h3>
          <dl className="mt-2 grid gap-1 text-[0.72rem] font-semibold leading-4 text-zinc-500">
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">When</dt>
              <CalendarDays
                className="shrink-0 text-zinc-400"
                size={13}
                strokeWidth={2}
                aria-hidden="true"
              />
              <dd className="min-w-0 truncate">{when}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">Where</dt>
              <MapPin
                className="shrink-0 text-zinc-400"
                size={13}
                strokeWidth={2}
                aria-hidden="true"
              />
              <dd className="min-w-0 truncate">{quest.location}</dd>
            </div>
          </dl>
        </div>

        <div className="flex h-full flex-col items-end justify-between gap-2 py-0.5">
          <ChevronRight
            className="text-zinc-300"
            size={18}
            strokeWidth={2}
            aria-hidden="true"
          />
          <div className="flex items-center gap-1 text-[0.7rem] font-bold text-zinc-400">
            <Users size={13} strokeWidth={2} aria-hidden="true" />
            {quest.goingCount}/{quest.maxPeople}
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onJoin(quest.id);
            }}
            disabled={actionState.isDisabled}
            className={`pointer-events-auto min-h-9 min-w-[4.9rem] rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
              actionState.isPrimary
                ? "bg-zinc-950 text-white hover:bg-zinc-800"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {actionState.label}
          </button>
        </div>
      </div>
    </article>
  );
}

function getActionState(quest: Quest, isJoining: boolean) {
  const isFull = quest.status === "open" && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);

  if (isJoined) {
    return { isDisabled: true, isPrimary: false, label: "In" };
  }

  if (quest.status !== "open") {
    return {
      isDisabled: true,
      isPrimary: false,
      label: quest.status === "closed" ? "Closed" : "Past",
    };
  }

  if (isFull) {
    return { isDisabled: true, isPrimary: false, label: "Full" };
  }

  if (isJoining) {
    return { isDisabled: true, isPrimary: false, label: "..." };
  }

  return { isDisabled: false, isPrimary: true, label: "Join" };
}
