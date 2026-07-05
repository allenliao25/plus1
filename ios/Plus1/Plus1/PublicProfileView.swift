import SwiftUI
import Supabase

/// Someone else's profile — reached by tapping any avatar. Same compact
/// header as ProfileView with Add friend / Message replacing Edit, and a
/// hosted-events grid.
struct PublicProfileView: View {
    let profileId: UUID

    @EnvironmentObject private var session: SessionStore

    @State private var profile: ProfileRow?
    @State private var quests: [Quest] = []
    @State private var friendship: FriendshipRow?
    @State private var busy = false
    @State private var confirmingCancel = false
    @State private var chatTarget: ChatTarget?
    @State private var errorMessage: String?

    /// Thread to push after "Message" resolves the direct thread.
    private struct ChatTarget: Identifiable, Hashable {
        let id: UUID
        let title: String
    }

    init(profileId: UUID) {
        self.profileId = profileId
    }

    private var isSelf: Bool { profileId == session.userId }

    private var friendshipState: FriendshipState {
        if isSelf { return .selfProfile }
        guard let me = session.userId else { return .none }
        return friendship?.state(for: me) ?? .none
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let profile {
                    header(profile)
                }

                buttonsRow

                SectionHeader(
                    title: "Events",
                    caption: quests.isEmpty ? "" : "\(quests.count) hosted"
                )

                grid
            }
            .padding(16)
        }
        .background(Theme.background)
        .compactNavTitle("@\(profile?.handle ?? "")")
        .navigationDestination(item: $chatTarget) { target in
            ChatThreadView(threadId: target.id, title: target.title)
        }
        .task { await load() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: errorBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .confirmationDialog(
            "Cancel friend request?",
            isPresented: $confirmingCancel,
            titleVisibility: .visible
        ) {
            Button("Cancel request", role: .destructive) { cancelRequest() }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    // MARK: Pieces

    private func header(_ profile: ProfileRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 16) {
                AvatarView(
                    initials: profile.initials,
                    url: profile.avatarUrl.flatMap(URL.init),
                    size: 72
                )
                HStack(spacing: 0) {
                    statColumn("\(quests.count)", "Hosted")
                    statColumn("—", "Joined")
                    statColumn("—", "Friends")
                }
                .frame(maxWidth: .infinity)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text([profile.displayName, profile.area]
                    .filter { !$0.isEmpty }
                    .joined(separator: " · "))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.foreground)
                if let bio = profile.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.sub)
                }
            }

            if !profile.interests.isEmpty {
                PublicChipFlow(spacing: 7) {
                    ForEach(profile.interests, id: \.self) { interest in
                        Text(interest)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.foreground)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 6)
                            .background(Theme.chip)
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    private func statColumn(_ value: String, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 17, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(Theme.foreground)
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.sub)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder private var buttonsRow: some View {
        if isSelf {
            Text("This is you — edit from the Profile tab")
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.sub)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 4)
        } else {
            HStack(spacing: 8) {
                friendButton
                Button("Message") { openChat() }
                    .buttonStyle(GhostButtonStyle())
                    .disabled(busy)
            }
        }
    }

    @ViewBuilder private var friendButton: some View {
        switch friendshipState {
        case .none, .declined:
            Button("Add friend") { addFriend() }
                .buttonStyle(MintButtonStyle())
                .disabled(busy)
        case .outgoing:
            Button("Requested") { confirmingCancel = true }
                .buttonStyle(GhostButtonStyle())
                .disabled(busy)
        case .incoming:
            Button("Accept") { acceptRequest() }
                .buttonStyle(MintButtonStyle())
                .disabled(busy)
        case .friends:
            Button("Friends") {}
                .buttonStyle(GhostButtonStyle())
                .contextMenu {
                    Button("Remove friend", role: .destructive) { removeFriend() }
                }
        case .selfProfile:
            EmptyView()
        }
    }

    @ViewBuilder private var grid: some View {
        if quests.isEmpty {
            EmptyStateCard(
                emoji: "🗓️",
                title: "No events yet",
                message: "Nothing hosted so far"
            )
        } else {
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 3),
                spacing: 7
            ) {
                ForEach(quests) { quest in
                    NavigationLink {
                        EventDetailView(questId: quest.id)
                    } label: {
                        PublicEventTile(quest: quest)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Data

    private func load() async {
        do {
            profile = try await Repo.profile(id: profileId)
            quests = try await Repo.questsByCreator(profileId)
            try await reloadFriendship()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func reloadFriendship() async throws {
        guard let me = session.userId, !isSelf else { return }
        let rows = try await Repo.friendships()
        friendship = rows.first { $0.otherId(for: me) == profileId }
    }

    // MARK: Actions

    private func run(_ work: @escaping () async throws -> Void) {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await work()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func addFriend() {
        run {
            try await Repo.requestFriend(addresseeId: profileId)
            try await reloadFriendship()
        }
    }

    private func cancelRequest() {
        guard let friendship else { return }
        run {
            try await Repo.removeFriend(friendshipId: friendship.id)
            self.friendship = nil
        }
    }

    private func acceptRequest() {
        guard let friendship else { return }
        run {
            try await Repo.respondFriend(friendshipId: friendship.id, accept: true)
            try await reloadFriendship()
        }
    }

    private func removeFriend() {
        guard let friendship else { return }
        run {
            try await Repo.removeFriend(friendshipId: friendship.id)
            self.friendship = nil
        }
    }

    private func openChat() {
        run {
            let threadId = try await Repo.directThread(with: profileId)
            chatTarget = ChatTarget(id: threadId, title: profile?.displayName ?? "Chat")
        }
    }
}

/// Square grid tile: category artwork (or cover photo) with attendance count.
private struct PublicEventTile: View {
    let quest: Quest

    var body: some View {
        CategoryArtwork(category: quest.category, imageURL: quest.cardImageURL, emojiSize: 26)
            .frame(height: 86)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(alignment: .bottomLeading) {
                Text("\(quest.goingCount) went")
                    .font(.system(size: 10.5, weight: .heavy))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.5), radius: 3)
                    .padding(7)
            }
            .accessibilityLabel("\(quest.title), \(quest.goingCount) went")
    }
}

// MARK: - Chip flow layout

/// Minimal wrapping flow layout for interest chips.
private struct PublicChipFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        return arrange(subviews, in: width).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let placement = arrange(subviews, in: bounds.width)
        for (index, origin) in placement.origins.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(_ subviews: Subviews, in width: CGFloat) -> (origins: [CGPoint], size: CGSize) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
        }
        return (origins, CGSize(width: maxX, height: y + rowHeight))
    }
}
