import SwiftUI
import Supabase

@main
struct Plus1App: App {
    @StateObject private var session = SessionStore()

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
                case .needsSetup:
                    ProfileSetupView()
                case .ready:
                    RootView()
                }
            }
            .environmentObject(session)
            .tint(Theme.accent)
        }
    }
}

/// Auth gate: watches the Supabase session, bootstraps the profile row,
/// and routes to sign-in → one-time setup → the app (web AppShell parity).
@MainActor
final class SessionStore: ObservableObject {
    enum Phase { case loading, signedOut, needsSetup, ready }

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
        do {
            let profile = try await Repo.ensureProfile()
            self.profile = profile
            phase = Repo.isAutoDisplayName(profile.displayName) ? .needsSetup : .ready
        } catch {
            phase = .signedOut
        }
    }

    func completeSetup() {
        phase = .ready
    }

    func refreshProfile() async {
        guard let userId else { return }
        profile = try? await Repo.profile(id: userId)
    }

    func signOut() async {
        try? await Supa.client.auth.signOut()
    }
}
