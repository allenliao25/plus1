import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import type { Quest } from "@/types/quest";

type HomeSpotlightCardProps = {
  isJoining: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
};

export default function HomeSpotlightCard({
  isJoining,
  quest,
  onJoin,
  onOpen,
}: HomeSpotlightCardProps) {
  const actionState = getActionState(quest, isJoining);
  const when = quest.startTimeRelative ?? quest.startTime;
  const openSpots = Math.max(0, quest.maxPeople - quest.goingCount);
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = `${quest.goingCount}/${quest.maxPeople} going · ${openSpots} open`;

  return (
    <article
      data-category={quest.category}
      className="event-card relative overflow-hidden rounded-[1.65rem] border border-zinc-900 bg-[linear-gradient(135deg,#161617_0%,#26262b_48%,var(--holo-a)_170%)] p-3.5 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_36%)]" />
      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none relative z-20 grid grid-cols-[6.35rem_1fr] gap-3.5">
        <div className="holo-thumb relative aspect-[4/5] overflow-hidden rounded-[1.2rem] bg-zinc-900 shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
          {quest.cardImageUrl ? (
            <SafeImage
              src={quest.cardImageUrl}
              alt=""
              fill
              sizes="104px"
              className="object-cover"
            />
          ) : (
            <QuestCategoryArtwork
              category={quest.category}
              className="h-full w-full"
            />
          )}
        </div>

        <div className="glass-overlay flex min-w-0 flex-col rounded-[1.2rem] border p-3">
          <h3 className="line-clamp-2 text-[1.35rem] font-bold leading-[1.02] tracking-normal text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.42)]">
            {quest.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/76">
            {context}
          </p>
          <p className="mt-2 truncate text-[0.78rem] font-bold leading-5 text-white/86">
            {socialProof}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onJoin(quest.id);
              }}
              disabled={actionState.isDisabled}
              className={`pointer-events-auto ml-auto min-h-10 min-w-[6.4rem] rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                actionState.isPrimary
                  ? "glass-action border text-zinc-950 hover:bg-white/90"
                  : "bg-white/12 text-white/58 ring-1 ring-white/12"
              }`}
            >
              {actionState.label}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function getActionState(quest: Quest, isJoining: boolean) {
  const isFull = quest.status === "open" && quest.goingCount >= quest.maxPeople;
  const isJoined = Boolean(quest.joinedByCurrentUser || quest.createdByCurrentUser);
  const isJoinable = quest.status === "open" && !isFull && !isJoined;

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

  return { isDisabled: !isJoinable, isPrimary: true, label: "Join" };
}
