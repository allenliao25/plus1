"use client";

import { useState } from "react";
import HolographicQuestCard from "@/components/HolographicQuestCard";
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
      <HolographicQuestCard
        quest={quest}
        variant="share"
        showActions={false}
      />

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
