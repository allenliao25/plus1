"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { ChangeEvent, useState } from "react";
import type { NewQuestInput } from "@/types/quest";

type AiQuestDraftProps = {
  isAvailable: boolean | null;
  /** Called when the user accepts a generated draft (e.g. to prefill the create form). */
  onApplyDraft: (draft: NewQuestInput) => void;
};

type Mode = "text" | "flyer";

const MAX_BYTES = 8 * 1024 * 1024;

async function readDraft(response: Response): Promise<NewQuestInput> {
  const payload = (await response.json().catch(() => null)) as {
    draft?: NewQuestInput;
    error?: string;
  } | null;

  if (!response.ok || !payload?.draft) {
    throw new Error(payload?.error || "The AI could not draft an event.");
  }

  return payload.draft;
}

export default function AiQuestDraft({
  isAvailable,
  onApplyDraft,
}: AiQuestDraftProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<NewQuestInput | null>(null);

  async function handleTextSubmit() {
    if (!prompt.trim() || isLoading || isAvailable === false) {
      return;
    }

    setIsLoading(true);
    setError("");
    setDraft(null);

    try {
      const response = await fetch("/api/ai/quest-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      setDraft(await readDraft(response));
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
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/ai/flyer-to-quest", {
        method: "POST",
        body: formData,
      });
      setDraft(await readDraft(response));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not read the flyer.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={isExpanded}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-zinc-700 shadow-sm">
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
        <div className="space-y-3 border-t border-zinc-200 px-4 py-4">
          {isAvailable === false ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
              Smart Draft needs OPENAI_API_KEY in this environment.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 rounded-full bg-white p-1">
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
                rows={3}
                className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                disabled={isLoading || !prompt.trim() || isAvailable === false}
                className="min-h-11 w-full rounded-full border border-zinc-950 bg-white px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-white disabled:text-zinc-300"
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
            <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm text-zinc-700">
                <dt className="font-bold text-zinc-500">Title</dt>
                <dd className="font-semibold">{draft.title || "—"}</dd>
                <dt className="font-bold text-zinc-500">Category</dt>
                <dd className="font-semibold">{draft.category}</dd>
                <dt className="font-bold text-zinc-500">Location</dt>
                <dd className="font-semibold">{draft.location || "—"}</dd>
                <dt className="font-bold text-zinc-500">Start</dt>
                <dd className="font-semibold">{draft.startTime || "—"}</dd>
                <dt className="font-bold text-zinc-500">Max</dt>
                <dd className="font-semibold">{draft.maxPeople}</dd>
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
