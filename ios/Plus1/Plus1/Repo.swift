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

    /// True if no other profile already uses `handle` (case-insensitive).
    static func isHandleAvailable(_ handle: String, excluding userId: UUID) async throws -> Bool {
        let normalized = handle.lowercased().replacingOccurrences(of: "@", with: "")
        struct IdRow: Decodable { let id: UUID }
        let matches: [IdRow] = try await db.from("profiles").select("id")
            .ilike("handle", value: normalized)
            .neq("id", value: userId)
            .limit(1).execute().value
        return matches.isEmpty
    }

    /// Upload a profile photo to the shared `profile-photos` bucket (web parity:
    /// same bucket, `<userId>/avatar-<timestamp>.jpg` path, 5 MB cap).
    static func uploadAvatar(data: Data, userId: UUID) async throws -> String {
        guard data.count <= 5 * 1024 * 1024 else { throw RepoError.imageTooLarge }
        let path = "\(userId.uuidString.lowercased())/avatar-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        try await db.storage.from("profile-photos")
            .upload(path, data: data,
                    options: FileOptions(cacheControl: "3600", contentType: "image/jpeg", upsert: true))
        return try db.storage.from("profile-photos").getPublicURL(path: path).absoluteString
    }

    static func searchPeople(query: String, limit: Int = 20) async throws -> [ProfileRow] {
        // Strip PostgREST filter metacharacters and escape ilike wildcards so
        // raw user text can't break the `.or(...)` filter.
        let sanitized = query
            .replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "%", with: "\\%")
            .replacingOccurrences(of: "_", with: "\\_")
        let rows: [ProfileRow] = try await db.from("profiles").select()
            .or("display_name.ilike.%\(sanitized)%,handle.ilike.%\(sanitized)%")
            .limit(limit).execute().value
        let blocked = (try? await blockedUserIds()) ?? []
        return blocked.isEmpty ? rows : rows.filter { !blocked.contains($0.id) }
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
        // Blocking has teeth: hide events hosted by blocked users. Repo fetches
        // the block list itself (one cheap query) rather than taking it as a
        // parameter, so it stays correct wherever it's called from.
        let blocked = (try? await blockedUserIds()) ?? []
        let visible = blocked.isEmpty ? rows : rows.filter { row in
            row.creatorId.map { !blocked.contains($0) } ?? true
        }
        return try await hydrate(visible)
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
        // Blocking has teeth: drop blocked people from the Going list.
        let blocked = (try? await blockedUserIds()) ?? []

        return rows.map { row in
            let host = row.creatorId.flatMap { byId[$0] }
            var attendees: [QuestAttendee] = []
            if let host, !blocked.contains(host.id) {
                attendees.append(QuestAttendee(
                    id: host.id, displayName: host.displayName,
                    avatarInitials: host.initials, avatarUrl: host.avatarUrl, isHost: true
                ))
            }
            for join in joins where join.questId == row.id {
                guard !blocked.contains(join.userId), let profile = byId[join.userId] else { continue }
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
        // Inverse of joinQuest's chat-membership sync: drop the user from the
        // event thread. Best-effort like other secondary writes.
        if let thread: ThreadRow = try? await db.from("message_threads")
            .select().eq("quest_id", value: id).eq("kind", value: "event")
            .single().execute().value {
            try? await db.from("message_thread_participants").delete()
                .eq("thread_id", value: thread.id).eq("user_id", value: me).execute()
        }
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
        try await replaceInvites(questId: row.id, inviterId: me, inviteeIds: input.inviteeIds, questTitle: input.title)
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
        try await replaceInvites(questId: id, inviterId: me, inviteeIds: input.inviteeIds, questTitle: input.title)
    }

    static func closeQuest(id: UUID) async throws {
        try await db.from("quests").update(["status": "closed"])
            .eq("id", value: id).execute()
    }

    private static func replaceInvites(questId: UUID, inviterId: UUID, inviteeIds: [UUID], questTitle: String) async throws {
        let existing: [QuestInviteRow] = try await db.from("quest_invites")
            .select().eq("quest_id", value: questId).execute().value
        let wanted = Set(inviteeIds.filter { $0 != inviterId })
        // Diff against non-declined existing invites, matching web parity.
        let currentActive = Set(existing.filter { $0.status != "declined" }.map(\.inviteeId))
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
        let addedIds = Array(wanted.subtracting(currentActive))
        guard !addedIds.isEmpty else { return }
        // Clear any prior `declined` rows for these invitees so re-inviting
        // doesn't stack a duplicate row (no unique index in the DB).
        let staleDeclined = existing.filter { addedIds.contains($0.inviteeId) && $0.status == "declined" }
        if !staleDeclined.isEmpty {
            try await db.from("quest_invites").delete()
                .in("id", values: staleDeclined.map(\.id)).execute()
        }
        try await db.from("quest_invites")
            .insert(addedIds.map { NewInvite(quest_id: questId, inviter_id: inviterId, invitee_id: $0) })
            .execute()
        // Notify added invitees (makes the "they'll get a notification" promise true).
        struct InviteActivity: Encodable {
            let user_id: UUID
            let actor_id: UUID
            let quest_id: UUID
            let type: String
            let title: String
        }
        try? await db.from("activity_events")
            .insert(addedIds.map {
                InviteActivity(
                    user_id: $0, actor_id: inviterId, quest_id: questId,
                    type: "invite", title: "You were invited to \(questTitle)"
                )
            })
            .execute()
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
        // Hide direct threads with blocked users (event threads stay visible).
        let blocked = (try? await blockedUserIds()) ?? []

        return threads.compactMap { thread -> ThreadSummary? in
            if thread.kind == "direct", !blocked.isEmpty {
                let counterpartId = everyone
                    .first { $0.threadId == thread.id && $0.userId != me }?.userId
                if let counterpartId, blocked.contains(counterpartId) { return nil }
            }
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
        let rows: [MessageRow] = try await db.from("messages").select()
            .eq("thread_id", value: threadId)
            .order("created_at", ascending: true).limit(150).execute().value
        // Hide event-chat messages from blocked senders (direct threads with a
        // blocked user are already filtered out of threadSummaries).
        let blocked = (try? await blockedUserIds()) ?? []
        return blocked.isEmpty ? rows : rows.filter { !blocked.contains($0.senderId) }
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
        let rows: [ActivityRow] = try await db.from("activity_events").select()
            .eq("user_id", value: me)
            .order("created_at", ascending: false).limit(50).execute().value
        // Blocking has teeth: drop rows whose actor (e.g. a blocked user's
        // friend request) I've blocked, so no live Accept button surfaces.
        let blocked = (try? await blockedUserIds()) ?? []
        return blocked.isEmpty ? rows : rows.filter { row in
            row.actorId.map { !blocked.contains($0) } ?? true
        }
    }

    static func markAllActivityRead() async throws {
        guard let me = currentUserId else { return }
        try await db.from("activity_events")
            .update(["read_at": Fmt.pg.string(from: Date())])
            .eq("user_id", value: me)
            .is("read_at", value: nil)
            .execute()
    }

    // MARK: Moderation — report, block, delete account

    /// File an insert-only report against a user or event.
    static func report(kind: String, id: UUID, reason: String, details: String?) async throws {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        struct NewReport: Encodable {
            let reporter_id: UUID
            let target_kind: String
            let target_id: UUID
            let reason: String
            let details: String?
        }
        try await db.from("reports")
            .insert(NewReport(reporter_id: me, target_kind: kind, target_id: id, reason: reason, details: details))
            .execute()
    }

    static func block(userId: UUID) async throws {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        struct NewBlock: Encodable {
            let blocker_id: UUID
            let blocked_id: UUID
        }
        try await db.from("user_blocks")
            .insert(NewBlock(blocker_id: me, blocked_id: userId))
            .execute()
    }

    static func unblock(userId: UUID) async throws {
        guard let me = currentUserId else { throw RepoError.notSignedIn }
        try await db.from("user_blocks").delete()
            .eq("blocker_id", value: me).eq("blocked_id", value: userId).execute()
    }

    static func blockedUserIds() async throws -> Set<UUID> {
        guard let me = currentUserId else { return [] }
        struct BlockRow: Decodable { let blocked_id: UUID }
        let rows: [BlockRow] = try await db.from("user_blocks")
            .select("blocked_id").eq("blocker_id", value: me).execute().value
        return Set(rows.map(\.blocked_id))
    }

    static func blockedProfiles() async throws -> [ProfileRow] {
        try await profiles(ids: Array(try await blockedUserIds()))
    }

    /// Permanently delete the account via RPC, then sign out locally.
    static func deleteAccount() async throws {
        try await db.rpc("delete_account").execute()
        // A global sign-out revokes server sessions but can fail offline; always
        // follow with a local-scope sign-out so the stored session is cleared and
        // authStateChanges fires, leaving no dead-but-.ready session behind.
        try? await db.auth.signOut()
        try? await db.auth.signOut(scope: .local)
    }
}

// MARK: - Event detail additions

extension Repo {
    /// Reopen a previously closed event (inverse of `closeQuest`).
    static func reopenQuest(questId: UUID) async throws {
        try await db.from("quests").update(["status": "open"])
            .eq("id", value: questId).execute()
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

// MARK: - Push & deep links

extension Repo {
    /// Register this device's APNs token via the SECURITY DEFINER RPC. The RPC
    /// deletes any prior row for this token (past RLS) before inserting one owned
    /// by the caller, so a token that still belongs to a previously signed-in
    /// user gets reassigned instead of hitting the standalone token-unique
    /// constraint.
    static func upsertPushToken(_ token: String) async throws {
        guard currentUserId != nil else { throw RepoError.notSignedIn }
        struct Params: Encodable {
            let target_token: String
            let target_platform: String
        }
        try await db.rpc(
            "register_push_token",
            params: Params(target_token: token, target_platform: "ios")
        ).execute()
    }

    /// Delete this device's own token row (used on sign-out) via the RPC.
    static func deletePushToken(_ token: String) async throws {
        guard currentUserId != nil else { return }
        struct Params: Encodable { let target_token: String }
        try await db.rpc(
            "unregister_push_token",
            params: Params(target_token: token)
        ).execute()
    }

    /// Resolve a public share token to its quest id, mirroring the web
    /// `/e/[token]` page: the `get_public_quest_share(share_token)` RPC.
    static func questIdForShareToken(_ token: String) async throws -> UUID? {
        struct Params: Encodable { let share_token: String }
        struct ShareRow: Decodable { let quest_id: UUID }
        let rows: [ShareRow] = try await db
            .rpc("get_public_quest_share", params: Params(share_token: token))
            .execute().value
        return rows.first?.quest_id
    }
}
