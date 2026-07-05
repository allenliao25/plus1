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
    @State private var sending = false
    @State private var errorMessage: String?
    @State private var channel: RealtimeChannelV2?
    @State private var listenTask: Task<Void, Never>?
    @State private var pollTask: Task<Void, Never>?

    private var myId: UUID? { Repo.currentUserId }
    private var trimmedDraft: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }

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
        .onDisappear { teardownLive() }
        .alert("Something went wrong", isPresented: errorBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    // MARK: Message rows

    @ViewBuilder
    private func messageBlock(_ message: MessageRow, at index: Int) -> some View {
        let mine = message.senderId == myId
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
        }
    }

    private func myBubble(_ message: MessageRow) -> some View {
        HStack {
            Spacer(minLength: 56)
            Text(message.body)
                .font(.system(size: 13))
                .foregroundStyle(Theme.accentInk)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.accent)
                .clipShape(UnevenRoundedRectangle(cornerRadii: .init(
                    topLeading: 17, bottomLeading: 17, bottomTrailing: 5, topTrailing: 17
                )))
        }
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
            Spacer(minLength: 56)
        }
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
        sending = true
        Task {
            defer { sending = false }
            do {
                let message = try await Repo.sendMessage(threadId: threadId, body: body)
                appendIfNew(message)
                draft = ""
                try? await Repo.markThreadRead(threadId: threadId)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: Data

    private func initialLoad() async {
        do {
            let list = try await Repo.messages(threadId: threadId)
            messages = list
            await loadMissingSenders(for: list)
            try? await Repo.markThreadRead(threadId: threadId)
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
        listenTask = Task {
            await channel.subscribe()
            for await insert in inserts {
                guard let message = try? insert.decodeRecord(
                    as: MessageRow.self, decoder: JSONDecoder()
                ) else { continue }
                appendIfNew(message)
                await loadMissingSenders(for: [message])
                try? await Repo.markThreadRead(threadId: threadId)
            }
        }
    }

    /// Always-on fallback so the chat stays live even if realtime is
    /// unavailable (e.g. the messages table isn't in the publication).
    private func startPolling() {
        guard pollTask == nil else { return }
        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                guard !Task.isCancelled else { break }
                await refresh()
            }
        }
    }

    private func teardownLive() {
        listenTask?.cancel()
        listenTask = nil
        pollTask?.cancel()
        pollTask = nil
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
