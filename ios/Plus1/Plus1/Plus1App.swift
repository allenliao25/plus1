import SwiftUI
import Supabase

@main
struct Plus1App: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session = SessionStore()
    @State private var app = AppModel()

    var body: some Scene {
        WindowGroup {
            Group {
                switch session.phase {
                case .loading:
                    ZStack {
                        Theme.background.ignoresSafeArea()
                        ProgressView()
                    }
                case .signedOut:
                    AuthView()
                case .offline:
                    OfflineView { Task { await session.bootstrap() } }
                case .needsSetup:
                    ProfileSetupView()
                case .ready:
                    RootView()
                }
            }
            .environmentObject(session)
            .environment(app)
            .tint(Theme.accent)
            .onAppear { PushManager.shared.app = app }
            .onOpenURL { url in handleDeepLink(url) }
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if let url = activity.webpageURL { handleDeepLink(url) }
            }
        }
    }

    /// Resolve a plus1 `/e/<token>` share URL to a quest and present it.
    /// Unknown or unresolvable links are ignored silently.
    private func handleDeepLink(_ url: URL) {
        guard url.host == "plus1-livid.vercel.app" else { return }
        let parts = url.pathComponents.filter { $0 != "/" }
        guard parts.count >= 2, parts[0] == "e" else { return }
        let token = parts[1]
        Task {
            if let questId = try? await Repo.questIdForShareToken(token) {
                app.deepLinkQuestId = questId
            }
        }
    }
}

/// Full-screen state when a valid session exists but the profile couldn't be
/// reached (offline / network failure). Keeps the user signed in.
private struct OfflineView: View {
    let retry: () -> Void
    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 14) {
                Text("📡").font(.system(size: 40))
                Text("You're offline")
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundStyle(Theme.foreground)
                Text("Check your connection and try again.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.sub)
                Button("Retry", action: retry)
                    .buttonStyle(MintButtonStyle(fullWidth: false))
                    .padding(.top, 4)
            }
        }
    }
}

/// Auth gate: watches the Supabase session, bootstraps the profile row,
/// and routes to sign-in → one-time setup → the app (web AppShell parity).
@MainActor
final class SessionStore: ObservableObject {
    enum Phase { case loading, signedOut, offline, needsSetup, ready }

    @Published var phase: Phase = .loading
    @Published var profile: ProfileRow?

    var userId: UUID? { Repo.currentUserId }

    init() {
        Task { await listen() }
    }

    private func listen() async {
        for await state in Supa.client.auth.authStateChanges {
            guard [.initialSession, .signedIn, .signedOut].contains(state.event) else { continue }
            if state.session == nil {
                phase = .signedOut
                profile = nil
            } else {
                await bootstrap()
            }
        }
    }

    func bootstrap() async {
        phase = .loading
        do {
            let profile = try await Repo.ensureProfile()
            self.profile = profile
            phase = Repo.isAutoDisplayName(profile.displayName) ? .needsSetup : .ready
        } catch RepoError.notSignedIn {
            phase = .signedOut
        } catch {
            // A session exists but the profile fetch failed. A network-ish
            // failure means offline (keep the user signed in); anything else
            // we treat as a genuine sign-out.
            if Self.isNetworkError(error) || Supa.client.auth.currentSession != nil {
                phase = .offline
            } else {
                phase = .signedOut
            }
        }
    }

    private static func isNetworkError(_ error: Error) -> Bool {
        if error is URLError { return true }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain
    }

    func completeSetup() {
        phase = .ready
    }

    func refreshProfile() async {
        guard let userId else { return }
        profile = try? await Repo.profile(id: userId)
    }

    func signOut() async {
        // Drop this device's push token first (best-effort) while the session
        // still authorizes the delete, then sign out. Await it so the delete
        // actually runs before the session is torn down, but cap it at ~2s so a
        // dead network can't hang sign-out.
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await PushManager.shared.clearTokenOnSignOut() }
            group.addTask { try? await Task.sleep(nanoseconds: 2_000_000_000) }
            await group.next()
            group.cancelAll()
        }
        try? await Supa.client.auth.signOut()
    }
}
