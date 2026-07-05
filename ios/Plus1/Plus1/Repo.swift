import Foundation
import Supabase

/// All Supabase reads/writes. Mutations mirror the web app's services
/// (questService/authService/messageService/friendService) so both clients
/// stay interchangeable against the same tables, RPCs, and RLS.
enum Repo {
    private static var db: SupabaseClient { Supa.client }

    // MARK: Auth + profile

    static var currentUserId: UUID? {
        db.auth.currentSession?.user.id
    }

    /// Load-or-create the profile row after sign-in (web ensureProfile parity).
    static func ensureProfile() async throws -> ProfileRow {
        guard let session = db.auth.currentSession else {
            throw RepoError.notSignedIn
        }
        let userId = session.user.id
        let existing: [ProfileRow] = try await db.from("profiles")
            .select().eq("id", value: userId).execute().value
        if let profile = existing.first { return profile }

        let phone = session.user.phone ?? ""
        let suffix = String(phone.suffix(4))
        let fallbackName = suffix.isEmpty ? "plus1 user" : "plus1 \(suffix)"
        let handle = "plus1.\(userId.uuidString.replacingOccurrences(of: "-", with: "").prefix(8).lowercased())"
        struct NewProfile: Encodable {
            let id: UUID
            let display_name: String
            let handle: String
            let phone: String?
            let avatar_initials: String
        }
        return try await db.from("profiles")
            .insert(NewProfile(
                id: userId,
                display_name: fallbackName,
                handle: handle,
                phone: phone.isEmpty ? nil : phone,
                avatar_initials: "P1"
            ), returning: .representation)
            .single().execute().value
    }

    /// Same rule as web isLikelyAutoDisplayName — gates first-run setup.
    static func isAutoDisplayName(_ name: String) -> Bool {
        let normalized = name.trimmingCharacters(in: .whitespaces).lowercased()
        return normalized.range(
            of: #"^plus1(?:\s+\d{4}| user)(?:-[a-z0-9]{6})?$"#,
            options: .regularExpression
        ) != nil
    }

    static func completeProfileSetup(
        userId: UUID, displayName: String, handle: String, interests: [String]
    ) async throws {
        struct Update: Encodable {
            let display_name: String
            let handle: String
            let interests: [String]
            let avatar_initials: String
        }
        let parts = displayName.split(separator: " ").prefix(2).compactMap(\.first)
        try await db.from("profiles").update(Update(
            display_name: displayName,
            handle: handle.lowercased().replacingOccurrences(of: "@", with: ""),
            interests: interests,
            avatar_initials: String(parts).uppercased()
        )).eq("id", value: userId).execute()
    }

    static func profile(id: UUID) async throws -> ProfileRow {
        try await db.from("profiles").select().eq("id", value: id)
            .single().execute().value
    }

    static func profiles(ids: [UUID]) async throws -> [ProfileRow] {
        guard !ids.isEmpty else { return [] }
        return try await db.from("profiles").select()
            .in("id", values: ids).execute().value
    }

    static func updateProfile(_ fields: [String: AnyJSON], userId: UUID) async throws {
        try await db.from("profiles").update(fields)
            .eq("id", value: userId).execute()
    }

    static func searchPeople(query: String, limit: Int = 20) async throws -> [ProfileRow] {
        try await db.from("profiles").select()
            .or("display_name.ilike.%\(query)%,handle.ilike.%\(query)%")
            .limit(limit).execute().value
    }

    // MARK: Quests — feed + hydration

    /// Open quests visible to the viewer (RLS enforces visibility), hydrated
    /// with hosts, attendees, and the viewer's join/invite flags.
    static func feedQuests() async throws -> [Quest] {
        let rows: [QuestRow] = try await db.from("quests")
            .select()
            .eq("status", value: "open")
            .or("start_time.is.null,start_time.gte.\(Fmt.pg.string(from: Date()))")
            .order("start_time", ascending: true, nullsFirst: true)
            .limit(100)
            .execute().value
        return try await hydrate(rows)
    }

    static func quest(id: UUID) async throws -> Quest {
        let row: QuestRow = try await db.from("quests")
            .select().eq("id", value: id).single().execute().value
        return try await hydrate([row]).first ?? Quest(
            row: row, host: nil, attendees: [], invitedProfiles: [],
            joinedByCurrentUser: false, invitedByCurrentUser: false,
            createdByCurrentUser: false
        )
    }

