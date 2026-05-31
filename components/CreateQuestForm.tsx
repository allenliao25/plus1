import { Camera, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { questCategories } from "@/data/demoQuests";
import { validateQuestCardImageFile } from "@/lib/questService";
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
  onCreateQuest: (
    event: NewQuestInput,
    cardImageFile?: File | null,
  ) => Promise<void>;
};

type TimeMode = "asap" | "scheduled";

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
  submitLabel = "Post event",
  submittingLabel = "Posting...",
  initialValues,
  onCreateQuest,
}: CreateQuestFormProps) {
  const [form, setForm] = useState<NewQuestInput>(initialValues ?? defaultForm);
  const [timeMode, setTimeMode] = useState<TimeMode>(
    initialValues?.startTime ? "scheduled" : "asap",
  );
  const [error, setError] = useState("");
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreviewUrl, setCardImagePreviewUrl] = useState<string | null>(
    null,
  );
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
    if (!Number.isInteger(maxPeople) || maxPeople < 2 || maxPeople > 12) {
      setError("Max people must be a whole number from 2 to 12.");
      return;
    }

    try {
      await onCreateQuest(
        {
          ...form,
          title: form.title.trim(),
          location: form.location.trim(),
          startTime: timeMode === "asap" ? "" : form.startTime.trim(),
          maxPeople,
          description:
            form.description.trim() || "No extra details yet. Just show up.",
        },
        cardImageFile,
      );
      setForm(defaultForm);
      clearCardImage();
      setError("");
      setCardImageError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not create this event. Try again.",
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
      setCardImageError("");
    } catch (caught) {
      setCardImageError(
        caught instanceof Error
          ? caught.message
          : "Could not use that event image.",
      );
    }
  }

  function clearCardImage() {
    if (cardImageObjectUrlRef.current) {
      URL.revokeObjectURL(cardImageObjectUrlRef.current);
      cardImageObjectUrlRef.current = null;
    }
    setCardImageFile(null);
    setCardImagePreviewUrl(null);
  }

  useEffect(() => {
    return () => {
      if (cardImageObjectUrlRef.current) {
        URL.revokeObjectURL(cardImageObjectUrlRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <label className="block">
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-zinc-800">Title</span>
          <RequiredBadge />
        </span>
        <input
          value={form.title}
          onChange={(event) => updateForm("title", event.target.value)}
          placeholder="Dinner at Wilbur"
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
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
      <label className="block">
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-zinc-800">Location</span>
          <RequiredBadge />
        </span>
        <input
          value={form.location}
          onChange={(event) => updateForm("location", event.target.value)}
          placeholder="Green Library"
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </label>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-zinc-800">Time</p>
          <RequiredBadge />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-full bg-zinc-100 p-1">
          {(["asap", "scheduled"] as TimeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTimeMode(mode)}
              className={`min-h-10 rounded-full px-3 py-2 text-sm font-bold transition ${
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
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
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
          placeholder="What should people know before joining?"
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-zinc-800">Max people</span>
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

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-zinc-800">Card photo</p>
          <span className="text-xs font-bold uppercase tracking-normal text-zinc-400">
            Optional
          </span>
          {cardImageFile ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                clearCardImage();
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
          data-category={form.category}
          className="holo-thumb mt-2 w-full overflow-hidden rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-left transition hover:border-zinc-400 hover:bg-white disabled:opacity-50"
        >
          {cardImagePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardImagePreviewUrl}
              alt=""
              className="h-48 w-full object-cover"
            />
          ) : (
            <span className="relative block h-40">
              <span className="holo-thumb-fallback absolute inset-0" />
              <span className="absolute inset-0 bg-black/16" />
              <span className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-white/16 bg-black/34 p-3 text-white shadow-sm backdrop-blur-xl">
                <span>
                  <span className="block text-sm font-bold">
                    Using the {form.category} default
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-white/75">
                    Upload a photo anytime.
                  </span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-zinc-800">
                  <Camera size={17} strokeWidth={1.9} aria-hidden="true" />
                </span>
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-12 w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}

function RequiredBadge() {
  return (
    <span className="text-xs font-bold uppercase tracking-normal text-zinc-400">
      Required
    </span>
  );
}
