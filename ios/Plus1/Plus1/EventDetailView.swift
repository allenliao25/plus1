import SwiftUI
import Supabase
import UIKit
import EventKit
import EventKitUI

/// Event detail — full-bleed artwork hero with the title on the image,
/// grouped info card, host row, Going stack, and a liquid-glass join dock
/// (mockups 02 + 08).
struct EventDetailView: View {
    let questId: UUID

    @Environment(\.openURL) private var openURL
    @Environment(AppModel.self) private var app
    @EnvironmentObject private var session: SessionStore

    @State private var quest: Quest?
    @State private var shareURL: URL?
    @State private var errorMessage: String?
    @State private var joining = false
    @State private var justJoined = false
    @State private var confirmingLeave = false
    @State private var confirmingClose = false
    @State private var editing = false
    @State private var chatThreadId: UUID?
    @State private var chatTitle = ""
    @State private var chatPresented = false
    @State private var reporting = false
    @State private var addingToCalendar = false
    @State private var toastMessage: String?
    @State private var sharing = false
    @State private var shareItems: [Any]?

    /// Deployed web app (capacitor.config.ts) — share links resolve there.
    private static let webBaseURL = "https://plus1-livid.vercel.app"

    var body: some View {
        Group {
            if let quest {
                content(quest)
            } else {
                skeletonContent
            }
        }
        .background(Theme.background)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
        .toast($toastMessage)
        .task(id: app.dataVersion) { await load() }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: .init(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        .confirmationDialog(
            "Leave this event?",
            isPresented: $confirmingLeave,
            titleVisibility: .visible
        ) {
            Button("Leave event", role: .destructive) { leave() }
        }
        .confirmationDialog(
            "Close this event? People won't be able to join anymore.",
            isPresented: $confirmingClose,
            titleVisibility: .visible
        ) {
            Button("Close event", role: .destructive) { close() }
        }
        .sheet(isPresented: $editing) {
            CreateEventView(editing: quest, onSaved: { Task { await load() } })
        }
        .sheet(isPresented: $reporting) {
            ReportSheet(kind: "quest", targetId: questId)
        }
        .sheet(isPresented: $addingToCalendar) {
            if let quest {
                CalendarEventEditor(quest: quest) { addingToCalendar = false }
                    .ignoresSafeArea()
            }
        }
        .navigationDestination(isPresented: $chatPresented) {
            if let chatThreadId {
                ChatThreadView(threadId: chatThreadId, title: chatTitle)
            }
        }
        .sheet(isPresented: .init(
            get: { shareItems != nil }, set: { if !$0 { shareItems = nil } }
        )) {
            if let shareItems {
                ShareSheet(items: shareItems)
            }
        }
    }

    // MARK: - Skeleton (initial load)

    private var skeletonContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                RoundedRectangle(cornerRadius: 22)
                    .fill(Theme.chip)
                    .frame(height: 230)
                SkeletonCard(height: 120)
                SkeletonCard(height: 64)
                SkeletonCard(height: 70)
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Layout

    private func content(_ quest: Quest) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                hero(quest)
                if justJoined && quest.joinedByCurrentUser {
                    joinedBanner
                }
                infoCard(quest)
                if let host = quest.host {
                    hostRow(host)
                }
                goingSection(quest)
                if quest.createdByCurrentUser && !quest.invitedProfiles.isEmpty {
                    invitedSection(quest)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 20)
        }
        .scrollIndicators(.hidden)
        .safeAreaInset(edge: .bottom) { dock(quest) }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if shareURL != nil {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    share()
                } label: {
                    if sharing {
                        ProgressView()
                    } else {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
                .disabled(sharing)
                .accessibilityLabel("Share event")
            }
        }
        if let quest, quest.createdByCurrentUser {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        editing = true
                    } label: {
                        Label("Edit event", systemImage: "pencil")
                    }
                    if quest.isOpen {
                        Button(role: .destructive) {
                            confirmingClose = true
                        } label: {
                            Label("Close event", systemImage: "xmark.circle")
                        }
                    } else {
                        Button {
                            reopen()
                        } label: {
                            Label("Reopen event", systemImage: "arrow.uturn.up")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Theme.foreground)
                }
                .accessibilityLabel("Event options")
            }
        } else if quest != nil {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(role: .destructive) {
                        reporting = true
                    } label: {
                        Label("Report event", systemImage: "flag")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Theme.foreground)
                }
                .accessibilityLabel("Event options")
            }
        }
    }

    // MARK: - Hero

    private func hero(_ quest: Quest) -> some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                if let url = quest.cardImageURL {
                    Color.clear.overlay(
                        AsyncImage(url: url) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            quest.category.gradient
                        }
                    )
                } else {
                    CategoryArtwork(category: quest.category, emojiSize: 100)
                }
            }

            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.38), location: 0),
                    .init(color: .clear, location: 0.3),
                    .init(color: .clear, location: 0.55),
                    .init(color: .black.opacity(0.62), location: 1),
                ],
                startPoint: .top, endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 4) {
                Text("\(quest.category.rawValue) · \(quest.visibility.label)".uppercased())
                    .font(.system(size: 10, design: .monospaced))
                    .kerning(1.2)
                    .foregroundStyle(.white.opacity(0.85))
                Text(quest.title)
                    .font(.system(size: 23, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(3)
                Text("\(quest.timeLabel) · hosted by \(quest.host?.displayName ?? "someone")")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.85))
            }
            .padding(14)
        }
        .frame(height: 230)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }

    private var joinedBanner: some View {
        HStack(spacing: 9) {
            Text("🎉").font(.system(size: 16))
            Text("You're going! 🎉")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.foreground)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accent.opacity(0.14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.accent.opacity(0.3), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .transition(.opacity)
    }

    // MARK: - Grouped info card

    private func infoCard(_ quest: Quest) -> some View {
        VStack(spacing: 0) {
            if quest.startDate != nil {
                Button {
                    addingToCalendar = true
                } label: {
                    infoRow(
                        icon: "clock.fill", tint: .orange,
                        title: quest.timeLabel, subtitle: "Add to calendar"
                    )
                }
                .buttonStyle(.plain)
            } else {
                infoRow(
                    icon: "clock.fill", tint: .orange,
                    title: quest.timeLabel, subtitle: "Happening now"
                )
            }
            divider
            Button {
                openInMaps(quest.location)
            } label: {
                infoRow(
                    icon: "mappin.and.ellipse", tint: .red,
                    title: quest.location, subtitle: "Open in Maps"
                )
            }
            .buttonStyle(.plain)
            divider
            infoRow(
                icon: "person.2.fill", tint: .green,
                title: capacityTitle(quest), subtitle: capacitySubtitle(quest)
            )
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var divider: some View {
        Rectangle().fill(Theme.hair).frame(height: 0.5).padding(.leading, 56)
    }

    private func infoRow(icon: String, tint: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(tint, in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.sub)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
    }

    private func capacityTitle(_ quest: Quest) -> String {
        if let max = quest.row.maxPeople {
            return "\(quest.goingCount) of \(max) going"
        }
        return "\(quest.goingCount) going"
    }

    private func capacitySubtitle(_ quest: Quest) -> String {
        guard let left = quest.spotsLeft else { return "no cap" }
        return left == 1 ? "1 spot left" : "\(left) spots left"
    }

    private func openInMaps(_ location: String) {
        let query = location.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? location
        if let url = URL(string: "maps://?q=\(query)") {
            openURL(url)
        }
    }

    // MARK: - Host row

    private func hostRow(_ host: ProfileRow) -> some View {
        HStack(spacing: 10) {
            NavigationLink {
                PublicProfileView(profileId: host.id)
            } label: {
                HStack(spacing: 10) {
                    AvatarView(initials: host.initials, url: host.avatarUrl.flatMap(URL.init), size: 40)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(host.displayName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Theme.foreground)
                        Text("Host")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.sub)
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer()

            if host.id != Repo.currentUserId {
                Button {
                    messageHost(host)
                } label: {
                    Text("Message")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundStyle(Theme.accentText)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Theme.chip)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .card()
    }

    private func messageHost(_ host: ProfileRow) {
        Task {
            do {
                let threadId = try await Repo.directThread(with: host.id)
                chatThreadId = threadId
                chatTitle = host.displayName
                chatPresented = true
            } catch {
                errorMessage = "Couldn't open that chat. Try again."
            }
        }
    }

    // MARK: - Going

    private func goingSection(_ quest: Quest) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(
                title: "Going",
                caption: quest.goingCount == 1 ? "1 person" : "\(quest.goingCount) people"
            )
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(quest.attendees) { person in
                        NavigationLink {
                            PublicProfileView(profileId: person.id)
                        } label: {
                            AvatarView(
                                initials: person.avatarInitials,
                                url: person.avatarUrl.flatMap(URL.init),
                                size: 32
                            )
                            .overlay {
                                if quest.joinedByCurrentUser && person.id == Repo.currentUserId {
                                    Circle()
                                        .stroke(Theme.accent, lineWidth: 2)
                                        .padding(-2.5)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    ForEach(0..<min(quest.spotsLeft ?? 0, 5), id: \.self) { _ in
                        Circle()
                            .strokeBorder(Theme.hair, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                            .frame(width: 32, height: 32)
                            .overlay(
                                Image(systemName: "plus")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Theme.sub)
                            )
                    }
                }
                .padding(.vertical, 3)
            }
            .scrollIndicators(.hidden)
        }
    }

    // MARK: - Invited (host only)

    private func invitedSection(_ quest: Quest) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(
                title: "Invited",
                caption: quest.invitedProfiles.count == 1 ? "1 pending" : "\(quest.invitedProfiles.count) pending"
            )
            VStack(spacing: 10) {
                ForEach(quest.invitedProfiles) { person in
                    HStack(spacing: 10) {
                        AvatarView(
                            initials: person.initials,
                            url: person.avatarUrl.flatMap(URL.init),
                            size: 36
                        )
                        VStack(alignment: .leading, spacing: 1) {
                            Text(person.displayName)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.foreground)
                            Text("Pending")
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.sub)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
            .card()
        }
    }

    // MARK: - Join dock

    private func dock(_ quest: Quest) -> some View {
        HStack(spacing: 10) {
            if quest.createdByCurrentUser {
                Button("Event chat") { openEventChat(quest) }
                    .buttonStyle(MintButtonStyle())
            } else if quest.joinedByCurrentUser {
                Button("You're in ✓") { confirmingLeave = true }
                    .buttonStyle(GhostButtonStyle())
                Button("Event chat") { openEventChat(quest) }
                    .buttonStyle(MintButtonStyle())
            } else {
                Button(joinLabel(quest)) { join() }
                    .buttonStyle(MintButtonStyle())
                    .disabled(quest.isFull || !quest.isOpen || joining)
                    .opacity(quest.isFull || !quest.isOpen ? 0.55 : 1)
            }
        }
        .padding(8)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Theme.hair, lineWidth: 0.5))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func joinLabel(_ quest: Quest) -> String {
        if !quest.isOpen { return "Event closed" }
        if quest.isFull { return "Event full" }
        guard let left = quest.spotsLeft else { return "Join" }
        return left == 1 ? "Join · 1 spot left" : "Join · \(left) spots left"
    }

    // MARK: - Data operations

    private func load() async {
        do {
            let loaded = try await Repo.quest(id: questId)
            quest = loaded
            // Mint the share link for ALL viewers so the toolbar ShareLink
            // works for attendees too (audit blocker: it was host-only).
            if shareURL == nil {
                await loadShareLink()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Web-parity share link: RPC mints a token, the deployed site serves /e/<token>.
    private func loadShareLink() async {
        struct ShareLinkResult: Decodable { let token: String; let created: Bool }
        do {
            let result: ShareLinkResult = try await Supa.client
                .rpc("create_quest_share_link", params: ["target_quest_id": questId])
                .single().execute().value
            shareURL = URL(string: "\(Self.webBaseURL)/e/\(result.token)")
        } catch {
            // Sharing stays hidden if the link can't be minted; not fatal.
        }
    }

    /// Renders the story card (fetching the cover photo first) and opens the
    /// system share sheet with both the image and the link. The URL is always
    /// present in the sheet's items, so the plain link stays shareable.
    private func share() {
        guard let quest, let shareURL, !sharing else { return }
        Haptics.tap()
        sharing = true
        Task {
            defer { sharing = false }
            let cover = await loadCoverImage(quest.cardImageURL)
            if let card = await renderShareCard(quest: quest, coverImage: cover, shareURL: shareURL) {
                shareItems = [card, shareURL]
            } else {
                // Card render failed — still let the user share the link.
                shareItems = [shareURL]
            }
        }
    }

    private func join() {
        guard let me = Repo.currentUserId, let snapshot = quest else { return }
        joining = true
        // Optimistic: flip membership + counts immediately, revert on error.
        applyMembership(joined: true, userId: me)
        Haptics.success()
        withAnimation { justJoined = true }
        scheduleBannerDismiss()
        Task {
            defer { joining = false }
            do {
                try await Repo.joinQuest(id: questId)
                await load()
                app.bumpData()
                await app.refreshBadges()
            } catch {
                quest = snapshot
                justJoined = false
                errorMessage = "Couldn't join this event. Try again."
            }
        }
    }

    private func leave() {
        guard let me = Repo.currentUserId, let snapshot = quest else { return }
        // Optimistic: drop membership + counts immediately, revert on error.
        applyMembership(joined: false, userId: me)
        justJoined = false
        Task {
            do {
                try await Repo.leaveQuest(id: questId)
                await load()
                app.bumpData()
                await app.refreshBadges()
            } catch {
                quest = snapshot
                errorMessage = "Couldn't leave this event. Try again."
            }
        }
    }

    /// Local-only membership flip for optimistic UI; the RPC reload is the
    /// source of truth and overwrites this shortly after.
    private func applyMembership(joined: Bool, userId: UUID) {
        guard var current = quest else { return }
        if joined {
            guard !current.joinedByCurrentUser else { return }
            current.joinedByCurrentUser = true
            if !current.attendees.contains(where: { $0.id == userId }),
               let me = session.profile {
                current.attendees.append(QuestAttendee(
                    id: userId, displayName: me.displayName,
                    avatarInitials: me.initials, avatarUrl: me.avatarUrl, isHost: false
                ))
            }
        } else {
            current.joinedByCurrentUser = false
            current.attendees.removeAll { $0.id == userId && !$0.isHost }
        }
        quest = current
    }

    /// Auto-dismiss the "You're going!" banner after ~4s with animation.
    private func scheduleBannerDismiss() {
        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            withAnimation { justJoined = false }
        }
    }

    private func close() {
        Task {
            do {
                try await Repo.closeQuest(id: questId)
                await load()
                Haptics.success()
                toastMessage = "Event closed"
                app.bumpData()
            } catch {
                errorMessage = "Couldn't close this event. Try again."
            }
        }
    }

    private func reopen() {
        Task {
            do {
                try await Repo.reopenQuest(questId: questId)
                await load()
                Haptics.success()
                toastMessage = "Event reopened"
                app.bumpData()
            } catch {
                errorMessage = "Couldn't reopen this event. Try again."
            }
        }
    }

    private func openEventChat(_ quest: Quest) {
        Task {
            do {
                let threadId = try await Repo.eventThread(questId: questId)
                chatThreadId = threadId
                chatTitle = quest.title
                chatPresented = true
            } catch {
                errorMessage = "Couldn't open the event chat. Try again."
            }
        }
    }
}

// MARK: - Share sheet

/// Wraps `UIActivityViewController` so the share sheet carries the rendered
/// card image AND the link — the image gives Instagram/Messages a real preview
/// while the URL stays available for link-only targets.
private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// MARK: - Add to calendar

/// Presents the system `EKEventEditViewController` prefilled from the quest.
/// On iOS 17+ this VC runs out of process and needs no calendar permission or
/// usage-description keys — the user grants the single event inline.
private struct CalendarEventEditor: UIViewControllerRepresentable {
    let quest: Quest
    let onDismiss: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onDismiss: onDismiss) }

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let store = EKEventStore()
        let event = EKEvent(eventStore: store)
        event.title = quest.title
        event.location = quest.location
        if let start = quest.startDate {
            event.startDate = start
            event.endDate = start.addingTimeInterval(2 * 60 * 60)
        }
        let controller = EKEventEditViewController()
        controller.eventStore = store
        controller.event = event
        controller.editViewDelegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: EKEventEditViewController, context: Context) {}

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let onDismiss: () -> Void
        init(onDismiss: @escaping () -> Void) { self.onDismiss = onDismiss }

        func eventEditViewController(
            _ controller: EKEventEditViewController,
            didCompleteWith action: EKEventEditViewAction
        ) {
            controller.dismiss(animated: true) { [onDismiss] in onDismiss() }
        }
    }
}
