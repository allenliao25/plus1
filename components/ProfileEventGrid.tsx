import { useState } from "react";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import type { PeopleSearchResult, Profile, Quest } from "@/types/quest";

type ProfileIdentity = Pick<
  Profile | PeopleSearchResult,
  "avatarInitials" | "avatarUrl"
>;

type ProfileAvatarProps = {
  profile: ProfileIdentity;
};

type ProfileStatProps = {
  label: string;
  onClick?: () => void;
  value: number;
};

type ProfileEventGridProps = {
  emptyBody: string;
  emptyTitle: string;
  quests: Quest[];
  onOpen: (questId: string) => void;
};

export function ProfileAvatar({ profile }: ProfileAvatarProps) {
  const [didImageFail, setDidImageFail] = useState(false);

  if (profile.avatarUrl && !didImageFail) {
    return (
      <span className="block aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-100 shadow-sm ring-1 ring-zinc-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.avatarUrl}
          alt=""
          onError={() => setDidImageFail(true)}
          className="block h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span className="grid aspect-square h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-950 text-2xl font-bold text-white shadow-sm">
      {profile.avatarInitials}
    </span>
  );
}

export function ProfileStat({ label, onClick, value }: ProfileStatProps) {
  const content = (
    <>
      <span className="block text-lg font-extrabold leading-none text-zinc-950">
        {value}
      </span>
      <span className="mt-1 block text-xs font-semibold text-zinc-500">
        {label}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={`${value} ${label}`}
        onClick={onClick}
        className="rounded-2xl py-1.5 transition hover:bg-zinc-100/70 active:scale-95"
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-label={`${value} ${label}`} className="py-1.5">
      {content}
    </div>
  );
}

export function ProfileEventGrid({
  emptyBody,
  emptyTitle,
  onOpen,
  quests,
}: ProfileEventGridProps) {
  if (quests.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <p className="text-sm font-bold text-zinc-800">{emptyTitle}</p>
        <p className="mt-1 text-sm text-zinc-400">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[1px] bg-zinc-200">
      {quests.map((quest) => (
        <QuestTile key={quest.id} quest={quest} onOpen={onOpen} />
      ))}
    </div>
  );
}

function QuestTile({
  quest,
  onOpen,
}: {
  quest: Quest;
  onOpen: (questId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(quest.id)}
      data-category={quest.category}
      className="holo-thumb group relative aspect-square overflow-hidden bg-zinc-100 text-left transition active:scale-[0.98]"
      aria-label={`Open ${quest.title}`}
    >
      {quest.cardImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={quest.cardImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <QuestCategoryArtwork
          category={quest.category}
          className="absolute inset-0 h-full w-full"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
      <p className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[11px] font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
        {quest.title}
      </p>
      {quest.status !== "open" ? (
        <span className="glass-chip absolute right-1.5 top-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase text-zinc-700">
          {quest.status}
        </span>
      ) : null}
    </button>
  );
}
