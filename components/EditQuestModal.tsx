import { FormEvent, useMemo, useState } from "react";
import type { NewQuestInput, Quest, QuestCategory } from "@/types/quest";
import { questCategories } from "@/data/demoQuests";

type EditQuestModalProps = {
  isSubmitting: boolean;
  quest: Quest;
  onCancel: () => void;
  onSave: (input: NewQuestInput) => Promise<void>;
};

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  const localDate = new Date(date.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
}

export default function EditQuestModal({
  isSubmitting,
  quest,
  onCancel,
  onSave,
}: EditQuestModalProps) {
  const defaultForm = useMemo<NewQuestInput>(
    () => ({
      title: quest.title,
      category: quest.category,
      location: quest.location,
      startTime: toDatetimeLocal(quest.startTimeISO),
      description: quest.description,
      maxPeople: quest.maxPeople,
    }),
    [quest],
  );
  const [form, setForm] = useState<NewQuestInput>(defaultForm);
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

    if (form.maxPeople < quest.goingCount) {
      setError(`Max people cannot be less than current going (${quest.goingCount}).`);
      return;
    }

    try {
      setError("");
      await onSave({
        ...form,
        title: form.title.trim(),
        location: form.location.trim(),
        startTime: form.startTime.trim(),
        description: form.description.trim() || "No extra details yet. Just show up.",
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save changes. Try again.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-zinc-950/45 p-4">
      <div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-3xl border border-zinc-200 bg-[#fbfaf7] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-zinc-950">Edit quest</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
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
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
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
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-zinc-700">Start time</span>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(event) => updateForm("startTime", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-zinc-700">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-zinc-700">Max people</span>
            <input
              type="number"
              min={quest.goingCount}
              max={12}
              value={form.maxPeople}
              onChange={(event) =>
                updateForm("maxPeople", Number(event.target.value))
              }
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
            />
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-11 flex-1 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
