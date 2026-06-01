import type { Quest } from "@/types/quest";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import QuestShareCard from "@/components/QuestShareCard";
import QuestStatusBadge from "@/components/QuestStatusBadge";
import { MessageCircle } from "lucide-react";

type QuestDetailProps = {
  isJoining?: boolean;
  isLeaving?: boolean;
  isClosing?: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onLeave: (questId: string) => void | Promise<void>;
  onClose: (questId: string) => void | Promise<void>;
  onEdit: (quest: Quest) => void;
  onOpenChat?: (questId: string) => void | Promise<void>;
  onOpenProfile?: (profileId: string) => void;
};

export default function QuestDetail({
  isJoining = false,
  isLeaving = false,
  isClosing = false,
  quest,
  onJoin,
  onLeave,
  onClose,
  onEdit,
  onOpenChat,
  onOpenProfile,
}: QuestDetailProps) {
  const isJoinable = quest.status === "open";
  const isFull = isJoinable && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);
  const canLeave = isJoinable && Boolean(quest.joinedByCurrentUser) && !quest.createdByCurrentUser;
  const canClose = isJoinable && Boolean(quest.createdByCurrentUser);
  const canEdit = isJoinable && Boolean(quest.createdByCurrentUser);
  const canChat = isJoinable && isJoined && Boolean(onOpenChat);

  return (
    <div className="space-y-5">
      <section className="glass-panel rounded-3xl border p-5">
        <div
          data-category={quest.category}
          className="holo-thumb relative mb-5 aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-zinc-100"
        >
          {quest.cardImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={quest.cardImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <QuestCategoryArtwork
              category={quest.category}
              className="absolute inset-0 h-full w-full"
            />
          )}
          <div className="absolute inset-0 bg-black/14" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),transparent_30%,rgba(0,0,0,0.78))]" />
          <span className="glass-overlay absolute bottom-3 left-3 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.7)]">
            {quest.category}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-chip rounded-full border px-3 py-1 text-xs font-bold text-zinc-700">
            {quest.category}
          </span>
          <QuestStatusBadge quest={quest} />
          <span className="glass-chip rounded-full border px-3 py-1 text-xs font-bold text-zinc-700">
            {visibilityLabel(quest.visibility)}
          </span>
          <span className="text-sm font-semibold text-zinc-500">
            {quest.startTime}
          </span>
          {quest.startTimeRelative ? (
            <span className="text-sm font-semibold text-zinc-500">
              {quest.startTimeRelative}
            </span>
          ) : null}
        </div>

        <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-zinc-950">
          {quest.title}
        </h2>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="glass-chip rounded-2xl border p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Location</dt>
            <dd className="mt-1 text-sm font-bold text-zinc-900">
              {quest.location}
            </dd>
          </div>
          <div className="glass-chip rounded-2xl border p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">People</dt>
            <dd className="mt-1 text-sm font-bold text-zinc-900">
              {quest.goingCount} of {quest.maxPeople}
            </dd>
          </div>
          <div className="glass-chip col-span-2 rounded-2xl border p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Host</dt>
            <dd className="mt-1 text-sm font-bold text-zinc-900">
              {quest.creatorId && onOpenProfile ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile(quest.creatorId!)}
                  className="text-left underline decoration-zinc-300 underline-offset-4"
                >
                  {quest.creator}
                </button>
              ) : (
                quest.creator
              )}
            </dd>
          </div>
          <div className="glass-chip col-span-2 rounded-2xl border p-3">
            <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Who is going</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {quest.attendees.map((attendee) => (
                <button
                  key={attendee.id}
                  type="button"
                  onClick={() => onOpenProfile?.(attendee.id)}
                  className="glass-chip inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-left text-xs font-bold text-zinc-700"
                >
                  {attendee.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={attendee.avatarUrl}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600">
                      {attendee.avatarInitials}
                    </span>
                  )}
                  <span>{attendee.displayName}</span>
                  {attendee.isHost ? (
                    <span className="text-zinc-500">(host)</span>
                  ) : null}
                </button>
              ))}
            </dd>
          </div>
        </dl>

        {quest.createdByCurrentUser && quest.invitedProfiles?.length ? (
          <div className="glass-chip mt-3 rounded-2xl border p-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">
              Invited
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {quest.invitedProfiles.map((profile) => (
                <span
                  key={profile.id}
                  className="glass-chip rounded-full border px-2.5 py-1 text-xs font-bold text-zinc-700"
                >
                  @{profile.handle}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-5 text-sm leading-6 text-zinc-600">
          {quest.description}
        </p>

        <div className="glass-action mt-6 space-y-2 rounded-[1.35rem] border p-2">
          <button
            type="button"
            onClick={() => onJoin(quest.id)}
            disabled={!isJoinable || isFull || isJoined || isJoining}
            className={`min-h-12 w-full rounded-full px-5 py-3 text-sm font-bold transition ${
              isJoined
                ? "bg-zinc-950 text-white"
                : !isJoinable
                  ? "bg-white/64 text-zinc-500"
                : isJoining
                  ? "bg-white/74 text-zinc-500"
                : isFull
                  ? "bg-white/64 text-zinc-400"
                  : "bg-zinc-950 text-white hover:bg-zinc-800"
            }`}
          >
            {isJoined
              ? "You're in"
              : !isJoinable
                ? quest.status === "closed"
                  ? "Closed"
                  : "Past"
              : isJoining
                ? "Joining..."
              : isFull
                  ? "Full"
                  : "Join"}
          </button>

          {canChat ? (
            <button
              type="button"
              onClick={() => onOpenChat?.(quest.id)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-300/80 bg-white/72 px-5 py-2.5 text-sm font-bold text-zinc-900 transition hover:bg-white"
            >
              <MessageCircle size={17} strokeWidth={2.2} aria-hidden="true" />
              Chat
            </button>
          ) : null}

          {canEdit || canLeave || canClose ? (
            <div className="grid gap-2">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(quest)}
                  className="min-h-11 w-full rounded-full border border-zinc-300/80 bg-white/68 px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-white"
                >
                  Edit event
                </button>
              ) : null}

              {canLeave ? (
                <button
                  type="button"
                  onClick={() => onLeave(quest.id)}
                  disabled={isLeaving}
                  className="min-h-11 w-full rounded-full border border-zinc-300/80 bg-white/68 px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-white disabled:opacity-50"
                >
                  {isLeaving ? "Leaving..." : "Leave event"}
                </button>
              ) : null}

              {canClose ? (
                <button
                  type="button"
                  onClick={() => onClose(quest.id)}
                  disabled={isClosing}
                  className="min-h-11 w-full rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {isClosing ? "Closing..." : "Close event"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <QuestShareCard quest={quest} />
    </div>
  );
}

function visibilityLabel(visibility: Quest["visibility"]) {
  if (visibility === "invite_only") {
    return "Invite-only";
  }

  if (visibility === "friends") {
    return "Friends";
  }

  return "Local";
}
