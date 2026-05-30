"use client";

import { ChangeEvent, FormEvent, useState } from "react";
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
    throw new Error(payload?.error || "The AI could not draft a quest.");
  }

  return payload.draft;
}

export default function AiQuestDraft({
  isAvailable,
  onApplyDraft,
}: AiQuestDraftProps) {
  const [mode, setMode] = useState<Mode>("text");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<NewQuestInput | null>(null);

  async function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        caught instanceof Error ? caught.message : "Could not draft a quest.",
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
    <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white/70 p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-zinc-900">
          Draft with AI
        </h3>
        <p className="text-sm leading-6 text-zinc-500">
          Describe your plan or upload a flyer. You can edit everything before
          posting.
        </p>
      </div>

      {isAvailable === false ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800">
          AI drafting is wired up, but OPENAI_API_KEY is not set in this
          environment. Add it to .env.local to demo this tab.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {(["text", "flyer"] as Mode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError("");
            }}
            className={`min-h-11 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
              mode === value
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {value === "text" ? "From text" : "From flyer"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <form onSubmit={handleTextSubmit} className="space-y-3">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="study at green tonight around 8, need 3 people"
            rows={3}
            className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim() || isAvailable === false}
            className="min-h-11 w-full rounded-2xl bg-zinc-950 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isAvailable === false
              ? "AI unavailable"
              : isLoading
                ? "Drafting..."
                : "Draft quest"}
          </button>
        </form>
      ) : (
        <label className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400">
          <input
            type="file"
            accept="image/*"
            onChange={handleFlyerChange}
            disabled={isLoading || isAvailable === false}
            className="hidden"
          />
          {isAvailable === false
            ? "AI unavailable"
            : isLoading
              ? "Reading flyer..."
              : "Upload a flyer image"}
        </label>
      )}

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {draft ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <dl className="space-y-1 text-sm text-zinc-700">
            <div className="flex gap-2">
              <dt className="font-semibold text-zinc-500">Title</dt>
              <dd>{draft.title || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-zinc-500">Category</dt>
              <dd>{draft.category}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-zinc-500">Location</dt>
              <dd>{draft.location || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-zinc-500">Start</dt>
              <dd>{draft.startTime || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold text-zinc-500">Max</dt>
              <dd>{draft.maxPeople}</dd>
            </div>
            {draft.description ? (
              <p className="pt-1 text-zinc-600">{draft.description}</p>
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => onApplyDraft(draft)}
            className="min-h-11 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Use this draft
          </button>
        </div>
      ) : null}
    </section>
  );
}
