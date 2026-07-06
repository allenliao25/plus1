import SwiftUI
import Supabase
import PhotosUI

/// Own profile — Instagram-compact header (avatar left, stats right, one
/// name/bio block, edit button) so the event grid owns the screen.
struct ProfileView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(AppModel.self) private var app

    @State private var hosted: [Quest] = []
    @State private var joined: [Quest] = []
    @State private var friendCount = 0
    @State private var tab: GridTab = .hosted
    @State private var showingSettings = false
    @State private var showingEdit = false
    @State private var errorMessage: String?
    @State private var loaded = false

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
        .compactNavTitle(session.profile.map { "@\($0.handle)" } ?? "")
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
                .presentationDetents([.large])
        }
        .sheet(isPresented: $showingEdit) {
            if let profile = session.profile {
                EditProfileSheet(profile: profile)
            }
        }
        .task(id: app.dataVersion) { await load() }
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
        if !loaded {
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 3),
                spacing: 7
            ) {
                ForEach(0..<6, id: \.self) { _ in
                    SkeletonCard(height: 86)
                }
            }
        } else if quests.isEmpty {
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
            errorMessage = error.localizedDescription
        }
        loaded = true
    }
}

/// Square grid tile: category artwork (or cover photo) with attendance count.
/// Open events read "N going"; closed/ended events dim and read "N went".
private struct ProfileEventTile: View {
    let quest: Quest

    private var ended: Bool { !quest.isOpen }
    private var countLabel: String {
        ended ? "\(quest.goingCount) went" : "\(quest.goingCount) going"
    }

    var body: some View {
        CategoryArtwork(category: quest.category, imageURL: quest.cardImageURL, emojiSize: 26)
            .frame(height: 86)
            .frame(maxWidth: .infinity)
            .opacity(ended ? 0.55 : 1)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(alignment: .topTrailing) {
                if ended {
                    Text("Ended")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.black.opacity(0.5), in: Capsule())
                        .padding(5)
                }
            }
            .overlay(alignment: .bottomLeading) {
                Text(countLabel)
                    .font(.system(size: 10.5, weight: .heavy))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.5), radius: 3)
                    .padding(7)
            }
            .accessibilityLabel("\(quest.title), \(countLabel)")
    }
}

// MARK: - Edit profile

