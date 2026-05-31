import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { Profile } from "@/types/quest";

export async function getAuthenticatedUser() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Could not read current session: ${error.message}`);
  }

  return session?.user ?? null;
}

export const PHONE_INPUT_ERROR = "Enter a 3-digit area code and 7-digit phone number.";

export function normalizeUsPhoneParts(areaCode: string, localNumber: string) {
  const area = areaCode.replace(/\D+/g, "");
  const local = localNumber.replace(/\D+/g, "");

  if (area.length !== 3 || local.length !== 7) {
    return "";
  }

  return `+1${area}${local}`;
}

export function isValidUsPhoneParts(areaCode: string, localNumber: string) {
  return normalizeUsPhoneParts(areaCode, localNumber) !== "";
}

export async function sendPhoneOtp(phone: string) {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    throw new Error(PHONE_INPUT_ERROR);
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
  });

  if (error) {
    throw new Error(`Could not send sign-in code: ${error.message}`);
  }
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const normalizedToken = token.trim();

  if (!normalizedPhone) {
    throw new Error(PHONE_INPUT_ERROR);
  }

  if (!normalizedToken) {
    throw new Error("Enter the 6-digit code.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: normalizedToken,
    type: "sms",
  });

  if (error) {
    throw new Error(`Could not verify sign-in code: ${error.message}`);
  }
}

export async function signOutCurrentUser() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Could not sign out: ${error.message}`);
  }
}

export function subscribeToAuthChanges(
  onChange: (event: AuthChangeEvent) => void,
) {
  const supabase = getSupabaseClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event) => {
    onChange(event);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function ensureProfile(user: User): Promise<Profile> {
  const fallbackName = resolveDisplayName(user);
  const fallbackEmail = normalizeProfileEmail(user.email);
  const fallbackPhone = user.phone ?? null;
  const fallbackInitials = initials(fallbackName);
  const supabase = getSupabaseClient();
  const { data: existingProfile, error: loadError } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", user.id)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Could not load profile: ${loadError.message}`);
  }

  if (existingProfile) {
    return mapProfileRow(existingProfile, fallbackName);
  }

  const { data, error } = await insertProfile({
    id: user.id,
    displayName: fallbackName,
    handle: createFallbackHandle(fallbackName, user.id),
    email: fallbackEmail,
    phone: fallbackPhone,
    avatarInitials: fallbackInitials,
  });

  if (error || !data) {
    throw new Error(`Could not load profile: ${error?.message ?? "Not found."}`);
  }

  return mapProfileRow(data, fallbackName);
}

export async function completeProfileSetup(
  userId: string,
  changes: { displayName: string; handle: string; interests?: string[] },
): Promise<Profile> {
  const nextDisplayName = normalizeDisplayName(changes.displayName);
  const nextHandle = normalizeHandle(changes.handle);

  if (nextDisplayName.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }
  validateHandle(nextHandle);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: nextDisplayName,
      handle: nextHandle,
      interests: changes.interests ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(profileSelect)
    .single();

  if (isDuplicateHandleError(error)) {
    throw new Error("That handle is already taken. Try another.");
  }

  if (error || !data) {
    throw new Error(
      `Could not finish profile setup: ${error?.message ?? "Profile not found."}`,
    );
  }

  return mapProfileRow(data, "plus1 user");
}

