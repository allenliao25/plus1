import Foundation
import PostHog
import Sentry

/// Thin analytics + crash-reporting facade for the native app.
///
/// No-op by default: keys arrive from the Info.plist (Config/Analytics.xcconfig
/// → INFOPLIST_KEY_* → plist). When a key is empty (the case tonight), the
/// matching SDK is never started and every call here silently returns, so call
/// sites never have to null-check. Mirrors the web `lib/analytics.ts` pattern.
enum Analytics {
    /// Reads a non-empty trimmed Info.plist string, or nil.
    private static func plistValue(_ key: String) -> String? {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: key) as? String
        else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static var posthogStarted = false

    /// Start PostHog + Sentry if (and only if) their keys are configured.
    /// Safe to call once at launch; a missing key means that SDK stays dormant.
    static func start() {
        if let apiKey = plistValue("POSTHOG_API_KEY"), !posthogStarted {
            let host = plistValue("POSTHOG_HOST") ?? "https://us.i.posthog.com"
            let config = PostHogConfig(apiKey: apiKey, host: host)
            // The funnel is explicit events; autocapture would just add noise.
            config.captureApplicationLifecycleEvents = true
            config.captureScreenViews = false
            config.sessionReplay = false
            PostHogSDK.shared.setup(config)
            posthogStarted = true
        }

        if let dsn = plistValue("SENTRY_DSN") {
            SentrySDK.start { options in
                options.dsn = dsn
                // Errors/crashes only tonight — no performance tracing build-out.
                options.tracesSampleRate = 0
            }
        }
    }

    static func track(_ event: String, _ properties: [String: Any]? = nil) {
        guard posthogStarted else { return }
        PostHogSDK.shared.capture(event, properties: properties)
    }

    static func identify(_ distinctId: String) {
        guard posthogStarted else { return }
        PostHogSDK.shared.identify(distinctId)
    }

    static func reset() {
        guard posthogStarted else { return }
        PostHogSDK.shared.reset()
    }
}
