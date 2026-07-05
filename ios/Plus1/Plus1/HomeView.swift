import SwiftUI

/// Home feed (mockups §01): custom "plus1" header with bell + avatar,
/// filter chips, big swipeable live artwork cards, then a scannable
/// "This week" list. Falls back to the §07 zero-friends layout.
private enum HomeFilter: Hashable {
    case all
    case friends
    case category(QuestCategory)
}

struct HomeView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var quests: [Quest] = []
    @State private var friendIds: Set<UUID> = []
    @State private var hasUnreadActivity = false
    @State private var filter: HomeFilter = .all
    @State private var loaded = false
    @State private var errorMessage: String?

    // MARK: Derived feed slices

    private func isFromFriends(_ quest: Quest) -> Bool {
        if quest.joinedByCurrentUser || quest.createdByCurrentUser { return true }
        if let host = quest.host { return friendIds.contains(host.id) }
        return false
    }

    private var filtered: [Quest] {
        switch filter {
        case .all: quests
        case .friends: quests.filter(isFromFriends)
        case .category(let category): quests.filter { $0.category == category }
        }
    }

    private var live: [Quest] { filtered.filter(\.isLive) }
    private var upcoming: [Quest] { filtered.filter { !$0.isLive } }
    private var friendQuests: [Quest] { quests.filter(isFromFriends) }
    private var campusQuests: [Quest] { quests.filter { $0.visibility == .local } }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                header
                filterChips
                if loaded && friendQuests.isEmpty {
                    emptyFriendsSections
                } else {
                    feedSections
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .toolbar(.hidden, for: .navigationBar)
        .task { await load() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: .init(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 12) {
            (Text("plus") + Text("1").foregroundStyle(Theme.accent))
                .font(.system(size: 25, weight: .heavy))
                .foregroundStyle(Theme.foreground)
            Spacer()
            NavigationLink {
                ActivityView()
            } label: {
                Image(systemName: "bell")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.foreground)
                    .frame(width: 36, height: 36)
                    .background(Theme.card, in: Circle())
                    .overlay(alignment: .topTrailing) {
                        if hasUnreadActivity {
                            Circle().fill(.red)
                                .frame(width: 8, height: 8)
                                .offset(x: -2, y: 2)
                        }
                    }
            }
            .accessibilityLabel("Activity")
            AvatarView(
                initials: session.profile?.initials ?? "?",
                url: session.profile?.avatarUrl.flatMap(URL.init),
                size: 32
            )
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(.all, "All")
                chip(.friends, "Friends")
                ForEach(QuestCategory.allCases) { category in
                    chip(.category(category), category.rawValue)
                }
            }
        }
    }

    private func chip(_ value: HomeFilter, _ label: String) -> some View {
        let selected = filter == value
        return Button {
            filter = value
        } label: {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(selected ? Theme.accentInk : Theme.foreground)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(selected ? Theme.accent : Theme.chip, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: Feed

    @ViewBuilder private var feedSections: some View {
        if !live.isEmpty {
            SectionHeader(title: "Happening now", caption: "\(live.count) live")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(live) { quest in
                        NavigationLink {
                            EventDetailView(questId: quest.id)
                        } label: {
                            LiveQuestCard(quest: quest)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        if !upcoming.isEmpty {
            SectionHeader(
                title: "This week",
                caption: "\(upcoming.count) \(upcoming.count == 1 ? "event" : "events")"
            )
            ForEach(upcoming) { quest in
                NavigationLink {
                    EventDetailView(questId: quest.id)
                } label: {
                    HomeQuestRow(quest: quest)
                }
                .buttonStyle(.plain)
            }
        }
        if loaded && live.isEmpty && upcoming.isEmpty {
            EmptyStateCard(
                emoji: "🤙",
                title: "Nothing here yet",
                message: "No open events match this filter — try another, or start one."
            )
        }
    }

    @ViewBuilder private var emptyFriendsSections: some View {
        EmptyStateCard(
            emoji: "🤙",
            title: "Nothing from friends yet",
            message: "plus1 gets better with friends — add some, or see what's open on campus"
        )
        if !campusQuests.isEmpty {
            SectionHeader(title: "Around campus", caption: "open to all")
            ForEach(campusQuests) { quest in
                NavigationLink {
                    EventDetailView(questId: quest.id)
                } label: {
                    HomeQuestRow(quest: quest)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Data

    private func load() async {
        do {
            async let questsTask = Repo.feedQuests()
            async let friendshipsTask = Repo.friendships()
            async let activityTask = Repo.activity()
            let (feed, friendships, activity) = try await (questsTask, friendshipsTask, activityTask)
            quests = feed
            if let me = Repo.currentUserId {
                friendIds = Set(
                    friendships
                        .filter { $0.status == "accepted" }
                        .map { $0.otherId(for: me) }
                )
            }
            hasUnreadActivity = activity.contains { !$0.isRead }
            loaded = true
        } catch {
            guard !(error is CancellationError) else { return }
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Live artwork card (192×152, title on the image)

private struct LiveQuestCard: View {
    let quest: Quest

    private var goingLabel: String {
        if let max = quest.row.maxPeople {
            return "\(quest.goingCount)/\(max) going"
        }
        return "\(quest.goingCount) going"
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            CategoryArtwork(category: quest.category, imageURL: quest.cardImageURL, emojiSize: 44)
            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.68), location: 0),
                    .init(color: .clear, location: 0.62)
                ],
                startPoint: .bottom, endPoint: .top
            )
            VStack(alignment: .leading, spacing: 3) {
                Text(quest.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text("\(quest.timeLabel) · \(quest.location)")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1)
                HStack(spacing: 6) {
                    AvatarStack(attendees: quest.attendees, size: 22)
                    Text(goingLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.top, 2)
            }
            .padding(10)
        }
        .frame(width: 192, height: 152)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(alignment: .topLeading) {
            HStack(spacing: 4) {
                Circle().fill(Theme.accent).frame(width: 6, height: 6)
                Text("LIVE")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(.black)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(.white, in: Capsule())
            .padding(8)
        }
    }
}

// MARK: - This-week list row

private struct HomeQuestRow: View {
    let quest: Quest

    private var meta: Text {
        let time = Text(quest.timeLabel).foregroundStyle(Theme.sub)
        let dot = Text(" · ").foregroundStyle(Theme.sub)
        if quest.spotsLeft == 1 {
            return time + dot + Text("1 spot left").bold().foregroundStyle(Theme.accent)
        }
        return time + dot + Text(quest.location).foregroundStyle(Theme.sub)
    }

    var body: some View {
        HStack(spacing: 10) {
            CategoryArtwork(category: quest.category, imageURL: quest.cardImageURL, emojiSize: 16)
                .frame(width: 36, height: 36)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 2) {
                Text(quest.title)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                meta
                    .font(.system(size: 12))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.sub)
        }
        .card()
        .contentShape(Rectangle())
    }
}
