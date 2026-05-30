import type { User } from "@supabase/supabase-js";
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

export async function sendPhoneOtp(phone: string) {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    throw new Error("Enter your phone number with country code.");
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
    throw new Error("Enter your phone number with country code.");
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

export function subscribeToAuthChanges(onChange: () => void) {
  const supabase = getSupabaseClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(() => {
    onChange();
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function ensureProfile(user: User): Promise<Profile> {
  const fallbackName = resolveDisplayName(user);
  const fallbackEmail = user.email ?? null;
  const fallbackPhone = user.phone ?? null;
  const fallbackInitials = initials(fallbackName);

  const { data, error } = await upsertProfile({
    id: user.id,
    displayName: fallbackName,
    email: fallbackEmail,
    phone: fallbackPhone,
    avatarInitials: fallbackInitials,
  });

  const shouldRetryWithUniqueName =
    error?.code === "23505" && error.message.includes("profiles_display_name");

  const retryResult = shouldRetryWithUniqueName
    ? await upsertProfile({
        id: user.id,
        displayName: `${fallbackName}-${user.id.slice(0, 6)}`,
        email: fallbackEmail,
        phone: fallbackPhone,
        avatarInitials: fallbackInitials,
      })
    : null;

  const profile = retryResult?.data ?? data;
  const profileError = retryResult?.error ?? error;

  if (profileError || !profile) {
    throw new Error(`Could not load profile: ${profileError?.message ?? "Not found."}`);
  }

  return {
    id: profile.id,
    displayName: profile.display_name ?? fallbackName,
    email: profile.email,
    phone: profile.phone,
    avatarInitials: profile.avatar_initials ?? initials(profile.display_name),
    bio: profile.bio,
    interests: profile.interests ?? [],
  };
}

export async function completeProfileSetup(
  userId: string,
  changes: { displayName: string; interests: string[] },
): Promise<Profile> {
  const nextDisplayName = normalizeDisplayName(changes.displayName);

  if (nextDisplayName.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: nextDisplayName,
      interests: changes.interests,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(
      "id, display_name, email, phone, avatar_initials, bio, interests, created_at, updated_at",
    )
    .single();

  const duplicateDisplayName =
    error?.code === "23505" && error.message.includes("profiles_display_name");
  if (duplicateDisplayName) {
    throw new Error("That display name is already taken. Try another.");
  }

  if (error || !data) {
    throw new Error(
      `Could not finish profile setup: ${error?.message ?? "Profile not found."}`,
    );
  }

  return {
    id: data.id,
    displayName: data.display_name ?? "plus1 user",
    email: data.email,
    phone: data.phone,
    avatarInitials: data.avatar_initials ?? initials(data.display_name),
    bio: data.bio,
    interests: data.interests ?? [],
  };
}

export async function updateProfile(
  userId: string,
  changes: { bio: string | null; interests: string[] },
): Promise<Profile> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      bio: changes.bio,
      interests: changes.interests,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(
      "id, display_name, email, phone, avatar_initials, bio, interests, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(
      `Could not update profile: ${error?.message ?? "Profile not found."}`,
    );
  }

  return {
    id: data.id,
    displayName: data.display_name ?? "plus1 user",
    email: data.email,
    phone: data.phone,
    avatarInitials: data.avatar_initials ?? initials(data.display_name),
    bio: data.bio,
    interests: data.interests ?? [],
  };
}

export function isLikelyAutoDisplayName(displayName: string) {
  const normalized = displayName.trim().toLowerCase();
  return /^plus1(?:\s+\d{4}| user)(?:-[a-z0-9]{6})?$/.test(normalized);
}

export function normalizePhoneNumber(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D+/g, "");

  if (!digits) {
    return "";
  }
  if (trimmed.startsWith("+")) {
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

function upsertProfile(input: {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarInitials: string;
}) {
  const supabase = getSupabaseClient();

  return supabase
    .from("profiles")
    .upsert(
      {
        id: input.id,
        display_name: input.displayName,
        email: input.email,
        phone: input.phone,
        avatar_initials: input.avatarInitials,
      },
      {
        onConflict: "id",
      },
    )
    .select("id, display_name, email, phone, avatar_initials, bio, interests, created_at, updated_at")
    .single();
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

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function formatPhoneDisplayName(phone?: string | null) {
  const normalized = normalizePhoneNumber(phone ?? "").replace(/\D+/g, "");

  if (normalized.length >= 4) {
    return `plus1 ${normalized.slice(-4)}`;
  }

  return "plus1 user";
}