    /// Quests I host or joined (profile grid / events list).
    static func myQuests() async throws -> (hosted: [Quest], joined: [Quest]) {
        guard let me = currentUserId else { return ([], []) }
        let hostedRows: [QuestRow] = try await db.from("quests")
            .select().eq("creator_id", value: me)
            .order("created_at", ascending: false).limit(60).execute().value
        let joins: [QuestJoinRow] = try await db.from("quest_joins")
            .select().eq("user_id", value: me)
            .order("created_at", ascending: false).limit(60).execute().value
        let joinedRows: [QuestRow] = joins.isEmpty ? [] : try await db.from("quests")
            .select().in("id", values: joins.map(\.questId)).execute().value
        let hosted = try await hydrate(hostedRows)
        let joined = try await hydrate(joinedRows)
        return (hosted, joined)
    }

    static func questsByCreator(_ creatorId: UUID) async throws -> [Quest] {
        let rows: [QuestRow] = try await db.from("quests")
            .select().eq("creator_id", value: creatorId)
            .order("created_at", ascending: false).limit(30).execute().value
        return try await hydrate(rows)
    }

    private static func hydrate(_ rows: [QuestRow]) async throws -> [Quest] {
        guard !rows.isEmpty else { return [] }
        let me = currentUserId
        let questIds = rows.map(\.id)

        async let joinsTask: [QuestJoinRow] = db.from("quest_joins")
            .select().in("quest_id", values: questIds).execute().value
        async let invitesTask: [QuestInviteRow] = db.from("quest_invites")
            .select().in("quest_id", values: questIds).execute().value
        let (joins, invites) = try await (joinsTask, invitesTask)

        var profileIds = Set(rows.compactMap(\.creatorId))
        profileIds.formUnion(joins.map(\.userId))
        profileIds.formUnion(invites.map(\.inviteeId))
        let profileList = try await profiles(ids: Array(profileIds))
        let byId = Dictionary(uniqueKeysWithValues: profileList.map { ($0.id, $0) })

        return rows.map { row in
            let host = row.creatorId.flatMap { byId[$0] }
            var attendees: [QuestAttendee] = []
            if let host {
                attendees.append(QuestAttendee(
                    id: host.id, displayName: host.displayName,
                    avatarInitials: host.initials, avatarUrl: host.avatarUrl, isHost: true
                ))
            }
            for join in joins where join.questId == row.id {
                guard let profile = byId[join.userId] else { continue }
                attendees.append(QuestAttendee(
                    id: profile.id, displayName: profile.displayName,
                    avatarInitials: profile.initials, avatarUrl: profile.avatarUrl, isHost: false
                ))
            }
            let questInvites = invites.filter { $0.questId == row.id }
            return Quest(
                row: row,
                host: host,
                attendees: attendees,
                invitedProfiles: questInvites.compactMap { byId[$0.inviteeId] },
                joinedByCurrentUser: me.map { id in joins.contains { $0.questId == row.id && $0.userId == id } } ?? false,
                invitedByCurrentUser: me.map { id in questInvites.contains { $0.inviteeId == id && $0.status == "pending" } } ?? false,
                createdByCurrentUser: me != nil && row.creatorId == me
            )
        }
    }

    // MARK: Quests — mutations

    static func joinQuest(id: UUID) async throws {
        struct Params: Encodable { let target_quest_id: UUID }
        try await db.rpc("join_quest_atomic", params: Params(target_quest_id: id))
            .execute()
        // keep the event chat membership in sync (web parity)
        try? await db.rpc("get_or_create_event_thread", params: ["target_quest_id": id])
            .execute()
    }

    static func leaveQuest(id: UUID) async throws {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        try await db.from("quest_joins").delete()
            .eq("quest_id", value: id).eq("user_id", value: me).execute()
    }

    struct QuestInput {
        var title: String
        var category: QuestCategory
        var location: String
        var startTime: Date?      // nil = right now / ASAP
        var description: String
        var maxPeople: Int?
        var visibility: QuestVisibility
        var cardImageUrl: String?
        var inviteeIds: [UUID]
    }

    private struct QuestWrite: Encodable {
        let title: String
        let category: String
        let location: String
        let start_time: String?
        let description: String?
        let max_people: Int?
        let visibility: String
        let card_image_url: String?
        var creator_id: UUID? = nil
        var area: String? = nil
    }

    static func createQuest(_ input: QuestInput) async throws -> QuestRow {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        let profile = try await profile(id: me)
        let row: QuestRow = try await db.from("quests")
            .insert(QuestWrite(
                title: input.title,
                category: input.category.rawValue,
                location: input.location,
                start_time: input.startTime.map { Fmt.pg.string(from: $0) },
                description: input.description.isEmpty ? nil : input.description,
                max_people: input.maxPeople,
                visibility: input.visibility.rawValue,
                card_image_url: input.cardImageUrl,
                creator_id: me,
                area: profile.area
            ), returning: .representation)
            .single().execute().value
        try await replaceInvites(questId: row.id, inviterId: me, inviteeIds: input.inviteeIds)
        return row
    }

