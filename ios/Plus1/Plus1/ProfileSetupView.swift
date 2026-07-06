import SwiftUI
import PhotosUI

/// One-time profile setup, shown after OTP when the display name looks
/// auto-generated (web completeProfileSetup parity). Name, @handle, avatar,
/// and interest chips.
struct ProfileSetupView: View {
    @EnvironmentObject private var session: SessionStore

    @State private var name = ""
    @State private var handle = ""
    @State private var selectedInterests: Set<String> = []
    @State private var error: String?
    @State private var busy = false

    // Avatar
    @State private var photoItem: PhotosPickerItem?
    @State private var pickedImage: UIImage?
    @State private var uploadedAvatarUrl: String?
    @State private var uploadingPhoto = false

    // Handle availability
    @State private var handleAvailable: Bool?
    @State private var checkingHandle = false
    @State private var handleCheckTask: Task<Void, Never>?

    private static let interestOptions = [
        "Food", "Study", "Fitness", "Outdoors", "Social", "Running",
        "Basketball", "Boba", "Films", "Music", "Gaming", "Coffee",
    ]

    private var isValid: Bool {
        name.trimmingCharacters(in: .whitespaces).count >= 2
            && handle.count >= 3
            && Self.hasAlphanumeric(handle)
            && handleAvailable != false
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Set up your profile")
                            .font(.system(size: 25, weight: .heavy))
                            .foregroundStyle(Theme.foreground)
                        Text("How friends will find you")
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.sub)
                    }
                    .padding(.top, 14)

                    // Avatar picker.
                    HStack {
                        Spacer()
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            ZStack {
                                if let pickedImage {
                                    Image(uiImage: pickedImage)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 76, height: 76)
                                        .clipShape(Circle())
                                } else {
                                    Circle()
                                        .strokeBorder(Theme.hair, style: StrokeStyle(lineWidth: 2, dash: [6, 5]))
                                        .frame(width: 76, height: 76)
                                        .overlay(
                                            Image(systemName: "camera")
                                                .font(.system(size: 20))
                                                .foregroundStyle(Theme.sub)
                                        )
                                }
                                if uploadingPhoto {
                                    Circle().fill(.black.opacity(0.35))
                                        .frame(width: 76, height: 76)
                                    ProgressView().tint(.white)
                                }
                            }
                        }
                        Spacer()
                    }
                    .padding(.vertical, 6)

                    field("Name") {
                        TextField("Your name", text: $name)
                            .textContentType(.name)
                            .font(.system(size: 16))
                    }

                    field("Handle") {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 2) {
                                Text("@")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(Theme.accent)
                                TextField("handle", text: $handle)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .font(.system(size: 16))
                                    .onChange(of: handle) { _, next in
                                        let clean = Self.sanitizeHandle(next)
                                        if clean != handle { handle = clean }
                                        scheduleHandleCheck()
                                    }
                                if checkingHandle {
                                    ProgressView().scaleEffect(0.7)
                                } else if handleAvailable == true {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.accentText)
                                        .font(.system(size: 15))
                                }
                            }
                            if handleAvailable == false {
                                Text("@\(handle) is taken")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.destructive)
                            }
                        }
                    }

                    field("Into (optional)") {
                        ChipFlow(spacing: 8) {
                            ForEach(Self.interestOptions, id: \.self) { interest in
                                interestChip(interest)
                            }
                        }
                    }

                    if let error {
                        Text(error)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(Theme.destructive)
                    }

                    Button(action: submit) {
                        Text(busy ? "Saving…" : "Let's go")
                    }
                    .buttonStyle(MintButtonStyle())
                    .disabled(busy || !isValid)
                    .opacity(isValid ? 1 : 0.55)
                    .padding(.top, 6)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
        }
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task { await handlePickedPhoto(newItem) }
        }
    }

    // MARK: Pieces

    private func field(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.system(size: 10, design: .monospaced))
                .kerning(1.2)
                .foregroundStyle(Theme.sub)
            content()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func interestChip(_ interest: String) -> some View {
        let selected = selectedInterests.contains(interest)
        return Button {
            if selected {
                selectedInterests.remove(interest)
            } else {
                selectedInterests.insert(interest)
            }
        } label: {
            Text(interest)
                .font(.system(size: 13, weight: selected ? .bold : .medium))
                .foregroundStyle(selected ? Theme.accentInk : Theme.foreground)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(selected ? Theme.accent : Theme.chip)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    /// Lowercase, strip everything outside [a-z0-9._].
    static func sanitizeHandle(_ raw: String) -> String {
        String(raw.lowercased().unicodeScalars.filter {
            ("a"..."z").contains(Character($0)) || ("0"..."9").contains(Character($0))
                || $0 == "_" || $0 == "."
        })
    }

    /// Require at least one letter/number so all-dot handles are rejected.
    static func hasAlphanumeric(_ handle: String) -> Bool {
        handle.contains { $0.isLetter || $0.isNumber }
    }

    // MARK: Avatar

    private func handlePickedPhoto(_ item: PhotosPickerItem) async {
        uploadingPhoto = true
        defer { uploadingPhoto = false }
        guard let userId = session.userId,
              let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data),
              let jpeg = Self.downscaledJPEG(image) else {
            error = "Couldn't use that photo — try another."
            return
        }
        pickedImage = image
        do {
            uploadedAvatarUrl = try await Repo.uploadAvatar(data: jpeg, userId: userId)
        } catch {
            // Non-blocking: keep the local preview, let setup finish without a saved photo.
            uploadedAvatarUrl = nil
            self.error = "Couldn't upload your photo — you can add one later."
        }
    }

    /// Downscale to a max 1024px dimension, JPEG 0.85.
    static func downscaledJPEG(_ image: UIImage) -> Data? {
        let maxDim: CGFloat = 1024
        let longest = max(image.size.width, image.size.height)
        let scaled: UIImage
        if longest > maxDim {
            let factor = maxDim / longest
            let size = CGSize(width: image.size.width * factor, height: image.size.height * factor)
            let renderer = UIGraphicsImageRenderer(size: size)
            scaled = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        } else {
            scaled = image
        }
        return scaled.jpegData(compressionQuality: 0.85)
    }

    // MARK: Handle availability

    private func scheduleHandleCheck() {
        handleCheckTask?.cancel()
        handleAvailable = nil
        guard handle.count >= 3, Self.hasAlphanumeric(handle), let userId = session.userId else {
            checkingHandle = false
            return
        }
        checkingHandle = true
        handleCheckTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            if Task.isCancelled { return }
            let available = (try? await Repo.isHandleAvailable(handle, excluding: userId)) ?? true
            if Task.isCancelled { return }
            checkingHandle = false
            handleAvailable = available
        }
    }

    // MARK: Actions

    private func submit() {
        guard let userId = session.userId else {
            error = "You need to sign in first."
            return
        }
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard trimmedName.count >= 2 else {
            error = "Display name must be at least 2 characters."
            return
        }
        guard handle.count >= 3, Self.hasAlphanumeric(handle) else {
            error = "Handle must be at least 3 characters and include a letter or number."
            return
        }
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                try await Repo.completeProfileSetup(
                    userId: userId,
                    displayName: trimmedName,
                    handle: handle,
                    interests: Array(selectedInterests)
                )
                if let uploadedAvatarUrl {
                    try? await Repo.updateProfile(["avatar_url": .string(uploadedAvatarUrl)], userId: userId)
                }
                await session.refreshProfile()
                session.completeSetup()
            } catch {
                self.error = Self.submitError(error)
            }
        }
    }

    /// Friendly wrapper — a raw handle collision beats the async check.
    private static func submitError(_ error: Error) -> String {
        let text = error.localizedDescription.lowercased()
        if text.contains("duplicate") || text.contains("unique") || text.contains("handle") {
            return "That handle just got taken — try another."
        }
        return error.localizedDescription
    }
}

/// Minimal wrapping flow layout for the interest chips (iOS 16+ Layout).
private struct ChipFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        return arrange(subviews, in: width).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let placement = arrange(subviews, in: bounds.width)
        for (index, origin) in placement.origins.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + origin.x, y: bounds.minY + origin.y),
                proposal: .unspecified
            )
        }
    }

    private func arrange(_ subviews: Subviews, in width: CGFloat) -> (origins: [CGPoint], size: CGSize) {
        var origins: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            origins.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
        }
        return (origins, CGSize(width: maxX, height: y + rowHeight))
    }
}
