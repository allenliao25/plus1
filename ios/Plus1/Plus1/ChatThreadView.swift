import SwiftUI
import Supabase

/// One conversation (direct or event chat): day-chipped bubble list with a
/// pinned capsule composer. Live updates via Supabase Realtime, with a
/// 5-second poll always running as the fallback (web has no realtime here).
struct ChatThreadView: View {
    let threadId: UUID
    let title: String

    init(threadId: UUID, title: String) {
        self.threadId = threadId
        self.title = title
    }

    @State private var messages: [MessageRow] = []
    @State private var senders: [UUID: ProfileRow] = [:]
    @State private var draft = ""
    @State private var loaded = false
    /// In-flight deliver() round-trips; `sending` is true while any is active.
    /// A counter (not a Bool) so a second deliver can't clear the first's flag.
    @State private var sendingCount = 0
    @State private var errorMessage: String?
    @State private var channel: RealtimeChannelV2?
    @State private var listenTask: Task<Void, Never>?
    @State private var statusTask: Task<Void, Never>?
    @State private var pollTask: Task<Void, Never>?
    /// Set in teardownLive() so a late status callback can't restart polling.
    @State private var tornDown = false
    /// Realtime is connected — while true we stop the poll fallback.
    @State private var realtimeHealthy = false
    /// Local ids of optimistic bubbles awaiting / failing their round-trip.
    @State private var pendingIds: Set<UUID> = []
    @State private var failedIds: Set<UUID> = []
    /// Body to restore/resend for a failed optimistic bubble.
    @State private var retryBodies: [UUID: String] = [:]
    /// Bubbles whose timestamp is revealed on tap.
    @State private var revealedTimestamps: Set<UUID> = []
    /// Long-pressed other-user message to report.
    @State private var reportingMessageId: UUID?
    @FocusState private var composerFocused: Bool

    @Environment(AppModel.self) private var app

