import SwiftUI

/// Five-tab shell (Home, Explore, Create, Inbox, Profile). Create is an
/// action tab: selecting it presents the create sheet and reverts to the
/// previously selected tab. On iOS 26 the TabView renders as the Liquid
/// Glass capsule automatically.
struct RootView: View {
    enum Tab: Hashable { case home, explore, create, inbox, profile }

    @Environment(AppModel.self) private var app
    @State private var selection: Tab = .home
    @State private var previousTab: Tab = .home
    @State private var sheet: RootSheet?
    @State private var unreadThreads = 0

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack { HomeView() }
                .tabItem { Label("Home", systemImage: "house") }
                .tag(Tab.home)
            NavigationStack { ExploreView() }
                .tabItem { Label("Explore", systemImage: "magnifyingglass") }
                .tag(Tab.explore)
            Color.clear
                .tabItem { Label("Create", systemImage: "plus.app") }
                .tag(Tab.create)
            NavigationStack { InboxView(unreadCount: $unreadThreads) }
                .tabItem { Label("Inbox", systemImage: "bubble.left.and.bubble.right") }
                .badge(app.unreadMessages)
                .tag(Tab.inbox)
            NavigationStack { ProfileView() }
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
        }
        .background(Theme.background)
        .tabBarMinimizeOnScroll()
        .onChange(of: selection) { _, newValue in
            if newValue == .create {
                sheet = .create
                selection = previousTab
            } else {
                previousTab = newValue
            }
        }
        .onChange(of: app.requestedTab) { _, requested in
            guard let requested else { return }
            selection = requested
            previousTab = requested
            app.requestedTab = nil
        }
        // A deep link (notification tap / universal link) must win any open
        // create sheet, so replace the current sheet item rather than relying on
        // a second `.sheet` that would be suppressed while the first is up.
        .onChange(of: app.deepLinkQuestId) { _, questId in
            if let questId { sheet = .event(questId) }
        }
        // A link set while signed-out lands in `deepLinkQuestId` before RootView
        // exists; pick it up on first appearance.
        .onAppear {
            if let questId = app.deepLinkQuestId { sheet = .event(questId) }
        }
        .sheet(item: $sheet, onDismiss: {
            app.deepLinkQuestId = nil
            Task { await app.refreshBadges() }
        }) { item in
            switch item {
            case .create:
                CreateEventView()
            case .event(let questId):
                NavigationStack {
                    EventDetailView(questId: questId)
                }
            }
        }
        .task { await app.refreshBadges() }
        .task {
            // Ask for push permission once the signed-in UI has settled.
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            PushManager.shared.requestPushPermissionIfNeeded()
        }
    }
}

/// The single sheet RootView presents — either the create form or a deep-linked
/// event. One `.sheet(item:)` (not two overlapping ones) so a deep link arriving
/// while Create is open replaces it instead of being dropped.
private enum RootSheet: Identifiable {
    case create
    case event(UUID)

    var id: String {
        switch self {
        case .create: "create"
        case .event(let questId): questId.uuidString
        }
    }
}

private extension View {
    /// Minimize the Liquid Glass tab bar on scroll (iOS 26+); no-op below.
    @ViewBuilder func tabBarMinimizeOnScroll() -> some View {
        if #available(iOS 26.0, *) {
            self.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }
}
