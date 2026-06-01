import type { FriendshipState } from "@/types/quest";

type FriendActionControlsProps = {
  friendshipId: string | null;
  state: FriendshipState;
  disabled?: boolean;
  isBusy?: boolean;
  profileId: string;
  onAccept: (friendshipId: string) => void | Promise<void>;
  onCancel: (friendshipId: string) => void | Promise<void>;
  onDecline: (friendshipId: string) => void | Promise<void>;
  onRemove: (friendshipId: string) => void | Promise<void>;
  onRequest: (profileId: string) => void | Promise<void>;
};

export default function FriendActionControls({
  disabled = false,
  friendshipId,
  isBusy = false,
  onAccept,
  onCancel,
  onDecline,
  onRemove,
  onRequest,
  profileId,
  state,
}: FriendActionControlsProps) {
  const isDisabled = disabled || isBusy;

  if (state === "self") {
    return <StatePill label="You" />;
  }

  if (state === "incoming" && friendshipId) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onAccept(friendshipId)}
          className="min-h-9 rounded-full bg-zinc-950 px-3 text-xs font-extrabold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {isBusy ? "..." : "Accept"}
        </button>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onDecline(friendshipId)}
          className="min-h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    );
  }

  if (state === "outgoing" && friendshipId) {
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onCancel(friendshipId)}
        className="min-h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
      >
        Requested
      </button>
    );
  }

  if (state === "friends" && friendshipId) {
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onRemove(friendshipId)}
        className="min-h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-extrabold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
      >
        Friends
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onRequest(profileId)}
      className="min-h-9 rounded-full bg-zinc-950 px-3 text-xs font-extrabold text-white transition hover:bg-zinc-800 disabled:opacity-50"
    >
      {isBusy ? "..." : "Add"}
    </button>
  );
}

function StatePill({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-9 items-center rounded-full bg-zinc-100 px-3 text-xs font-extrabold text-zinc-500">
      {label}
    </span>
  );
}