    private var myId: UUID? { Repo.currentUserId }
    private var trimmedDraft: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var sending: Bool { sendingCount > 0 }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    if !loaded {
                        ProgressView().padding(.top, 60)
                    } else if messages.isEmpty {
                        EmptyStateCard(
                            emoji: "👋",
                            title: "No messages yet",
                            message: "Break the ice — say hi."
                        )
                        .padding(.top, 24)
                    } else {
                        ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                            messageBlock(message, at: index)
                                .id(message.id)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 8)
            }
            .defaultScrollAnchor(.bottom)
            .onChange(of: messages.count) {
                guard let last = messages.last else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
            .onChange(of: composerFocused) { _, focused in
                // Keep the latest message visible when the keyboard rises.
                guard focused, let last = messages.last else { return }
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
        .background(Theme.background)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) { inputBar }
        .task {
            await initialLoad()
            startRealtime()
            startPolling()
        }
        .onDisappear {
            teardownLive()
            Task { await app.refreshBadges() }
        }
        .sheet(item: reportingBinding) { target in
            ReportSheet(kind: "message", targetId: target.id)
        }
        .alert("Something went wrong", isPresented: errorBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var reportingBinding: Binding<ReportTarget?> {
        Binding(
            get: { reportingMessageId.map(ReportTarget.init) },
            set: { reportingMessageId = $0?.id }
        )
    }

    private struct ReportTarget: Identifiable, Hashable { let id: UUID }

    // MARK: Message rows

    @ViewBuilder
    private func messageBlock(_ message: MessageRow, at index: Int) -> some View {
        let mine = message.senderId == myId
        let isNewest = index == messages.count - 1
        VStack(spacing: 8) {
            if showsDayChip(at: index) {
                DayChip(label: dayLabel(message))
            }
            if !mine, showsSender(at: index) {
                Text(senderName(message))
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.sub)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 40)
                    .padding(.bottom, -5)
            }
            if mine {
                myBubble(message)
            } else {
                theirBubble(message)
            }
            if showsTimestamp(message, isNewest: isNewest) {
                Text(timeLabel(message))
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.sub)
                    .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
                    .padding(mine ? .trailing : .leading, mine ? 4 : 40)
            }
        }
    }

    private func myBubble(_ message: MessageRow) -> some View {
        let pending = pendingIds.contains(message.id)
        let failed = failedIds.contains(message.id)
        return HStack(spacing: 5) {
            Spacer(minLength: 56)
            if failed {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.destructive)
            } else if pending {
                Image(systemName: "clock")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.sub)
            }
            Text(message.body)
                .font(.system(size: 13))
                .foregroundStyle(Theme.accentInk)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.accent)
                .clipShape(UnevenRoundedRectangle(cornerRadii: .init(
                    topLeading: 17, bottomLeading: 17, bottomTrailing: 5, topTrailing: 17
                )))
                .opacity(pending ? 0.6 : 1)
        }
        .overlay(alignment: .bottomTrailing) {
            if failed {
                Text("Tap to retry")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundStyle(Theme.destructive)
                    .offset(y: 13)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { onMyBubbleTap(message) }
    }

    private func theirBubble(_ message: MessageRow) -> some View {
        HStack(alignment: .bottom, spacing: 7) {
            AvatarView(
                initials: senders[message.senderId]?.initials ?? "?",
                url: senders[message.senderId]?.avatarUrl.flatMap(URL.init),
                size: 26
            )
            Text(message.body)
                .font(.system(size: 13))
                .foregroundStyle(Theme.foreground)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.card)
                .clipShape(UnevenRoundedRectangle(cornerRadii: .init(
                    topLeading: 17, bottomLeading: 5, bottomTrailing: 17, topTrailing: 17
                )))
                .contentShape(Rectangle())
                .onTapGesture { toggleTimestamp(message) }
                .contextMenu {
                    Button(role: .destructive) {
                        reportingMessageId = message.id
                    } label: {
                        Label("Report message", systemImage: "flag")
                    }
                }
            Spacer(minLength: 56)
        }
    }

    private func onMyBubbleTap(_ message: MessageRow) {
        if failedIds.contains(message.id) {
            retry(message)
        } else if !pendingIds.contains(message.id) {
            toggleTimestamp(message)
        }
    }

    private func toggleTimestamp(_ message: MessageRow) {
        if revealedTimestamps.contains(message.id) {
            revealedTimestamps.remove(message.id)
        } else {
            revealedTimestamps.insert(message.id)
        }
    }

    private func showsTimestamp(_ message: MessageRow, isNewest: Bool) -> Bool {
        isNewest || revealedTimestamps.contains(message.id)
    }

    private func timeLabel(_ message: MessageRow) -> String {
        if pendingIds.contains(message.id) { return "Sending…" }
        if failedIds.contains(message.id) { return "Not delivered" }
        guard let date = Fmt.parse(message.createdAt) else { return "" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    private func showsDayChip(at index: Int) -> Bool {
        guard index > 0 else { return true }
        guard let current = Fmt.parse(messages[index].createdAt),
              let previous = Fmt.parse(messages[index - 1].createdAt) else { return false }
        return !Calendar.current.isDate(current, inSameDayAs: previous)
    }

    private func showsSender(at index: Int) -> Bool {
        guard index > 0 else { return true }
        return messages[index - 1].senderId != messages[index].senderId
    }

    private func dayLabel(_ message: MessageRow) -> String {
        guard let date = Fmt.parse(message.createdAt) else { return "Today" }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    private func senderName(_ message: MessageRow) -> String {
        senders[message.senderId]?.displayName ?? "Member"
    }

    // MARK: Composer

    private var inputBar: some View {
        HStack(spacing: 9) {
            TextField("Message…", text: $draft)
                .font(.system(size: 13.5))
                .padding(.horizontal, 15)
                .padding(.vertical, 10)
                .background(Theme.card)
                .clipShape(Capsule())
                .submitLabel(.send)
                .focused($composerFocused)
                .onSubmit(send)

            Button(action: send) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.accentInk)
                    .frame(width: 36, height: 36)
                    .background(Theme.accent)
                    .clipShape(Circle())
            }
            .disabled(trimmedDraft.isEmpty || sending)
            .opacity(trimmedDraft.isEmpty || sending ? 0.5 : 1)
            .accessibilityLabel("Send message")
        }
        .padding(.horizontal, 12)
        .padding(.top, 6)
        .padding(.bottom, 8)
        .background(Theme.background)
    }

    private func send() {
        let body = trimmedDraft
        guard !body.isEmpty, !sending else { return }
        guard let me = myId else { return }
        Haptics.tap()
        // Optimistic: append a pending local bubble and clear the draft now.
        let localId = UUID()
        let pending = MessageRow(
            id: localId, threadId: threadId, senderId: me, body: body,
            createdAt: Fmt.pg.string(from: Date())
        )
        messages.append(pending)
        pendingIds.insert(localId)
        retryBodies[localId] = body
        draft = ""
        deliver(localId: localId, body: body)
    }

    /// Round-trip a pending optimistic bubble: swap in the server row on
    /// success, mark it failed (tap-to-retry) on failure.
    private func deliver(localId: UUID, body: String) {
        sendingCount += 1
        Task {
            defer { sendingCount -= 1 }
            do {
                let message = try await Repo.sendMessage(threadId: threadId, body: body)
                if let index = messages.firstIndex(where: { $0.id == localId }) {
                    if messages.contains(where: { $0.id == message.id }) {
                        messages.remove(at: index)  // realtime already delivered it
                    } else {
                        messages[index] = message
                    }
                }
                pendingIds.remove(localId)
                failedIds.remove(localId)
                retryBodies[localId] = nil
                try? await Repo.markThreadRead(threadId: threadId)
                await app.refreshBadges()
            } catch {
                pendingIds.remove(localId)
                failedIds.insert(localId)
            }
        }
    }

    private func retry(_ message: MessageRow) {
        guard !pendingIds.contains(message.id), let body = retryBodies[message.id] else { return }
        Haptics.tap()
        failedIds.remove(message.id)
        pendingIds.insert(message.id)
        deliver(localId: message.id, body: body)
    }

    // MARK: Data

    private func initialLoad() async {
        do {
            let list = try await Repo.messages(threadId: threadId)
            messages = list
            await loadMissingSenders(for: list)
            try? await Repo.markThreadRead(threadId: threadId)
            await app.refreshBadges()
        } catch {
            errorMessage = error.localizedDescription
        }
        loaded = true
    }

    /// Re-fetch and merge — the poll fallback and the realtime catch-up path.
    private func refresh() async {
        guard let list = try? await Repo.messages(threadId: threadId) else { return }
        let known = Set(messages.map(\.id))
        let fresh = list.filter { !known.contains($0.id) }
        guard !fresh.isEmpty else { return }
        messages.append(contentsOf: fresh)
        await loadMissingSenders(for: fresh)
        try? await Repo.markThreadRead(threadId: threadId)
        await app.refreshBadges()
    }

    private func appendIfNew(_ message: MessageRow) {
        guard !messages.contains(where: { $0.id == message.id }) else { return }
        messages.append(message)
    }

    private func loadMissingSenders(for list: [MessageRow]) async {
        let missing = Set(list.map(\.senderId)).subtracting(senders.keys)
        guard !missing.isEmpty else { return }
        let people = (try? await Repo.profiles(ids: Array(missing))) ?? []
        for person in people { senders[person.id] = person }
    }

    // MARK: Live updates

    private func startRealtime() {
        guard listenTask == nil else { return }
        let channel = Supa.client.channel("thread-\(threadId.uuidString.lowercased())")
        self.channel = channel
        let inserts = channel.postgresChange(
            InsertAction.self,
            schema: "public",
            table: "messages",
            filter: .eq("thread_id", value: threadId)
        )
        // Track subscription health: while subscribed we suspend the poll
        // and rely on realtime; if it drops we resume polling.
        let statusChanges = channel.statusChange
        statusTask = Task {
            for await status in statusChanges {
                realtimeHealthy = (status == .subscribed)
                if realtimeHealthy {
                    stopPolling()
                } else {
                    startPolling()
                }
            }
        }
        listenTask = Task {
            await channel.subscribe()
            for await insert in inserts {
                guard let message = try? insert.decodeRecord(
                    as: MessageRow.self, decoder: JSONDecoder()
                ) else { continue }
                appendIfNew(message)
                await loadMissingSenders(for: [message])
                try? await Repo.markThreadRead(threadId: threadId)
                await app.refreshBadges()
            }
        }
    }

    /// Fallback poll — runs only while realtime is NOT healthy (e.g. the
    /// messages table isn't in the publication, or the socket dropped).
    private func startPolling() {
        guard !tornDown, pollTask == nil, !realtimeHealthy else { return }
        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                guard !Task.isCancelled else { break }
                await refresh()
            }
        }
    }

    private func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func teardownLive() {
        tornDown = true
        statusTask?.cancel()
        statusTask = nil
        listenTask?.cancel()
        listenTask = nil
        stopPolling()
        realtimeHealthy = false
        if let channel {
            Task { await channel.unsubscribe() }
        }
        channel = nil
    }
}

// MARK: - Day chip

private struct DayChip: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(Theme.sub)
            .padding(.horizontal, 10)
            .padding(.vertical, 3)
            .background(Theme.chip)
            .clipShape(Capsule())
            .padding(.vertical, 2)
    }
}
