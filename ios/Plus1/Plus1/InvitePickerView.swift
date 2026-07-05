import SwiftUI

/// Friend multi-select pushed from the create sheet's "Invite people" row.
/// Loads accepted friendships, searchable by name or handle; selection is
/// bound back into the compose form.
struct InvitePickerView: View {
    @Binding var selection: [ProfileRow]

    init(selection: Binding<[ProfileRow]>) {
        _selection = selection
    }

    @Environment(\.dismiss) private var dismiss
    @State private var friends: [ProfileRow] = []
    @State private var query = ""
    @State private var loading = true
    @State private var loadError: String?

    private var filtered: [ProfileRow] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return friends }
        return friends.filter {
            $0.displayName.lowercased().contains(needle)
                || $0.handle.lowercased().contains(needle)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, 48)
                } else if let loadError {
                    Text(loadError)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if friends.isEmpty {
                    EmptyStateCard(
                        emoji: "👥",
                        title: "No friends yet",
                        message: "Add friends from Explore first — then you can invite them to events."
                    )
                } else if filtered.isEmpty {
                    Text("No one matches “\(query)”")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.sub)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 32)
                } else {
                    VStack(spacing: 0) {
                        ForEach(filtered) { friend in
                            friendRow(friend)
                            if friend.id != filtered.last?.id {
                                Rectangle()
                                    .fill(Theme.hair)
                                    .frame(height: 0.5)
                                    .padding(.leading, 65)
                            }
                        }
                    }
                    .background(Theme.card)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                    Text("\(selection.count) selected · they'll get a notification when you post")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.sub)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                }
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Invite people")
        .toolbarTitleDisplayMode(.inline)
        .searchable(
            text: $query,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Search friends"
        )
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { dismiss() }
                    .fontWeight(.bold)
            }
        }
        .task { await load() }
    }

    private func load() async {
        defer { loading = false }
        guard let me = Repo.currentUserId else {
            friends = []
            return
        }
        do {
            let ships = try await Repo.friendships()
            let friendIds = ships
                .filter { $0.status == "accepted" }
                .map { $0.otherId(for: me) }
            friends = try await Repo.profiles(ids: friendIds)
                .sorted {
                    $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
                }
        } catch {
            guard !(error is CancellationError) else { return }
            loadError = error.localizedDescription
        }
    }

    private func friendRow(_ friend: ProfileRow) -> some View {
        let isSelected = selection.contains { $0.id == friend.id }
        return Button {
            if isSelected {
                selection.removeAll { $0.id == friend.id }
            } else {
                selection.append(friend)
            }
        } label: {
            HStack(spacing: 11) {
                AvatarView(
                    initials: friend.initials,
                    url: friend.avatarUrl.flatMap(URL.init),
                    size: 40
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(friend.displayName)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.foreground)
                    Text("@\(friend.handle)")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.sub)
                }
                Spacer(minLength: 8)
                checkCircle(isSelected)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func checkCircle(_ on: Bool) -> some View {
        ZStack {
            if on {
                Circle().fill(Theme.accent)
                Image(systemName: "checkmark")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(Theme.accentInk)
            } else {
                Circle().stroke(Theme.hair, lineWidth: 1.5)
            }
        }
        .frame(width: 24, height: 24)
        .animation(.snappy(duration: 0.15), value: on)
    }
}
