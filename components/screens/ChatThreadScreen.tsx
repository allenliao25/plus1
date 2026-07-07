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
      <div className="glass-panel rounded-card border p-5 text-center">
        <p className="text-sm font-extrabold text-ink">Chat unavailable.</p>
        <p className="mt-1 text-sm font-semibold text-muted">
          This conversation may no longer be visible.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="app-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
        <div className="mx-auto max-w-[16rem] pb-2 text-center">
          <p className="text-sm font-extrabold text-ink">{thread.title}</p>
          {thread.subtitle ? (
            <p className="mt-0.5 text-xs font-bold text-faint">
              {thread.subtitle}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-10 w-3/4 animate-pulse rounded-3xl bg-surface-2" />
            <div className="ml-auto h-10 w-2/3 animate-pulse rounded-3xl bg-zinc-900/10" />
          </div>
        ) : messages.length === 0 ? (
          <div className="glass-panel rounded-card border p-6 text-center">
            <p className="text-sm font-extrabold text-ink">
              Start the conversation
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-muted">
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
        className="-mx-5 shrink-0 border-t border-line/70 bg-white/90 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur"
      >
        <div className="glass-panel flex min-h-12 items-end gap-2 rounded-card border p-2 shadow-raised">
          <textarea
            aria-label="Message"
            ref={inputRef}
            rows={1}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            enterKeyHint="send"
            placeholder="Message"
            className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-md font-medium leading-5 text-ink outline-none placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={!body.trim() || isSending}
            aria-label="Send message"
            className="pressable grid size-9 shrink-0 place-items-center rounded-full bg-ink text-white disabled:bg-line disabled:text-faint"
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
            ? "bg-ink text-white"
            : "bg-surface-2 text-ink ring-1 ring-line/60"
        }`}
      >
        {senderName ? (
          <p className="mb-1 text-xs font-extrabold text-faint">
            {senderName}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words font-medium">{message.body}</p>
        {isLastInGroup && createdAtRelative ? (
          <p
            className={`mt-1 text-xs font-bold ${
              message.isMine ? "text-white/60" : "text-faint"
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
        className="size-8 rounded-full object-cover ring-1 ring-line"
      />
    );
  }

  return (
    <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-extrabold text-white ring-1 ring-line">
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
      return "rounded-card rounded-br-md";
    }
    if (isFirstInGroup) {
      return "rounded-card rounded-br-md rounded-tr-card";
    }
    if (isLastInGroup) {
      return "rounded-card rounded-tr-md rounded-br-md";
    }
    return "rounded-card rounded-r-md";
  }

  if (isFirstInGroup && isLastInGroup) {
    return "rounded-card rounded-bl-md";
  }
  if (isFirstInGroup) {
    return "rounded-card rounded-bl-md rounded-tl-card";
  }
  if (isLastInGroup) {
    return "rounded-card rounded-tl-md rounded-bl-md";
  }
  return "rounded-card rounded-l-md";
}
