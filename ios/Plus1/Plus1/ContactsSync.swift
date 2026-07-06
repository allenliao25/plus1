import Contacts
import Foundation

// MARK: - Phone normalization (web normalizePhoneNumber parity)

/// Swift port of the web app's `normalizePhoneNumber` (lib/authService.ts).
/// Kept behavior-identical so a contact number normalizes to the same E.164
/// string the server stored at sign-up, or matching never works. Do not
/// "improve" the rules here without changing the web function in lockstep.
enum PhoneNormalizer {
    static func normalize(_ phone: String) -> String {
        let trimmed = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        var digits = trimmed.filter { $0.isASCII && $0.isNumber }
        let hadPlus = trimmed.hasPrefix("+")

        // International "00" prefix (only when not already "+").
        if !hadPlus && digits.hasPrefix("00") {
            digits = String(digits.dropFirst(2))
        }

        guard !digits.isEmpty else { return "" }

        if hadPlus {
            return "+\(digits)"
        }
        if digits.count == 10 {
            return "+1\(digits)"
        }
        if digits.count == 11 && digits.hasPrefix("1") {
            return "+\(digits)"
        }
        return "+\(digits)"
    }
}

// MARK: - Contact store access + number extraction

enum ContactsSync {
    enum AccessResult {
        case authorized([String])   // normalized, deduped E.164 phone numbers
        case denied
    }

    /// Request Contacts permission (if needed), then read every phone number
    /// from the address book. Only `CNContactPhoneNumbersKey` is fetched — no
    /// names or other fields ever leave the device.
    static func requestAndFetchPhones() async -> AccessResult {
        let store = CNContactStore()
        let granted: Bool
        do {
            granted = try await store.requestAccess(for: .contacts)
        } catch {
            granted = false
        }
        guard granted else { return .denied }

        let keys = [CNContactPhoneNumbersKey as CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keys)

        var normalized = Set<String>()
        do {
            try store.enumerateContacts(with: request) { contact, _ in
                for labeled in contact.phoneNumbers {
                    let value = PhoneNormalizer.normalize(labeled.value.stringValue)
                    if !value.isEmpty { normalized.insert(value) }
                }
            }
        } catch {
            return .denied
        }
        return .authorized(Array(normalized))
    }

    /// Current Contacts authorization without prompting — drives the
    /// "access is off" empty state.
    static var isDenied: Bool {
        switch CNContactStore.authorizationStatus(for: .contacts) {
        case .denied, .restricted: return true
        default: return false
        }
    }
}

// MARK: - Contact match row + Repo call

/// A profile returned by the `match_contacts` RPC. Narrower than `ProfileRow`
/// (the RPC only returns the columns the list needs); `asProfileRow` adapts it
/// so the existing `PersonRow` view can render it unchanged.
struct ContactMatch: Codable, Identifiable, Hashable {
    let id: UUID
    let displayName: String
    let handle: String
    let avatarUrl: String?
    let avatarInitials: String?

    enum CodingKeys: String, CodingKey {
        case id, handle
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case avatarInitials = "avatar_initials"
    }

    var asProfileRow: ProfileRow {
        ProfileRow(
            id: id,
            displayName: displayName,
            handle: handle,
            avatarInitials: avatarInitials,
            avatarUrl: avatarUrl,
            websiteUrl: nil,
            bio: nil,
            pronouns: nil,
            area: "",
            interests: []
        )
    }
}

extension Repo {
    /// Server-side contact matching (web parity: numbers in, matched profiles
    /// out, caller excluded). Chunks input to stay under the RPC's 2000 cap.
    static func matchContacts(phones: [String]) async throws -> [ContactMatch] {
        guard !phones.isEmpty else { return [] }
        struct Params: Encodable { let phones: [String] }
        var matched: [UUID: ContactMatch] = [:]
        for chunk in stride(from: 0, to: phones.count, by: 2000).map({
            Array(phones[$0..<min($0 + 2000, phones.count)])
        }) {
            let rows: [ContactMatch] = try await Supa.client
                .rpc("match_contacts", params: Params(phones: chunk))
                .execute().value
            for row in rows { matched[row.id] = row }
        }
        return Array(matched.values)
    }
}
