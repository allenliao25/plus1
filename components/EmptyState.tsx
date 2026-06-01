type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="glass-panel rounded-3xl border border-dashed p-6 text-center">
      <h3 className="text-base font-bold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{body}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-11 rounded-full bg-zinc-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
