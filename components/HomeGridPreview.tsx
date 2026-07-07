import {
  getQuestActionState,
  shouldShowChatAffordance,
} from "@/components/JoinButton";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import { formatCapacitySummary } from "@/lib/questCapacity";
import type { Quest } from "@/types/quest";

type HomeGridPreviewProps = {
  joiningQuestId: string | null;
  quests: Quest[];
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onOpenChat?: (questId: string) => void;
};

export default function HomeGridPreview({
  joiningQuestId,
  quests,
  onJoin,
  onOpen,
  onOpenChat,
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
          onOpenChat={onOpenChat}
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
  onOpenChat,
}: {
  isJoining: boolean;
  isTall: boolean;
  quest: Quest;
  onJoin: (questId: string) => void | Promise<void>;
  onOpen: (questId: string) => void;
  onOpenChat?: (questId: string) => void;
}) {
  const showChat = shouldShowChatAffordance(quest, Boolean(onOpenChat));
  const actionState = showChat
    ? { label: "Chat", isDisabled: false, isPrimary: true }
    : getQuestActionState(quest, isJoining);
  const when = quest.startTimeRelative ?? quest.startTime;
  const context = `Hosted by ${quest.creator} · ${quest.location} · ${when}`;
  const socialProof = formatCapacitySummary(quest);

  return (
    <article
      data-category={quest.category}
      className={`event-card group relative overflow-hidden rounded-card-sm bg-ink text-white shadow-raised ${
        isTall ? "aspect-[3/4]" : "aspect-[4/5]"
      }`}
    >
      <div className="absolute inset-0">
        {quest.cardImageUrl ? (
          <SafeImage
            src={quest.cardImageUrl}
            alt=""
            fill
            sizes="220px"
            className="object-cover"
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

      <div className="glass-overlay pointer-events-none absolute inset-x-2.5 bottom-2.5 z-20 rounded-2xl border p-2.5">
        <h3 className="line-clamp-2 text-base font-bold leading-none tracking-normal text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.68)]">
          {quest.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-4 text-white/80">
          {context}
        </p>
        <p className="mt-1 truncate text-xs font-bold leading-4 text-white/90">
          {socialProof}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (showChat) {
                onOpenChat?.(quest.id);
                return;
              }
              onJoin(quest.id);
            }}
            disabled={actionState.isDisabled}
            className={`pointer-events-auto ml-auto min-h-8 min-w-[5.35rem] rounded-full px-2.5 py-1 text-xs font-bold pressable ${
              actionState.isPrimary
                ? "glass-action border text-ink hover:bg-white/90"
                : "bg-white/10 text-white/50 ring-1 ring-white/10"
            }`}
          >
            {actionState.label}
          </button>
        </div>
      </div>
    </article>
  );
}
