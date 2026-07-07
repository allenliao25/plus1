"use client";

import type { MouseEvent } from "react";
import { isLocalDemoQuestId } from "@/data/localDemoQuests";
import { isQuestFull } from "@/lib/questCapacity";
import type { Quest } from "@/types/quest";

type QuestActionState = {
  label: string;
  isDisabled: boolean;
  isPrimary: boolean;
};

export function getQuestActionState(
  quest: Quest,
  isJoining: boolean,
): QuestActionState {
  const isFull = isQuestFull(quest);
  const isJoined = Boolean(
    quest.joinedByCurrentUser || quest.createdByCurrentUser,
  );

  if (isJoined) {
    return { label: "You're in", isDisabled: true, isPrimary: false };
  }

  if (quest.status !== "open") {
    return {
      label: quest.status === "closed" ? "Closed" : "Past",
      isDisabled: true,
      isPrimary: false,
    };
  }

  if (isFull) {
    return { label: "Full", isDisabled: true, isPrimary: false };
  }

  if (isJoining) {
    return { label: "Joining...", isDisabled: true, isPrimary: false };
  }

  return { label: "Join", isDisabled: false, isPrimary: true };
}

// A joined/hosted attendee sees a "Chat" shortcut only when the event is still
// open and a chat handler is wired through; otherwise it stays "You're in".
// Local demo quests have no real chat thread, so they never get the shortcut.
export function shouldShowChatAffordance(
  quest: Quest,
  hasOnOpenChat: boolean,
): boolean {
  const isJoined = Boolean(
    quest.joinedByCurrentUser || quest.createdByCurrentUser,
  );

  return (
    isJoined &&
    hasOnOpenChat &&
    quest.status === "open" &&
    !isLocalDemoQuestId(quest.id)
  );
}

type JoinButtonProps = {
  quest: Quest;
  isJoining: boolean;
  onJoin: (questId: string) => void | Promise<void>;
  onOpenChat?: (questId: string) => void;
  variant: "solid" | "glass";
  size?: "compact" | "immersive";
  className?: string;
};

export default function JoinButton({
  quest,
  isJoining,
  onJoin,
  onOpenChat,
  variant,
  size = "compact",
  className = "",
}: JoinButtonProps) {
  const showChat = shouldShowChatAffordance(quest, Boolean(onOpenChat));
  const { label, isDisabled, isPrimary } = showChat
    ? { label: "Chat", isDisabled: false, isPrimary: true }
    : getQuestActionState(quest, isJoining);

  const sizeClasses =
    size === "immersive"
      ? "min-h-10 min-w-28 px-3.5 py-2 text-sm"
      : "min-h-9 min-w-24 px-3 py-1.5 text-xs";

  const variantClasses =
    variant === "glass"
      ? isPrimary
        ? "glass-action border text-ink hover:bg-white/90"
        : "bg-white/10 text-white/60 ring-1 ring-white/10"
      : isPrimary
        ? "bg-ink text-white hover:bg-ink-hover"
        : "glass-chip border text-muted";

  return (
    <button
      type="button"
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (showChat) {
          onOpenChat?.(quest.id);
          return;
        }
        onJoin(quest.id);
      }}
      disabled={isDisabled}
      className={`pointer-events-auto shrink-0 rounded-full font-bold pressable ${sizeClasses} ${variantClasses} ${className}`}
    >
      {label}
    </button>
  );
}
