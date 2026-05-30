import {
  AtSign,
  Camera,
  Link2,
  Save,
  Type,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, type ReactNode, useState } from "react";
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

  const normalizedDisplayName = displayName.trim().replace(/\s+/g, " ");
  const normalizedHandle = normalizeHandle(handle);
  const normalizedWebsiteUrl = websiteUrl.trim();
  const normalizedBio = bio.trim();
  const isDirty =
    normalizedDisplayName !== profile.displayName ||
    normalizedHandle !== profile.handle ||
    normalizedWebsiteUrl !== (profile.websiteUrl ?? "") ||
    normalizedBio !== (profile.bio ?? "");
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
      interests: profile.interests,
    });
  }

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
              <span className="grid h-24 w-24 place-items-center rounded-full bg-zinc-950 text-2xl font-semibold text-white">
                {profile.avatarInitials}
              </span>
              <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border border-white bg-zinc-100 text-zinc-700 shadow-sm">
                <Camera size={16} strokeWidth={1.9} aria-hidden="true" />
              </span>
            </div>
          </div>

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
