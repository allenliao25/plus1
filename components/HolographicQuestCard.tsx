"use client";

import { CalendarDays, MapPin, Users } from "lucide-react";
import type { Quest } from "@/types/quest";

type HolographicQuestCardProps = {
  isJoining?: boolean;
  quest: Quest;
  variant?: "immersive" | "compact" | "share";
  showActions?: boolean;
  onJoin?: (questId: string) => void | Promise<void>;
  onOpen?: (questId: string) => void;
};

export default function HolographicQuestCard({
  isJoining = false,
  quest,
  variant = "compact",
  showActions = true,
  onJoin,
  onOpen,
}: HolographicQuestCardProps) {
  const isJoinable = quest.status === "open";
  const isFull = isJoinable && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);
  const isPersonalMatch = Boolean(quest.matchesCurrentUserInterests);
  const isImmersive = variant === "immersive";
  const isShare = variant === "share";
  const status = statusLabel(quest, isFull);
  const when = quest.startTimeRelative ?? quest.startTime;
  const hasImage = Boolean(quest.cardImageUrl);

  return (
    <article
      data-category={quest.category}
      className="event-card group relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-zinc-950 text-white shadow-[0_16px_44px_rgba(15,23,42,0.14)]"
    >
      <div
        className={`relative flex flex-col justify-between ${
          isImmersive
            ? "min-h-[29rem] p-5"
            : isShare
              ? "min-h-[25rem] p-5"
              : "min-h-[18.5rem] p-4"
        }`}
      >
        <div className="absolute inset-0">
          {quest.cardImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quest.cardImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="holo-card-fallback h-full w-full" />
          )}
          <div
            className={`absolute inset-0 ${
              hasImage
                ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.10),transparent_28%,rgba(0,0,0,0.18)_52%,rgba(0,0,0,0.82))]"
                : "bg-[linear-gradient(180deg,rgba(7,10,18,0.08),rgba(7,10,18,0.24)_42%,rgba(7,10,18,0.82))]"
            }`}
          />
        </div>

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
              {quest.category}
            </span>
            {isPersonalMatch ? (
              <span className="rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
                For you
              </span>
            ) : null}
            {status ? (
              <span className="rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
                {status}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative z-10 mt-10 max-w-full">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75 drop-shadow">
            Hosted by {quest.creator}
          </p>
          <h3
            className={`mt-2 font-bold leading-[1.04] tracking-normal text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] ${
              isImmersive
                ? "text-[2.45rem]"
                : isShare
                  ? "text-[2rem]"
                  : "text-[1.65rem]"
            }`}
          >
            <span className="break-words">{quest.title}</span>
          </h3>

          <dl className="mt-5 grid gap-2 text-sm font-semibold text-white/92 drop-shadow">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Where</dt>
              <MapPin size={17} strokeWidth={1.9} aria-hidden="true" />
              <dd className="min-w-0 truncate">{quest.location}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">When</dt>
              <CalendarDays size={17} strokeWidth={1.9} aria-hidden="true" />
              <dd className="min-w-0 truncate">{when}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Spots</dt>
              <Users size={17} strokeWidth={1.9} aria-hidden="true" />
              <dd>
                {quest.goingCount}/{quest.maxPeople} going
              </dd>
            </div>
          </dl>

          {isImmersive || isShare ? (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/82 drop-shadow">
              {quest.description}
            </p>
          ) : null}

          {showActions ? (
            <div className="mt-5 flex items-center gap-3">
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(quest.id)}
                  className="min-h-11 rounded-full border border-white/30 bg-white/18 px-4 py-2.5 text-sm font-bold text-white shadow-sm backdrop-blur-md transition hover:bg-white/25"
                >
                  Details
                </button>
              ) : null}
              {onJoin ? (
                <button
                  type="button"
                  onClick={() => onJoin(quest.id)}
                  disabled={!isJoinable || isFull || isJoined || isJoining}
                  className={`min-h-11 flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                    isJoined
                      ? "bg-white text-zinc-950 shadow-sm"
                      : !isJoinable || isFull
                        ? "bg-white/18 text-white/55"
                        : isJoining
                          ? "bg-white/25 text-white/70"
                          : "bg-white text-zinc-950 hover:bg-white/90"
                  }`}
                >
                  {joinLabel({ isFull, isJoined, isJoinable, isJoining, quest })}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-white/62">
              Tap to join this event on plus1
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function statusLabel(quest: Quest, isFull: boolean) {
  if (quest.createdByCurrentUser) {
    return "Hosting";
  }

  if (quest.joinedByCurrentUser) {
    return "Going";
  }

  if (quest.status === "closed") {
    return "Closed";
  }

  if (quest.status === "past") {
    return "Past";
  }

  return isFull ? "Full" : null;
}

function joinLabel({
  isFull,
  isJoined,
  isJoinable,
  isJoining,
  quest,
}: {
  isFull: boolean;
  isJoined: boolean;
  isJoinable: boolean;
  isJoining: boolean;
  quest: Quest;
}) {
  if (isJoined) {
    return "You're in";
  }

  if (!isJoinable) {
    return quest.status === "closed" ? "Closed" : "Past";
  }

  if (isJoining) {
    return "Joining...";
  }

  return isFull ? "Full" : "I'm down";
}
