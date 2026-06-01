"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { AI_TEXT_PROMPT_MAX_LENGTH } from "@/lib/aiLimits";
import { searchProfilesForInvite } from "@/lib/friendService";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type {
  Profile,
  QuestInviteProfile,
  SmartQuestDraft,
} from "@/types/quest";

type AiQuestDraftProps = {
  currentProfile: Profile;
  currentUserId: string;
  isAvailable: boolean | null;
  /** Called when the user accepts a generated draft (e.g. to prefill the create form). */
  onApplyDraft: (draft: SmartQuestDraft) => void;
};

type Mode = "text" | "flyer";

const MAX_BYTES = 8 * 1024 * 1024;

function getDraftContext() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return {
    nowLocal: localDate.toISOString().slice(0, 16),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

async function readDraft(response: Response): Promise<SmartQuestDraft> {
  const payload = (await response.json().catch(() => null)) as {
    draft?: SmartQuestDraft;
    error?: string;
  } | null;

  if (!response.ok || !payload?.draft) {
    throw new Error(payload?.error || "The AI could not draft an event.");
  }

  return payload.draft;
}

async function resolveInviteProfiles(
  currentProfile: Profile,
  currentUserId: string,
  hints: string[] | undefined,
) {
  if (!hints?.length) {
    return { profiles: [], selfHints: [], unresolvedHints: [] };
  }

  const profiles: QuestInviteProfile[] = [];
  const selfHints: string[] = [];
  const unresolvedHints: string[] = [];
  const seenProfileIds = new Set<string>();

  for (const hint of hints) {
    if (profileMatchesInviteHint(currentProfile, hint)) {
      selfHints.push(hint);
      continue;
    }

    const results = await searchProfilesForInvite(currentUserId, hint);
    const match = chooseInviteMatch(hint, results);

    if (!match) {
      unresolvedHints.push(hint);
      continue;
    }

    if (!seenProfileIds.has(match.id)) {
      seenProfileIds.add(match.id);
      profiles.push(match);
    }
  }

  return { profiles, selfHints, unresolvedHints };
}

function chooseInviteMatch(hint: string, results: QuestInviteProfile[]) {
  const normalizedHint = normalizeInviteLookup(hint);

  return (
    results.find((profile) => profileMatchesInviteHint(profile, normalizedHint)) ??
    results.find(
      (profile) => normalizeInviteLookup(profile.displayName) === normalizedHint,
    ) ??
    results[0] ??
    null
  );
}

function profileMatchesInviteHint(
  profile: Pick<Profile, "displayName" | "handle">,
  hint: string,
) {
  const normalizedHint = normalizeInviteLookup(hint);
  const normalizedHandle = normalizeInviteLookup(profile.handle);
  const normalizedName = normalizeInviteLookup(profile.displayName);

  return (
    normalizedHandle === normalizedHint ||
    normalizedName === normalizedHint ||
    normalizedHandle.includes(normalizedHint) ||
    normalizedName.includes(normalizedHint)
  );
}

function normalizeInviteLookup(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "");
}

