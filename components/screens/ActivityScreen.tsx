import EmptyState from "@/components/EmptyState";
import type { ActivityEvent, ActivityEventType } from "@/types/quest";

type ActivityScreenProps = {
  events: ActivityEvent[];
  onOpenQuest: (questId: string) => void;
  onBrowse: () => void;
};

const typeLabels: Record<ActivityEventType, string> = {
  join: "Joined",
  edit: "Updated",
  close: "Closed",
  reminder: "Reminder",
};

export default function ActivityScreen({
  events,
  onOpenQuest,
  onBrowse,
}: ActivityScreenProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950">Activity</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          Joins, edits, and updates on the quests you care about.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="When people join or update your quests, you'll see it here."
          actionLabel="Browse quests"
          onAction={onBrowse}
        />
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                disabled={!event.questId}
                onClick={() => event.questId && onOpenQuest(event.questId)}
                className={`w-full rounded-3xl border p-4 text-left transition disabled:cursor-default ${
                  event.isRead
                    ? "border-zinc-200 bg-white"
                    : "border-zinc-300 bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!event.isRead ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  ) : null}
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                    {typeLabels[event.type]}
                  </span>
                  {event.createdAtRelative ? (
                    <span className="ml-auto text-xs font-medium text-zinc-400">
                      {event.createdAtRelative}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-900">
                  {event.title}
                </p>
                {event.body ? (
                  <p className="mt-1 text-sm leading-6 text-zinc-500">
                    {event.body}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
