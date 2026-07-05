import SwiftUI
import Supabase

/// Own profile — Instagram-compact header (avatar left, stats right, one
/// name/bio block, edit button) so the event grid owns the screen.
struct ProfileView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var hosted: [Quest] = []
    @State private var joined: [Quest] = []
    @State private var friendCount = 0
    @State private var tab: GridTab = .hosted
    @State private var showingSettings = false
    @State private var showingEdit = false
    @State private var errorMessage: String?

    private enum GridTab: String, CaseIterable {
        case hosted = "Hosted"
        case joined = "Joined"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let profile = session.profile {
                    header(profile)
                }

                Button("Edit profile") { showingEdit = true }
                    .buttonStyle(GhostButtonStyle())

                Picker("Events", selection: $tab) {
                    ForEach(GridTab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                grid
            }
            .padding(16)
        }
        .background(Theme.background)
        .compactNavTitle("@\(session.profile?.handle ?? "me")")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityLabel("Settings")
            }
        }
        .sheet(isPresented: $showingSettings) {
            SettingsSheet()
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showingEdit) {
            if let profile = session.profile {
                EditProfileSheet(profile: profile)
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: errorBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
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
                    statColumn("\(hosted.count)", "Hosted")
                    statColumn("\(joined.count)", "Joined")
                    statColumn("\(friendCount)", "Friends")
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
                ProfileChipFlow(spacing: 7) {
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

    @ViewBuilder private var grid: some View {
        let quests = tab == .hosted ? hosted : joined
        if quests.isEmpty {
            EmptyStateCard(
                emoji: tab == .hosted ? "🗓️" : "🧭",
                title: tab == .hosted ? "No events hosted yet" : "No events joined yet",
                message: tab == .hosted
                    ? "Create one with the + button"
                    : "Explore to find something"
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
                        ProfileEventTile(quest: quest)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Data

    private func load() async {
        await session.refreshProfile()
        do {
            let mine = try await Repo.myQuests()
            hosted = mine.hosted
            joined = mine.joined
            if let me = session.userId {
                let rows = try await Repo.friendships()
                friendCount = rows.filter { $0.state(for: me) == .friends }.count
            }
        } catch {
            guard !(error is CancellationError) else { return }
            errorMessage = error.localizedDescription
        }
    }
}

/// Square grid tile: category artwork (or cover photo) with attendance count.
private struct ProfileEventTile: View {
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

// MARK: - Edit profile

private struct EditProfileSheet: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    let profile: ProfileRow

    @State private var name: String
    @State private var handle: String
    @State private var bio: String
    @State private var pronouns: String
    @State private var area: String
    @State private var selectedInterests: Set<String>
    @State private var busy = false
    @State private var errorMessage: String?

    private static let interestOptions = [
        "Food", "Study", "Fitness", "Outdoors", "Social", "Running",
        "Basketball", "Boba", "Films", "Music", "Gaming", "Coffee",
    ]

    init(profile: ProfileRow) {
        self.profile = profile
        _name = State(initialValue: profile.displayName)
        _handle = State(initialValue: profile.handle)
        _bio = State(initialValue: profile.bio ?? "")
        _pronouns = State(initialValue: profile.pronouns ?? "")
        _area = State(initialValue: profile.area)
        _selectedInterests = State(initialValue: Set(profile.interests))
    }

    /// Standard options plus any custom interests already on the profile.
    private var allOptions: [String] {
        Self.interestOptions + profile.interests.filter { !Self.interestOptions.contains($0) }
    }

    private var isValid: Bool {
        name.trimmingCharacters(in: .whitespaces).count >= 2 && handle.count >= 3
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    field("Name") {
                        TextField("Your name", text: $name)
                            .textContentType(.name)
                            .font(.system(size: 16))
                    }

                    field("Handle") {
                        HStack(spacing: 2) {
                            Text("@")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Theme.accent)
                            TextField("handle", text: $handle)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .font(.system(size: 16))
                                .onChange(of: handle) { _, next in
                                    handle = Self.sanitizeHandle(next)
                                }
                        }
                    }

                    field("Bio") {
                        TextField("What you're down for", text: $bio, axis: .vertical)
                            .lineLimit(2...4)
                            .font(.system(size: 16))
                    }

                    field("Pronouns") {
                        TextField("Optional", text: $pronouns)
                            .textInputAutocapitalization(.never)
                            .font(.system(size: 16))
                    }

                    field("Area") {
                        TextField("Campus or neighborhood", text: $area)
                            .font(.system(size: 16))
                    }

                    field("Into") {
                        ProfileChipFlow(spacing: 8) {
                            ForEach(allOptions, id: \.self) { interest in
                                interestChip(interest)
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Theme.background)
            .navigationTitle("Edit profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Saving…" : "Save") { save() }
                        .disabled(busy || !isValid)
                }
            }
            .alert("Couldn't save", isPresented: errorBinding) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func field(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.system(size: 10, design: .monospaced))
                .kerning(1.2)
                .foregroundStyle(Theme.sub)
            content()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func interestChip(_ interest: String) -> some View {
        let selected = selectedInterests.contains(interest)
        return Button {
            if selected {
                selectedInterests.remove(interest)
            } else {
                selectedInterests.insert(interest)
            }
        } label: {
            Text(interest)
                .font(.system(size: 13, weight: selected ? .bold : .medium))
                .foregroundStyle(selected ? Theme.accentInk : Theme.foreground)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(selected ? Theme.accent : Theme.chip)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    /// Lowercase, strip everything outside [a-z0-9._].
    private static func sanitizeHandle(_ raw: String) -> String {
        String(raw.lowercased().unicodeScalars.filter {
            ("a"..."z").contains(Character($0)) || ("0"..."9").contains(Character($0))
                || $0 == "_" || $0 == "."
        })
    }

    private func save() {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                let trimmedName = name.trimmingCharacters(in: .whitespaces)
                let trimmedBio = bio.trimmingCharacters(in: .whitespacesAndNewlines)
                let trimmedPronouns = pronouns.trimmingCharacters(in: .whitespaces)
                let trimmedArea = area.trimmingCharacters(in: .whitespaces)
                let interests = allOptions.filter { selectedInterests.contains($0) }
                let initialParts = trimmedName.split(separator: " ").prefix(2).compactMap(\.first)
                try await Repo.updateProfile([
                    "display_name": .string(trimmedName),
                    "handle": .string(handle),
                    "bio": trimmedBio.isEmpty ? .null : .string(trimmedBio),
                    "pronouns": trimmedPronouns.isEmpty ? .null : .string(trimmedPronouns),
                    "area": .string(trimmedArea),
                    "interests": .array(interests.map { .string($0) }),
                    "avatar_initials": .string(String(initialParts).uppercased()),
                ], userId: profile.id)
                await session.refreshProfile()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Settings

private struct SettingsSheet: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var confirmingSignOut = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Button {
                    confirmingSignOut = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 15, weight: .semibold))
                            .frame(width: 22)
                        Text("Sign out")
                            .font(.system(size: 15, weight: .semibold))
                        Spacer()
                    }
                    .foregroundStyle(Theme.destructive)
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
                .card()

                Text("plus1 v\(Self.appVersion)")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.sub)
                    .frame(maxWidth: .infinity)

                Spacer()
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Theme.background)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Sign out of plus1?",
                isPresented: $confirmingSignOut,
                titleVisibility: .visible
            ) {
                Button("Sign out", role: .destructive) {
                    Task { await session.signOut() }
                }
            }
        }
    }

    private static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }
}

// MARK: - Chip flow layout

/// Minimal wrapping flow layout for interest chips.
private struct ProfileChipFlow: Layout {
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
