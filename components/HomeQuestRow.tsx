import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import type { Quest } from "@/types/quest";

type HomeQuestRowProps = {
  isJoining: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function HomeQuestRow({
  isJoining,
  quest,
  onJoin,
  onOpen,
}: HomeQuestRowProps) {
  const actionState = getActionState(quest, isJoining);
  const when = quest.startTimeRelative ?? quest.startTime;
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = `${quest.goingCount}/${quest.maxPeople} going · ${openSpots} open`;

  return (
    <article
      data-category={quest.category}
      className="event-card relative overflow-hidden rounded-[1.15rem] border border-zinc-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none relative z-20 grid grid-cols-[4.75rem_1fr_auto] items-center gap-3">
        <div className="holo-thumb relative aspect-square overflow-hidden rounded-[0.95rem] bg-zinc-950">
          {quest.cardImageUrl ? (
            <SafeImage
              src={quest.cardImageUrl}
              alt=""
              fill
              sizes="76px"
              className="object-cover"
            />
          ) : (
            <QuestCategoryArtwork
              category={quest.category}
              className="h-full w-full"
            />
          )}
        </div>

        <div className="min-w-0 py-0.5">
          <h3 className="line-clamp-2 text-[1.02rem] font-bold leading-[1.08] tracking-normal text-zinc-950">
            {quest.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[0.72rem] font-semibold leading-4 text-zinc-500">
            {context}
          </p>
          <p className="mt-1 truncate text-[0.72rem] font-bold leading-4 text-zinc-700">
            {socialProof}
          </p>
        </div>

        <div className="flex h-full flex-col items-end justify-end gap-2 py-0.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onJoin(quest.id);
            }}
            disabled={actionState.isDisabled}
            className={`pointer-events-auto min-h-9 min-w-[5.7rem] rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
              actionState.isPrimary
                ? "bg-zinc-950 text-white hover:bg-zinc-800"
                : "glass-chip border text-zinc-500"
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
    return { isDisabled: true, isPrimary: false, label: "You're in" };
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
    return { isDisabled: true, isPrimary: false, label: "Joining..." };
  }

  return { isDisabled: false, isPrimary: true, label: "Join" };
}