private struct EditProfileSheet: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(AppModel.self) private var app
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

    // Avatar
    @State private var photoItem: PhotosPickerItem?
    @State private var pickedImage: UIImage?
    @State private var uploadedAvatarUrl: String?
    @State private var uploadingPhoto = false

    // Handle availability
    @State private var handleAvailable: Bool?
    @State private var checkingHandle = false
    @State private var handleCheckTask: Task<Void, Never>?

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
        name.trimmingCharacters(in: .whitespaces).count >= 2
            && handle.count >= 3
            && handleAvailable != false
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Spacer()
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            VStack(spacing: 6) {
                                ZStack {
                                    if let pickedImage {
                                        Image(uiImage: pickedImage)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 76, height: 76)
                                            .clipShape(Circle())
                                    } else {
                                        AvatarView(
                                            initials: profile.initials,
                                            url: profile.avatarUrl.flatMap(URL.init),
                                            size: 76
                                        )
                                    }
                                    if uploadingPhoto {
                                        Circle().fill(.black.opacity(0.35))
                                            .frame(width: 76, height: 76)
                                        ProgressView().tint(.white)
                                    }
                                }
                                Text("Change photo")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Theme.accentText)
                            }
                        }
                        Spacer()
                    }
                    .padding(.bottom, 4)

                    field("Name") {
                        TextField("Your name", text: $name)
                            .textContentType(.name)
                            .font(.system(size: 16))
                    }

                    field("Handle") {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 2) {
                                Text("@")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Theme.accent)
                                TextField("handle", text: $handle)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .font(.system(size: 16))
                                    .onChange(of: handle) { _, next in
                                        let clean = Self.sanitizeHandle(next)
                                        if clean != handle { handle = clean }
                                        scheduleHandleCheck()
                                    }
                                if checkingHandle {
                                    ProgressView().scaleEffect(0.7)
                                } else if handleAvailable == true {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.accentText)
                                        .font(.system(size: 15))
                                }
                            }
                            if handleAvailable == false {
                                Text("@\(handle) is taken")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.destructive)
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
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task { await handlePickedPhoto(newItem) }
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

    // MARK: Avatar

    private func handlePickedPhoto(_ item: PhotosPickerItem) async {
        uploadingPhoto = true
        defer { uploadingPhoto = false }
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = ProfileSetupView.downscaledJPEG(image) else {
            errorMessage = "Couldn't use that photo — try another."
            return
        }
        pickedImage = image
        do {
            uploadedAvatarUrl = try await Repo.uploadAvatar(data: jpeg, userId: profile.id)
        } catch {
            pickedImage = nil
            uploadedAvatarUrl = nil
            errorMessage = "Couldn't upload your photo — try again."
        }
    }

    // MARK: Handle availability

    private func scheduleHandleCheck() {
        handleCheckTask?.cancel()
        // Unchanged handle → treat as available (it's already theirs).
        if handle.lowercased() == profile.handle.lowercased() {
            handleAvailable = nil
            checkingHandle = false
            return
        }
        handleAvailable = nil
        guard handle.count >= 3 else {
            checkingHandle = false
            return
        }
        checkingHandle = true
        handleCheckTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            if Task.isCancelled { return }
            let available = (try? await Repo.isHandleAvailable(handle, excluding: profile.id)) ?? true
            if Task.isCancelled { return }
            checkingHandle = false
            handleAvailable = available
        }
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
                var fields: [String: AnyJSON] = [
                    "display_name": .string(trimmedName),
                    "handle": .string(handle),
                    "bio": trimmedBio.isEmpty ? .null : .string(trimmedBio),
                    "pronouns": trimmedPronouns.isEmpty ? .null : .string(trimmedPronouns),
                    "area": .string(trimmedArea),
                    "interests": .array(interests.map { .string($0) }),
                    "avatar_initials": .string(String(initialParts).uppercased()),
                ]
                if let uploadedAvatarUrl {
                    fields["avatar_url"] = .string(uploadedAvatarUrl)
                }
                try await Repo.updateProfile(fields, userId: profile.id)
                await session.refreshProfile()
                app.bumpData()
                dismiss()
            } catch {
                errorMessage = Self.saveError(error)
            }
        }
    }

    /// Friendly wrapper for a raw handle collision that beats the async check.
    private static func saveError(_ error: Error) -> String {
        let text = error.localizedDescription.lowercased()
        if text.contains("duplicate") || text.contains("unique") || text.contains("handle") {
            return "That handle just got taken — try another."
        }
        return error.localizedDescription
    }
}

// MARK: - Settings

