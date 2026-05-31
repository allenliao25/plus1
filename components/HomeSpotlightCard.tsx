import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import type { Quest } from "@/types/quest";

type HomeSpotlightCardProps = {
  isJoining: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function HomeSpotlightCard({
  isJoining,
  quest,
  onJoin,
  onOpen,
}: HomeSpotlightCardProps) {
  const actionState = getActionState(quest, isJoining);
  const when = quest.startTimeRelative ?? quest.startTime;
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);

  return (
    <article
      data-category={quest.category}
      className="event-card relative overflow-hidden rounded-[1.65rem] border border-zinc-900 bg-[linear-gradient(135deg,#161617_0%,#26262b_48%,var(--holo-a)_170%)] p-3.5 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_36%)]" />
      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none relative z-20 grid grid-cols-[6.35rem_1fr] gap-3.5">
        <div className="holo-thumb aspect-[4/5] overflow-hidden rounded-[1.2rem] bg-zinc-900 shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
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

        <div className="flex min-w-0 flex-col py-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/68">
                <Sparkles size={13} strokeWidth={2.2} aria-hidden="true" />
                Tonight&apos;s move
              </p>
              <h3 className="mt-2 line-clamp-2 text-[1.35rem] font-bold leading-[1.02] tracking-normal text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.42)]">
                {quest.title}
              </h3>
            </div>
            <ChevronRight
              className="mt-0.5 shrink-0 text-white/58"
              size={21}
              strokeWidth={2.1}
              aria-hidden="true"
            />
          </div>

          <p className="mt-2 truncate text-sm font-semibold text-white/72">
            Hosted by {quest.creator}
          </p>

          <dl className="mt-3 space-y-1.5 text-[0.78rem] font-bold leading-5 text-white/86">
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">When</dt>
              <CalendarDays
                className="shrink-0 text-white/64"
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
              <dd className="min-w-0 truncate">{when}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">Where</dt>
              <MapPin
                className="shrink-0 text-white/64"
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
              <dd className="min-w-0 truncate">{quest.location}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">Spots</dt>
              <Users
                className="shrink-0 text-white/64"
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
              <dd className="min-w-0 truncate">
                {quest.goingCount}/{quest.maxPeople} going
                {openSpots > 0 ? ` / ${openSpots} open` : ""}
              </dd>
            </div>
          </dl>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/82 backdrop-blur">
              {quest.category}
            </span>
            {quest.matchesCurrentUserInterests ? (
              <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/82 backdrop-blur">
                For you
              </span>
            ) : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onJoin(quest.id);
              }}
              disabled={actionState.isDisabled}
              className={`pointer-events-auto ml-auto min-h-10 min-w-[6.4rem] rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                actionState.isPrimary
                  ? "bg-white text-zinc-950 shadow-[0_12px_30px_rgba(0,0,0,0.25)] hover:bg-white/90"
                  : "bg-white/12 text-white/58 ring-1 ring-white/12"
              }`}
            >
              {actionState.label}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function getActionState(quest: Quest, isJoining: boolean) {
  const isFull = quest.status === "open" && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);
  const isJoinable = quest.status === "open" && !isFull && !isJoined;

  if (isJoined) {
    return { isDisabled: true, isPrimary: false, label: "You're in" };
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
    return { isDisabled: true, isPrimary: false, label: "Joining..." };
  }

  return { isDisabled: !isJoinable, isPrimary: true, label: "I'm down" };
}
