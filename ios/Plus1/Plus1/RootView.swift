import SwiftUI

/// Four-tab shell with the Create button floating beside the system tab bar.
/// On iOS 26 the TabView renders as the Liquid Glass capsule automatically.
struct RootView: View {
    @State private var creating = false
    @State private var unreadThreads = 0

    var body: some View {
        TabView {
            NavigationStack { HomeView() }
                .tabItem { Label("Home", systemImage: "house") }
            NavigationStack { ExploreView() }
                .tabItem { Label("Explore", systemImage: "magnifyingglass") }
            NavigationStack { InboxView(unreadCount: $unreadThreads) }
                .tabItem { Label("Inbox", systemImage: "bubble.left.and.bubble.right") }
                .badge(unreadThreads)
            NavigationStack { ProfileView() }
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
        .background(Theme.background)
        .overlay(alignment: .bottomTrailing) {
            Button {
                creating = true
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 52, height: 52)
                    .background(.ultraThinMaterial, in: Circle())
                    .overlay(Circle().stroke(Theme.hair, lineWidth: 0.5))
                    .shadow(color: .black.opacity(0.18), radius: 12, y: 6)
            }
            .accessibilityLabel("New event")
            .padding(.trailing, 14)
            .padding(.bottom, 64)
        }
        .sheet(isPresented: $creating) {
            CreateEventView()
        }
    }
}
