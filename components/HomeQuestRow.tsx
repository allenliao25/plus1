import JoinButton from "@/components/JoinButton";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import { formatCapacitySummary } from "@/lib/questCapacity";
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
  const when = quest.startTimeRelative ?? quest.startTime;
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = formatCapacitySummary(quest);

  return (
    <article
      data-category={quest.category}
      className="event-card relative overflow-hidden rounded-card-sm border border-line bg-surface p-2.5 shadow-card"
    >
      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-300"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none relative z-20 grid grid-cols-[4.75rem_1fr_auto] items-center gap-3">
        <div className="holo-thumb relative aspect-square overflow-hidden rounded-2xl bg-ink">
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
          <h3 className="line-clamp-2 text-base font-bold leading-none tracking-normal text-ink">
            {quest.title}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-4 text-muted">
            {context}
          </p>
          <p className="mt-1 truncate text-xs font-bold leading-4 text-ink-soft">
            {socialProof}
          </p>
        </div>

        <div className="flex h-full flex-col items-end justify-end gap-2 py-0.5">
          <JoinButton
            quest={quest}
            isJoining={isJoining}
            onJoin={onJoin}
            variant="solid"
            size="compact"
          />
        </div>
      </div>
    </article>
  );
}
