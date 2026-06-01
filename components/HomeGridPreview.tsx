import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
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
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = `${quest.goingCount}/${quest.maxPeople} going · ${openSpots} open`;

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
            className="h-full w-full object-cover"
          />
        ) : (
          <QuestCategoryArtwork
            category={quest.category}
            className="h-full w-full"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.12)_36%,rgba(0,0,0,0.82))]" />
      </div>

      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="glass-overlay pointer-events-none absolute inset-x-2.5 bottom-2.5 z-20 rounded-[0.95rem] border p-2.5">
        <h3 className="line-clamp-2 text-[1.02rem] font-bold leading-[1.02] tracking-normal text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.68)]">
          {quest.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[0.67rem] font-semibold leading-4 text-white/78">
          {context}
        </p>
        <p className="mt-1 truncate text-[0.66rem] font-bold leading-4 text-white/88">
          {socialProof}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onJoin(quest.id);
            }}
            disabled={actionState.isDisabled}
            className={`pointer-events-auto ml-auto min-h-8 min-w-[5.35rem] rounded-full px-2.5 py-1 text-[0.68rem] font-bold transition active:scale-95 ${
              actionState.isPrimary
                ? "glass-action border text-zinc-950 hover:bg-white/90"
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
