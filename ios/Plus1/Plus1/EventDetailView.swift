import SwiftUI
import Supabase
import UIKit

/// Event detail — full-bleed artwork hero with the title on the image,
/// grouped info card, host row, Going stack, and a liquid-glass join dock
/// (mockups 02 + 08).
struct EventDetailView: View {
    let questId: UUID

    @Environment(\.openURL) private var openURL

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

    /// Deployed web app (capacitor.config.ts) — share links resolve there.
    private static let webBaseURL = "https://plus1-livid.vercel.app"

    var body: some View {
        Group {
            if let quest {
                content(quest)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Theme.background)
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbarContent }
        .task { await load() }
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
        .navigationDestination(isPresented: $chatPresented) {
            if let chatThreadId {
                ChatThreadView(threadId: chatThreadId, title: chatTitle)
            }
        }
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
        if let shareURL, quest?.createdByCurrentUser != true {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: shareURL)
            }
        }
        if quest?.createdByCurrentUser == true {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        editing = true
                    } label: {
                        Label("Edit event", systemImage: "pencil")
                    }
                    if let shareURL {
                        ShareLink(item: shareURL) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                    Button(role: .destructive) {
                        confirmingClose = true
                    } label: {
                        Label("Close event", systemImage: "xmark.circle")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
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
            infoRow(
                icon: "clock.fill", tint: .orange,
                title: quest.timeLabel, subtitle: "Add to calendar"
            )
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
                        .foregroundStyle(Theme.accent)
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
            if loaded.createdByCurrentUser && shareURL == nil {
                await loadShareLink()
            }
        } catch {
            guard !(error is CancellationError) else { return }
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

    private func join() {
        joining = true
        Task {
            defer { joining = false }
            do {
                try await Repo.joinQuest(id: questId)
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                withAnimation { justJoined = true }
                await load()
            } catch {
                errorMessage = "Couldn't join this event. Try again."
            }
        }
    }

    private func leave() {
        Task {
            do {
                try await Repo.leaveQuest(id: questId)
                justJoined = false
                await load()
            } catch {
                errorMessage = "Couldn't leave this event. Try again."
            }
        }
    }

    private func close() {
        Task {
            do {
                try await Repo.closeQuest(id: questId)
                await load()
            } catch {
                errorMessage = "Couldn't close this event. Try again."
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
