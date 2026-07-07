import JoinButton from "@/components/JoinButton";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import { formatCapacitySummary } from "@/lib/questCapacity";
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
  const when = quest.startTimeRelative ?? quest.startTime;
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = formatCapacitySummary(quest);

  return (
    <article
      data-category={quest.category}
      className="event-card relative overflow-hidden rounded-hero border border-zinc-900 bg-[linear-gradient(135deg,#161617_0%,#26262b_48%,var(--holo-a)_170%)] p-3.5 text-white shadow-overlay"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(255,255,255,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_36%)]" />
      <button
        type="button"
        onClick={() => onOpen(quest.id)}
        className="absolute inset-0 z-10 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        aria-label={`Open details for ${quest.title}`}
      />

      <div className="pointer-events-none relative z-20 grid grid-cols-[6.35rem_1fr] gap-3.5">
        <div className="holo-thumb relative aspect-[4/5] overflow-hidden rounded-card-sm bg-zinc-900 shadow-modal">
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

        <div className="glass-overlay flex min-w-0 flex-col rounded-card-sm border p-3">
          <h3 className="line-clamp-2 text-xl font-bold leading-none tracking-normal text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.42)]">
            {quest.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white/80">
            {context}
          </p>
          <p className="mt-2 truncate text-sm font-bold leading-5 text-white/90">
            {socialProof}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <JoinButton
              quest={quest}
              isJoining={isJoining}
              onJoin={onJoin}
              variant="glass"
              size="immersive"
              className="ml-auto"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
