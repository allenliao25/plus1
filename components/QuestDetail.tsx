import type { Quest } from "@/types/quest";
import QuestShareCard from "@/components/QuestShareCard";
import QuestStatusBadge from "@/components/QuestStatusBadge";

type QuestDetailProps = {
  isJoining?: boolean;
  isLeaving?: boolean;
  isClosing?: boolean;
  quest: Quest;
  onBack: () => void;
  onJoin: (questId: string) => void | Promise<void>;
  onLeave: (questId: string) => void | Promise<void>;
  onClose: (questId: string) => void | Promise<void>;
  onEdit: (quest: Quest) => void;
};

export default function QuestDetail({
  isJoining = false,
  isLeaving = false,
  isClosing = false,
  quest,
  onBack,
  onJoin,
  onLeave,
  onClose,
  onEdit,
}: QuestDetailProps) {
  const isJoinable = quest.status === "open";
  const isFull = isJoinable && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);
  const canLeave = isJoinable && Boolean(quest.joinedByCurrentUser) && !quest.createdByCurrentUser;
  const canClose = isJoinable && Boolean(quest.createdByCurrentUser);
  const canEdit = isJoinable && Boolean(quest.createdByCurrentUser);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
      >
        Back
      </button>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            {quest.category}
          </span>
          <QuestStatusBadge quest={quest} />
          <span className="text-sm font-medium text-zinc-500">
            {quest.startTime}
          </span>
          {quest.startTimeRelative ? (
            <span className="text-sm font-medium text-zinc-500">
              {quest.startTimeRelative}
            </span>
          ) : null}
        </div>

        <h2 className="mt-4 text-2xl font-semibold leading-tight text-zinc-950">
          {quest.title}
        </h2>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-50 p-3">
            <dt className="text-xs font-medium text-zinc-500">Location</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900">
              {quest.location}
            </dd>
          </div>
          <div className="rounded-2xl bg-zinc-50 p-3">
            <dt className="text-xs font-medium text-zinc-500">People</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900">
              {quest.goingCount} of {quest.maxPeople}
            </dd>
          </div>
          <div className="col-span-2 rounded-2xl bg-zinc-50 p-3">
            <dt className="text-xs font-medium text-zinc-500">Host</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900">
              {quest.creator}
            </dd>
          </div>
          <div className="col-span-2 rounded-2xl bg-zinc-50 p-3">
            <dt className="text-xs font-medium text-zinc-500">Who is going</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {quest.attendees.map((attendee) => (
                <span
                  key={attendee.id}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600">
                    {attendee.avatarInitials}
                  </span>
                  <span>{attendee.displayName}</span>
                  {attendee.isHost ? (
                    <span className="text-zinc-500">(host)</span>
                  ) : null}
                </span>
              ))}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-sm leading-6 text-zinc-600">
          {quest.description}
        </p>

        <button
          type="button"
          onClick={() => onJoin(quest.id)}
          disabled={!isJoinable || isFull || isJoined || isJoining}
          className={`mt-6 min-h-11 w-full rounded-2xl px-4 py-3.5 text-base font-semibold transition ${
            isJoined
              ? "bg-emerald-50 text-emerald-700"
              : !isJoinable
                ? "bg-zinc-100 text-zinc-500"
              : isJoining
                ? "bg-zinc-200 text-zinc-500"
              : isFull
                ? "bg-zinc-100 text-zinc-400"
                : "bg-zinc-950 text-white hover:bg-zinc-800"
          }`}
        >
          {isJoined
            ? "You are going"
            : !isJoinable
              ? quest.status === "closed"
                ? "Quest is closed"
                : "Quest has started"
            : isJoining
              ? "Joining..."
              : isFull
                ? "Quest is full"
                : "I'm down"}
        </button>

        {canEdit ? (
          <button
            type="button"
            onClick={() => onEdit(quest)}
            className="mt-3 min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Edit quest
          </button>
        ) : null}

        {canLeave ? (
          <button
            type="button"
            onClick={() => onLeave(quest.id)}
            disabled={isLeaving}
            className="mt-3 min-h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {isLeaving ? "Leaving..." : "Leave quest"}
          </button>
        ) : null}

        {canClose ? (
          <button
            type="button"
            onClick={() => onClose(quest.id)}
            disabled={isClosing}
            className="mt-3 min-h-11 w-full rounded-2xl bg-red-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
          >
            {isClosing ? "Closing..." : "Close quest"}
          </button>
        ) : null}
      </section>

      <QuestShareCard quest={quest} />
    </div>
  );
}
