import { Camera, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import InvitePicker from "@/components/InvitePicker";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import type {
  NewQuestInput,
  Quest,
  QuestCardImageChanges,
  QuestCategory,
  QuestInviteProfile,
  QuestVisibility,
} from "@/types/quest";
import { questCategories } from "@/data/demoQuests";
import { validateQuestCardImageFile } from "@/lib/questService";

type EditQuestModalProps = {
  currentUserId: string;
  friendProfiles?: QuestInviteProfile[];
  isSubmitting: boolean;
  quest: Quest;
  onCancel: () => void;
  onSave: (
    input: NewQuestInput,
    imageChanges?: QuestCardImageChanges,
  ) => Promise<void>;
};

type TimeMode = "asap" | "scheduled";

const visibilityOptions: Array<{
  value: QuestVisibility;
  label: string;
  helper: string;
}> = [
  {
    value: "local",
    label: "Local",
    helper: "Anyone in your area can discover and join.",
  },
  {
    value: "friends",
    label: "Friends",
    helper: "Your friends can discover and join. Invited people can also join.",
  },
  {
    value: "invite_only",
    label: "Invite-only",
    helper: "Only invited people can see and join.",
  },
];

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

export default function EditQuestModal(props: EditQuestModalProps) {
  return useEditQuestModalContent(props);
}

function useEditQuestModalContent({
  currentUserId,
  friendProfiles = [],
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
      visibility: quest.visibility,
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
  const [invitees, setInvitees] = useState<QuestInviteProfile[]>(
    quest.invitedProfiles ?? [],
  );
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
          visibility: form.visibility ?? "local",
          inviteeIds: invitees.map((invitee) => invitee.id),
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
      const objectUrl = URL.createObjectURL(file);
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
    if (!cardImagePreviewUrl?.startsWith("blob:")) {
      return;
    }

    return () => {
      URL.revokeObjectURL(cardImagePreviewUrl);
    };
  }, [cardImagePreviewUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-white/72 text-zinc-950 backdrop-blur-2xl">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-[var(--plus1-app-height,100vh)] w-full max-w-[480px] flex-col overflow-hidden bg-white"
      >
        <div className="glass-bar sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
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
                        ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                        : "glass-chip border text-zinc-700 hover:bg-white/80"
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
                    setCardImageFile(null);
                    setCardImagePreviewUrl(null);
                    setRemoveCardImage(true);
                    setCardImageError("");
                  }}
                  className="glass-chip inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-zinc-700 transition hover:bg-white/80 disabled:opacity-50"
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
              className="holo-thumb mt-2 w-full overflow-hidden rounded-3xl border border-dashed border-zinc-300 bg-white text-left transition hover:border-zinc-400 disabled:opacity-50"
            >
              {cardImagePreviewUrl ? (
                <SafeImage
                  src={cardImagePreviewUrl}
                  alt=""
                  width={448}
                  height={176}
                  className="h-44 w-full object-cover"
                />
              ) : (
                <span className="relative block h-40">
                  <QuestCategoryArtwork
                    category={form.category}
                    className="absolute inset-0 h-full w-full"
                  />
                  <span className="absolute inset-0 bg-black/16" />
                  <span className="glass-overlay absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl border p-3 text-white">
                    <span>
                      <span className="block text-sm font-bold">
                        Using the {form.category} default
                      </span>
                      <span className="mt-0.5 block text-xs font-semibold text-white/75">
                        Upload a photo anytime.
                      </span>
                    </span>
                    <span className="glass-action grid size-10 shrink-0 place-items-center rounded-full border text-zinc-800">
                      <Camera size={17} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                  </span>
                </span>
              )}
            </button>
            <input
              aria-label="Event card photo"
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
            <div className="glass-panel mt-2 grid grid-cols-2 gap-2 rounded-full border p-1">
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
                aria-label="Scheduled event time"
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

          <div>
            <p className="text-sm font-bold text-zinc-800">Who can see this?</p>
            <div className="glass-panel mt-2 grid grid-cols-3 gap-1 rounded-full border p-1">
              {visibilityOptions.map((option) => {
                const isSelected = (form.visibility ?? "local") === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => updateForm("visibility", option.value)}
                    className={`min-h-10 rounded-full px-2 py-2 text-sm font-bold transition disabled:opacity-50 ${
                      isSelected
                        ? "bg-zinc-950 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold leading-6 text-zinc-600">
              {
                visibilityOptions.find(
                  (option) => option.value === (form.visibility ?? "local"),
                )?.helper
              }
            </p>
          </div>

          <InvitePicker
            currentUserId={currentUserId}
            disabled={isSubmitting}
            friendProfiles={friendProfiles}
            selectedProfiles={invitees}
            onChange={setInvitees}
          />

        </div>

        <div className="glass-bar sticky bottom-0 z-20 shrink-0 border-t px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3">
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
              className="glass-chip min-h-12 flex-1 rounded-full border px-4 py-3 text-sm font-bold text-zinc-700 transition hover:bg-white/80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 flex-1 rounded-full bg-zinc-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:bg-zinc-300"
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
