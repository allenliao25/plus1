import type { FriendshipState } from "@/types/quest";

type FriendActionControlsProps = {
  friendshipId: string | null;
  state: FriendshipState;
  disabled?: boolean;
  isBusy?: boolean;
  profileId: string;
  variant?: "compact" | "profile";
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
  variant = "compact",
}: FriendActionControlsProps) {
  const isDisabled = disabled || isBusy;
  const isProfile = variant === "profile";
  const secondaryClass = isProfile
    ? "inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-surface-2 px-3 text-sm font-bold text-ink pressable disabled:opacity-50"
    : "min-h-9 rounded-full border border-line bg-white px-3 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2 disabled:opacity-50";
  const primaryClass = isProfile
    ? "inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-ink px-3 text-sm font-bold text-white pressable disabled:opacity-50"
    : "min-h-9 rounded-full bg-ink px-3 text-xs font-extrabold text-white transition hover:bg-ink-hover disabled:opacity-50";

  if (state === "self") {
    return <StatePill label="You" variant={variant} />;
  }

  if (state === "incoming" && friendshipId) {
    return (
      <div className={isProfile ? "grid grid-cols-2 gap-2" : "flex shrink-0 items-center gap-2"}>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onAccept(friendshipId)}
          className={primaryClass}
        >
          {isBusy ? "..." : "Accept"}
        </button>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onDecline(friendshipId)}
          className={secondaryClass}
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
        className={secondaryClass}
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
        className={secondaryClass}
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
      className={primaryClass}
    >
      {isBusy ? "..." : "Add"}
    </button>
  );
}

function StatePill({
  label,
  variant,
}: {
  label: string;
  variant: "compact" | "profile";
}) {
  return (
    <span
      className={
        variant === "profile"
          ? "inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-surface-2 px-3 text-sm font-bold text-muted"
          : "inline-flex min-h-9 items-center rounded-full bg-surface-2 px-3 text-xs font-extrabold text-muted"
      }
    >
      {label}
    </span>
  );
}
