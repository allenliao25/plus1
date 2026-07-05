import SwiftUI

/// Explore (mockups §05): search-first tab. Default view is friend
/// suggestions + campus-open events; searching filters BOTH people
/// (server-side) and the loaded event feed (title/location).
struct ExploreView: View {
    @State private var quests: [Quest] = []
    @State private var suggestions: [ProfileRow] = []
    @State private var friendships: [FriendshipRow] = []
    @State private var peopleResults: [ProfileRow] = []
    @State private var query = ""
    @State private var loaded = false
    @State private var errorMessage: String?

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

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                if trimmedQuery.isEmpty {
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
        .task { await load() }
        .task(id: trimmedQuery) { await searchPeople() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: .init(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
    }

    // MARK: Default content

    @ViewBuilder private var defaultSections: some View {
        if !suggestions.isEmpty {
            SectionHeader(title: "Find friends", caption: "\(suggestions.count) suggested")
            peopleGroup(suggestions)
        }
        if !campusQuests.isEmpty {
            SectionHeader(title: "Around campus", caption: "open to all")
            ForEach(campusQuests) { quest in
                NavigationLink {
                    EventDetailView(questId: quest.id)
                } label: {
                    ExploreQuestRow(quest: quest)
                }
                .buttonStyle(.plain)
            }
        }
        if loaded && suggestions.isEmpty && campusQuests.isEmpty {
            EmptyStateCard(
                emoji: "🔍",
                title: "Nothing to explore yet",
                message: "People and campus-open events show up here as they join plus1."
            )
        }
    }

    // MARK: Search results

    @ViewBuilder private var searchSections: some View {
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
                    ExploreQuestRow(quest: quest)
                }
                .buttonStyle(.plain)
            }
        }
        if loaded && peopleResults.isEmpty && questResults.isEmpty {
            EmptyStateCard(
                emoji: "🔍",
                title: "No matches",
                message: "Try a different name, event, or place."
            )
        }
    }

    private func peopleGroup(_ people: [ProfileRow]) -> some View {
        VStack(spacing: 0) {
            ForEach(people) { person in
                PersonRow(
                    profile: person,
                    state: friendshipState(for: person.id),
                    onAdd: { addFriend(person.id) },
                    onAccept: { acceptFriend(person.id) }
                )
                if person.id != people.last?.id {
                    Rectangle().fill(Theme.hair).frame(height: 0.5)
                }
            }
        }
        .card()
    }

    // MARK: Friendship state + actions

    private func friendshipState(for profileId: UUID) -> FriendshipState {
        guard let me = Repo.currentUserId else { return .none }
        guard let friendship = friendships.first(where: { $0.otherId(for: me) == profileId }) else {
            return .none
        }
        return friendship.state(for: me)
    }

    private func addFriend(_ profileId: UUID) {
        Task {
            do {
                try await Repo.requestFriend(addresseeId: profileId)
                friendships = try await Repo.friendships()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func acceptFriend(_ profileId: UUID) {
        guard let me = Repo.currentUserId,
              let friendship = friendships.first(where: {
                  $0.requesterId == profileId && $0.addresseeId == me
              })
        else { return }
        Task {
            do {
                try await Repo.respondFriend(friendshipId: friendship.id, accept: true)
                friendships = try await Repo.friendships()
            } catch {
                errorMessage = error.localizedDescription
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
            guard !(error is CancellationError) else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func searchPeople() async {
        guard !trimmedQuery.isEmpty else {
            peopleResults = []
            return
        }
        let me = Repo.currentUserId
        let found = (try? await Repo.searchPeople(query: trimmedQuery)) ?? []
        peopleResults = found.filter { $0.id != me }
    }
}

// MARK: - Person row (avatar · name/@handle · friendship button)

private struct PersonRow: View {
    let profile: ProfileRow
    let state: FriendshipState
    let onAdd: () -> Void
    let onAccept: () -> Void

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
            Button("Pending") {}
                .buttonStyle(GhostButtonStyle(fullWidth: false))
                .disabled(true)
        case .incoming:
            Button("Accept", action: onAccept)
                .buttonStyle(MintButtonStyle(fullWidth: false))
        default:
            Button("Add", action: onAdd)
                .buttonStyle(MintButtonStyle(fullWidth: false))
        }
    }
}

// MARK: - Event row (same shape as Home's this-week row)

private struct ExploreQuestRow: View {
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