    static func updateQuest(id: UUID, _ input: QuestInput) async throws {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        try await db.from("quests").update(QuestWrite(
            title: input.title,
            category: input.category.rawValue,
            location: input.location,
            start_time: input.startTime.map { Fmt.pg.string(from: $0) },
            description: input.description.isEmpty ? nil : input.description,
            max_people: input.maxPeople,
            visibility: input.visibility.rawValue,
            card_image_url: input.cardImageUrl
        )).eq("id", value: id).execute()
        try await replaceInvites(questId: id, inviterId: me, inviteeIds: input.inviteeIds)
    }

    static func closeQuest(id: UUID) async throws {
        try await db.from("quests").update(["status": "closed"])
            .eq("id", value: id).execute()
    }

    private static func replaceInvites(questId: UUID, inviterId: UUID, inviteeIds: [UUID]) async throws {
        let existing: [QuestInviteRow] = try await db.from("quest_invites")
            .select().eq("quest_id", value: questId).execute().value
        let wanted = Set(inviteeIds)
        let current = Set(existing.map(\.inviteeId))
        let stale = existing.filter { !wanted.contains($0.inviteeId) && $0.status == "pending" }
        if !stale.isEmpty {
            try await db.from("quest_invites").delete()
                .in("id", values: stale.map(\.id)).execute()
        }
        struct NewInvite: Encodable {
            let quest_id: UUID
            let inviter_id: UUID
            let invitee_id: UUID
        }
        let additions = wanted.subtracting(current).map {
            NewInvite(quest_id: questId, inviter_id: inviterId, invitee_id: $0)
        }
        if !additions.isEmpty {
            try await db.from("quest_invites").insert(additions).execute()
        }
    }

    /// Upload a cover to the shared quest-card-images bucket (web parity:
    /// same bucket, same public URL shape, 8 MB cap).
    static func uploadCardImage(data: Data, contentType: String) async throws -> String {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        guard data.count <= 8 * 1024 * 1024 else { throw RepoError.imageTooLarge }
        let ext = contentType.contains("png") ? "png" : contentType.contains("webp") ? "webp" : "jpg"
        let path = "\(me.uuidString.lowercased())/\(UUID().uuidString.lowercased()).\(ext)"
        try await db.storage.from("quest-card-images")
            .upload(path, data: data, options: FileOptions(contentType: contentType))
        return try db.storage.from("quest-card-images").getPublicURL(path: path).absoluteString
    }

    // MARK: Friends

    /// Activity feed row for friend request/accept (web recordFriendActivity parity).
    private struct NewActivity: Encodable {
        let user_id: UUID
        let actor_id: UUID
        let type: String
        let title: String
        let body: String?
    }

    static func friendships() async throws -> [FriendshipRow] {
        guard let me = currentUserId else { return [] }
        return try await db.from("friendships").select()
            .or("requester_id.eq.\(me.uuidString),addressee_id.eq.\(me.uuidString)")
            .execute().value
    }

    static func requestFriend(addresseeId: UUID) async throws {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        struct NewFriendship: Encodable {
            let requester_id: UUID
            let addressee_id: UUID
        }
        try await db.from("friendships")
            .insert(NewFriendship(requester_id: me, addressee_id: addresseeId))
            .execute()
        let requesterName = (try? await profile(id: me))?.displayName ?? "Someone"
        try? await db.from("activity_events")
            .insert(NewActivity(
                user_id: addresseeId,
                actor_id: me,
                type: "friend_request",
                title: "\(requesterName) sent you a friend request",
                body: nil
            ))
            .execute()
    }

    static func respondFriend(friendshipId: UUID, accept: Bool) async throws {
        guard accept else {
            try await db.from("friendships")
                .update(["status": "declined"])
                .eq("id", value: friendshipId).execute()
            return
        }
        let friendship: FriendshipRow = try await db.from("friendships")
            .select().eq("id", value: friendshipId).single().execute().value
        try await db.from("friendships")
            .update(["status": "accepted"])
            .eq("id", value: friendshipId).execute()
        guard let me = currentUserId else { return }
        let accepterName = (try? await profile(id: me))?.displayName ?? "Someone"
        try? await db.from("activity_events")
            .insert(NewActivity(
                user_id: friendship.requesterId,
                actor_id: me,
                type: "friend_accept",
                title: "\(accepterName) accepted your friend request",
                body: nil
            ))
            .execute()
    }

    static func removeFriend(friendshipId: UUID) async throws {
        try await db.from("friendships").delete()
            .eq("id", value: friendshipId).execute()
    }

    // MARK: Messaging

    static func directThread(with userId: UUID) async throws -> UUID {
        struct Params: Encodable { let target_user_id: UUID }
        let id: UUID = try await db.rpc("get_or_create_direct_thread", params: Params(target_user_id: userId))
            .execute().value
        return id
    }

