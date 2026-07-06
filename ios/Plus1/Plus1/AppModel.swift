import Foundation
import Observation

/// Shared app state so mutations propagate across tabs. Every screen holds its
/// own `@State`; without a common signal a join/leave/accept/edit in one screen
/// leaves the others stale. Screens observe `dataVersion` via `.task(id:)` and
/// call `bumpData()` after their own mutations.
@Observable
final class AppModel {
    /// Monotonic change counter; screens use `.task(id: dataVersion)` to refetch.
    var dataVersion = 0
    /// TOTAL unread messages across all threads (not thread count).
    var unreadMessages = 0
    /// Whether any activity row is still unread (mirrors HomeView's rule).
    var hasUnreadActivity = false
    /// User ids the viewer has blocked; used to filter feeds/search/threads.
    var blockedIds: Set<UUID> = []
    /// A tab a screen wants to switch to (e.g. an empty-state CTA). RootView
    /// observes this, applies the selection, then clears it back to nil.
    var requestedTab: RootView.Tab?
    /// An event to present as a sheet (notification tap / universal link).
    /// RootView drives a `.sheet(item:)` off this and clears it on dismiss.
    var deepLinkQuestId: UUID?

    func bumpData() { dataVersion += 1 }

    /// Refresh inbox + activity badges and the block list. Never throws —
    /// on failure the previous values are left untouched.
    func refreshBadges() async {
        if let threads = try? await Repo.threadSummaries() {
            unreadMessages = threads.reduce(0) { $0 + $1.unreadCount }
        }
        if let activity = try? await Repo.activity() {
            hasUnreadActivity = activity.contains { !$0.isRead }
        }
        if let blocked = try? await Repo.blockedUserIds() {
            blockedIds = blocked
        }
    }
}
