import { Camera, Sparkles, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import InvitePicker from "@/components/InvitePicker";
import QuestCategoryArtwork from "@/components/QuestCategoryArtwork";
import SafeImage from "@/components/SafeImage";
import { questCategories } from "@/data/demoQuests";
import { validateQuestCardImageFile } from "@/lib/questService";
import type {
  NewQuestInput,
  QuestCategory,
  QuestInviteProfile,
  QuestVisibility,
} from "@/types/quest";

type CreateQuestFormProps = {
  currentUserId: string;
  friendProfiles?: QuestInviteProfile[];
  isSubmitting: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  /**
   * Seeds the form once on mount. Remount the form with a new `key` to apply
   * an AI draft; the draft is never auto-posted.
   */
  initialValues?: NewQuestInput;
  initialInvitees?: QuestInviteProfile[];
  /** True when this mount was seeded by a Smart Draft; drives the header + scroll. */
  wasDrafted?: boolean;
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
  maxPeople: null,
  visibility: "local",
};

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

export default function CreateQuestForm(props: CreateQuestFormProps) {
  return useCreateQuestFormContent(props);
}

function useCreateQuestFormContent({
  currentUserId,
  friendProfiles = [],
  isSubmitting,
  submitLabel = "Post event",
  submittingLabel = "Posting…",
  initialValues,
  initialInvitees,
  wasDrafted = false,
  onCreateQuest,
}: CreateQuestFormProps) {
  const [form, setForm] = useState<NewQuestInput>({
    ...defaultForm,
    ...initialValues,
    visibility: initialValues?.visibility ?? defaultForm.visibility,
  });
  const [timeMode, setTimeMode] = useState<TimeMode>(
    initialValues?.startTime ? "scheduled" : "asap",
  );
  const [error, setError] = useState("");
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreviewUrl, setCardImagePreviewUrl] = useState<string | null>(
    null,
  );
  const [cardImageError, setCardImageError] = useState("");
  const [invitees, setInvitees] = useState<QuestInviteProfile[]>(
    initialInvitees ?? [],
  );
  const cardImageInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

    const maxPeople = form.maxPeople;
    if (
      maxPeople !== null &&
      (!Number.isInteger(maxPeople) || maxPeople < 2 || maxPeople > 12)
    ) {
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
          visibility: form.visibility ?? "local",
          inviteeIds: invitees.map((invitee) => invitee.id),
          description:
            form.description.trim() || "No extra details yet. Just show up.",
        },
        cardImageFile,
      );
      setForm(defaultForm);
      setInvitees([]);
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
      const objectUrl = URL.createObjectURL(file);
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
    setCardImageFile(null);
    setCardImagePreviewUrl(null);
  }

  useEffect(() => {
    if (!cardImagePreviewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(cardImagePreviewUrl);
    };
  }, [cardImagePreviewUrl]);

  // When seeded by a Smart Draft, bring the prefilled form into view so the
  // user can review and reach "Post event".
  useEffect(() => {
    if (wasDrafted) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [wasDrafted]);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {wasDrafted ? (
        <p className="glass-chip flex items-center gap-2 rounded-card border px-4 py-3 text-sm font-semibold text-ink-soft">
          <Sparkles
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-muted"
          />
          Drafted for you — check the details and post.
        </p>
      ) : (
        <p className="text-xs font-bold uppercase tracking-caps text-faint">
          Or fill it in yourself
        </p>
      )}

      {error ? (
        <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <label className="block">
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-ink-soft">Title</span>
          <RequiredBadge />
        </span>
        <input
          value={form.title}
          onChange={(event) => updateForm("title", event.target.value)}
          placeholder="Dinner at Wilbur"
          className="mt-2 w-full rounded-card border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-faint focus:border-faint"
        />
      </label>

      <div>
        <p className="text-sm font-bold text-ink-soft">Category</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {questCategories.map((category) => {
            const isSelected = form.category === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => updateForm("category", category as QuestCategory)}
                className={`pressable min-h-11 rounded-full border px-3 py-2.5 text-sm font-bold ${
                  isSelected
                    ? "border-ink bg-ink text-white shadow-sm"
                    : "glass-chip border text-ink-soft hover:bg-white/80"
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
          <span className="text-sm font-bold text-ink-soft">Location</span>
          <RequiredBadge />
        </span>
        <input
          value={form.location}
          onChange={(event) => updateForm("location", event.target.value)}
          placeholder="Green Library"
          className="mt-2 w-full rounded-card border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-faint focus:border-faint"
        />
      </label>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink-soft">Time</p>
          <RequiredBadge />
        </div>
        <div className="glass-panel mt-2 grid grid-cols-2 gap-2 rounded-full border p-1">
          {(["asap", "scheduled"] as TimeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTimeMode(mode)}
              className={`pressable min-h-10 rounded-full px-3 py-2 text-sm font-bold ${
                timeMode === mode
                  ? "bg-ink text-white shadow-sm"
                  : "text-muted hover:text-ink-soft"
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
            className="mt-2 w-full rounded-card border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-faint focus:border-faint"
          />
        ) : (
          <p className="mt-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-sm font-semibold text-muted">
            Shows as ASAP and stays open until you close it.
          </p>
        )}
      </div>

      <label className="block">
        <span className="text-sm font-bold text-ink-soft">Description</span>
        <textarea
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
          placeholder="What should people know before joining?"
          rows={4}
          className="mt-2 w-full resize-none rounded-card border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-faint focus:border-faint"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-ink-soft">Max people</span>
        <input
          type="number"
          min={2}
          max={12}
          value={form.maxPeople ?? ""}
          placeholder="No max"
          onChange={(event) =>
            updateForm(
              "maxPeople",
              event.target.value ? Number(event.target.value) : null,
            )
          }
          className="mt-2 w-full rounded-card border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-faint"
        />
      </label>

      <div>
        <p className="text-sm font-bold text-ink-soft">Who can see this?</p>
        <div className="glass-panel mt-2 grid grid-cols-3 gap-1 rounded-full border p-1">
          {visibilityOptions.map((option) => {
            const isSelected = (form.visibility ?? "local") === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={isSubmitting}
                onClick={() => updateForm("visibility", option.value)}
                className={`pressable min-h-10 rounded-full px-2 py-2 text-sm font-bold disabled:opacity-50 ${
                  isSelected
                    ? "bg-ink text-white shadow-sm"
                    : "text-muted hover:text-ink-soft"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 rounded-card border border-line bg-surface-2 px-4 py-3 text-sm font-semibold leading-6 text-muted">
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

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink-soft">Card photo</p>
          <span className="text-xs font-bold uppercase tracking-caps text-faint">
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
              className="glass-chip pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-ink-soft hover:bg-white/80 disabled:opacity-50"
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
          className="holo-thumb mt-2 w-full overflow-hidden rounded-hero border border-dashed border-faint bg-surface-2 text-left transition hover:border-muted hover:bg-surface disabled:opacity-50"
        >
          {cardImagePreviewUrl ? (
            <SafeImage
              src={cardImagePreviewUrl}
              alt=""
              width={448}
              height={192}
              className="h-48 w-full object-cover"
            />
          ) : (
            <span className="relative block h-40">
              <QuestCategoryArtwork
                category={form.category}
                className="absolute inset-0 h-full w-full"
              />
              <span className="absolute inset-0 bg-black/16" />
              <span className="glass-overlay absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-card border p-3 text-white">
                <span>
                  <span className="block text-sm font-bold">
                    Using the {form.category} default
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-white/75">
                    Upload a photo anytime.
                  </span>
                </span>
                <span className="glass-action grid size-10 shrink-0 place-items-center rounded-full border text-ink-soft">
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

      <button
        type="submit"
        disabled={isSubmitting}
        className="pressable min-h-12 w-full rounded-full bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:bg-faint"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}

function RequiredBadge() {
  return (
    <span className="text-xs font-bold uppercase tracking-caps text-faint">
      Required
    </span>
  );
}
