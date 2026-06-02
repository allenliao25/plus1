import { FormEvent, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";
import type { ChatMessage, MessageThread } from "@/types/quest";

type ChatThreadScreenProps = {
  currentUserId: string;
  isLoading?: boolean;
  isSending?: boolean;
  messages: ChatMessage[];
  thread: MessageThread | null;
  onSend: (body: string) => void | Promise<void>;
};

export default function ChatThreadScreen({
  isLoading = false,
  isSending = false,
  messages,
  onSend,
  thread,
}: ChatThreadScreenProps) {
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const now = useNow();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isLoading]);

  async function sendCurrentMessage() {
    const nextBody = body.trim();

    if (!nextBody || isSending) {
      return;
    }

    await onSend(nextBody);
    setBody("");
    inputRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCurrentMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendCurrentMessage();
    }
  }

  if (!thread) {
    return (
      <div className="glass-panel rounded-[1.35rem] border p-5 text-center">
        <p className="text-sm font-extrabold text-zinc-950">Chat unavailable.</p>
        <p className="mt-1 text-sm font-semibold text-zinc-500">
          This conversation may no longer be visible.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <section className="min-h-0 flex-1 space-y-3 pb-4">
        <div className="mx-auto max-w-[16rem] pb-2 text-center">
          <p className="text-sm font-extrabold text-zinc-950">{thread.title}</p>
          {thread.subtitle ? (
            <p className="mt-0.5 text-xs font-bold text-zinc-400">
              {thread.subtitle}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-10 w-3/4 animate-pulse rounded-3xl bg-zinc-100" />
            <div className="ml-auto h-10 w-2/3 animate-pulse rounded-3xl bg-zinc-900/10" />
          </div>
        ) : messages.length === 0 ? (
          <div className="glass-panel rounded-[1.35rem] border p-6 text-center">
            <p className="text-sm font-extrabold text-zinc-950">
              Start the conversation
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-zinc-500">
              Keep it simple: plans, timing, and where to meet.
            </p>
          </div>
        ) : (
          <div>
            {messages.map((message, index) => {
              const previousMessage = messages[index - 1];
              const nextMessage = messages[index + 1];
              const isFirstInGroup =
                !previousMessage || previousMessage.senderId !== message.senderId;
              const isLastInGroup =
                !nextMessage || nextMessage.senderId !== message.senderId;

              return (
                <MessageBubble
                  key={message.id}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  isEventChat={thread.kind === "event"}
                  message={message}
                  now={now}
                />
              );
            })}
          </div>
        )}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 -mx-5 border-t border-zinc-200/70 bg-white/94 px-5 py-3 backdrop-blur"
      >
        <div className="glass-panel flex min-h-12 items-end gap-2 rounded-[1.45rem] border p-2 shadow-[0_14px_34px_rgba(24,24,27,0.08)]">
          <textarea
            aria-label="Message"
            ref={inputRef}
            rows={1}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            enterKeyHint="send"
            placeholder="Message"
            className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] font-medium leading-5 text-zinc-950 outline-none placeholder:text-zinc-400"
          />
          <button
            type="submit"
            disabled={!body.trim() || isSending}
            aria-label="Send message"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-950 text-white transition active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            <Send size={17} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({
  isEventChat,
  isFirstInGroup,
  isLastInGroup,
  message,
  now,
}: {
  isEventChat: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  message: ChatMessage;
  now: number;
}) {
  const createdAtRelative = formatRelativeTime(message.createdAtISO, now);
  const showIncomingAvatar = !message.isMine && isLastInGroup;
  const senderName =
    isEventChat && !message.isMine && isFirstInGroup
      ? message.sender?.displayName
      : null;
  const rowGap = isFirstInGroup ? "mt-3" : "mt-1";
  const bubbleShape = getBubbleShape({
    isFirstInGroup,
    isLastInGroup,
    isMine: message.isMine,
  });

  return (
    <div
      className={`flex items-end gap-2 ${rowGap} ${
        message.isMine ? "justify-end pl-12" : "justify-start pr-10"
      }`}
    >
      {!message.isMine ? (
        <div className="flex w-8 shrink-0 justify-center">
          {showIncomingAvatar ? <MessageAvatar message={message} /> : null}
        </div>
      ) : null}
      <div
        className={`max-w-[78%] px-4 py-2.5 text-sm leading-5 ${bubbleShape} ${
          message.isMine
            ? "bg-zinc-950 text-white"
            : "bg-zinc-100 text-zinc-950 ring-1 ring-zinc-200/60"
        }`}
      >
        {senderName ? (
          <p className="mb-1 text-[0.7rem] font-extrabold text-zinc-400">
            {senderName}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words font-medium">{message.body}</p>
        {isLastInGroup && createdAtRelative ? (
          <p
            className={`mt-1 text-[0.68rem] font-bold ${
              message.isMine ? "text-white/58" : "text-zinc-400"
            }`}
          >
            {createdAtRelative}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MessageAvatar({ message }: { message: ChatMessage }) {
  const initials =
    message.sender?.avatarInitials.trim().slice(0, 2).toUpperCase() || "?";

  if (message.sender?.avatarUrl) {
    return (
      <SafeImage
        src={message.sender.avatarUrl}
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-full object-cover ring-1 ring-zinc-200"
      />
    );
  }

  return (
    <span className="grid size-8 place-items-center rounded-full bg-zinc-950 text-[0.68rem] font-extrabold text-white ring-1 ring-zinc-200">
      {initials}
    </span>
  );
}

function getBubbleShape({
  isFirstInGroup,
  isLastInGroup,
  isMine,
}: {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isMine: boolean;
}) {
  if (isMine) {
    if (isFirstInGroup && isLastInGroup) {
      return "rounded-[1.35rem] rounded-br-md";
    }
    if (isFirstInGroup) {
      return "rounded-[1.35rem] rounded-br-md rounded-tr-[1.35rem]";
    }
    if (isLastInGroup) {
      return "rounded-[1.35rem] rounded-tr-md rounded-br-md";
    }
    return "rounded-[1.35rem] rounded-r-md";
  }

  if (isFirstInGroup && isLastInGroup) {
    return "rounded-[1.35rem] rounded-bl-md";
  }
  if (isFirstInGroup) {
    return "rounded-[1.35rem] rounded-bl-md rounded-tl-[1.35rem]";
  }
  if (isLastInGroup) {
    return "rounded-[1.35rem] rounded-tl-md rounded-bl-md";
  }
  return "rounded-[1.35rem] rounded-l-md";
}
