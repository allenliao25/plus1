import Foundation

// MARK: - Enums (mirror types/quest.ts)

enum QuestCategory: String, Codable, CaseIterable, Identifiable {
    case food = "Food"
    case study = "Study"
    case fitness = "Fitness"
    case outdoors = "Outdoors"
    case social = "Social"
    case sidequest = "Sidequest"
    case other = "Other"

    var id: String { rawValue }

    /// Legacy "Errand" rows map to Sidequest; unknown → Social (web parity).
    static func normalized(_ raw: String?) -> QuestCategory {
        if raw == "Errand" { return .sidequest }
        return raw.flatMap(QuestCategory.init(rawValue:)) ?? .social
    }
}

enum QuestVisibility: String, Codable, CaseIterable, Identifiable {
    case friends
    case local
    case inviteOnly = "invite_only"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .friends: "Friends"
        case .local: "Campus"
        case .inviteOnly: "Invite only"
        }
    }

    static func normalized(_ raw: String?) -> QuestVisibility {
        if raw == "public" { return .local }
        return raw.flatMap(QuestVisibility.init(rawValue:)) ?? .local
    }
}

enum FriendshipState {
    case none, incoming, outgoing, friends, declined, selfProfile
}

// MARK: - Database rows (explicit snake_case keys)

struct ProfileRow: Codable, Identifiable, Hashable {
    let id: UUID
    var displayName: String
    var handle: String
    var avatarInitials: String?
    var avatarUrl: String?
    var websiteUrl: String?
    var bio: String?
    var pronouns: String?
    var area: String
    var interests: [String]

    enum CodingKeys: String, CodingKey {
        case id, handle, bio, pronouns, area, interests
        case displayName = "display_name"
        case avatarInitials = "avatar_initials"
        case avatarUrl = "avatar_url"
        case websiteUrl = "website_url"
    }

    var initials: String {
        if let avatarInitials, !avatarInitials.isEmpty { return avatarInitials }
        let parts = displayName.split(separator: " ").prefix(2).compactMap(\.first)
        return parts.isEmpty ? "?" : String(parts).uppercased()
    }
}

struct QuestRow: Codable, Identifiable, Hashable {
    let id: UUID
    var creatorId: UUID?
    var title: String
    var category: String
    var location: String
    var startTime: String?
    var description: String?
    var cardImageUrl: String?
    var area: String
    var visibility: String
    var maxPeople: Int?
    var status: String
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, category, location, description, area, visibility, status
        case creatorId = "creator_id"
        case startTime = "start_time"
        case cardImageUrl = "card_image_url"
        case maxPeople = "max_people"
        case createdAt = "created_at"
    }
}

struct QuestJoinRow: Codable, Identifiable, Hashable {
    let id: UUID
    let questId: UUID
    let userId: UUID
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case questId = "quest_id"
        case userId = "user_id"
        case createdAt = "created_at"
    }
}

struct FriendshipRow: Codable, Identifiable, Hashable {
    let id: UUID
    let requesterId: UUID
    let addresseeId: UUID
    var status: String

    enum CodingKeys: String, CodingKey {
        case id, status
        case requesterId = "requester_id"
        case addresseeId = "addressee_id"
    }

    func state(for me: UUID) -> FriendshipState {
        switch status {
        case "accepted": return .friends
        case "declined": return .declined
        default: return requesterId == me ? .outgoing : .incoming
        }
    }

    func otherId(for me: UUID) -> UUID {
        requesterId == me ? addresseeId : requesterId
    }
}

struct QuestInviteRow: Codable, Identifiable, Hashable {
    let id: UUID
    let questId: UUID
    let inviterId: UUID
    let inviteeId: UUID
    var status: String

    enum CodingKeys: String, CodingKey {
        case id, status
        case questId = "quest_id"
        case inviterId = "inviter_id"
        case inviteeId = "invitee_id"
    }
}

struct ActivityRow: Codable, Identifiable, Hashable {
    let id: UUID
    let userId: UUID
    let actorId: UUID?
    let questId: UUID?
    let type: String
    let title: String
    let body: String?
    var readAt: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, type, title, body
        case userId = "user_id"
        case actorId = "actor_id"
        case questId = "quest_id"
        case readAt = "read_at"
        case createdAt = "created_at"
    }

    var isRead: Bool { readAt != nil }
}

struct ThreadRow: Codable, Identifiable, Hashable {
    let id: UUID
    let kind: String
    let questId: UUID?
    let directKey: String?
    let lastMessageAt: String?

    enum CodingKeys: String, CodingKey {
        case id, kind
        case questId = "quest_id"
        case directKey = "direct_key"
        case lastMessageAt = "last_message_at"
    }
}

struct ThreadParticipantRow: Codable, Hashable {
    let threadId: UUID
    let userId: UUID
    var lastReadAt: String?
    var mutedAt: String?

    enum CodingKeys: String, CodingKey {
        case threadId = "thread_id"
        case userId = "user_id"
        case lastReadAt = "last_read_at"
        case mutedAt = "muted_at"
    }
}

struct MessageRow: Codable, Identifiable, Hashable {
    let id: UUID
    let threadId: UUID
    let senderId: UUID
    let body: String
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, body
        case threadId = "thread_id"
        case senderId = "sender_id"
        case createdAt = "created_at"
    }
}

// MARK: - View models

struct QuestAttendee: Identifiable, Hashable {
    let id: UUID
    let displayName: String
    let avatarInitials: String
    let avatarUrl: String?
    let isHost: Bool
}

/// A quest joined with everything the screens need (web's hydrated Quest).
struct Quest: Identifiable, Hashable {
    let row: QuestRow
    var host: ProfileRow?
    var attendees: [QuestAttendee]
    var invitedProfiles: [ProfileRow]
    var joinedByCurrentUser: Bool
    var invitedByCurrentUser: Bool
    var createdByCurrentUser: Bool

    var id: UUID { row.id }
    var title: String { row.title }
    var category: QuestCategory { .normalized(row.category) }
    var visibility: QuestVisibility { .normalized(row.visibility) }
    var location: String { row.location }
    var isOpen: Bool { row.status == "open" }
    var cardImageURL: URL? { row.cardImageUrl.flatMap(URL.init) }
    var startDate: Date? { Fmt.parse(row.startTime) }
    var timeLabel: String { Fmt.eventTime(row.startTime) }
    /// Live = no start time (ASAP) or already started but still open.
    var isLive: Bool {
        guard isOpen else { return false }
        guard let startDate else { return true }
        return startDate <= Date()
    }
    /// Host counts toward max_people (attendees[0] is the host) — intentional
    /// web parity; do not "fix" this to exclude the host.
    var goingCount: Int { attendees.count }
    var spotsLeft: Int? { row.maxPeople.map { max(0, $0 - goingCount) } }
    var isFull: Bool { (spotsLeft ?? 1) == 0 }
}

struct ThreadSummary: Identifiable, Hashable {
    let id: UUID
    let kind: String
    let questId: UUID?
    let title: String
    let category: QuestCategory?
    let cardImageUrl: String?
    let counterpart: ProfileRow?
    let preview: String
    let lastMessageAt: String?
    let unreadCount: Int
    let muted: Bool
}
