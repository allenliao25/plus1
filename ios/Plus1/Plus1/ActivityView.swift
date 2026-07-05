import SwiftUI

/// Activity (mockups §05): pushed from the Home bell. "New" (unread)
/// and "Earlier" groups; friend requests get an inline Accept button.
struct ActivityView: View {
    @State private var rows: [ActivityRow] = []
    @State private var actors: [UUID: ProfileRow] = [:]
    @State private var friendships: [FriendshipRow] = []
    @State private var loaded = false
    @State private var errorMessage: String?

    private var unread: [ActivityRow] { rows.filter { !$0.isRead } }
    private var earlier: [ActivityRow] { rows.filter(\.isRead) }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                if !unread.isEmpty {
                    SectionHeader(title: "New", caption: "\(unread.count) unread")
                    group(unread)
                }
                if !earlier.isEmpty {
                    SectionHeader(title: "Earlier")
                    group(earlier)
                }
                if loaded && rows.isEmpty {
                    EmptyStateCard(
                        emoji: "🔔",
                        title: "No activity yet",
                        message: "Joins, invites, and friend requests show up here."
                    )
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Activity")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Mark all read") {
                    Task { await markAllRead() }
                }
                .font(.system(size: 13, weight: .semibold))
                .disabled(unread.isEmpty)
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: .init(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    // MARK: Rows

    private func group(_ items: [ActivityRow]) -> some View {
        VStack(spacing: 0) {
            ForEach(items) { row in
                activityRow(row)
                if row.id != items.last?.id {
                    Rectangle().fill(Theme.hair).frame(height: 0.5)
                }
            }
        }
        .card()
    }

    private func activityRow(_ row: ActivityRow) -> some View {
        let actor = row.actorId.flatMap { actors[$0] }
        return HStack(spacing: 10) {
            AvatarView(
                initials: actor?.initials ?? "?",
                url: actor?.avatarUrl.flatMap(URL.init),
                size: 40
            )
            VStack(alignment: .leading, spacing: 2) {
                Text(row.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if let body = row.body, !body.isEmpty {
                    Text(body)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.sub)
                        .lineLimit(1)
                }
                Text(Fmt.relative(row.createdAt))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.sub)
            }
            Spacer(minLength: 8)
            if row.type == "friend_request", let friendship = pendingFriendship(for: row) {
                Button {
                    Task { await accept(friendship) }
                } label: {
                    Text("Accept")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.accentInk)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Theme.accent, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            if !row.isRead {
                Circle().fill(Theme.accent).frame(width: 8, height: 8)
            }
        }
        .padding(.vertical, 8)
    }

    private func pendingFriendship(for row: ActivityRow) -> FriendshipRow? {
        guard let me = Repo.currentUserId, let actorId = row.actorId else { return nil }
        return friendships.first {
            $0.requesterId == actorId && $0.addresseeId == me && $0.state(for: me) == .incoming
        }
    }

    // MARK: Actions

    private func accept(_ friendship: FriendshipRow) async {
        do {
            try await Repo.respondFriend(friendshipId: friendship.id, accept: true)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func markAllRead() async {
        do {
            try await Repo.markAllActivityRead()
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: Data

    private func load() async {
        do {
            let activity = try await Repo.activity()
            let actorIds = Array(Set(activity.compactMap(\.actorId)))
            async let profilesTask = Repo.profiles(ids: actorIds)
            async let friendshipsTask = Repo.friendships()
            let (profiles, friendships) = try await (profilesTask, friendshipsTask)
            rows = activity
            actors = Dictionary(uniqueKeysWithValues: profiles.map { ($0.id, $0) })
            self.friendships = friendships
            loaded = true
        } catch {
            guard !(error is CancellationError) else { return }
            errorMessage = error.localizedDescription
        }
    }
}
