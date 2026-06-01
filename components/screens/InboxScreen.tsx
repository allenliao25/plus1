import { MessageCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import { splitThreadsByKind } from "@/lib/messageService";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";
import type { FriendConnection, MessageThread } from "@/types/quest";

type InboxScreenProps = {
  friends: FriendConnection[];
  isLoading?: boolean;
  threads: MessageThread[];
  onMessageFriend: (profileId: string) => void | Promise<void>;
  onOpenThread: (threadId: string) => void;
};

type InboxMode = "direct" | "event";

export default function InboxScreen({
  friends,
  isLoading = false,
  onMessageFriend,
  onOpenThread,
  threads,
}: InboxScreenProps) {
  const [mode, setMode] = useState<InboxMode>("direct");
  const [query, setQuery] = useState("");
  const now = useNow();
  const sections = useMemo(() => splitThreadsByKind(threads), [threads]);
  const activeThreads = mode === "direct" ? sections.direct : sections.event;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredThreads = normalizedQuery
    ? activeThreads.filter((thread) =>
        [thread.title, thread.subtitle, thread.preview]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery)),
      )
    : activeThreads;

  return (
    <div className="space-y-4">
      <div className="glass-panel grid grid-cols-2 rounded-full border p-1">
        <ModeButton
          isActive={mode === "direct"}
          label="Messages"
          onClick={() => setMode("direct")}
        />
        <ModeButton
          isActive={mode === "event"}
          label="Event chats"
          onClick={() => setMode("event")}
        />
      </div>

      <label className="glass-panel flex min-h-12 items-center gap-2 rounded-full border px-4 text-zinc-500 transition focus-within:border-zinc-300 focus-within:bg-white/92">
        <Search size={17} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "direct" ? "Search messages" : "Search event chats"}
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-medium text-zinc-950 outline-none placeholder:text-zinc-500"
        />
      </label>

      {isLoading ? (
        <div className="space-y-2">
          <div className="glass-panel h-20 animate-pulse rounded-[1.35rem] border" />
          <div className="glass-panel h-20 animate-pulse rounded-[1.35rem] border" />
        </div>
      ) : filteredThreads.length > 0 ? (
        <div className="glass-panel divide-y divide-zinc-100 overflow-hidden rounded-[1.35rem] border">
          {filteredThreads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              now={now}
              onOpen={() => onOpenThread(thread.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyInbox mode={mode} />
      )}

      {mode === "direct" && friends.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-zinc-400">
            Start a chat
          </p>
          <div className="glass-panel divide-y divide-zinc-100 overflow-hidden rounded-[1.35rem] border">
            {friends.slice(0, 8).map((friend) => (
              <div key={friend.id} className="flex items-center gap-3 p-3">
                <ProfileAvatar
                  avatarInitials={friend.profile.avatarInitials}
                  avatarUrl={friend.profile.avatarUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-zinc-950">
                    {friend.profile.displayName}
                  </p>
                  <p className="truncate text-xs font-bold text-zinc-400">
                    @{friend.profile.handle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onMessageFriend(friend.profile.id)}
                  className="min-h-9 rounded-full bg-zinc-950 px-4 text-xs font-extrabold text-white transition active:scale-95"
                >
                  Message
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ThreadRow({
  now,
  onOpen,
  thread,
}: {
  now: number;
  onOpen: () => void;
  thread: MessageThread;
}) {
  const lastMessageAtRelative = formatRelativeTime(thread.lastMessageAtISO, now);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-zinc-50"
    >
      {thread.kind === "event" ? (
        <EventAvatar thread={thread} />
      ) : (
        <ProfileAvatar
          avatarInitials={thread.participants[0]?.avatarInitials ?? "?"}
          avatarUrl={thread.participants[0]?.avatarUrl ?? null}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-extrabold text-zinc-950">
            {thread.title}
          </span>
          {lastMessageAtRelative ? (
            <span className="shrink-0 text-xs font-bold text-zinc-400">
              {lastMessageAtRelative}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-zinc-500">
            {thread.preview}
          </span>
          {thread.unreadCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-extrabold text-white">
              {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function EventAvatar({ thread }: { thread: MessageThread }) {
  if (thread.quest?.cardImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thread.quest.cardImageUrl}
        alt=""
        className="h-[52px] w-[52px] shrink-0 rounded-2xl object-cover ring-1 ring-zinc-200"
      />
    );
  }

  return (
    <span className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-200">
      <QuestCategoryArtwork
        category={thread.quest?.category ?? "Other"}
        className="absolute inset-0 h-full w-full"
      />
    </span>
  );
}

function ProfileAvatar({
  avatarInitials,
  avatarUrl,
}: {
  avatarInitials: string;
  avatarUrl: string | null;
}) {
  const initials = avatarInitials.trim().slice(0, 2).toUpperCase() || "?";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-[52px] w-[52px] shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }

  return (
    <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-zinc-950 text-sm font-extrabold text-white">
      {initials}
    </span>
  );
}

function EmptyInbox({ mode }: { mode: InboxMode }) {
  return (
    <div className="glass-panel rounded-[1.35rem] border p-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-100 text-zinc-500">
        <MessageCircle size={22} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-extrabold text-zinc-950">
        {mode === "direct" ? "No messages yet" : "No event chats yet"}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-zinc-500">
        {mode === "direct"
          ? "Friends you message will show up here."
          : "Join or host an event to start its group chat."}
      </p>
    </div>
  );
}

function ModeButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`min-h-10 rounded-full text-sm font-extrabold transition ${
        isActive ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500 hover:bg-white/48"
      }`}
    >
      {label}
    </button>
  );
}
