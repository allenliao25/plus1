import { FormEvent, useState } from "react";
import { questCategories } from "@/data/demoQuests";
import type { NewQuestInput, QuestCategory } from "@/types/quest";

type CreateQuestFormProps = {
  isSubmitting: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  /**
   * Seeds the form once on mount. Remount the form with a new `key` to apply
   * an AI draft; the draft is never auto-posted.
   */
  initialValues?: NewQuestInput;
  onCreateQuest: (quest: NewQuestInput) => Promise<void>;
};

const defaultForm: NewQuestInput = {
  title: "",
  category: "Food",
  location: "",
  startTime: "",
  description: "",
  maxPeople: 4,
};

export default function CreateQuestForm({
  isSubmitting,
  submitLabel = "Post quest",
  submittingLabel = "Posting...",
  initialValues,
  onCreateQuest,
}: CreateQuestFormProps) {
  const [form, setForm] = useState<NewQuestInput>(initialValues ?? defaultForm);
  const [error, setError] = useState("");

  function updateForm<Value extends keyof NewQuestInput>(
    key: Value,
    value: NewQuestInput[Value],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.location.trim() || !form.startTime.trim()) {
      setError("Add a title, location, and start time.");
      return;
    }

    try {
      await onCreateQuest({
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        startTime: form.startTime.trim(),
        description:
          form.description.trim() || "No extra details yet. Just show up.",
      });
      setForm(defaultForm);
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not create this quest. Try again.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm leading-6 text-zinc-500">
        Post a casual plan for people nearby to join.
      </p>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-zinc-700">Title</span>
        <input
          value={form.title}
          onChange={(event) => updateForm("title", event.target.value)}
          placeholder="Dinner at Wilbur"
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </label>

      <div>
        <p className="text-sm font-semibold text-zinc-700">Category</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {questCategories.map((category) => {
            const isSelected = form.category === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => updateForm("category", category as QuestCategory)}
                className={`min-h-11 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                  isSelected
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-zinc-700">Location</span>
        <input
          value={form.location}
          onChange={(event) => updateForm("location", event.target.value)}
          placeholder="Green Library"
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-zinc-700">Start time</span>
        <input
          type="datetime-local"
          value={form.startTime}
          onChange={(event) => updateForm("startTime", event.target.value)}
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-zinc-700">Description</span>
        <textarea
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          placeholder="What should people know before joining?"
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-zinc-700">Max people</span>
        <input
          type="number"
          min={2}
          max={12}
          value={form.maxPeople}
          onChange={(event) =>
            updateForm("maxPeople", Number(event.target.value))
          }
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 w-full rounded-2xl bg-zinc-950 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
