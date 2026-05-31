import {
  AtSign,
  Camera,
  Link2,
  Type,
  UserRound,
} from "lucide-react";
import {
  FormEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { questCategories } from "@/data/demoQuests";
import {
  isValidHandle,
  normalizeHandle,
  normalizeWebsiteUrl,
  validateProfilePhotoFile,
} from "@/lib/authService";
import type { Profile } from "@/types/quest";

export type ProfileIdentityChanges = {
  displayName: string;
  handle: string;
  websiteUrl: string | null;
  bio: string | null;
  interests: string[];
  avatarFile?: File | null;
};

type ProfileEditSheetProps = {
  profile: Profile;
  isSaving: boolean;
  saveError: string;
  onCancel: () => void;
  onSave: (changes: ProfileIdentityChanges) => Promise<void> | void;
};

type CropOffset = {
  x: number;
  y: number;
};

const CROP_PREVIEW_SIZE = 260;
const CROP_OUTPUT_SIZE = 512;
const DEFAULT_CROP_OFFSET = { x: 0, y: 0 };

export default function ProfileEditSheet({
  profile,
  isSaving,
  saveError,
  onCancel,
  onSave,
}: ProfileEditSheetProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [websiteUrl, setWebsiteUrl] = useState(profile.websiteUrl ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [selectedInterests, setSelectedInterests] = useState(profile.interests);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(profile.avatarUrl);
  const [avatarError, setAvatarError] = useState("");
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropSourceName, setCropSourceName] = useState("profile-photo.jpg");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState<CropOffset>(DEFAULT_CROP_OFFSET);
  const [cropNaturalSize, setCropNaturalSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const [isCropDragging, setIsCropDragging] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [hiddenSaveError, setHiddenSaveError] = useState("");
  const objectUrlRef = useRef<string | null>(null);
  const cropObjectUrlRef = useRef<string | null>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropDragRef = useRef<{
    offset: CropOffset;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const normalizedDisplayName = displayName.trim().replace(/\s+/g, " ");
  const normalizedHandle = normalizeHandle(handle);
  const normalizedWebsiteUrl = websiteUrl.trim();
  const normalizedBio = bio.trim();
  const websiteValidation = validateWebsiteInput(normalizedWebsiteUrl);
  const websiteChanged = websiteValidation.error
    ? normalizedWebsiteUrl !== (profile.websiteUrl ?? "")
    : (websiteValidation.value ?? "") !== (profile.websiteUrl ?? "");
  const interestsChanged =
    selectedInterests.length !== profile.interests.length ||
    selectedInterests.some((interest) => !profile.interests.includes(interest));
  const isDirty =
    normalizedDisplayName !== profile.displayName ||
    normalizedHandle !== profile.handle ||
    websiteChanged ||
    normalizedBio !== (profile.bio ?? "") ||
    interestsChanged ||
    Boolean(avatarFile);
  const canSave = isDirty && !isSaving && !cropSourceUrl;
  const displayedError =
    submitError || (hiddenSaveError === saveError ? "" : saveError);

  function clearLocalErrors() {
    setSubmitError("");
    setHiddenSaveError(saveError);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    const validationError = getValidationError({
      displayName: normalizedDisplayName,
      handle: normalizedHandle,
      websiteError: websiteValidation.error,
    });

    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitError("");
    setHiddenSaveError("");

    try {
      await onSave({
        displayName: normalizedDisplayName,
        handle: normalizedHandle,
        websiteUrl: websiteValidation.value,
        bio: normalizedBio || null,
        interests: selectedInterests,
        avatarFile,
      });
    } catch (error) {
      setSubmitError(readErrorMessage(error));
    }
  }

  function toggleInterest(interest: string) {
    clearLocalErrors();
    setSelectedInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    );
  }

  function handleAvatarFile(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      validateProfilePhotoFile(file);
    } catch (error) {
      setAvatarError(readErrorMessage(error));
      return;
    }

    clearCropSource();

    const objectUrl = URL.createObjectURL(file);
    cropObjectUrlRef.current = objectUrl;
    setCropSourceUrl(objectUrl);
    setCropSourceName(file.name || "profile-photo.jpg");
    setCropZoom(1);
    setCropOffset(DEFAULT_CROP_OFFSET);
    setCropNaturalSize(null);
    setAvatarError("");
    clearLocalErrors();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearCropSource() {
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }

    cropDragRef.current = null;
    setIsCropDragging(false);
    setCropSourceUrl(null);
    setCropNaturalSize(null);
  }

  function handleCancelCrop() {
    clearCropSource();
    setCropZoom(1);
    setCropOffset(DEFAULT_CROP_OFFSET);
  }

  function clampCropOffset(nextOffset: CropOffset, nextZoom = cropZoom) {
    const image = cropImageRef.current;

    if (!image?.naturalWidth || !image.naturalHeight) {
      return nextOffset;
    }

    const baseScale = Math.max(
      CROP_PREVIEW_SIZE / image.naturalWidth,
      CROP_PREVIEW_SIZE / image.naturalHeight,
    );
    const renderedWidth = image.naturalWidth * baseScale * nextZoom;
    const renderedHeight = image.naturalHeight * baseScale * nextZoom;
    const maxX = Math.max(0, (renderedWidth - CROP_PREVIEW_SIZE) / 2);
    const maxY = Math.max(0, (renderedHeight - CROP_PREVIEW_SIZE) / 2);

    return {
      x: clamp(nextOffset.x, -maxX, maxX),
      y: clamp(nextOffset.y, -maxY, maxY),
    };
  }

  function handleCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!cropSourceUrl) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      offset: cropOffset,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsCropDragging(true);
  }

  function handleCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    setCropOffset(
      clampCropOffset({
        x: drag.offset.x + event.clientX - drag.startX,
        y: drag.offset.y + event.clientY - drag.startY,
      }),
    );
  }

  function handleCropPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
      setIsCropDragging(false);
    }
  }

  function handleCropZoom(nextZoom: number) {
    setCropZoom(nextZoom);
    setCropOffset((current) => clampCropOffset(current, nextZoom));
  }

  async function handleApplyCrop() {
    const image = cropImageRef.current;

    if (!image || !cropSourceUrl) {
      return;
    }

    try {
      const file = await cropProfileImage({
        image,
        fileName: cropSourceName,
        offset: clampCropOffset(cropOffset),
        zoom: cropZoom,
      });

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const previewUrl = URL.createObjectURL(file);
      objectUrlRef.current = previewUrl;
      setAvatarPreviewUrl(previewUrl);
      setAvatarFile(file);
      setAvatarError("");
      clearLocalErrors();
      clearCropSource();
    } catch (error) {
      setAvatarError(readErrorMessage(error));
    }
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      if (cropObjectUrlRef.current) {
        URL.revokeObjectURL(cropObjectUrlRef.current);
      }
    };
  }, []);

  const cropBaseScale = cropNaturalSize
    ? Math.max(
        CROP_PREVIEW_SIZE / cropNaturalSize.width,
        CROP_PREVIEW_SIZE / cropNaturalSize.height,
      )
    : 1;
  const cropRenderedWidth = cropNaturalSize
    ? cropNaturalSize.width * cropBaseScale
    : CROP_PREVIEW_SIZE;
  const cropRenderedHeight = cropNaturalSize
    ? cropNaturalSize.height * cropBaseScale
    : CROP_PREVIEW_SIZE;

  const editor = (
    <div className="fixed inset-0 z-50 bg-white text-zinc-950">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-[var(--plus1-app-height,100vh)] w-full max-w-[480px] flex-col overflow-hidden bg-white"
      >
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/92 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] backdrop-blur-xl">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            aria-label="Cancel profile edits"
            className="min-h-10 rounded-full px-1 text-sm font-bold text-zinc-700 transition hover:text-zinc-950 disabled:opacity-50"
          >
            Cancel
          </button>
          <h3 className="text-base font-bold text-zinc-950">
            Edit profile
          </h3>
          <button
            type="submit"
            disabled={!canSave}
            aria-label="Save profile"
            className="min-h-10 rounded-full px-1 text-sm font-bold text-zinc-950 transition hover:text-zinc-700 disabled:text-zinc-300"
          >
            {isSaving ? "Saving" : "Save"}
          </button>
        </div>

        <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="flex justify-center">
            <div className="relative aspect-square h-24 w-24 overflow-visible rounded-full">
              {avatarPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreviewUrl}
                  alt=""
                  onError={() => setAvatarPreviewUrl(null)}
                  className="aspect-square h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-full bg-zinc-950 text-2xl font-semibold text-white">
                  {profile.avatarInitials}
                </span>
              )}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Choose profile photo"
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-white bg-zinc-100 text-zinc-700 shadow-sm transition hover:bg-zinc-200 disabled:opacity-50"
              >
                <Camera size={16} strokeWidth={1.9} aria-hidden="true" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => handleAvatarFile(event.target.files?.[0])}
              />
            </div>
          </div>
          {avatarError ? (
            <p className="mt-3 text-center text-sm font-bold text-red-600">
              {avatarError}
            </p>
          ) : null}

          <div className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            <ProfileField icon={<UserRound size={18} strokeWidth={1.9} />} label="Name">
              <input
                type="text"
                required
                maxLength={32}
                value={displayName}
                onChange={(event) => {
                  clearLocalErrors();
                  setDisplayName(event.target.value);
                }}
                placeholder="Your name"
                className="min-w-0 w-full bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>

            <ProfileField icon={<AtSign size={18} strokeWidth={1.9} />} label="Handle">
              <input
                type="text"
                required
                maxLength={31}
                value={handle}
                onChange={(event) => {
                  clearLocalErrors();
                  setHandle(event.target.value);
                }}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="your.handle"
                className="min-w-0 w-full bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>

            <ProfileField icon={<Link2 size={18} strokeWidth={1.9} />} label="Website">
              <input
                type="text"
                inputMode="url"
                value={websiteUrl}
                onChange={(event) => {
                  clearLocalErrors();
                  setWebsiteUrl(event.target.value);
                }}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="https://your-site.com"
                className="min-w-0 w-full bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>

            <ProfileField icon={<Type size={18} strokeWidth={1.9} />} label="Bio">
              <textarea
                value={bio}
                maxLength={150}
                rows={4}
                onChange={(event) => {
                  clearLocalErrors();
                  setBio(event.target.value);
                }}
                placeholder="Tell people what you're about."
                className="min-w-0 w-full resize-none bg-transparent text-base leading-6 text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-zinc-400">
            <span>Handles use letters, numbers, periods, and underscores.</span>
            <span>{normalizedBio.length}/150</span>
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-zinc-800">Interests</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {questCategories.map((interest) => {
                const isSelected = selectedInterests.includes(interest);

                return (
                  <button
                    key={interest}
                    type="button"
                    disabled={isSaving}
                    onClick={() => toggleInterest(interest)}
                    className={`min-h-11 rounded-full border px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-zinc-200 bg-white/94 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3 backdrop-blur-xl">
          {displayedError ? (
            <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {displayedError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!canSave}
            className="min-h-12 w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isSaving ? "Saving profile..." : isDirty ? "Save changes" : "No changes"}
          </button>
        </div>
      </form>

      {cropSourceUrl ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-white/95 px-5 backdrop-blur-xl">
          <div className="w-full max-w-[360px] rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="text-center">
              <h3 className="text-lg font-bold text-zinc-950">
                Adjust profile photo
              </h3>
              <p className="mt-1 text-sm leading-5 text-zinc-500">
                Drag and zoom so it fits the circle.
              </p>
            </div>

            <div
              className={`relative mx-auto mt-5 aspect-square w-[260px] touch-none overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200 ${
                isCropDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerEnd}
              onPointerCancel={handleCropPointerEnd}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={cropImageRef}
                src={cropSourceUrl}
                alt=""
                draggable={false}
                onLoad={(event) => {
                  setCropNaturalSize({
                    height: event.currentTarget.naturalHeight,
                    width: event.currentTarget.naturalWidth,
                  });
                  setCropOffset((current) =>
                    clampCropOffset(current, cropZoom),
                  );
                }}
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  height: `${cropRenderedHeight}px`,
                  transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropZoom})`,
                  transformOrigin: "center",
                  width: `${cropRenderedWidth}px`,
                }}
              />
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-400">
                Zoom
              </span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={(event) => handleCropZoom(Number(event.target.value))}
                className="mt-3 w-full accent-zinc-950"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCancelCrop}
                className="min-h-11 rounded-full bg-zinc-100 px-4 text-sm font-bold text-zinc-950 transition hover:bg-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className="min-h-11 rounded-full bg-zinc-950 px-4 text-sm font-bold text-white transition hover:bg-zinc-800"
              >
                Use photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (typeof document === "undefined") {
    return editor;
  }

  return createPortal(editor, document.body);
}

function validateWebsiteInput(value: string) {
  try {
    return {
      error: "",
      value: normalizeWebsiteUrl(value),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Enter a valid website link.",
      value: null,
    };
  }
}

function getValidationError({
  displayName,
  handle,
  websiteError,
}: {
  displayName: string;
  handle: string;
  websiteError: string;
}) {
  if (displayName.length < 2) {
    return "Name must be at least 2 characters.";
  }

  if (!isValidHandle(handle)) {
    return "Handle must be 3-30 characters using letters, numbers, periods, or underscores.";
  }

  return websiteError;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not save profile.";
}

async function cropProfileImage({
  fileName,
  image,
  offset,
  zoom,
}: {
  fileName: string;
  image: HTMLImageElement;
  offset: CropOffset;
  zoom: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not crop that photo.");
  }

  const baseScale = Math.max(
    CROP_PREVIEW_SIZE / image.naturalWidth,
    CROP_PREVIEW_SIZE / image.naturalHeight,
  );
  const scale = baseScale * zoom;
  const renderedLeft =
    (CROP_PREVIEW_SIZE - image.naturalWidth * scale) / 2 + offset.x;
  const renderedTop =
    (CROP_PREVIEW_SIZE - image.naturalHeight * scale) / 2 + offset.y;
  const sourceX = -renderedLeft / scale;
  const sourceY = -renderedTop / scale;
  const sourceSize = CROP_PREVIEW_SIZE / scale;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    CROP_OUTPUT_SIZE,
    CROP_OUTPUT_SIZE,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }

        reject(new Error("Could not crop that photo."));
      },
      "image/jpeg",
      0.92,
    );
  });
  const safeName = fileName.replace(/\.[^.]+$/, "") || "profile-photo";

  return new File([blob], `${safeName}-crop.jpg`, { type: "image/jpeg" });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ProfileField({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <label className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3.5">
      <span className="pt-0.5 text-zinc-400" aria-hidden="true">{icon}</span>
      <span className="text-sm font-bold text-zinc-700">{label}</span>
      <span className="col-start-2 min-w-0">{children}</span>
    </label>
  );
}
