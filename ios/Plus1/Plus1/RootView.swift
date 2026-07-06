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
    @State private var creating = false
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
                creating = true
                selection = previousTab
            } else {
                previousTab = newValue
            }
        }
        .sheet(isPresented: $creating) {
            CreateEventView()
        }
        .onChange(of: creating) { _, isPresenting in
            if !isPresenting { Task { await app.refreshBadges() } }
        }
        .onChange(of: app.requestedTab) { _, requested in
            guard let requested else { return }
            selection = requested
            previousTab = requested
            app.requestedTab = nil
        }
        .task { await app.refreshBadges() }
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
