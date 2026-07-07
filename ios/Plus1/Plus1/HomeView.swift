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
    @Environment(AppModel.self) private var app
    @State private var quests: [Quest] = []
    @State private var friendIds: Set<UUID> = []
    @State private var filter: HomeFilter = .all
    @State private var loaded = false
    @State private var errorMessage: String?
    // Free-tonight availability signal.
    @State private var freeFriends: [FreeFriend] = []
    @State private var myFreeUntil: Date?
    @State private var busyFree = false
    @State private var confirmClearFree = false

    // MARK: Derived feed slices

    /// A friend's event — excludes your own hosted events (those get their
    /// own "Yours" slice) and joined events (surfaced normally in the feed).
    private func isFromFriends(_ quest: Quest) -> Bool {
        if quest.createdByCurrentUser { return false }
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

    /// "Tonight" rail: open events live now OR starting today between 16:00 and
    /// 04:00 next-day (local). Live first, then by start time. Reuses the loaded
    /// feed — no extra fetch. Events here are ALSO left in the normal sections
    /// below (featured-rail pattern; duplication is intentional for v1).
    private var tonight: [Quest] {
        let calendar = Calendar.current
        let now = Date()
        let candidates = quests.filter { quest in
            guard quest.isOpen else { return false }
            if quest.isLive { return true }
            guard let start = quest.startDate else { return false }
            let hour = calendar.component(.hour, from: start)
            let inWindow = hour >= 16 || hour < 4
            guard inWindow else { return false }
            // A non-live event only belongs in "Tonight" if it hasn't started yet
            // — otherwise a 2am-today event that's already past would show here.
            guard start > now else { return false }
            // "Today" = the evening/late-night block anchored on today's date.
            // 16:00–23:59 must be today; 00:00–03:59 counts as tonight's tail.
            if hour >= 16 {
                return calendar.isDateInToday(start)
            }
            let yesterday = calendar.date(byAdding: .day, value: -1, to: start) ?? start
            return calendar.isDateInToday(start) || calendar.isDateInToday(yesterday)
        }
        return candidates.sorted { a, b in
            if a.isLive != b.isLive { return a.isLive }
            return (a.startDate ?? .distantPast) < (b.startDate ?? .distantPast)
        }
        // Cap the rail so it stays a rail, not the whole feed.
        .prefix(10)
        .map { $0 }
    }

    private var showsTonight: Bool { filter == .all && !tonight.isEmpty }
    private var friendQuests: [Quest] { quests.filter(isFromFriends) }
    private var yourQuests: [Quest] { quests.filter(\.createdByCurrentUser) }
    private var campusQuests: [Quest] { quests.filter { $0.visibility == .local } }

    /// Only the All filter falls back to the zero-friends layout — a category
    /// filter with no results shows a normal category empty state instead.
    private var showsEmptyFriends: Bool {
        loaded && filter == .all && friendQuests.isEmpty && yourQuests.isEmpty
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                header
                filterChips
                if !loaded {
                    ForEach(0..<3, id: \.self) { _ in SkeletonCard(height: 92) }
                } else if showsEmptyFriends {
                    freeTonightSection
                    if showsTonight { tonightRail }
                    emptyFriendsSections
                } else {
                    freeTonightSection
                    if showsTonight { tonightRail }
                    feedSections
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .toolbar(.hidden, for: .navigationBar)
        .task(id: app.dataVersion) { await load() }
        .onAppear {
            // Re-fires when a detail/create screen is popped — surfaces
            // joins/leaves/creates made elsewhere (InboxView's pattern).
            if loaded { Task { await load() } }
            Task { await app.refreshBadges() }
        }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: .init(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        .confirmationDialog(
            "No longer free?", isPresented: $confirmClearFree, titleVisibility: .visible
        ) {
            Button("No longer free", role: .destructive) { Task { await clearFree() } }
            Button("Cancel", role: .cancel) {}
        }
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
                        if app.hasUnreadActivity {
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
            Haptics.tap()
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

    // MARK: Free tonight

    private var amFree: Bool { myFreeUntil != nil }

    /// End of tonight = the next occurrence of 4am local. If it's already past
    /// 4am we mean tomorrow's 4am; between midnight and 4am, today's 4am.
    private func endOfTonight() -> Date {
        let calendar = Calendar.current
        let now = Date()
        var next = calendar.nextDate(
            after: now,
            matching: DateComponents(hour: 4, minute: 0, second: 0),
            matchingPolicy: .nextTime
        ) ?? now.addingTimeInterval(6 * 60 * 60)
        // nextDate never returns `now` itself; if the computed 4am is somehow in
        // the past, roll forward a day.
        if next <= now { next = calendar.date(byAdding: .day, value: 1, to: next) ?? next }
        return next
    }

    /// Section is only fully shown when there's something to show: you're free,
    /// or friends are free. Otherwise it collapses to the compact pill.
    @ViewBuilder private var freeTonightSection: some View {
        if filter == .all {
            VStack(alignment: .leading, spacing: 10) {
                if !freeFriends.isEmpty {
                    SectionHeader(title: "Free tonight", caption: "\(freeFriends.count)")
                }
                freePill
                if !freeFriends.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(freeFriends) { friend in
                            freeFriendRow(friend)
                            if friend.id != freeFriends.last?.id {
                                Rectangle().fill(Theme.hair).frame(height: 0.5)
                            }
                        }
                    }
                    .card()
                }
                if amFree && !freeFriends.isEmpty { makePlanPrompt }
            }
        }
    }

    /// Prominent one-tap state: "I'm free tonight" or the active confirmation.
    private var freePill: some View {
        Button {
            if amFree {
                confirmClearFree = true
            } else {
                Task { await setFree() }
            }
        } label: {
            HStack(spacing: 8) {
                if amFree {
                    Text("You're free tonight ✓")
                        .font(.system(size: 15, weight: .bold))
                    Text("(until 4am)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.accentInk.opacity(0.75))
                } else {
                    Text("I'm free tonight 🙋")
                        .font(.system(size: 15, weight: .bold))
                }
            }
            .foregroundStyle(Theme.accentInk)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(Theme.accent)
            .clipShape(Capsule())
            .opacity(busyFree ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(busyFree)
        .accessibilityLabel(amFree ? "You're free tonight, tap to undo" : "Mark yourself free tonight")
    }

    private func freeFriendRow(_ friend: FreeFriend) -> some View {
        HStack(spacing: 10) {
            NavigationLink {
                PublicProfileView(profileId: friend.profile.id)
            } label: {
                HStack(spacing: 10) {
                    AvatarView(
                        initials: friend.profile.initials,
                        url: friend.profile.avatarUrl.flatMap(URL.init),
                        size: 36
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(friend.profile.displayName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.foreground)
                            .lineLimit(1)
                        Text("free tonight")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.sub)
                    }
                    Spacer(minLength: 8)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            // "me too" just fires the same set RPC (unless you're already free).
            if !amFree {
                Button {
                    Task { await meToo() }
                } label: {
                    Text("me too")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.accentInk)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Theme.accent, in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(busyFree)
            }
        }
        .padding(.vertical, 8)
    }

    /// Subtle nudge when you AND friends are free: spin up a plan.
    private var makePlanPrompt: some View {
        Button {
            Analytics.track("free_tonight_make_plan", ["free_friends": freeFriends.count])
            Haptics.tap()
            app.requestedTab = .create
        } label: {
            HStack(spacing: 6) {
                Text("\(freeFriends.count + 1) of you are free — make the plan")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.accentText)
                Image(systemName: "arrow.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.accentText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
    }

    private func setFree() async {
        busyFree = true
        defer { busyFree = false }
        Haptics.success()
        do {
            try await Repo.setFreeTonight(until: endOfTonight())
            Analytics.track("free_tonight_set")
            await loadFree()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func meToo() async {
        busyFree = true
        defer { busyFree = false }
        Haptics.success()
        do {
            try await Repo.setFreeTonight(until: endOfTonight())
            Analytics.track("free_tonight_me_too")
            await loadFree()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func clearFree() async {
        busyFree = true
        defer { busyFree = false }
        Haptics.tap()
        do {
            try await Repo.clearFreeTonight()
            Analytics.track("free_tonight_cleared")
            await loadFree()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadFree() async {
        async let friendsTask = Repo.fetchFreeFriends()
        async let mineTask = Repo.myAvailabilityExpiry()
        freeFriends = (try? await friendsTask) ?? []
        myFreeUntil = (try? await mineTask) ?? nil
    }

    // MARK: Feed

    /// Featured "Tonight" rail — a horizontal snap-scroll of the evening's
    /// live/soon events, above the normal sections.
    private var tonightRail: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Tonight", caption: "\(tonight.count)")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(tonight) { quest in
                        NavigationLink {
                            EventDetailView(questId: quest.id)
                        } label: {
                            TonightCard(quest: quest)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.viewAligned)
        }
    }

    /// Your own hosted events, shown as a labeled slice under the All filter
    /// so they aren't silently counted as "friends'".
    @ViewBuilder private var yoursSection: some View {
        if filter == .all, !yourQuests.isEmpty {
            SectionHeader(
                title: "Yours",
                caption: "\(yourQuests.count) \(yourQuests.count == 1 ? "event" : "events")"
            )
            ForEach(yourQuests) { quest in
                NavigationLink {
                    EventDetailView(questId: quest.id)
                } label: {
                    HomeQuestRow(quest: quest)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var categoryEmptyMessage: String {
        if case .category(let category) = filter {
            return "No \(category.rawValue.lowercased()) hangouts right now — start one?"
        }
        return "No open events match this filter — try another, or start one."
    }

    @ViewBuilder private var feedSections: some View {
        yoursSection
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
        if loaded && live.isEmpty && upcoming.isEmpty && !(filter == .all && !yourQuests.isEmpty) {
            EmptyStateCard(
                emoji: "🤙",
                title: "Nothing here yet",
                message: categoryEmptyMessage
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
            async let freeTask: Void = loadFree()
            let (feed, friendships, _) = try await (questsTask, friendshipsTask, freeTask)
            quests = feed
            if let me = Repo.currentUserId {
                friendIds = Set(
                    friendships
                        .filter { $0.status == "accepted" }
                        .map { $0.otherId(for: me) }
                )
            }
            loaded = true
        } catch {
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
                    .foregroundStyle(Theme.accentInk)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(.white, in: Capsule())
            .padding(8)
        }
    }
}

// MARK: - Tonight rail card (240×140)

private struct TonightCard: View {
    let quest: Quest

    private var metaLine: String {
        if let left = quest.spotsLeft, left > 0, left <= 2 {
            let spots = left == 1 ? "1 spot left" : "\(left) spots left"
            return "\(quest.timeLabel) · \(spots)"
        }
        return "\(quest.timeLabel) · \(quest.location)"
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            CategoryArtwork(category: quest.category, imageURL: quest.cardImageURL, emojiSize: 40)
            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.68), location: 0),
                    .init(color: .clear, location: 0.6)
                ],
                startPoint: .bottom, endPoint: .top
            )
            VStack(alignment: .leading, spacing: 3) {
                Text(quest.title)
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(metaLine)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1)
            }
            .padding(10)
        }
        .frame(width: 240, height: 140)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(alignment: .topLeading) {
            if quest.isLive {
                HStack(spacing: 4) {
                    Circle().fill(Theme.accent).frame(width: 6, height: 6)
                    Text("LIVE")
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundStyle(Theme.accentInk)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.white, in: Capsule())
                .padding(8)
            }
        }
    }
}

// MARK: - This-week list row

private struct HomeQuestRow: View {
    let quest: Quest

    private var meta: Text {
        let time = Text(quest.timeLabel).foregroundStyle(Theme.sub)
        let dot = Text(" · ").foregroundStyle(Theme.sub)
        if let left = quest.spotsLeft, left > 0, left <= 2 {
            let label = left == 1 ? "1 spot left" : "\(left) spots left"
            return time + dot + Text(label).bold().foregroundStyle(Theme.accentText)
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