function formatDraftStartTime(value: string) {
  if (!value) {
    return "ASAP";
  }

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const dayLabel = isSameDay
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }).format(date);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${dayLabel}, ${timeLabel}`;
}

async function getAuthHeader() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Sign in before using Smart Draft.");
  }

  return `Bearer ${session.access_token}`;
}

export default function AiQuestDraft({
  currentProfile,
  currentUserId,
  isAvailable,
  onApplyDraft,
}: AiQuestDraftProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<SmartQuestDraft | null>(null);

  async function applyResolvedDraft(nextDraft: SmartQuestDraft) {
    const { profiles, selfHints, unresolvedHints } = await resolveInviteProfiles(
      currentProfile,
      currentUserId,
      nextDraft.inviteHints,
    );

    setDraft({
      ...nextDraft,
      inviteeProfiles: profiles,
      selfInviteHints: selfHints,
      unresolvedInviteHints: unresolvedHints,
    });
  }

  async function handleTextSubmit() {
    if (!prompt.trim() || isLoading || isAvailable === false) {
      return;
    }

    setIsLoading(true);
    setError("");
    setDraft(null);

    try {
      const authorization = await getAuthHeader();
      const response = await fetch("/api/ai/quest-draft", {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          context: getDraftContext(),
        }),
      });
      await applyResolvedDraft(await readDraft(response));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not draft an event.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFlyerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isLoading || isAvailable === false) {
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("Image is too large (max 8 MB).");
      return;
    }

    setIsLoading(true);
    setError("");
    setDraft(null);

    try {
      const authorization = await getAuthHeader();
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/ai/flyer-to-quest", {
        method: "POST",
        headers: { Authorization: authorization },
        body: formData,
      });
      await applyResolvedDraft(await readDraft(response));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not read the flyer.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="glass-panel overflow-hidden rounded-2xl border">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={isExpanded}
      >
        <span className="glass-action grid h-9 w-9 shrink-0 place-items-center rounded-full border text-zinc-700">
          <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-zinc-900">
            Smart Draft
          </span>
          <span className="block truncate text-xs font-medium text-zinc-500">
            Describe your plan. We will fill the basics.
          </span>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className={`shrink-0 text-zinc-400 transition ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded ? (
        <div className="space-y-3 border-t border-zinc-200/70 px-4 py-4">
          {isAvailable === false ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
              Smart Draft needs OPENAI_API_KEY in this environment.
            </p>
          ) : null}

          <div className="glass-chip grid grid-cols-2 gap-2 rounded-full border p-1">
            {(["text", "flyer"] as Mode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setError("");
                }}
                className={`min-h-10 rounded-full px-3 py-2 text-sm font-bold transition ${
                  mode === value
                    ? "bg-zinc-950 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {value === "text" ? "Text" : "Flyer"}
              </button>
            ))}
          </div>

          {mode === "text" ? (
            <div className="space-y-3">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="study at green tonight around 8, need 3 people"
                maxLength={AI_TEXT_PROMPT_MAX_LENGTH}
                rows={3}
                className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                disabled={isLoading || !prompt.trim() || isAvailable === false}
                className="glass-action min-h-11 w-full rounded-full border px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-white disabled:text-zinc-300"
              >
                {isAvailable === false
                  ? "Unavailable"
                  : isLoading
                    ? "Filling..."
                    : "Fill details"}
              </button>
            </div>
          ) : (
            <label className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-sm font-bold text-zinc-600 transition hover:border-zinc-400">
              <input
                type="file"
                accept="image/*"
                onChange={handleFlyerChange}
                disabled={isLoading || isAvailable === false}
                className="hidden"
              />
              {isAvailable === false
                ? "Unavailable"
                : isLoading
                  ? "Reading flyer..."
                  : "Upload a flyer"}
            </label>
          )}

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}

          {draft ? (
            <div className="glass-chip space-y-3 rounded-2xl border p-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm text-zinc-700">
                <dt className="font-bold text-zinc-500">Title</dt>
                <dd className="font-semibold">{draft.title || "—"}</dd>
                <dt className="font-bold text-zinc-500">Category</dt>
                <dd className="font-semibold">{draft.category}</dd>
                <dt className="font-bold text-zinc-500">Location</dt>
                <dd className="font-semibold">{draft.location || "—"}</dd>
                <dt className="font-bold text-zinc-500">Start</dt>
                <dd className="font-semibold">
                  {formatDraftStartTime(draft.startTime)}
                </dd>
                <dt className="font-bold text-zinc-500">Max</dt>
                <dd className="font-semibold">{draft.maxPeople}</dd>
                {draft.inviteeProfiles?.length ||
                draft.selfInviteHints?.length ||
                draft.unresolvedInviteHints?.length ? (
                  <>
                    <dt className="font-bold text-zinc-500">Invites</dt>
                    <dd className="font-semibold">
                      {[
                        ...(draft.inviteeProfiles ?? []).map(
                          (profile) => `@${profile.handle}`,
                        ),
                        ...(draft.selfInviteHints ?? []).map(
                          (hint) => `${hint} is you`,
                        ),
                        ...(draft.unresolvedInviteHints ?? []).map(
                          (hint) => `${hint} not found`,
                        ),
                      ].join(", ")}
                    </dd>
                  </>
                ) : null}
              </dl>
              <button
                type="button"
                onClick={() => onApplyDraft(draft)}
                className="min-h-11 w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                Use these details
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
