import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import type { Profile } from "@/types/quest";

export async function getAuthenticatedUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Could not read current session: ${error.message}`);
  }

  return data.user;
}

export async function signInWithEmailLink(email: string) {
  if (!email) {
    throw new Error("Enter an email address.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });

  if (error) {
    throw new Error(`Could not send sign-in link: ${error.message}`);
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
  const supabase = getSupabaseClient();
  const fallbackName = resolveDisplayName(user);
  const fallbackEmail = user.email ?? `${user.id}@plus1.local`;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: fallbackName,
        email: fallbackEmail,
        avatar_initials: initials(fallbackName),
      },
      {
        onConflict: "id",
      },
    )
    .select("id, display_name, email, avatar_initials, created_at")
    .single();

  if (error || !data) {
    throw new Error(`Could not load profile: ${error?.message ?? "Not found."}`);
  }

  return {
    id: data.id,
    displayName: data.display_name ?? fallbackName,
    email: data.email,
    avatarInitials: data.avatar_initials ?? initials(data.display_name),
  };
}

function resolveDisplayName(user: User) {
  const fromMetadata =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.email === "string"
          ? user.email.split("@")[0]
          : "plus1 user";

  return fromMetadata.trim() || "plus1 user";
}

function getAuthRedirectUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  return "http://localhost:3000/";
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
