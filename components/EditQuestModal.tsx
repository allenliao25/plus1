import { Camera, ImagePlus, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  NewQuestInput,
  Quest,
  QuestCardImageChanges,
  QuestCategory,
} from "@/types/quest";
import { questCategories } from "@/data/demoQuests";
import { validateQuestCardImageFile } from "@/lib/questService";

type EditQuestModalProps = {
  isSubmitting: boolean;
  quest: Quest;
  onCancel: () => void;
  onSave: (
    input: NewQuestInput,
    imageChanges?: QuestCardImageChanges,
  ) => Promise<void>;
};

type TimeMode = "asap" | "scheduled";

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
  const [timeMode, setTimeMode] = useState<TimeMode>(
    quest.startTimeISO ? "scheduled" : "asap",
  );
  const [error, setError] = useState("");
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreviewUrl, setCardImagePreviewUrl] = useState<string | null>(
    quest.cardImageUrl,
  );
  const [removeCardImage, setRemoveCardImage] = useState(false);
  const [cardImageError, setCardImageError] = useState("");
  const cardImageObjectUrlRef = useRef<string | null>(null);
  const cardImageInputRef = useRef<HTMLInputElement>(null);

  function updateForm<Value extends keyof NewQuestInput>(
    key: Value,
    value: NewQuestInput[Value],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.location.trim()) {
      setError("Add a title and location.");
      return;
    }

    if (timeMode === "scheduled") {
      if (!form.startTime.trim()) {
        setError("Choose a start time or switch to ASAP.");
        return;
      }

      const startTime = new Date(form.startTime);
      if (
        Number.isNaN(startTime.getTime()) ||
        startTime.getTime() <= Date.now()
      ) {
        setError("Choose a future start time.");
        return;
      }
    }

    const maxPeople = Number(form.maxPeople);
    if (!Number.isInteger(maxPeople) || maxPeople > 12) {
      setError("Max people must be a whole number up to 12.");
      return;
    }

    if (maxPeople < quest.goingCount) {
      setError(`Max people cannot be less than current going (${quest.goingCount}).`);
      return;
    }

    try {
      setError("");
      await onSave(
        {
          ...form,
          title: form.title.trim(),
          location: form.location.trim(),
          startTime: timeMode === "asap" ? "" : form.startTime.trim(),
          maxPeople,
          description: form.description.trim() || "No extra details yet. Just show up.",
        },
        { cardImageFile, removeCardImage },
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save changes. Try again.",
      );
    }
  }

  function handleCardImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      validateQuestCardImageFile(file);
      if (cardImageObjectUrlRef.current) {
        URL.revokeObjectURL(cardImageObjectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      cardImageObjectUrlRef.current = objectUrl;
      setCardImageFile(file);
      setCardImagePreviewUrl(objectUrl);
      setRemoveCardImage(false);
      setCardImageError("");
    } catch (caught) {
      setCardImageError(
        caught instanceof Error
          ? caught.message
          : "Could not use that event image.",
      );
    }
  }

  useEffect(() => {
    return () => {
      if (cardImageObjectUrlRef.current) {
        URL.revokeObjectURL(cardImageObjectUrlRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-white text-zinc-950">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-[var(--plus1-app-height,100vh)] w-full max-w-[480px] flex-col overflow-hidden bg-white"
      >
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/92 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur-xl">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="min-h-10 rounded-full px-1 text-sm font-bold text-zinc-700 transition hover:text-zinc-950 disabled:opacity-50"
          >
            Cancel
          </button>
          <h3 className="text-base font-bold tracking-tight text-zinc-950">Edit event</h3>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-10 rounded-full px-1 text-sm font-bold text-zinc-950 transition hover:text-zinc-700 disabled:text-zinc-300"
          >
            {isSubmitting ? "Saving" : "Save"}
          </button>
        </div>

        <div className="app-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
          <label className="block">
            <span className="text-sm font-bold text-zinc-800">Title</span>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
            />
          </label>

          <div>
            <p className="text-sm font-bold text-zinc-800">Category</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {questCategories.map((category) => {
                const isSelected = form.category === category;

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => updateForm("category", category as QuestCategory)}
                    className={`min-h-11 rounded-full border px-3 py-2.5 text-sm font-bold transition ${
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

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-zinc-800">Card photo</p>
              {cardImagePreviewUrl ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (cardImageObjectUrlRef.current) {
                      URL.revokeObjectURL(cardImageObjectUrlRef.current);
                      cardImageObjectUrlRef.current = null;
                    }
                    setCardImageFile(null);
                    setCardImagePreviewUrl(null);
                    setRemoveCardImage(true);
                    setCardImageError("");
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                  Remove
                </button>
              ) : null}
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => cardImageInputRef.current?.click()}
              className="mt-2 w-full overflow-hidden rounded-3xl border border-dashed border-zinc-300 bg-white text-left transition hover:border-zinc-400 disabled:opacity-50"
            >
              {cardImagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardImagePreviewUrl}
                  alt=""
                  className="h-44 w-full object-cover"
                />
              ) : (
                <span className="flex min-h-36 flex-col items-center justify-center gap-3 px-4 text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-zinc-100 text-zinc-700">
                    <ImagePlus size={20} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-zinc-700">
                    <Camera size={16} strokeWidth={1.9} aria-hidden="true" />
                    Add photo
                  </span>
                </span>
              )}
            </button>
            <input
              ref={cardImageInputRef}
              type="file"
              accept="image/*"
              disabled={isSubmitting}
              onChange={handleCardImageChange}
              className="sr-only"
            />
            {cardImageError ? (
              <p className="mt-2 text-sm font-bold text-red-600">
                {cardImageError}
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-bold text-zinc-800">Location</span>
            <input
              value={form.location}
              onChange={(event) => updateForm("location", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
            />
          </label>

          <div>
            <p className="text-sm font-bold text-zinc-800">Time</p>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-full bg-zinc-100 p-1">
              {(["asap", "scheduled"] as TimeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTimeMode(mode)}
                  disabled={isSubmitting}
                  className={`min-h-10 rounded-full px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${
                    timeMode === mode
                      ? "bg-zinc-950 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {mode === "asap" ? "ASAP" : "Pick time"}
                </button>
              ))}
            </div>
            {timeMode === "scheduled" ? (
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(event) => updateForm("startTime", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
              />
            ) : (
              <p className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-600">
                Shows as ASAP and stays open until you close it.
              </p>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-bold text-zinc-800">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-zinc-800">Max people</span>
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

        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-zinc-200 bg-white/94 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-xl">
          {error ? (
            <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="min-h-12 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 flex-1 rounded-full bg-zinc-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:bg-zinc-300"
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
