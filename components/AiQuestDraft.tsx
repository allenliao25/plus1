"use client";

import { ImagePlus, Sparkles } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
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
  /** Called when a draft is generated (prefills + reveals the create form). */
  onApplyDraft: (draft: SmartQuestDraft) => void;
};

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

  const searchableHints = hints.filter((hint) => {
    if (!profileMatchesInviteHint(currentProfile, hint)) {
      return true;
    }

    selfHints.push(hint);
    return false;
  });

  const matches = await Promise.all(
    searchableHints.map(async (hint) => {
      const results = await searchProfilesForInvite(currentUserId, hint);
      return { hint, match: chooseInviteMatch(hint, results) };
    }),
  );

  for (const { hint, match } of matches) {

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

export default function AiQuestDraft(props: AiQuestDraftProps) {
  return useAiQuestDraftContent(props);
}

function useAiQuestDraftContent({
  currentProfile,
  currentUserId,
  isAvailable,
  onApplyDraft,
}: AiQuestDraftProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const flyerInputRef = useRef<HTMLInputElement>(null);

  async function applyResolvedDraft(nextDraft: SmartQuestDraft) {
    const { profiles, selfHints, unresolvedHints } = await resolveInviteProfiles(
      currentProfile,
      currentUserId,
      nextDraft.inviteHints,
    );

    onApplyDraft({
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
      setPrompt("");
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

  if (isAvailable === false) {
    return (
      <section className="glass-panel flex items-center gap-3 rounded-card border px-4 py-3">
        <span className="glass-action grid size-9 shrink-0 place-items-center rounded-full border text-faint">
          <Sparkles size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-xs font-semibold leading-5 text-muted">
          Smart Draft needs OPENAI_API_KEY in this environment. Fill your event
          in below.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel glass-ignite overflow-hidden rounded-hero border shadow-glow">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span className="glass-action grid size-10 shrink-0 place-items-center rounded-full border text-ink-soft">
            <Sparkles size={19} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white">Smart Draft</h2>
            <p className="text-xs font-medium text-white/70">
              Describe the plan — we fill in the details.
            </p>
          </div>
        </div>

        <textarea
          aria-label="Smart draft prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="What's the plan? Try: dinner at 7 at Coupa"
          maxLength={AI_TEXT_PROMPT_MAX_LENGTH}
          rows={3}
          disabled={isLoading}
          className="w-full resize-none rounded-card border border-white/15 bg-white/95 px-4 py-3 text-base text-ink outline-none transition placeholder:text-faint focus:border-white/60 focus:bg-white disabled:opacity-70"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTextSubmit}
            disabled={isLoading || !prompt.trim()}
            className="pressable flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-white/60"
          >
            {isLoading ? (
              <>
                <Sparkles
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="animate-pulse"
                />
                Drafting…
              </>
            ) : (
              <>
                <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
                Draft it
              </>
            )}
          </button>
          <label
            className={`glass-action pressable grid min-h-12 w-12 shrink-0 place-items-center rounded-full border text-ink-soft ${
              isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
            aria-label="Draft from a flyer photo"
            title="Draft from a flyer photo"
          >
            <input
              ref={flyerInputRef}
              type="file"
              accept="image/*"
              onChange={handleFlyerChange}
              disabled={isLoading}
              className="sr-only"
            />
            <ImagePlus size={19} strokeWidth={1.9} aria-hidden="true" />
          </label>
        </div>

        {error ? (
          <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
