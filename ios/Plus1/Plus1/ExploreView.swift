import SwiftUI
import UIKit

/// Explore (mockups §05): search-first tab. Default view is friend
/// suggestions + campus-open events; searching filters BOTH people
/// (server-side) and the loaded event feed (title/location).
struct ExploreView: View {
    @Environment(AppModel.self) private var app

    @State private var quests: [Quest] = []
    @State private var suggestions: [ProfileRow] = []
    @State private var friendships: [FriendshipRow] = []
    @State private var peopleResults: [ProfileRow] = []
    @State private var query = ""
    @State private var loaded = false
    @State private var errorMessage: String?
    /// Ids optimistically flipped to "Requested" (add sent, awaiting confirm).
    @State private var optimisticRequested: Set<UUID> = []
    /// Ids whose incoming request was optimistically accepted/declined.
    @State private var optimisticResolved: Set<UUID> = []
    /// Search threw (vs. genuinely empty) — drives the inline retry state.
    @State private var searchFailed = false

    // MARK: Contact sync
    /// Cached matches for the current app session so the flow doesn't re-prompt
    /// or re-fetch on every appearance — only pull-to-refresh re-syncs.
    private static var cachedMatches: [ContactMatch]?
    @State private var contactMatches: [ContactMatch] = ExploreView.cachedMatches ?? []
    @State private var didSyncContacts = ExploreView.cachedMatches != nil
    @State private var syncingContacts = false
    @State private var contactsDenied = false

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespaces)
    }

    private var questResults: [Quest] {
        quests.filter {
            $0.title.localizedCaseInsensitiveContains(trimmedQuery)
                || $0.location.localizedCaseInsensitiveContains(trimmedQuery)
        }
    }

    private var campusQuests: [Quest] {
        quests.filter { $0.visibility == .local }
    }

    /// Accepted-friend ids, for friends-first social proof on event rows.
    private var friendIds: Set<UUID> {
        guard let me = Repo.currentUserId else { return [] }
        return Set(
            friendships
                .filter { $0.status == "accepted" }
                .map { $0.otherId(for: me) }
        )
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                if !loaded {
                    ForEach(0..<4, id: \.self) { _ in SkeletonCard(height: 56) }
                } else if trimmedQuery.isEmpty {
                    defaultSections
                } else {
                    searchSections
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .compactNavTitle("Explore")
        .searchable(text: $query, prompt: "Events, people, places")
        .task(id: app.dataVersion) { await load() }
        .task(id: trimmedQuery) { await searchPeople() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: .init(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    // MARK: Default content

    /// Suggestions minus anyone already a friend or with a pending request
    /// either direction (they don't belong in "Find friends").
    private var filteredSuggestions: [ProfileRow] {
        suggestions.filter { person in
            switch friendshipState(for: person.id) {
            case .none, .declined: return true
            default: return false
            }
        }
    }

    /// Contact matches minus self, existing friends, pending either direction,
    /// and blocked ids — the same exclusion rule as `filteredSuggestions`.
    private var filteredContactMatches: [ProfileRow] {
        let me = Repo.currentUserId
        return contactMatches
            .filter { $0.id != me && !app.blockedIds.contains($0.id) }
            .filter { match in
                switch friendshipState(for: match.id) {
                case .none, .declined: return true
                default: return false
                }
            }
            .map(\.asProfileRow)
    }

    @ViewBuilder private var defaultSections: some View {
        contactsSection
        if !filteredSuggestions.isEmpty {
            SectionHeader(title: "Find friends", caption: "\(filteredSuggestions.count) suggested")
            peopleGroup(filteredSuggestions)
        }
        if !campusQuests.isEmpty {
            SectionHeader(title: "Around campus", caption: "open to all")
            ForEach(campusQuests) { quest in
                NavigationLink {
                    EventDetailView(questId: quest.id)
                } label: {
                    ExploreQuestRow(quest: quest, friendIds: friendIds)
                }
                .buttonStyle(.plain)
            }
        }
        if loaded && filteredSuggestions.isEmpty && campusQuests.isEmpty && didSyncContacts {
            EmptyStateCard(
                emoji: "🔍",
                title: "Nothing to explore yet",
                message: "People and campus-open events show up here as they join plus1."
            )
        }
    }

    // MARK: Contacts

    private static let inviteMessage =
        "join me on plus1 — never do stuff alone. https://plus1-livid.vercel.app"

    @ViewBuilder private var contactsSection: some View {
        if contactsDenied {
            contactsPermissionCard
        } else if !didSyncContacts {
            contactsIntroCard
        } else {
            let matches = filteredContactMatches
            SectionHeader(title: "From your contacts", caption: matches.isEmpty ? "" : "\(matches.count)")
            if matches.isEmpty {
                contactsEmptyCard
            } else {
                peopleGroup(matches)
            }
        }
    }

    private var contactsIntroCard: some View {
        VStack(spacing: 8) {
            Text("👋").font(.system(size: 30))
            Text("Find friends from contacts")
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Theme.foreground)
            Text("We only use numbers to find matches — contacts stay on your device.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.sub)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button(syncingContacts ? "Syncing…" : "Sync contacts") { syncContacts() }
                .buttonStyle(MintButtonStyle(fullWidth: false))
                .disabled(syncingContacts)
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .card()
    }

    private var contactsEmptyCard: some View {
        VStack(spacing: 8) {
            Text("No matches yet")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.foreground)
            ShareLink(item: ExploreView.inviteMessage) {
                Text("Invite friends")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.accentInk)
                    .padding(.vertical, 13)
                    .padding(.horizontal, 18)
                    .background(Theme.accent)
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .card()
    }

    private var contactsPermissionCard: some View {
        VStack(spacing: 8) {
            Text("🔒").font(.system(size: 30))
            Text("Contacts access is off")
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Theme.foreground)
            Text("Turn it on in Settings to find friends from your contacts.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.sub)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(MintButtonStyle(fullWidth: false))
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .card()
    }

    private func syncContacts() {
        guard !syncingContacts else { return }
        syncingContacts = true
        Task {
            let result = await ContactsSync.requestAndFetchPhones()
            switch result {
            case .denied:
                contactsDenied = true
            case .authorized(let phones):
                contactsDenied = false
                do {
                    let matches = try await Repo.matchContacts(phones: phones)
                    contactMatches = matches
                    ExploreView.cachedMatches = matches
                    didSyncContacts = true
                } catch {
                    errorMessage = "Couldn't sync your contacts. Try again."
                }
            }
            syncingContacts = false
        }
    }

    // MARK: Search results

    @ViewBuilder private var searchSections: some View {
        if searchFailed && peopleResults.isEmpty {
            searchErrorState
        } else {
            if !peopleResults.isEmpty {
                SectionHeader(title: "People", caption: "\(peopleResults.count)")
                peopleGroup(peopleResults)
            }
            if !questResults.isEmpty {
                SectionHeader(title: "Events", caption: "\(questResults.count)")
                ForEach(questResults) { quest in
                    NavigationLink {
                        EventDetailView(questId: quest.id)
                    } label: {
                        ExploreQuestRow(quest: quest, friendIds: friendIds)
                    }
                    .buttonStyle(.plain)
                }
            }
            if peopleResults.isEmpty && questResults.isEmpty {
                EmptyStateCard(
                    emoji: "🔍",
                    title: "No matches",
                    message: "Try a different name, event, or place."
                )
            }
        }
    }

    private var searchErrorState: some View {
        VStack(spacing: 10) {
            Text("😕").font(.system(size: 30))
            Text("Couldn't search")
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(Theme.foreground)
            Text("Check your connection and try again.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.sub)
            Button("Retry") { Task { await searchPeople() } }
                .buttonStyle(MintButtonStyle(fullWidth: false))
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .card()
    }

    private func peopleGroup(_ people: [ProfileRow]) -> some View {
        VStack(spacing: 0) {
            ForEach(people) { person in
                PersonRow(
                    profile: person,
                    state: friendshipState(for: person.id),
                    onAdd: { addFriend(person.id) },
                    onAccept: { acceptFriend(person.id) },
                    onDecline: { declineFriend(person.id) }
                )
                if person.id != people.last?.id {
                    Rectangle().fill(Theme.hair).frame(height: 0.5)
                }
            }
        }
        .card()
    }

    // MARK: Friendship state + actions

    /// Server state with optimistic overrides folded in so a tapped row
    /// updates instantly without a full refetch.
    private func friendshipState(for profileId: UUID) -> FriendshipState {
        if optimisticResolved.contains(profileId) { return .friends }
        if optimisticRequested.contains(profileId) { return .outgoing }
        guard let me = Repo.currentUserId else { return .none }
        guard let friendship = friendships.first(where: { $0.otherId(for: me) == profileId }) else {
            return .none
        }
        return friendship.state(for: me)
    }

    private func addFriend(_ profileId: UUID) {
        // Optimistic: flip to "Requested" immediately, revert on failure.
        optimisticRequested.insert(profileId)
        Haptics.tap()
        Task {
            do {
                try await Repo.requestFriend(addresseeId: profileId)
                friendships = try await Repo.friendships()
                app.bumpData()
                await app.refreshBadges()
            } catch {
                optimisticRequested.remove(profileId)
                errorMessage = "Couldn't send that friend request. Try again."
            }
            optimisticRequested.remove(profileId)
        }
    }

    private func acceptFriend(_ profileId: UUID) {
        guard let me = Repo.currentUserId,
              let friendship = friendships.first(where: {
                  $0.requesterId == profileId && $0.addresseeId == me
              })
        else { return }
        optimisticResolved.insert(profileId)
        Haptics.tap()
        Task {
            do {
                try await Repo.respondFriend(friendshipId: friendship.id, accept: true)
                friendships = try await Repo.friendships()
                app.bumpData()
                await app.refreshBadges()
            } catch {
                optimisticResolved.remove(profileId)
                errorMessage = "Couldn't accept that request. Try again."
            }
            optimisticResolved.remove(profileId)
        }
    }

    private func declineFriend(_ profileId: UUID) {
        guard let me = Repo.currentUserId,
              let friendship = friendships.first(where: {
                  $0.requesterId == profileId && $0.addresseeId == me
              })
        else { return }
        Haptics.tap()
        Task {
            do {
                try await Repo.respondFriend(friendshipId: friendship.id, accept: false)
                friendships = try await Repo.friendships()
                app.bumpData()
                await app.refreshBadges()
            } catch {
                errorMessage = "Couldn't decline that request. Try again."
            }
        }
    }

    // MARK: Data

    private func load() async {
        do {
            async let questsTask = Repo.feedQuests()
            async let peopleTask = Repo.searchPeople(query: "")
            async let friendshipsTask = Repo.friendships()
            let (feed, people, friendships) = try await (questsTask, peopleTask, friendshipsTask)
            let me = Repo.currentUserId
            quests = feed
            suggestions = Array(people.filter { $0.id != me }.prefix(10))
            self.friendships = friendships
            loaded = true
        } catch {
            errorMessage = error.localizedDescription
        }
        // Keep the contacts state honest across loads (initial + pull-to-refresh):
        // reflect a revoked permission, and re-sync matches only if already
        // granted so refresh updates the list without re-prompting.
        if ContactsSync.isDenied {
            contactsDenied = true
        } else if didSyncContacts {
            contactsDenied = false
            if let phones = await syncedPhones() {
                let matches = (try? await Repo.matchContacts(phones: phones)) ?? contactMatches
                contactMatches = matches
                ExploreView.cachedMatches = matches
            }
        }
    }

    /// Re-fetch device numbers without prompting (permission already granted).
    private func syncedPhones() async -> [String]? {
        if case .authorized(let phones) = await ContactsSync.requestAndFetchPhones() {
            return phones
        }
        return nil
    }

    private func searchPeople() async {
        guard !trimmedQuery.isEmpty else {
            peopleResults = []
            searchFailed = false
            return
        }
        // Debounce: coalesce keystrokes; task cancellation handles the rest.
        try? await Task.sleep(nanoseconds: 300_000_000)
        guard !Task.isCancelled else { return }
        let me = Repo.currentUserId
        do {
            let found = try await Repo.searchPeople(query: trimmedQuery)
            peopleResults = found.filter { $0.id != me }
            searchFailed = false
        } catch {
            peopleResults = []
            searchFailed = true
        }
    }
}

// MARK: - Person row (avatar · name/@handle · friendship button)

private struct PersonRow: View {
    let profile: ProfileRow
    let state: FriendshipState
    let onAdd: () -> Void
    let onAccept: () -> Void
    let onDecline: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            NavigationLink {
                PublicProfileView(profileId: profile.id)
            } label: {
                HStack(spacing: 10) {
                    AvatarView(
                        initials: profile.initials,
                        url: profile.avatarUrl.flatMap(URL.init),
                        size: 40
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(profile.displayName)
                            .font(.system(size: 14.5, weight: .bold))
                            .foregroundStyle(Theme.foreground)
                            .lineLimit(1)
                        Text("@\(profile.handle)")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.sub)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            trailingButton
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder private var trailingButton: some View {
        switch state {
        case .friends:
            Button("Friends") {}
                .buttonStyle(GhostButtonStyle(fullWidth: false))
                .disabled(true)
        case .outgoing:
            Button("Requested") {}
                .buttonStyle(GhostButtonStyle(fullWidth: false))
                .disabled(true)
        case .incoming:
            HStack(spacing: 6) {
                Button("Decline", action: onDecline)
                    .buttonStyle(GhostButtonStyle(fullWidth: false))
                Button("Accept", action: onAccept)
                    .buttonStyle(MintButtonStyle(fullWidth: false))
            }
        default:
            Button("Add", action: onAdd)
                .buttonStyle(MintButtonStyle(fullWidth: false))
        }
    }
}

// MARK: - Event row (same shape as Home's this-week row)

private struct ExploreQuestRow: View {
    let quest: Quest
    var friendIds: Set<UUID> = []

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
                if let proof = quest.socialProof(friendIds: friendIds) {
                    SocialProofLine(proof: proof)
                        .padding(.top, 1)
                }
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