    static func eventThread(questId: UUID) async throws -> UUID {
        struct Params: Encodable { let target_quest_id: UUID }
        let id: UUID = try await db.rpc("get_or_create_event_thread", params: Params(target_quest_id: questId))
            .execute().value
        return id
    }

    static func threadSummaries() async throws -> [ThreadSummary] {
        guard let me = currentUserId else { return [] }
        let mine: [ThreadParticipantRow] = try await db.from("message_thread_participants")
            .select().eq("user_id", value: me).execute().value
        guard !mine.isEmpty else { return [] }
        let threadIds = mine.map(\.threadId)
        let threads: [ThreadRow] = try await db.from("message_threads")
            .select().in("id", values: threadIds)
            .order("last_message_at", ascending: false).execute().value
        let everyone: [ThreadParticipantRow] = try await db.from("message_thread_participants")
            .select().in("thread_id", values: threadIds).execute().value
        let recent: [MessageRow] = try await db.from("messages")
            .select().in("thread_id", values: threadIds)
            .order("created_at", ascending: false).limit(300).execute().value

        let questIds = threads.compactMap(\.questId)
        let quests: [QuestRow] = questIds.isEmpty ? [] : try await db.from("quests")
            .select().in("id", values: questIds).execute().value
        let questById = Dictionary(uniqueKeysWithValues: quests.map { ($0.id, $0) })

        var counterpartIds = Set<UUID>()
        for thread in threads where thread.kind == "direct" {
            for participant in everyone where participant.threadId == thread.id && participant.userId != me {
                counterpartIds.insert(participant.userId)
            }
        }
        let people = try await profiles(ids: Array(counterpartIds))
        let personById = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0) })
        let myLastRead = Dictionary(uniqueKeysWithValues: mine.map { ($0.threadId, $0.lastReadAt) })

        return threads.map { thread in
            let threadMessages = recent.filter { $0.threadId == thread.id }
            let last = threadMessages.first
            let lastRead = Fmt.parse(myLastRead[thread.id] ?? nil)
            let unread = threadMessages.filter { message in
                guard message.senderId != me, let created = Fmt.parse(message.createdAt) else { return false }
                guard let lastRead else { return true }
                return created > lastRead
            }.count
            let counterpart = everyone
                .first { $0.threadId == thread.id && $0.userId != me }
                .flatMap { personById[$0.userId] }
            let quest = thread.questId.flatMap { questById[$0] }
            return ThreadSummary(
                id: thread.id,
                kind: thread.kind,
                questId: thread.questId,
                title: thread.kind == "event"
                    ? (quest?.title ?? "Event chat")
                    : (counterpart?.displayName ?? "Chat"),
                category: quest.map { .normalized($0.category) },
                cardImageUrl: quest?.cardImageUrl,
                counterpart: counterpart,
                preview: last?.body ?? "Say hi 👋",
                lastMessageAt: thread.lastMessageAt,
                unreadCount: unread
            )
        }
    }

    static func messages(threadId: UUID) async throws -> [MessageRow] {
        try await db.from("messages").select()
            .eq("thread_id", value: threadId)
            .order("created_at", ascending: true).limit(150).execute().value
    }

    static func sendMessage(threadId: UUID, body: String) async throws -> MessageRow {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        struct NewMessage: Encodable {
            let thread_id: UUID
            let sender_id: UUID
            let body: String
        }
        return try await db.from("messages")
            .insert(NewMessage(thread_id: threadId, sender_id: me, body: body),
                    returning: .representation)
            .single().execute().value
    }

    static func markThreadRead(threadId: UUID) async throws {
        guard let me = currentUserId else { return }
        try await db.from("message_thread_participants")
            .update(["last_read_at": Fmt.pg.string(from: Date())])
            .eq("thread_id", value: threadId).eq("user_id", value: me).execute()
    }

    // MARK: Activity

    static func activity() async throws -> [ActivityRow] {
        guard let me = currentUserId else { return [] }
        return try await db.from("activity_events").select()
            .eq("user_id", value: me)
            .order("created_at", ascending: false).limit(50).execute().value
    }

    static func markAllActivityRead() async throws {
        guard let me = currentUserId else { return }
        try await db.from("activity_events")
            .update(["read_at": Fmt.pg.string(from: Date())])
            .eq("user_id", value: me)
            .is("read_at", value: nil)
            .execute()
    }
}

enum RepoError: LocalizedError {
    case notSignedIn
    case imageTooLarge

    var errorDescription: String? {
        switch self {
        case .notSignedIn: "You need to sign in first."
        case .imageTooLarge: "Event image must be 8 MB or smaller."
        }
    }
}
