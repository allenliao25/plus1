"use client";

import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
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
  const isCompact = variant === "compact";
  const status = statusLabel(quest, isFull);
  const when = quest.startTimeRelative ?? quest.startTime;
  const hasImage = Boolean(quest.cardImageUrl);
  const cardShape = isImmersive || isShare
    ? "aspect-[4/5] rounded-[1.75rem]"
    : "aspect-[5/4] rounded-[1.35rem]";
  const overlayInset = isImmersive || isShare ? "inset-x-3.5 bottom-3.5" : "inset-x-3 bottom-3";
  const overlayPadding = isImmersive || isShare ? "p-3.5" : "p-3";
  const titleSize = isImmersive || isShare ? "text-[1.55rem]" : "text-[1.22rem]";
  const ctaWidth = isImmersive || isShare ? "min-w-[7rem]" : "min-w-[6.25rem]";

  return (
    <article
      data-category={quest.category}
      className={`event-card group relative overflow-hidden border border-zinc-200 bg-zinc-950 text-white shadow-[0_16px_44px_rgba(15,23,42,0.14)] ${cardShape}`}
    >
      <div className="absolute inset-0">
        {quest.cardImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={quest.cardImageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
          />
        ) : (
          <div className="holo-card-fallback h-full w-full" />
        )}
        <div className={`absolute inset-0 ${hasImage ? "bg-black/[0.12]" : "bg-black/[0.08]"}`} />
        <div
          className={`absolute inset-0 ${
            hasImage
              ? "bg-[linear-gradient(180deg,rgba(0,0,0,0.05),transparent_38%,rgba(0,0,0,0.18)_58%,rgba(0,0,0,0.78))]"
              : "bg-[linear-gradient(180deg,rgba(7,10,18,0.04),rgba(7,10,18,0.18)_50%,rgba(7,10,18,0.76))]"
          }`}
        />
      </div>

      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(quest.id)}
          className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
          aria-label={`Open details for ${quest.title}`}
        />
      ) : null}

      <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
        <span className="rounded-full border border-white/18 bg-black/28 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
          {quest.category}
        </span>
        {isPersonalMatch ? (
          <span className="rounded-full border border-white/18 bg-black/28 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
            For you
          </span>
        ) : null}
        {status ? (
          <span className="rounded-full border border-white/18 bg-black/28 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
            {status}
          </span>
        ) : null}
      </div>

      <div
        className={`event-card-deck pointer-events-none absolute z-20 ${overlayInset} ${overlayPadding} rounded-[1.15rem] border border-white/14 bg-black/38 shadow-[0_16px_42px_rgba(0,0,0,0.30)] backdrop-blur-xl`}
      >
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3
                className={`line-clamp-2 min-w-0 font-bold leading-[1.02] tracking-normal text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.80)] ${titleSize}`}
              >
                {quest.title}
              </h3>
              {onOpen ? (
                <ChevronRight
                  className="mt-0.5 shrink-0 text-white/72 drop-shadow"
                  size={isCompact ? 18 : 20}
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <dl className="mt-2 flex min-w-0 items-center gap-2 text-[0.78rem] font-bold leading-5 text-white/90">
              <div className="flex min-w-0 items-center gap-1.5">
                <dt className="sr-only">Where</dt>
                <MapPin
                  className="shrink-0 text-white/76 drop-shadow"
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <dd className="min-w-0 truncate [text-shadow:0_2px_9px_rgba(0,0,0,0.72)]">
                  {quest.location}
                </dd>
              </div>
              <span className="shrink-0 text-white/45" aria-hidden="true">
                /
              </span>
              <div className="flex min-w-0 items-center gap-1.5">
                <dt className="sr-only">When</dt>
                <CalendarDays
                  className="shrink-0 text-white/76 drop-shadow"
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <dd className="min-w-0 truncate [text-shadow:0_2px_9px_rgba(0,0,0,0.72)]">
                  {when}
                </dd>
              </div>
            </dl>
          </div>

          {showActions && onJoin ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onJoin(quest.id);
              }}
              disabled={!isJoinable || isFull || isJoined || isJoining}
              className={`pointer-events-auto min-h-10 shrink-0 rounded-full px-3.5 py-2 text-sm font-bold transition ${ctaWidth} ${
                isJoined
                  ? "bg-white text-zinc-950 shadow-[0_10px_26px_rgba(0,0,0,0.24)] ring-1 ring-black/10"
                  : !isJoinable || isFull
                    ? "bg-white/12 text-white/55 ring-1 ring-white/12"
                    : isJoining
                      ? "bg-white/24 text-white/72 ring-1 ring-white/12"
                      : "bg-white text-zinc-950 shadow-[0_10px_26px_rgba(0,0,0,0.25)] ring-1 ring-black/10 hover:bg-white/90"
              }`}
            >
              {joinLabel({ isFull, isJoined, isJoinable, isJoining, quest })}
            </button>
          ) : null}
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
