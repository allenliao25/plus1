"use client";

import { useState, type CSSProperties, type PointerEvent } from "react";
import JoinButton from "@/components/JoinButton";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import {
  formatCapacitySummary,
  isQuestFull,
} from "@/lib/questCapacity";
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
  const isFull = isQuestFull(quest);
  const isImmersive = variant === "immersive";
  const isShare = variant === "share";
  const isCompact = !isImmersive && !isShare;
  const status = statusLabel(quest, isFull);
  const when = quest.startTimeRelative ?? quest.startTime;
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = formatCapacitySummary(quest);
  const [didImageFail, setDidImageFail] = useState(false);
  const hasImage = Boolean(quest.cardImageUrl && !didImageFail);
  const cardShape = isImmersive || isShare
    ? "aspect-[4/5] rounded-hero"
    : "aspect-[5/4] rounded-card";
  const overlayInset = isImmersive || isShare ? "inset-x-3.5 bottom-3.5" : "inset-x-3 bottom-3";
  const overlayPadding = isImmersive || isShare ? "p-3.5" : "p-3";
  const titleSize = isImmersive || isShare ? "text-2xl" : "text-xl";

  if (isCompact) {
    return (
      <article
        data-category={quest.category}
        className="event-card relative overflow-hidden rounded-card-sm border border-line bg-surface p-2.5 shadow-card"
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
          <div className="holo-thumb relative aspect-square overflow-hidden rounded-2xl bg-ink">
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
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-extrabold uppercase tracking-caps text-muted">
                  {status}
                </span>
              ) : null}
            </div>
            <h3 className="mt-0.5 line-clamp-2 text-base font-bold leading-none tracking-normal text-ink">
              {quest.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-4 text-muted">
              {context}
            </p>
            <p className="mt-1 truncate text-xs font-bold leading-4 text-ink-soft">
              {socialProof}
            </p>
          </div>

          {showActions && onJoin ? (
            <JoinButton
              quest={quest}
              isJoining={isJoining}
              onJoin={onJoin}
              variant="solid"
              size="compact"
            />
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
      className={`event-card group relative overflow-hidden border border-line bg-ink text-white shadow-overlay ${cardShape}`}
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
          <span className="glass-overlay rounded-full border px-2.5 py-1 text-2xs font-bold uppercase tracking-caps text-white">
            {status}
          </span>
        ) : null}
      </div>

      <div
        className={`glass-overlay event-card-deck pointer-events-none absolute z-20 ${overlayInset} ${overlayPadding} rounded-card-sm border`}
      >
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className={`line-clamp-2 min-w-0 font-bold leading-none tracking-normal text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.80)] ${titleSize}`}
            >
              {quest.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/80 [text-shadow:0_2px_9px_rgba(0,0,0,0.72)]">
              {context}
            </p>
            <p className="mt-1 truncate text-sm font-bold leading-5 text-white/90 [text-shadow:0_2px_9px_rgba(0,0,0,0.72)]">
              {socialProof}
            </p>
          </div>

          {showActions && onJoin ? (
            <JoinButton
              quest={quest}
              isJoining={isJoining}
              onJoin={onJoin}
              variant="glass"
              size="immersive"
            />
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
