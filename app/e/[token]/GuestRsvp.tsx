"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { CheckCircle2, PartyPopper } from "lucide-react";
import {
  guestCancelViaToken,
  guestJoinViaShare,
} from "@/lib/questShareService";

const APP_STORE_URL = "https://apps.apple.com/app/plus1";

type GuestRsvpProps = {
  token: string;
  questTitle: string;
  goingCount: number;
  canRsvp: boolean;
  disabledReason: string | null;
  accent: { base: string; dark: string; pale: string };
};

type StoredRsvp = {
  claimToken: string;
  displayName: string;
};

function storageKey(token: string) {
  return `plus1:guest-rsvp:${token}`;
}

function readStoredRsvp(token: string): StoredRsvp | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(token));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredRsvp;
    return parsed.claimToken ? parsed : null;
  } catch {
    return null;
  }
}

const emptySubscribe = () => () => {};

export default function GuestRsvp({
  token,
  questTitle,
  goingCount,
  canRsvp,
  disabledReason,
  accent,
}: GuestRsvpProps) {
  const [name, setName] = useState("");
  // null = not yet acted on this render; set after a submit/cancel.
  const [override, setOverride] = useState<StoredRsvp | null | undefined>(
    undefined,
  );
  const [count, setCount] = useState(goingCount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-only: false during SSR / first paint, true once mounted. Avoids a
  // hydration mismatch when we read localStorage.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const readStored = useCallback(() => readStoredRsvp(token), [token]);

  // Local override (from this session's submit/cancel) wins; otherwise fall
  // back to whatever is persisted in localStorage once hydrated.
  const stored =
    override !== undefined ? override : hydrated ? readStored() : null;

  function setStored(value: StoredRsvp | null) {
    setOverride(value);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Add your first name to RSVP.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await guestJoinViaShare(token, trimmed);
      const record: StoredRsvp = {
        claimToken: result.claimToken,
        displayName: trimmed,
      };

      try {
        window.localStorage.setItem(storageKey(token), JSON.stringify(record));
      } catch {
        // Non-fatal: RSVP still succeeded server-side.
      }

      setStored(record);
      setCount(result.goingCount);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save your RSVP. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!stored || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await guestCancelViaToken(stored.claimToken);
      try {
        window.localStorage.removeItem(storageKey(token));
      } catch {
        // Non-fatal.
      }
      setStored(null);
      setCount((current) => Math.max(0, current - 1));
    } catch {
      setError("Could not cancel your RSVP. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Avoid a hydration flash before we know whether the guest already RSVPed.
  if (!hydrated) {
    return (
      <div className="min-h-12 rounded-full bg-zinc-100" aria-hidden="true" />
    );
  }

  if (stored) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-center gap-3 rounded-2xl p-4"
          style={{ background: accent.pale, color: accent.dark }}
        >
          <PartyPopper size={22} />
          <div>
            <p className="text-sm font-extrabold">
              You&apos;re in, {stored.displayName}!
            </p>
            <p className="text-xs font-semibold opacity-80">
              {count} going to {questTitle}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-center">
          <p className="text-sm font-extrabold text-zinc-950">
            Get the plans in your pocket
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Download plus1 to see who else is in, chat, and get updates.
          </p>
          <a
            href={APP_STORE_URL}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-extrabold text-white transition hover:bg-zinc-800"
          >
            Download the app
          </a>
          <p className="mt-2 text-xs font-semibold text-zinc-400">
            or just keep the link — no app needed to attend
          </p>
        </div>

        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="w-full text-center text-xs font-bold text-zinc-400 underline decoration-zinc-300 underline-offset-4 transition hover:text-zinc-600 disabled:opacity-50"
        >
          {submitting ? "Cancelling…" : "Can't make it anymore"}
        </button>

        {error ? (
          <p className="text-center text-xs font-semibold text-rose-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (!canRsvp) {
    return (
      <div className="rounded-2xl bg-zinc-50 p-4 text-center">
        <p className="text-sm font-bold text-zinc-500">
          {disabledReason ?? "RSVP is closed for this event."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label
        htmlFor="guest-name"
        className="block text-xs font-extrabold uppercase tracking-[0.14em] text-zinc-400"
      >
        RSVP with your first name
      </label>
      <input
        id="guest-name"
        type="text"
        inputMode="text"
        autoComplete="given-name"
        maxLength={40}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your first name"
        className="min-h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-950 outline-none focus:border-zinc-400"
      />
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold text-white transition disabled:opacity-50"
        style={{ background: accent.base }}
      >
        {submitting ? (
          "Saving…"
        ) : (
          <>
            <CheckCircle2 size={17} />
            I&apos;m in 🙋
          </>
        )}
      </button>
      {error ? (
        <p className="text-center text-xs font-semibold text-rose-600">
          {error}
        </p>
      ) : null}
      <p className="text-center text-xs font-semibold text-zinc-400">
        No account needed. Just your first name.
      </p>
    </form>
  );
}
