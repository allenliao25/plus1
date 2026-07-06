import Foundation
import UIKit
import UserNotifications

/// APNs registration + notification routing. The app delegate owns the OS
/// callbacks (device token, notification taps); `PushManager` owns the
/// permission gate and the best-effort token upload/delete lifecycle.
///
/// Notification payloads carry custom string keys `questId` and `threadId`
/// (exactly those names — they must match what the server sends). A tap with
/// `threadId` routes to the Inbox tab; a tap with `questId` deep-links to the
/// event sheet. Both go through `AppModel`, wired up in `Plus1App`.
@MainActor
final class PushManager: NSObject {
    static let shared = PushManager()

    /// Set by `Plus1App` once the app model exists so notification taps can
    /// drive navigation. Weak-ish via closures kept simple: a stored reference.
    var app: AppModel?

    private let askedKey = "push.permission.asked"
    private let lastTokenKey = "push.lastUploadedToken"

    /// The most recently uploaded APNs token (hex), remembered so we can delete
    /// the exact row on sign-out.
    var lastUploadedToken: String? {
        get { UserDefaults.standard.string(forKey: lastTokenKey) }
        set { UserDefaults.standard.set(newValue, forKey: lastTokenKey) }
    }

    // MARK: Permission + registration

    /// Ask for notification permission exactly once (UserDefaults-gated). If
    /// already authorized on a later launch, silently re-register so rotated
    /// tokens get re-uploaded.
    func requestPushPermissionIfNeeded() {
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                Task { @MainActor in UIApplication.shared.registerForRemoteNotifications() }
            case .notDetermined:
                guard !UserDefaults.standard.bool(forKey: self.askedKey) else { return }
                UserDefaults.standard.set(true, forKey: self.askedKey)
                center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
                    guard granted else { return }
                    Task { @MainActor in UIApplication.shared.registerForRemoteNotifications() }
                }
            default:
                break
            }
        }
    }

    /// Best-effort delete of this device's token row before sign-out. Awaited by
    /// `signOut()` while the session still authorizes the delete, so it must run
    /// to completion (or time out) rather than fire-and-forget.
    func clearTokenOnSignOut() async {
        guard let token = lastUploadedToken else { return }
        lastUploadedToken = nil
        try? await Repo.deletePushToken(token)
    }

    // MARK: Routing

    /// Route a tapped notification's custom payload. `threadId` wins the Inbox
    /// tab; `questId` opens the event sheet.
    func route(userInfo: [AnyHashable: Any]) {
        guard let app else { return }
        if userInfo["threadId"] is String {
            app.requestedTab = .inbox
        } else if let questId = userInfo["questId"] as? String,
                  let uuid = UUID(uuidString: questId) {
            app.deepLinkQuestId = uuid
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension PushManager: UNUserNotificationCenterDelegate {
    /// Foreground presentation: show the banner (with sound + badge). We don't
    /// suppress the banner for an already-open thread — there's no cheap shared
    /// "current thread" signal to check against.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        Task { @MainActor in PushManager.shared.route(userInfo: userInfo) }
        completionHandler()
    }
}

// MARK: - App delegate

/// Bridges UIKit's remote-notification callbacks into `PushManager`.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = PushManager.shared
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task {
            try? await Repo.upsertPushToken(hex)
            await MainActor.run { PushManager.shared.lastUploadedToken = hex }
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Push registration failed: \(error.localizedDescription)")
    }
}
