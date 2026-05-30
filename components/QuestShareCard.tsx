"use client";

import { useState } from "react";
import { buildQuestShareUrl } from "@/lib/questLinks";
import type { Quest } from "@/types/quest";

type QuestShareCardProps = {
  quest: Quest;
};

function buildShareText(quest: Quest, shareUrl: string | null): string {
  const when = quest.startTimeRelative ?? quest.startTime;
  return [
    `${quest.title} — plus1`,
    `${quest.category} · ${quest.location}`,
    when ? `When: ${when}` : null,
    `Spots: ${quest.goingCount}/${quest.maxPeople} going`,
    quest.description,
    shareUrl,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function QuestShareCard({ quest }: QuestShareCardProps) {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const when = quest.startTimeRelative ?? quest.startTime;
  const shareUrl =
    typeof window === "undefined"
      ? null
      : buildQuestShareUrl(quest.id, window.location.href);

  async function handleShare() {
    const text = buildShareText(quest, shareUrl);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: quest.title,
          text,
          url: shareUrl ?? undefined,
        });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      }
    } catch {
      // User dismissed the share sheet or copy was blocked; no action needed.
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {quest.category}
          </span>
          <span className="text-sm font-medium text-white/70">plus1</span>
        </div>

        <h2 className="mt-6 text-2xl font-bold leading-tight">{quest.title}</h2>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="w-16 shrink-0 text-white/50">Where</dt>
            <dd className="font-medium">{quest.location}</dd>
          </div>
          {when ? (
            <div className="flex items-center gap-2">
              <dt className="w-16 shrink-0 text-white/50">When</dt>
              <dd className="font-medium">{when}</dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <dt className="w-16 shrink-0 text-white/50">Spots</dt>
            <dd className="font-medium">
              {quest.goingCount}/{quest.maxPeople} going
            </dd>
          </div>
        </dl>

        {quest.description ? (
          <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-white/80">
            {quest.description}
          </p>
        ) : null}

        <p className="mt-6 text-xs font-medium text-white/50">
          Hosted by {quest.creator} · Tap to join on plus1
        </p>
      </div>

      <button
        type="button"
        onClick={handleShare}
        className="min-h-11 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
      >
        {shareState === "copied" ? "Copied to clipboard" : "Share card"}
      </button>
    </div>
  );
}
