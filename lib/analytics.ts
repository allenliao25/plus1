/**
 * Thin PostHog wrapper for the web share/guest-RSVP funnel + auth flow.
 *
 * No-op by default so call sites never null-check: if
 * NEXT_PUBLIC_POSTHOG_KEY is unset (the case tonight), init() does nothing and
 * every track/identify/reset silently returns. Mirrors the OPENAI_API_KEY
 * pattern — code paths ship, keys arrive later.
 *
 * Client-only. Import from client components / instrumentation-client.
 */
import type { PostHog } from "posthog-js";

let client: PostHog | null = null;

/**
 * Initialize PostHog once, only in the browser and only when a key is set.
 * Called from instrumentation-client.ts before hydration.
 */
export async function initAnalytics(): Promise<void> {
  if (client || typeof window === "undefined") {
    return;
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    return;
  }

  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  try {
    const posthog = (await import("posthog-js")).default;
    posthog.init(key, {
      api_host: host,
      // The funnel is a handful of explicit events — DOM autocapture would just
      // add noise (and scrape guest names off the RSVP form). Keep it manual.
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      // Never record replays; not in scope and privacy-sensitive on a public page.
      disable_session_recording: true,
      person_profiles: "identified_only",
    });
    client = posthog;
  } catch {
    // Analytics must never break the funnel page.
  }
}

export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  client?.capture(event, properties);
}

export function identify(
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  client?.identify(distinctId, properties);
}

export function resetAnalytics(): void {
  client?.reset();
}
