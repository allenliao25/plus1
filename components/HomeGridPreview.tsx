import { CalendarDays, MapPin, Users } from "lucide-react";
import type { Quest } from "@/types/quest";

type HomeGridPreviewProps = {
  joiningQuestId: string | null;
  quests: Quest[];
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function HomeGridPreview({
  joiningQuestId,
  quests,
  onJoin,
  onOpen,
}: HomeGridPreviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {quests.map((quest, index) => (
        <HomeGridTile
          key={quest.id}
          isJoining={joiningQuestId === quest.id}
          isTall={index % 3 !== 1}
          quest={quest}
          onJoin={onJoin}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function HomeGridTile({
  isJoining,
  isTall,
  quest,
  onJoin,
  onOpen,
}: {
  isJoining: boolean;
  isTall: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
}) {
  const actionState = getActionState(quest, isJoining);
  const when = quest.startTimeRelative ?? quest.startTime;

  return (
    <article
      data-category={quest.category}
      className={`event-card group relative overflow-hidden rounded-[1.15rem] bg-zinc-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.12)] ${
        isTall ? "aspect-[3/4]" : "aspect-[4/5]"
      }`}
    >
      <div className="absolute inset-0">
        {quest.cardImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={quest.cardImageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.018]"
          />
        ) : (
          <div className="holo-card-fallback h-full w-full" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.12)_36%,rgba(0,0,0,0.82))]" />
      </div>

      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-20 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate rounded-full border border-white/16 bg-black/28 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-md">
          {quest.matchesCurrentUserInterests ? "For you" : quest.category}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-20 rounded-[0.95rem] border border-white/12 bg-black/36 p-2.5 backdrop-blur-xl">
        <h3 className="line-clamp-2 text-[1.02rem] font-bold leading-[1.02] tracking-normal text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.68)]">
          {quest.title}
        </h3>
        <dl className="mt-2 grid gap-1 text-[0.67rem] font-bold leading-4 text-white/82">
          <div className="flex min-w-0 items-center gap-1.5">
            <dt className="sr-only">When</dt>
            <CalendarDays
              className="shrink-0 text-white/62"
              size={12}
              strokeWidth={2}
              aria-hidden="true"
            />
            <dd className="min-w-0 truncate">{when}</dd>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <dt className="sr-only">Where</dt>
            <MapPin
              className="shrink-0 text-white/62"
              size={12}
              strokeWidth={2}
              aria-hidden="true"
            />
            <dd className="min-w-0 truncate">{quest.location}</dd>
          </div>
        </dl>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[0.66rem] font-bold text-white/72">
            <Users size={12} strokeWidth={2} aria-hidden="true" />
            {quest.goingCount}/{quest.maxPeople}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onJoin(quest.id);
            }}
            disabled={actionState.isDisabled}
            className={`pointer-events-auto min-h-8 min-w-[3.85rem] rounded-full px-2.5 py-1 text-[0.68rem] font-bold transition active:scale-95 ${
              actionState.isPrimary
                ? "bg-white text-zinc-950 hover:bg-white/90"
                : "bg-white/12 text-white/52 ring-1 ring-white/12"
            }`}
          >
            {actionState.label}
          </button>
        </div>
      </div>
    </article>
  );
}

function getActionState(quest: Quest, isJoining: boolean) {
  const isFull = quest.status === "open" && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);

  if (isJoined) {
    return { isDisabled: true, isPrimary: false, label: "In" };
  }

  if (quest.status !== "open") {
    return {
      isDisabled: true,
      isPrimary: false,
      label: quest.status === "closed" ? "Closed" : "Past",
    };
  }

  if (isFull) {
    return { isDisabled: true, isPrimary: false, label: "Full" };
  }

  if (isJoining) {
    return { isDisabled: true, isPrimary: false, label: "..." };
  }

  return { isDisabled: false, isPrimary: true, label: "Join" };
}
