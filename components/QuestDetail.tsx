import type { Quest } from "@/types/quest";

type QuestDetailProps = {
  isJoining?: boolean;
  quest: Quest;
  onBack: () => void;
  onJoin: (questId: string) => void | Promise<void>;
};

export default function QuestDetail({
  isJoining = false,
  quest,
  onBack,
  onJoin,
}: QuestDetailProps) {
  const isFull = quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
      >
        Back
      </button>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
            {quest.category}
          </span>
          <span className="text-sm font-medium text-zinc-500">
            {quest.startTime}
          </span>
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
        </dl>

        <p className="mt-5 text-sm leading-6 text-zinc-600">
          {quest.description}
        </p>

        <button
          type="button"
          onClick={() => onJoin(quest.id)}
          disabled={isFull || isJoined || isJoining}
          className={`mt-6 w-full rounded-2xl px-4 py-3.5 text-base font-semibold transition ${
            isJoined
              ? "bg-emerald-50 text-emerald-700"
              : isJoining
                ? "bg-zinc-200 text-zinc-500"
              : isFull
                ? "bg-zinc-100 text-zinc-400"
                : "bg-zinc-950 text-white hover:bg-zinc-800"
          }`}
        >
          {isJoined
            ? "You are going"
            : isJoining
              ? "Joining..."
              : isFull
                ? "Quest is full"
                : "I'm down"}
        </button>
      </section>
    </div>
  );
}