export async function updateProfile(
  userId: string,
  changes: {
    displayName: string;
    handle: string;
    bio: string | null;
    avatarUrl?: string | null;
    websiteUrl?: string | null;
    interests?: string[];
  },
): Promise<Profile> {
  const nextDisplayName = normalizeDisplayName(changes.displayName);
  const nextHandle = normalizeHandle(changes.handle);
  const nextWebsiteUrl =
    changes.websiteUrl === undefined
      ? undefined
      : normalizeWebsiteUrl(changes.websiteUrl);

  if (nextDisplayName.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }
  validateHandle(nextHandle);

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: nextDisplayName,
      handle: nextHandle,
      ...(changes.avatarUrl !== undefined ? { avatar_url: changes.avatarUrl } : {}),
      ...(nextWebsiteUrl !== undefined ? { website_url: nextWebsiteUrl } : {}),
      bio: normalizeBio(changes.bio),
      ...(changes.interests ? { interests: changes.interests } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(profileSelect)
    .single();

  if (isDuplicateHandleError(error)) {
    throw new Error("That handle is already taken. Try another.");
  }

  if (error || !data) {
    throw new Error(
      `Could not update profile: ${error?.message ?? "Profile not found."}`,
    );
  }

  return mapProfileRow(data, "plus1 user");
}

export async function uploadProfilePhoto(userId: string, file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file for your profile photo.");
  }

  const maxBytes = 5 * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error("Profile photo must be 5 MB or smaller.");
  }

  const supabase = getSupabaseClient();
  const extension = getImageExtension(file);
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw new Error(`Could not upload profile photo: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("profile-photos").getPublicUrl(path);

  return publicUrl;
}

export function isLikelyAutoDisplayName(displayName: string) {
  const normalized = displayName.trim().toLowerCase();
  return /^plus1(?:\s+\d{4}| user)(?:-[a-z0-9]{6})?$/.test(normalized);
}

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export function isValidE164PhoneNumber(phone: string) {
  return E164_PATTERN.test(phone);
}

export function normalizePhoneNumber(phone: string) {
  const trimmed = phone.trim();

  if (!trimmed) {
    return "";
  }

  let digits = trimmed.replace(/\D+/g, "");
  const hadPlus = trimmed.startsWith("+");

  if (!hadPlus && digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (!digits) {
    return "";
  }

  if (hadPlus) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export function isValidHandle(handle: string) {
  return /^[a-z0-9._]{3,30}$/.test(handle);
}

export function normalizeWebsiteUrl(value: string | null) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }

    return url.toString().slice(0, 255);
  } catch {
    throw new Error("Enter a valid website link.");
  }
}

function validateHandle(handle: string) {
  if (!isValidHandle(handle)) {
    throw new Error(
      "Handle must be 3-30 characters using letters, numbers, periods, or underscores.",
    );
  }
}

const profileSelect =
  "id, display_name, handle, email, phone, avatar_initials, avatar_url, website_url, bio, interests, created_at, updated_at";

function insertProfile(input: {
  id: string;
  displayName: string;
  handle: string;
  email: string | null;
  phone: string | null;
  avatarInitials: string;
}) {
  const supabase = getSupabaseClient();

  return supabase
    .from("profiles")
    .insert({
      id: input.id,
      display_name: input.displayName,
      handle: input.handle,
      email: input.email,
      phone: input.phone,
      avatar_initials: input.avatarInitials,
    })
    .select(profileSelect)
    .single();
}

function mapProfileRow(
  profile: {
    id: string;
    display_name: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    avatar_initials: string | null;
    avatar_url: string | null;
    website_url: string | null;
    bio: string | null;
    interests: string[] | null;
  },
  fallbackName: string,
): Profile {
  const displayName = profile.display_name ?? fallbackName;

  return {
    id: profile.id,
    displayName,
    handle: profile.handle ?? createFallbackHandle(displayName, profile.id),
    email: profile.email,
    phone: profile.phone,
    avatarInitials: profile.avatar_initials ?? initials(displayName),
    avatarUrl: profile.avatar_url,
    websiteUrl: profile.website_url,
    bio: profile.bio,
    interests: profile.interests ?? [],
  };
}

function resolveDisplayName(user: User) {
  const fromPhone = formatPhoneDisplayName(user.phone);
  const fromMetadata =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.email === "string"
          ? user.email.split("@")[0]
          : fromPhone;

  return fromMetadata.trim() || fromPhone;
}

function initials(name: string | null) {
  return (name ?? "DU")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function normalizeProfileEmail(email: string | null | undefined) {
  const trimmed = email?.trim() ?? "";
  return trimmed || null;
}

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function normalizeBio(value: string | null) {
  const nextBio = value?.trim() ?? "";
  return nextBio ? nextBio.slice(0, 150) : null;
}

function formatPhoneDisplayName(phone?: string | null) {
  const normalized = normalizePhoneNumber(phone ?? "").replace(/\D+/g, "");

  if (normalized.length >= 4) {
    return `plus1 ${normalized.slice(-4)}`;
  }

  return "plus1 user";
}

function createFallbackHandle(displayName: string, userId: string) {
  const base =
    normalizeHandle(displayName)
      .replace(/[^a-z0-9._]+/g, ".")
      .replace(/[._]{2,}/g, ".")
      .replace(/^[._]+|[._]+$/g, "")
      .slice(0, 20) || "plus1";
  const suffix = userId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `${base}.${suffix}`.slice(0, 30);
}

function isDuplicateHandleError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "23505" &&
    (error.message?.includes("profiles_handle") ?? false)
  );
}

function getImageExtension(file: File) {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}
