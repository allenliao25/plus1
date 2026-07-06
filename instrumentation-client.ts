/**
 * Client-side instrumentation (runs after document load, before hydration).
 *
 * Two gated, no-op-by-default integrations:
 *  - PostHog product analytics (NEXT_PUBLIC_POSTHOG_KEY)
 *  - Sentry crash/error reporting (NEXT_PUBLIC_SENTRY_DSN)
 *
 * Sentry path chosen: minimal @sentry/browser init rather than @sentry/nextjs.
 * The full @sentry/nextjs wizard is invasive (wraps next.config, adds
 * sentry.*.config files + a build plugin + source-map upload). A plain
 * Sentry.init() installs global window.onerror / unhandledrejection handlers,
 * which is all we need tonight. No keys are set, so this is dormant code.
 */
import { initAnalytics } from "@/lib/analytics";

async function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  try {
    const Sentry = await import("@sentry/browser");
    Sentry.init({
      dsn,
      // Errors only tonight — no tracing/replay build-out.
      tracesSampleRate: 0,
    });
  } catch {
    // Crash reporting must never itself crash the page.
  }
}

initAnalytics();
initSentry();
