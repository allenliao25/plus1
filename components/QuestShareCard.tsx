"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { buildPublicQuestShareUrl } from "@/lib/questLinks";
import {
  canCreatePublicSharePreview,
  createQuestShareLink,
} from "@/lib/questShareService";
import type { Quest } from "@/types/quest";

type QuestShareCardProps = {
  quest: Quest;
};

export default function QuestShareCard({ quest }: QuestShareCardProps) {
  const [shareState, setShareState] = useState<"idle" | "sharing" | "copied">(
    "idle",
  );
  const [shareError, setShareError] = useState("");

  async function handleShare() {
    setShareError("");

    if (
      quest.visibility !== "local" &&
      quest.createdByCurrentUser &&
      typeof window !== "undefined"
    ) {
      const shouldCreatePublicPreview = window.confirm(
        "Create a public preview link for this private event? Anyone with the link can see the event card and basics, but actions still require sign-in.",
      );

      if (!shouldCreatePublicPreview) {
        return;
      }
    }

    setShareState("sharing");

    try {
      const shareLink = await createQuestShareLink(quest.id);
      const shareUrl =
        typeof window === "undefined"
          ? buildPublicQuestShareUrl(shareLink.token)
          : buildPublicQuestShareUrl(shareLink.token, window.location.href);
      const shareText = `Join me for ${quest.title} on plus1.`;

      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: quest.title,
          text: shareText,
          url: shareUrl,
        });
        setShareState("idle");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
        return;
      }

      setShareError("Copy this event from a browser with clipboard support.");
      setShareState("idle");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not create a share link for this event.";
      setShareError(message);
      setShareState("idle");
    }
  }

  const canEnablePreview = canCreatePublicSharePreview(quest);
  const helperText =
    quest.visibility === "local"
      ? "Copies a public event link with a visual preview."
      : canEnablePreview
        ? "Creates a public preview link for this private event."
        : "Private preview links must be enabled by the host.";

  return (
    <div className="glass-panel space-y-2 rounded-[1.35rem] border p-2">
      <button
        type="button"
        onClick={handleShare}
        disabled={shareState === "sharing"}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
      >
        <Share2 size={16} strokeWidth={2.4} aria-hidden="true" />
        {shareState === "sharing"
          ? "Creating link..."
          : shareState === "copied"
            ? "Link copied"
            : "Share event"}
      </button>
      <p className="px-2 text-center text-xs font-semibold leading-5 text-zinc-500">
        {shareError || helperText}
      </p>
    </div>
  );
}