private struct SettingsSheet: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var confirmingSignOut = false
    @State private var confirmingDelete = false
    @State private var confirmingDeleteFinal = false
    @State private var deleting = false
    @State private var errorMessage: String?

    private static let termsURL = URL(string: "https://plus1-livid.vercel.app/terms")!
    private static let privacyURL = URL(string: "https://plus1-livid.vercel.app/privacy")!

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    section("Account") {
                        NavigationLink {
                            BlockedUsersView()
                        } label: {
                            settingsRow("Blocked users", icon: "hand.raised", chevron: true)
                        }
                        .buttonStyle(.plain)
                    }

                    section("About") {
                        Link(destination: Self.termsURL) {
                            settingsRow("Terms of Service", icon: "doc.text", chevron: true)
                        }
                        divider
                        Link(destination: Self.privacyURL) {
                            settingsRow("Privacy Policy", icon: "lock.shield", chevron: true)
                        }
                        divider
                        settingsRow("Version", icon: "info.circle", trailing: "v\(Self.appVersion)")
                    }

                    section {
                        Button {
                            confirmingSignOut = true
                        } label: {
                            settingsRow("Sign out", icon: "rectangle.portrait.and.arrow.right", tint: Theme.destructive)
                        }
                        .buttonStyle(.plain)
                    }

                    section("Danger zone") {
                        Button {
                            confirmingDelete = true
                        } label: {
                            settingsRow("Delete account", icon: "trash", tint: Theme.destructive)
                        }
                        .buttonStyle(.plain)
                        .disabled(deleting)
                    }
                }
                .padding(16)
            }
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
            .confirmationDialog(
                "Delete your account?",
                isPresented: $confirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete account", role: .destructive) {
                    confirmingDeleteFinal = true
                }
            } message: {
                Text("Deleting your account is permanent and can't be undone.")
            }
            .alert("Delete account?", isPresented: $confirmingDeleteFinal) {
                Button("Cancel", role: .cancel) {}
                Button("Delete my account", role: .destructive) { deleteAccount() }
            } message: {
                Text("This permanently deletes your profile, events, and messages. There's no undo.")
            }
            .alert("Couldn't delete account", isPresented: errorBinding) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .overlay {
                if deleting {
                    ZStack {
                        Color.black.opacity(0.25).ignoresSafeArea()
                        ProgressView("Deleting…").tint(Theme.accent)
                            .padding(20)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    // MARK: Pieces

    @ViewBuilder
    private func section(_ title: String? = nil, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title {
                Text(title.uppercased())
                    .font(.system(size: 10, design: .monospaced))
                    .kerning(1.2)
                    .foregroundStyle(Theme.sub)
                    .padding(.leading, 4)
            }
            VStack(spacing: 0) { content() }
                .card(padding: 0)
        }
    }

    private var divider: some View {
        Rectangle().fill(Theme.hair).frame(height: 0.5).padding(.leading, 46)
    }

    private func settingsRow(
        _ title: String, icon: String, tint: Color = Theme.foreground,
        chevron: Bool = false, trailing: String? = nil
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .frame(width: 22)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Theme.sub)
            }
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.sub)
            }
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }

    private func deleteAccount() {
        guard !deleting else { return }
        deleting = true
        Task {
            defer { deleting = false }
            do {
                try await Repo.deleteAccount()
                // deleteAccount signs out; the session phase change dismisses this.
            } catch {
                errorMessage = "Couldn't delete your account — try again in a moment."
            }
        }
    }

    private static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }
}

// MARK: - Blocked users

private struct BlockedUsersView: View {
    @Environment(AppModel.self) private var app
    @State private var profiles: [ProfileRow] = []
    @State private var loaded = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                if !loaded {
                    ForEach(0..<3, id: \.self) { _ in SkeletonCard(height: 56) }
                } else if profiles.isEmpty {
                    EmptyStateCard(
                        emoji: "🙂",
                        title: "No one blocked",
                        message: "You haven't blocked anyone."
                    )
                } else {
                    ForEach(profiles) { profile in
                        HStack(spacing: 12) {
                            AvatarView(
                                initials: profile.initials,
                                url: profile.avatarUrl.flatMap(URL.init),
                                size: 40
                            )
                            VStack(alignment: .leading, spacing: 1) {
                                Text(profile.displayName)
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(Theme.foreground)
                                Text("@\(profile.handle)")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Theme.sub)
                            }
                            Spacer()
                            Button("Unblock") { unblock(profile) }
                                .buttonStyle(GhostButtonStyle(fullWidth: false))
                        }
                        .padding(10)
                        .card()
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .compactNavTitle("Blocked")
        .task { await load() }
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

    private func load() async {
        do {
            profiles = try await Repo.blockedProfiles()
        } catch {
            errorMessage = error.localizedDescription
        }
        loaded = true
    }

    private func unblock(_ profile: ProfileRow) {
        Task {
            do {
                try await Repo.unblock(userId: profile.id)
                profiles.removeAll { $0.id == profile.id }
                app.blockedIds.remove(profile.id)
                app.bumpData()
            } catch {
                errorMessage = "Couldn't unblock — try again."
            }
        }
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
