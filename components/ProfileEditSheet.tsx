import {
  AtSign,
  Camera,
  Link2,
  Type,
  UserRound,
} from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { questCategories } from "@/data/demoQuests";
import {
  isValidHandle,
  normalizeHandle,
  normalizeWebsiteUrl,
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
  const [submitError, setSubmitError] = useState("");
  const [hiddenSaveError, setHiddenSaveError] = useState("");
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const canSave = isDirty && !isSaving;
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

    if (!file.type.startsWith("image/")) {
      setAvatarError("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Profile photo must be 5 MB or smaller.");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setAvatarPreviewUrl(objectUrl);
    setAvatarError("");
    clearLocalErrors();
    setAvatarFile(file);
  }

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
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
            <div className="relative h-24 w-24">
              {avatarPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreviewUrl}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover"
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
                accept="image/*"
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
    </div>
  );
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
