"use client";

import { useState, type CSSProperties, type PointerEvent } from "react";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
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
  const isImmersive = variant === "immersive";
  const isShare = variant === "share";
  const isCompact = !isImmersive && !isShare;
  const status = statusLabel(quest, isFull);
  const when = quest.startTimeRelative ?? quest.startTime;
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = `${quest.goingCount}/${quest.maxPeople} going · ${openSpots} open`;
  const [didImageFail, setDidImageFail] = useState(false);
  const hasImage = Boolean(quest.cardImageUrl && !didImageFail);
  const cardShape = isImmersive || isShare
    ? "aspect-[4/5] rounded-[1.75rem]"
    : "aspect-[5/4] rounded-[1.35rem]";
  const overlayInset = isImmersive || isShare ? "inset-x-3.5 bottom-3.5" : "inset-x-3 bottom-3";
  const overlayPadding = isImmersive || isShare ? "p-3.5" : "p-3";
  const titleSize = isImmersive || isShare ? "text-[1.55rem]" : "text-[1.22rem]";
  const ctaWidth = isImmersive || isShare ? "min-w-[7rem]" : "min-w-[6.25rem]";

  if (isCompact) {
    return (
      <article
        data-category={quest.category}
        className="event-card relative overflow-hidden rounded-[1.15rem] border border-zinc-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
      >
        {onOpen ? (
          <button
            type="button"
            onClick={() => onOpen(quest.id)}
            className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300"
            aria-label={`Open details for ${quest.title}`}
          />
        ) : null}

        <div className="pointer-events-none relative z-20 grid grid-cols-[4.75rem_1fr_auto] items-center gap-3">
          <div className="holo-thumb relative aspect-square overflow-hidden rounded-[0.95rem] bg-zinc-950">
            {hasImage ? (
              <SafeImage
                src={quest.cardImageUrl!}
                alt=""
                fill
                sizes="76px"
                onError={() => setDidImageFail(true)}
                className="object-cover"
              />
            ) : (
              <QuestCategoryArtwork
                category={quest.category}
                className="h-full w-full"
              />
            )}
          </div>

          <div className="min-w-0 py-0.5">
            <div className="flex items-center gap-1.5">
              {status ? (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.1em] text-zinc-500">
                  {status}
                </span>
              ) : null}
            </div>
            <h3 className="mt-0.5 line-clamp-2 text-[1.02rem] font-bold leading-[1.08] tracking-normal text-zinc-950">
              {quest.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-[0.72rem] font-semibold leading-4 text-zinc-500">
              {context}
            </p>
            <p className="mt-1 truncate text-[0.72rem] font-bold leading-4 text-zinc-700">
              {socialProof}
            </p>
          </div>

          {showActions && onJoin ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onJoin(quest.id);
              }}
              disabled={!isJoinable || isFull || isJoined || isJoining}
              className={`pointer-events-auto min-h-9 min-w-[5.7rem] rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                isJoined
                  ? "glass-chip border text-zinc-500"
                  : !isJoinable || isFull
                    ? "glass-chip border text-zinc-400"
                  : isJoining
                    ? "glass-chip border text-zinc-500"
                    : "bg-zinc-950 text-white hover:bg-zinc-800"
              }`}
            >
              {joinLabel({ isFull, isJoined, isJoinable, isJoining, quest })}
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      data-category={quest.category}
      onPointerMove={handleTiltPointerMove}
      onPointerLeave={handleTiltPointerLeave}
      style={tiltStyle}
      className={`event-card group relative overflow-hidden border border-zinc-200 bg-zinc-950 text-white shadow-[0_16px_44px_rgba(15,23,42,0.14)] ${cardShape}`}
    >
      <div className="absolute inset-0">
        {hasImage ? (
          <SafeImage
            src={quest.cardImageUrl!}
            alt=""
            fill
            sizes="448px"
            onError={() => setDidImageFail(true)}
            className="object-cover"
          />
        ) : (
          <QuestCategoryArtwork
            category={quest.category}
            className="h-full w-full"
          />
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
        {status ? (
          <span className="glass-overlay rounded-full border px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white">
            {status}
          </span>
        ) : null}
      </div>

      <div
        className={`glass-overlay event-card-deck pointer-events-none absolute z-20 ${overlayInset} ${overlayPadding} rounded-[1.15rem] border`}
      >
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className={`line-clamp-2 min-w-0 font-bold leading-[1.02] tracking-normal text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.80)] ${titleSize}`}
            >
              {quest.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-[0.78rem] font-semibold leading-5 text-white/82 [text-shadow:0_2px_9px_rgba(0,0,0,0.72)]">
              {context}
            </p>
            <p className="mt-1 truncate text-[0.78rem] font-bold leading-5 text-white/92 [text-shadow:0_2px_9px_rgba(0,0,0,0.72)]">
              {socialProof}
            </p>
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
                  ? "glass-action border text-zinc-950"
                  : !isJoinable || isFull
                    ? "bg-white/12 text-white/55 ring-1 ring-white/12"
                  : isJoining
                    ? "bg-white/24 text-white/72 ring-1 ring-white/12"
                      : "glass-action border text-zinc-950 hover:bg-white/90"
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

const tiltStyle = {
  transform:
    "perspective(900px) rotateX(var(--holo-rotate-x)) rotateY(var(--holo-rotate-y))",
  transition: "transform 180ms ease",
} satisfies CSSProperties;

function handleTiltPointerMove(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === "touch") {
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;

  event.currentTarget.style.setProperty(
    "--holo-rotate-x",
    `${(-y * 4).toFixed(2)}deg`,
  );
  event.currentTarget.style.setProperty(
    "--holo-rotate-y",
    `${(x * 5).toFixed(2)}deg`,
  );
}

function handleTiltPointerLeave(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty("--holo-rotate-x", "0deg");
  event.currentTarget.style.setProperty("--holo-rotate-y", "0deg");
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

  return isFull ? "Full" : "Join";
}
