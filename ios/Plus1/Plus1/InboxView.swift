import SwiftUI

/// Inbox tab: Direct / Events segmented lists of message threads
/// (web InboxScreen parity, styled per the v3 mockups).
struct InboxView: View {
    @Binding var unreadCount: Int

    init(unreadCount: Binding<Int>) {
        _unreadCount = unreadCount
    }

    private enum Tab: String, CaseIterable, Identifiable {
        case direct = "Direct"
        case events = "Events"
        var id: String { rawValue }
    }

    @State private var tab: Tab = .direct
    @State private var threads: [ThreadSummary] = []
    @State private var loaded = false
    @State private var errorMessage: String?

    private var directThreads: [ThreadSummary] { threads.filter { $0.kind == "direct" } }
    private var eventThreads: [ThreadSummary] { threads.filter { $0.kind == "event" } }
    private var activeThreads: [ThreadSummary] { tab == .direct ? directThreads : eventThreads }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("Inbox filter", selection: $tab) {
                    ForEach(Tab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                if !loaded {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 60)
                } else if activeThreads.isEmpty {
                    emptyState
                } else {
                    SectionHeader(
                        title: tab == .direct ? "Messages" : "Event chats",
                        caption: "\(activeThreads.count) active"
                    )
                    threadList(activeThreads)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .background(Theme.background)
        .compactNavTitle("Inbox")
        .task { await load() }
        .onAppear {
            // Re-fires when a chat is popped — keeps unread badges fresh.
            if loaded { Task { await load() } }
        }
        .refreshable { await load() }
        .alert("Something went wrong", isPresented: errorBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: Pieces

    private var emptyState: some View {
        Group {
            if tab == .direct {
                EmptyStateCard(
                    emoji: "💬",
                    title: "No messages yet",
                    message: "Message a friend from their profile to start a chat."
                )
            } else {
                EmptyStateCard(
                    emoji: "🎟️",
                    title: "No event chats",
                    message: "Join an event to unlock its chat."
                )
            }
        }
        .padding(.top, 24)
    }

    private func threadList(_ list: [ThreadSummary]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(list.enumerated()), id: \.element.id) { index, thread in
                NavigationLink {
                    ChatThreadView(threadId: thread.id, title: thread.title)
                } label: {
                    ThreadRowView(thread: thread)
                }
                .buttonStyle(.plain)
                if index < list.count - 1 {
                    Rectangle()
                        .fill(Theme.hair)
                        .frame(height: 0.5)
                        .padding(.leading, 63)
                }
            }
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    // MARK: Data

    private func load() async {
        do {
            let list = try await Repo.threadSummaries()
            threads = list
            unreadCount = list.filter { $0.unreadCount > 0 }.count
        } catch {
            guard !(error is CancellationError) else {
                loaded = true
                return
            }
            errorMessage = error.localizedDescription
        }
        loaded = true
    }
}

// MARK: - Row

private struct ThreadRowView: View {
    let thread: ThreadSummary

    var body: some View {
        HStack(spacing: 11) {
            artwork

            VStack(alignment: .leading, spacing: 1) {
                Text(thread.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                Text(thread.preview)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.sub)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 4) {
                Text(Fmt.relative(thread.lastMessageAt))
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(Theme.sub)
                if thread.unreadCount > 0 {
                    Text("\(thread.unreadCount)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.accentInk)
                        .padding(.horizontal, 5)
                        .frame(minWidth: 17, minHeight: 17)
                        .background(Theme.accent)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var artwork: some View {
        if thread.kind == "event" {
            CategoryArtwork(
                category: thread.category ?? .social,
                imageURL: thread.cardImageUrl.flatMap(URL.init),
                emojiSize: 15
            )
            .frame(width: 36, height: 36)
            .clipShape(RoundedRectangle(cornerRadius: 9))
        } else {
            AvatarView(
                initials: thread.counterpart?.initials ?? "?",
                url: thread.counterpart?.avatarUrl.flatMap(URL.init),
                size: 40
            )
        }
    }
}
