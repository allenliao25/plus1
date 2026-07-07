"use client";

import {
  CalendarDays,
  Eye,
  MapPin,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  getQuestActionState,
  shouldShowChatAffordance,
} from "@/components/JoinButton";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import {
  formatGoingLabel,
  formatOpenSpotsLabel,
} from "@/lib/questCapacity";
import type { Quest, QuestAttendee } from "@/types/quest";

type EventDiscoveryCardProps = {
  isJoining: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onOpenChat?: (questId: string) => void;
};

export default function EventDiscoveryCard({
  isJoining,
  onJoin,
  onOpen,
  onOpenChat,
  quest,
}: EventDiscoveryCardProps) {
  const [didImageFail, setDidImageFail] = useState(false);
  const host = findHost(quest);
  const hasImage = Boolean(quest.cardImageUrl && !didImageFail);
  const when = quest.startTimeRelative ?? quest.startTime;
  const showChat = shouldShowChatAffordance(
    quest,
    Boolean(onOpenChat),
    isJoining,
  );
  const actionState = showChat
    ? { label: "Chat", isDisabled: false, isPrimary: true }
    : getQuestActionState(quest, isJoining);
  const reason = getReasonLabel(quest);

  return (
    <article
      data-category={quest.category}
      className="event-card group relative h-[calc(100svh-15rem)] min-h-[28rem] max-h-[39rem] snap-center overflow-hidden rounded-hero border border-white/70 bg-ink text-white shadow-modal"
    >
      <div className="absolute inset-0">
        {hasImage ? (
          <SafeImage
            src={quest.cardImageUrl!}
            alt=""
            fill
            sizes="480px"
            onError={() => setDidImageFail(true)}
            className="object-cover transition duration-700 group-hover:scale-[1.025]"
          />
        ) : (
          <QuestCategoryArtwork
            category={quest.category}
            className="h-full w-full scale-110"
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_12%,rgba(255,255,255,0.20),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.10)_36%,rgba(0,0,0,0.88))]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.58))]" />
      </div>

      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/75"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-3">
        <div className="glass-overlay max-w-[72%] rounded-full border px-3 py-2">
          <p className="flex items-center gap-1.5 truncate text-xs font-extrabold uppercase tracking-caps text-white">
            <Sparkles size={13} strokeWidth={2.4} aria-hidden="true" />
            {reason}
          </p>
        </div>

        <div className="glass-overlay rounded-full border px-3 py-2">
          <p className="text-xs font-extrabold uppercase tracking-caps text-white">
            {quest.category}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(quest.id);
          }}
          className="pointer-events-auto grid size-12 place-items-center rounded-full border border-white/20 bg-black/20 text-white shadow-modal backdrop-blur-xl pressable"
          aria-label={`View details for ${quest.title}`}
        >
          <Eye size={20} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-3.5 bottom-3.5 z-20">
        <div className="glass-overlay event-card-deck rounded-card border p-4">
          <div className="flex items-center gap-2">
            <HostAvatar host={host} quest={quest} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {quest.creator}
              </p>
              <p className="text-xs font-semibold text-white/70">Host</p>
            </div>
          </div>

          <h2 className="mt-4 line-clamp-2 text-3xl font-black leading-none tracking-normal text-white [text-shadow:0_4px_18px_rgba(0,0,0,0.74)]">
            {quest.title}
          </h2>

          <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-white/80">
            {quest.description}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Fact icon={<CalendarDays size={16} />} label={when} />
            <Fact icon={<MapPin size={16} />} label={quest.location} />
            <Fact icon={<Users size={16} />} label={formatGoingLabel(quest)} />
            <Fact icon={<Ticket size={16} />} label={formatOpenSpotsLabel(quest)} />
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (showChat) {
                onOpenChat?.(quest.id);
                return;
              }
              onJoin(quest.id);
            }}
            disabled={actionState.isDisabled}
            className={`pointer-events-auto mt-4 min-h-12 w-full rounded-full px-5 py-3 text-md font-black pressable ${
              actionState.isPrimary
                ? "glass-action border text-ink hover:bg-white/90"
                : "border border-white/10 bg-white/10 text-white/60"
            }`}
          >
            {actionState.label}
          </button>
        </div>
      </div>
    </article>
  );
}

function Fact({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-h-10 min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
      <span className="shrink-0 text-white/80">{icon}</span>
      <span className="truncate text-xs font-bold text-white/90">{label}</span>
    </div>
  );
}

function HostAvatar({
  host,
  quest,
}: {
  host: QuestAttendee | null;
  quest: Quest;
}) {
  if (host?.avatarUrl) {
    return (
      <SafeImage
        src={host.avatarUrl}
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-full border border-white/50 object-cover"
      />
    );
  }

  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-full border border-white/40 bg-white/20 text-sm font-black text-white shadow-inner">
      {host?.avatarInitials ?? getInitials(quest.creator)}
    </div>
  );
}

function findHost(quest: Quest) {
  return quest.attendees.find((attendee) => attendee.isHost) ?? null;
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "P1";
}

function getReasonLabel(quest: Quest) {
  if (quest.matchesCurrentUserInterests) {
    return `Matches ${quest.category}`;
  }

  if (quest.visibility === "friends") {
    return "Friend circle";
  }

  return "Public nearby";
}

