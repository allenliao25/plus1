import {
  AtSign,
  Camera,
  Link2,
  Save,
  Type,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { questCategories } from "@/data/demoQuests";
import {
  isValidHandle,
  normalizeHandle,
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
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedDisplayName = displayName.trim().replace(/\s+/g, " ");
  const normalizedHandle = normalizeHandle(handle);
  const normalizedWebsiteUrl = websiteUrl.trim();
  const normalizedBio = bio.trim();
  const interestsChanged =
    selectedInterests.length !== profile.interests.length ||
    selectedInterests.some((interest) => !profile.interests.includes(interest));
  const isDirty =
    normalizedDisplayName !== profile.displayName ||
    normalizedHandle !== profile.handle ||
    normalizedWebsiteUrl !== (profile.websiteUrl ?? "") ||
    normalizedBio !== (profile.bio ?? "") ||
    interestsChanged ||
    Boolean(avatarFile);
  const canSave =
    normalizedDisplayName.length >= 2 &&
    isValidHandle(normalizedHandle) &&
    isDirty &&
    !isSaving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    await onSave({
      displayName: normalizedDisplayName,
      handle: normalizedHandle,
      websiteUrl: normalizedWebsiteUrl || null,
      bio: normalizedBio || null,
      interests: selectedInterests,
      avatarFile,
    });
  }

  function toggleInterest(interest: string) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[456px] overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            aria-label="Cancel profile edits"
            className="grid h-10 w-10 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-50"
          >
            <X size={19} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <h3 className="text-base font-semibold text-zinc-950">
            Edit profile
          </h3>
          <button
            type="submit"
            disabled={!canSave}
            aria-label="Save profile"
            className="grid h-10 w-10 place-items-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:bg-zinc-300"
          >
            <Save size={18} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-5 py-5">
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
            <p className="mt-3 text-center text-sm font-medium text-red-600">
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
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                className="w-full bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>

            <ProfileField icon={<AtSign size={18} strokeWidth={1.9} />} label="Handle">
              <input
                type="text"
                required
                maxLength={31}
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="your.handle"
                className="w-full bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>

            <ProfileField icon={<Link2 size={18} strokeWidth={1.9} />} label="Website">
              <input
                type="text"
                inputMode="url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="https://your-site.com"
                className="w-full bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>

            <ProfileField icon={<Type size={18} strokeWidth={1.9} />} label="Bio">
              <textarea
                value={bio}
                maxLength={150}
                rows={4}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Tell people what you're about."
                className="w-full resize-none bg-transparent text-base leading-6 text-zinc-950 outline-none placeholder:text-zinc-400"
              />
            </ProfileField>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-zinc-400">
            <span>Handles use letters, numbers, periods, and underscores.</span>
            <span>{normalizedBio.length}/150</span>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-zinc-700">Interests</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {questCategories.map((interest) => {
                const isSelected = selectedInterests.includes(interest);

                return (
                  <button
                    key={interest}
                    type="button"
                    disabled={isSaving}
                    onClick={() => toggleInterest(interest)}
                    className={`min-h-11 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
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

          {saveError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {saveError}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
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
    <label className="grid grid-cols-[1.5rem_5rem_1fr] items-start gap-3 px-4 py-3.5">
      <span className="pt-0.5 text-zinc-400" aria-hidden="true">
        {icon}
      </span>
      <span className="pt-0.5 text-sm font-semibold text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
