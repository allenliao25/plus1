import FriendActionControls from "@/components/FriendActionControls";
import type { PeopleSearchResult } from "@/types/quest";
import { useState } from "react";

type PeopleListProps = {
  actionProfileId: string | null;
  people: PeopleSearchResult[];
  onAcceptFriend: (friendshipId: string) => void | Promise<void>;
  onCancelFriendRequest: (friendshipId: string) => void | Promise<void>;
  onDeclineFriend: (friendshipId: string) => void | Promise<void>;
  onOpenProfile: (profileId: string) => void;
  onRemoveFriend: (friendshipId: string) => void | Promise<void>;
  onSendFriendRequest: (profileId: string) => void | Promise<void>;
};

export default function PeopleList({
  actionProfileId,
  onAcceptFriend,
  onCancelFriendRequest,
  onDeclineFriend,
  onOpenProfile,
  onRemoveFriend,
  onSendFriendRequest,
  people,
}: PeopleListProps) {
  if (people.length === 0) {
    return null;
  }

  return (
    <div className="glass-panel divide-y divide-zinc-100 overflow-hidden rounded-[1.35rem] border">
      {people.map((person) => (
        <div key={person.id} className="flex items-center gap-3 p-3">
          <button
            type="button"
            onClick={() => onOpenProfile(person.id)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <PersonAvatar person={person} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold text-zinc-950">
                {person.displayName}
              </span>
              <span className="block truncate text-xs font-bold text-zinc-400">
                @{person.handle} · {person.area}
              </span>
            </span>
          </button>
          <FriendActionControls
            friendshipId={person.friendshipId}
            isBusy={actionProfileId === person.id}
            profileId={person.id}
            state={person.friendshipState}
            onAccept={onAcceptFriend}
            onCancel={onCancelFriendRequest}
            onDecline={onDeclineFriend}
            onRemove={onRemoveFriend}
            onRequest={onSendFriendRequest}
          />
        </div>
      ))}
    </div>
  );
}

function PersonAvatar({ person }: { person: PeopleSearchResult }) {
  const [didImageFail, setDidImageFail] = useState(false);

  if (person.avatarUrl && !didImageFail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        onError={() => setDidImageFail(true)}
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }

  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-zinc-950 text-sm font-extrabold text-white">
      {person.avatarInitials}
    </span>
  );
}
