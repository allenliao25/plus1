"use client";

import { ArrowUpRight, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import {
  buildActivityLine,
  groupActivityEvents,
} from "@/lib/activityFeed";
import type { ActivityEvent, FriendConnection } from "@/types/quest";

type ActivityScreenProps = {
  actionProfileId: string | null;
  events: ActivityEvent[];
  incomingFriendRequests: FriendConnection[];
  onAcceptFriend: (friendshipId: string) => void | Promise<void>;
  onDeclineFriend: (friendshipId: string) => void | Promise<void>;
  onOpenProfile: (profileId: string) => void;
  onOpenQuest: (questId: string) => void;
  onBrowse: () => void;
};

export default function ActivityScreen({
  actionProfileId,
  events,
  incomingFriendRequests,
  onAcceptFriend,
  onDeclineFriend,
  onOpenProfile,
  onOpenQuest,
  onBrowse,
}: ActivityScreenProps) {
  const incomingFriendshipIds = useMemo(
    () =>
      new Set(
        incomingFriendRequests.map((request) => request.id),
      ),
    [incomingFriendRequests],
  );
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          !event.friendRequest?.friendshipId ||
          !incomingFriendshipIds.has(event.friendRequest.friendshipId),
      ),
    [events, incomingFriendshipIds],
  );
  const sections = useMemo(
    () => groupActivityEvents(visibleEvents),
    [visibleEvents],
  );

  return (
    <div className="space-y-6 pb-2">
      <p className="text-sm leading-6 text-muted">
        Updates from people and events you care about.
      </p>

      {incomingFriendRequests.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold tracking-normal text-ink">
            Friend requests
          </h2>
          <ul className="space-y-1">
            {incomingFriendRequests.map((request) => (
              <li
                key={request.id}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-3"
              >
                <button
                  type="button"
                  onClick={() => onOpenProfile(request.profile.id)}
                  className="contents text-left"
                >
                  <FriendAvatar request={request} />
                  <span className="min-w-0 self-center">
                    <span className="block text-md leading-5 text-ink">
                      <span className="font-extrabold text-ink">
                        @{request.profile.handle}
                      </span>{" "}
                      sent you a friend request
                    </span>
                  </span>
                </button>
                <div className="col-start-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={actionProfileId === request.profile.id}
                    onClick={() => onAcceptFriend(request.id)}
                    className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-3 text-sm font-extrabold text-white transition hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={actionProfileId === request.profile.id}
                    onClick={() => onDeclineFriend(request.id)}
                    className="glass-chip inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-extrabold text-ink-soft transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X size={16} strokeWidth={2.4} aria-hidden="true" />
                    Ignore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {visibleEvents.length === 0 && incomingFriendRequests.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="When people join, invite you, or update events, you'll see it here."
          actionLabel="Browse events"
          onAction={onBrowse}
        />
      ) : (
        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-extrabold tracking-normal text-ink">
                {section.title}
              </h2>
              <ul className="space-y-1">
                {section.events.map((event) => (
                  <ActivityRow
                    key={event.id}
                    event={event}
                    isResponding={
                      Boolean(event.actorId) && event.actorId === actionProfileId
                    }
                    onOpenQuest={onOpenQuest}
                    onRespondToFriendRequest={(friendshipId, status) =>
                      status === "accepted"
                        ? onAcceptFriend(friendshipId)
                        : onDeclineFriend(friendshipId)
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  event,
  isResponding,
  onOpenQuest,
  onRespondToFriendRequest,
}: {
  event: ActivityEvent;
  isResponding: boolean;
  onOpenQuest: (questId: string) => void;
  onRespondToFriendRequest?: (
    friendshipId: string,
    status: "accepted" | "declined",
  ) => void | Promise<void>;
}) {
  const line = buildActivityLine(event);
  const canOpenQuest = Boolean(event.questId);
  const hasPendingFriendRequest =
    event.type === "friend_request" &&
    event.friendRequest?.status === "pending" &&
    Boolean(onRespondToFriendRequest);
  const rowContent = (
    <>
      <div className="relative shrink-0">
        <ActivityAvatar event={event} />
        {!event.isRead ? (
          <span className="absolute -right-0.5 top-0 size-2.5 rounded-full border-2 border-white bg-rose-500" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 self-center">
        <p className="text-md leading-5 text-ink">
          {line.actorHandle ? (
            <span className="font-extrabold text-ink">
              {line.actorHandle}
            </span>
          ) : null}
          {line.actorHandle ? " " : null}
          <span>{line.action}</span>
          {event.createdAtRelative ? (
            <span className="ml-1 font-semibold text-faint">
              {event.createdAtRelative}
            </span>
          ) : null}
        </p>
        {line.detail ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
            {line.detail}
          </p>
        ) : null}
      </div>
    </>
  );

  if (hasPendingFriendRequest && event.friendRequest) {
    return (
      <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-3">
        {rowContent}
        <div className="col-start-2 flex items-center gap-2">
          <button
            type="button"
            disabled={isResponding}
            onClick={() =>
              void onRespondToFriendRequest?.(
                event.friendRequest!.friendshipId,
                "accepted",
              )
            }
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-ink px-3 text-sm font-extrabold text-white transition hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} strokeWidth={2.4} aria-hidden="true" />
            Accept
          </button>
          <button
            type="button"
            disabled={isResponding}
            onClick={() =>
              void onRespondToFriendRequest?.(
                event.friendRequest!.friendshipId,
                "declined",
              )
            }
            className="glass-chip inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-extrabold text-ink-soft transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
            Ignore
          </button>
        </div>
      </li>
    );
  }

  if (canOpenQuest) {
    return (
      <li>
        <button
          type="button"
          onClick={() => event.questId && onOpenQuest(event.questId)}
          className="grid w-full grid-cols-[3.5rem_minmax(0,1fr)_4.25rem] items-center gap-3 py-3 text-left transition hover:opacity-85"
        >
          {rowContent}
          <EventPreview event={event} />
        </button>
      </li>
    );
  }

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-3">
      {rowContent}
    </li>
  );
}

function ActivityAvatar({ event }: { event: ActivityEvent }) {
  const [didImageFail, setDidImageFail] = useState(false);
  const actor = event.actor;
  const initials = actor?.avatarInitials.trim().slice(0, 2).toUpperCase() || "+1";

  if (actor?.avatarUrl && !didImageFail) {
    return (
      <span className="glass-chip block size-12 overflow-hidden rounded-full border bg-surface-2">
        <SafeImage
          src={actor.avatarUrl}
          alt=""
          width={48}
          height={48}
          onError={() => setDidImageFail(true)}
          className="block h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className="grid size-12 place-items-center rounded-full bg-ink text-sm font-extrabold text-white shadow-sm">
      {initials}
    </span>
  );
}

function FriendAvatar({ request }: { request: FriendConnection }) {
  if (request.profile.avatarUrl) {
    return (
      <SafeImage
        src={request.profile.avatarUrl}
        alt=""
        width={48}
        height={48}
        className="size-12 shrink-0 rounded-full object-cover ring-1 ring-line"
      />
    );
  }

  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-white">
      {request.profile.avatarInitials}
    </span>
  );
}

function EventPreview({ event }: { event: ActivityEvent }) {
  const [didImageFail, setDidImageFail] = useState(false);

  if (event.quest?.cardImageUrl && !didImageFail) {
    return (
      <span className="relative block size-16 overflow-hidden rounded-2xl bg-surface-2 shadow-sm ring-1 ring-line">
        <SafeImage
          src={event.quest.cardImageUrl}
          alt=""
          width={64}
          height={64}
          onError={() => setDidImageFail(true)}
          className="block h-full w-full object-cover"
        />
        <PreviewBadge />
      </span>
    );
  }

  if (event.quest) {
    return (
      <span className="relative block size-16 overflow-hidden rounded-2xl bg-surface-2 shadow-sm ring-1 ring-line">
        <QuestCategoryArtwork
          category={event.quest.category}
          className="h-full w-full"
        />
        <PreviewBadge />
      </span>
    );
  }

  return (
    <span className="glass-chip inline-flex h-10 items-center justify-center gap-1 rounded-full border px-2 text-xs font-extrabold text-ink-soft">
      View
      <ArrowUpRight size={13} strokeWidth={2.4} aria-hidden="true" />
    </span>
  );
}

function PreviewBadge() {
  return (
    <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-white/90 text-ink shadow-sm">
      <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden="true" />
    </span>
  );
}
