import SwiftUI
import PhotosUI

/// Two-step create/edit sheet (mockup 03, phones C + D):
/// compose — big title, inline When/Category/Spots/Visibility, settings rows
/// for Where/Cover/Description/Invites — then an Instagram-style preview of
/// the exact feed card before anything posts. Validation mirrors the web
/// CreateQuestForm (title + location required, future start time,
/// invite-only needs invitees).
struct CreateEventView: View {
    let editing: Quest?
    let onSaved: (() -> Void)?

    init(editing: Quest? = nil, onSaved: (() -> Void)? = nil) {
        self.editing = editing
        self.onSaved = onSaved
        _title = State(initialValue: editing?.title ?? "")
        _category = State(initialValue: editing?.category ?? .food)
        _visibility = State(initialValue: editing?.visibility ?? .friends)
        _location = State(initialValue: editing?.location ?? "")
        _descriptionText = State(initialValue: editing?.row.description ?? "")
        _noCap = State(initialValue: editing.map { $0.row.maxPeople == nil } ?? false)
        _spots = State(initialValue: editing?.row.maxPeople ?? 4)
        _schedule = State(initialValue: editing?.startDate != nil)
        // New events floor to "now + 1h"; editing preserves the original start
        // time even if it's already in the past (don't silently clamp).
        if let existingStart = editing?.startDate {
            _startTime = State(initialValue: existingStart)
        } else {
            _startTime = State(initialValue: Date().addingTimeInterval(3600))
        }
        _invitees = State(initialValue: editing?.invitedProfiles ?? [])
        _existingImageUrl = State(initialValue: editing?.row.cardImageUrl)
    }

    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var app

    // Form state
    @State private var title: String
    @State private var schedule: Bool
    @State private var startTime: Date
    @State private var category: QuestCategory
    @State private var noCap: Bool
    @State private var spots: Int
    @State private var visibility: QuestVisibility
    @State private var location: String
    @State private var descriptionText: String
    @State private var invitees: [ProfileRow]
    @State private var existingImageUrl: String?
    @State private var photoItem: PhotosPickerItem?
    @State private var photoData: Data?

    // Flow state
    @State private var showPreview = false
    @State private var posting = false
    @State private var postError: String?
    @State private var photoError: String?
    @State private var coverUploadFailed = false

    var body: some View {
        NavigationStack {
            composeStep
                .navigationDestination(isPresented: $showPreview) { previewStep }
        }
        .onChange(of: photoItem) { _, newItem in
            guard let newItem else { return }
            Task {
                guard let data = try? await newItem.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    photoError = "Couldn't load that photo. Try picking another."
                    return
                }
                // Downscale huge photos so a 12MP shot can't blow the 8MB cap.
                photoData = Self.downscaledJPEG(image) ?? data
            }
        }
        .alert("Photo problem", isPresented: Binding(
            get: { photoError != nil },
            set: { if !$0 { photoError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(photoError ?? "")
        }
    }

    /// Downscale to a max 1600px dimension, then JPEG-encode at 0.85 quality.
    private static func downscaledJPEG(_ image: UIImage, maxDimension: CGFloat = 1600) -> Data? {
        let longest = max(image.size.width, image.size.height)
        let scale = longest > maxDimension ? maxDimension / longest : 1
        let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: 0.85)
    }

    // MARK: - Step 1 · Compose

    private var composeStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                TextField("What's the move?", text: $title, axis: .vertical)
                    .font(.system(size: 24, weight: .heavy))
                    .foregroundStyle(Theme.foreground)
                    .padding(.horizontal, 4)
                    .padding(.top, 4)
                    .onChange(of: title) { _, newValue in
                        if newValue.count > 80 { title = String(newValue.prefix(80)) }
                    }

                whenCard
                categoryCard
                spotsCard
                visibilityCard
                detailRows
                if !invitees.isEmpty, visibility != .inviteOnly {
                    Text("\(invitees.count) \(invitees.count == 1 ? "friend" : "friends") will still get an invite notification.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.sub)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background)
        .navigationTitle(editing == nil ? "New event" : "Edit event")
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel") { dismiss() }
                    .foregroundStyle(Theme.foreground)
            }
        }
        .safeAreaInset(edge: .bottom) { composeFooter }
    }

    /// New events can't start in the past; editing preserves an already-past
    /// start, so the picker allows down to that original time.
    private var datePickerRange: PartialRangeFrom<Date> {
        if editing != nil, startTime < Date() {
            return startTime...
        }
        return Date()...
    }

    private var whenCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardLabel("When")
            Picker("When", selection: $schedule.animation()) {
                Text("Right now").tag(false)
                Text("Schedule").tag(true)
            }
            .pickerStyle(.segmented)
            if schedule {
                DatePicker(
                    "Starts",
                    selection: $startTime,
                    in: datePickerRange,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.foreground)
            }
        }
        .card(padding: 14)
    }

    private var categoryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardLabel("Category")
            WrapChips(spacing: 8) {
                ForEach(QuestCategory.allCases) { option in
                    let selected = category == option
                    Button {
                        category = option
                    } label: {
                        Text(option.rawValue)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(selected ? Theme.accentInk : Theme.foreground)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 7)
                            .background(selected ? Theme.accent : Theme.chip)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .card(padding: 14)
    }

    private var spotsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardLabel("Spots")
            HStack(spacing: 10) {
                Text(noCap ? "No cap" : "\(spots) people")
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundStyle(Theme.foreground)
                    .contentTransition(.numericText())
                Spacer()
                stepButton("minus", enabled: !noCap && spots > 2) {
                    withAnimation(.snappy) { spots -= 1 }
                }
                stepButton("plus", enabled: !noCap && spots < 50) {
                    withAnimation(.snappy) { spots += 1 }
                }
            }
            Toggle(isOn: $noCap.animation()) {
                Text("No cap on spots")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.sub)
            }
            .tint(Theme.accent)
            if !noCap {
                Text("including you")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.sub)
            }
        }
        .card(padding: 14)
    }

    private func stepButton(_ symbol: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.foreground)
                .frame(width: 34, height: 34)
                .background(Theme.chip, in: Circle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.35)
    }

    private var visibilityCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardLabel("Who can see it")
            Picker("Who can see it", selection: $visibility) {
                ForEach(QuestVisibility.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
            Text(visibilityHelper)
                .font(.system(size: 11.5))
                .foregroundStyle(Theme.sub)
        }
        .card(padding: 14)
    }

    private var visibilityHelper: String {
        switch visibility {
        case .friends: "Your friends can discover and join. Invited people can too."
        case .local: "Anyone on campus can discover and join."
        case .inviteOnly: "Only people you invite can see and join."
        }
    }

    private var detailRows: some View {
        VStack(spacing: 0) {
            NavigationLink {
                PlaceScreen(location: $location)
            } label: {
                SettingsRow(
                    label: "Where",
                    value: location.isEmpty ? "Add a place" : location,
                    isSet: !location.isEmpty
                )
            }
            rowDivider
            PhotosPicker(selection: $photoItem, matching: .images) {
                coverRow
            }
            rowDivider
            NavigationLink {
                DescriptionScreen(text: $descriptionText)
            } label: {
                SettingsRow(
                    label: "Description",
                    value: descriptionSnippet,
                    isSet: !descriptionText.isEmpty
                )
            }
            rowDivider
            NavigationLink {
                InvitePickerView(selection: $invitees)
            } label: {
                SettingsRow(
                    label: "Invite people",
                    value: invitees.isEmpty ? "None yet" : "\(invitees.count) selected",
                    isSet: !invitees.isEmpty,
                    mint: visibility == .inviteOnly
                )
            }
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var rowDivider: some View {
        Rectangle()
            .fill(Theme.hair)
            .frame(height: 0.5)
            .padding(.leading, 14)
    }

    private var hasCustomCover: Bool {
        photoData != nil || existingImageUrl != nil
    }

    private var coverRow: some View {
        HStack(spacing: 8) {
            Text("Cover")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.foreground)
            Spacer(minLength: 12)
            if let photoData, let image = UIImage(data: photoData) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 28, height: 28)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            } else if let existingImageUrl, let url = URL(string: existingImageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    category.gradient
                }
                .frame(width: 28, height: 28)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            Text(hasCustomCover ? "Custom photo" : "Auto artwork")
                .font(.system(size: 14))
                .foregroundStyle(hasCustomCover ? Theme.foreground : Theme.sub)
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.sub)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }

    private var descriptionSnippet: String {
        let trimmed = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Optional" }
        let firstLine = trimmed.split(separator: "\n").first.map(String.init) ?? trimmed
        return firstLine.count > 22 ? String(firstLine.prefix(22)) + "…" : firstLine
    }

    // MARK: - Validation

    private var validationMessage: String? {
        if title.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 {
            return "Give it a title — at least 3 characters."
        }
        if location.trimmingCharacters(in: .whitespaces).isEmpty {
            return "Add a place so people know where to go."
        }
        // Only nag on past start for NEW events — editing preserves an
        // already-past original start time (web parity).
        if schedule, editing == nil, startTime <= Date() {
            return "Pick a future start time."
        }
        if visibility == .inviteOnly, invitees.isEmpty {
            return "Invite-only events need at least one invite."
        }
        return nil
    }

    /// Don't nag on a fresh sheet — only after the user has started typing.
    private var isPristine: Bool {
        title.isEmpty && location.isEmpty
    }

    private var composeFooter: some View {
        VStack(spacing: 8) {
            if let message = validationMessage, !isPristine {
                Text(message)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.destructive)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button("Preview event") { showPreview = true }
                .buttonStyle(MintButtonStyle())
                .disabled(validationMessage != nil)
                .opacity(validationMessage == nil ? 1 : 0.5)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(Theme.background)
    }

    // MARK: - Step 2 · Preview

    private var whenLabel: String {
        schedule ? Fmt.eventTime(Fmt.pg.string(from: startTime)) : "Right now"
    }

    private var previewStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("How it will look · \(visibility.label)".uppercased())
                    .font(.system(size: 10.5, design: .monospaced))
                    .kerning(1.2)
                    .foregroundStyle(Theme.sub)
                previewCard
                summaryCard
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Preview")
        .toolbarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    showPreview = false
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 15, weight: .semibold))
                        Text("Edit")
                    }
                }
                .disabled(posting)
            }
        }
        .safeAreaInset(edge: .bottom) { postFooter }
        .alert("Couldn't save this event", isPresented: Binding(
            get: { postError != nil },
            set: { if !$0 { postError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(postError ?? "")
        }
        .alert("Cover photo didn't upload", isPresented: $coverUploadFailed) {
            Button("Post without photo") { Task { await post(skipPhoto: true) } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("We couldn't upload your cover photo. You can post the event without it, or cancel and try again.")
        }
    }

    private var previewCard: some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                if let photoData, let image = UIImage(data: photoData) {
                    Color.clear.overlay(
                        Image(uiImage: image).resizable().scaledToFill()
                    )
                } else {
                    CategoryArtwork(
                        category: category,
                        imageURL: existingImageUrl.flatMap(URL.init),
                        emojiSize: 48
                    )
                }
            }
            LinearGradient(
                colors: [.clear, .black.opacity(0.62)],
                startPoint: .center, endPoint: .bottom
            )
            VStack(alignment: .leading, spacing: 4) {
                Text(title.trimmingCharacters(in: .whitespacesAndNewlines))
                    .font(.system(size: 20, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text("\(whenLabel) · \(location)")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(1)
                HStack(spacing: 7) {
                    AvatarView(
                        initials: session.profile?.initials ?? "?",
                        url: session.profile?.avatarUrl.flatMap(URL.init),
                        size: 22
                    )
                    .overlay(Circle().stroke(.white.opacity(0.7), lineWidth: 1.5))
                    Text(hostLine)
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.9))
                }
                .padding(.top, 3)
            }
            .padding(14)
        }
        .frame(height: 172)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(alignment: .topLeading) {
            if !schedule { livePill.padding(10) }
        }
        .overlay(alignment: .topTrailing) {
            changeCoverChip.padding(10)
        }
    }

    private var hostLine: String {
        noCap ? "1 going · you're hosting" : "1/\(spots) · you're hosting"
    }

    private var livePill: some View {
        HStack(spacing: 5) {
            Circle().fill(Theme.accent).frame(width: 6, height: 6)
            Text("LIVE")
                .font(.system(size: 9, weight: .heavy))
                .kerning(0.8)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(.black.opacity(0.45), in: Capsule())
    }

    private var changeCoverChip: some View {
        PhotosPicker(selection: $photoItem, matching: .images) {
            Text("CHANGE COVER")
                .font(.system(size: 9, weight: .heavy))
                .kerning(0.6)
                .foregroundStyle(Theme.accentInk)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(.white.opacity(0.92), in: Capsule())
        }
    }

    private var summaryCard: some View {
        VStack(spacing: 0) {
            SummaryRow(
                symbol: "clock.fill",
                tint: .orange,
                title: whenLabel,
                subtitle: schedule
                    ? startTime.formatted(date: .abbreviated, time: .shortened)
                    : "Visible until you close it"
            )
            SummaryRow(
                symbol: "mappin.circle.fill",
                tint: .red,
                title: location,
                subtitle: session.profile?.area ?? ""
            )
            SummaryRow(
                symbol: "person.2.fill",
                tint: Theme.accent,
                title: "\(noCap ? "No cap" : "\(spots) spots") · \(visibility.label.lowercased())",
                subtitle: inviteesLine
            )
        }
        .padding(.vertical, 4)
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var inviteesLine: String {
        guard !invitees.isEmpty else { return "No invites yet" }
        return "Inviting " + invitees.map { "@\($0.handle)" }.joined(separator: ", ")
    }

    private var postFooter: some View {
        Button {
            Task { await post() }
        } label: {
            if posting {
                ProgressView().tint(Theme.accentInk)
            } else {
                Text(editing == nil ? "Post event" : "Save changes")
            }
        }
        .buttonStyle(MintButtonStyle())
        .disabled(posting)
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(Theme.background)
    }

    // MARK: - Posting

    /// Post the event. When `skipPhoto` is set (after a cover-upload failure
    /// the user chose to skip), the event is saved without the picked photo so
    /// the whole event isn't lost.
    private func post(skipPhoto: Bool = false) async {
        posting = true
        defer { posting = false }

        var imageUrl = existingImageUrl
        if let photoData, !skipPhoto {
            do {
                imageUrl = try await Repo.uploadCardImage(data: photoData, contentType: "image/jpeg")
            } catch {
                // Don't lose the event — offer to post without the photo.
                coverUploadFailed = true
                return
            }
        }

        do {
            let input = Repo.QuestInput(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                category: category,
                location: location.trimmingCharacters(in: .whitespaces),
                startTime: schedule ? startTime : nil,
                description: descriptionText.trimmingCharacters(in: .whitespacesAndNewlines),
                maxPeople: noCap ? nil : spots,
                visibility: visibility,
                cardImageUrl: imageUrl,
                inviteeIds: invitees.map(\.id)
            )
            if let editing {
                try await Repo.updateQuest(id: editing.id, input)
            } else {
                _ = try await Repo.createQuest(input)
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            app.bumpData()
            onSaved?()
            dismiss()
        } catch {
            postError = error.localizedDescription
        }
    }
}

// MARK: - Small pieces

/// Uppercase mono card label ("WHEN", "CATEGORY", …).
private struct CardLabel: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10.5, design: .monospaced))
            .kerning(1.2)
            .foregroundStyle(Theme.sub)
    }
}

/// Settings-style row: label, trailing value, chevron.
private struct SettingsRow: View {
    let label: String
    let value: String
    var isSet = false
    var mint = false

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.foreground)
            Spacer(minLength: 12)
            Text(value)
                .font(.system(size: 14, weight: mint ? .bold : .regular))
                .foregroundStyle(mint ? Theme.accent : (isSet ? Theme.foreground : Theme.sub))
                .lineLimit(1)
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.sub)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}

/// Icon-circle + two-line summary row on the preview step.
private struct SummaryRow: View {
    let symbol: String
    let tint: Color
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 11) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 30, height: 30)
                .background(tint.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14.5, weight: .bold))
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(1)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.sub)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
    }
}

/// Mini screen behind the "Where" row — just a place name, no MapKit.
private struct PlaceScreen: View {
    @Binding var location: String
    @FocusState private var focused: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Green Library, Wilbur courts…", text: $location)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.foreground)
                .padding(14)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .focused($focused)
                .submitLabel(.done)
                .onSubmit { dismiss() }
            Text("Just the place name — enough for people to find you.")
                .font(.system(size: 12))
                .foregroundStyle(Theme.sub)
            Spacer()
        }
        .padding(16)
        .background(Theme.background)
        .navigationTitle("Where")
        .toolbarTitleDisplayMode(.inline)
        .onAppear { focused = true }
    }
}

/// Mini screen behind the "Description" row.
private struct DescriptionScreen: View {
    @Binding var text: String
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextEditor(text: $text)
                .font(.system(size: 15))
                .foregroundStyle(Theme.foreground)
                .scrollContentBackground(.hidden)
                .focused($focused)
                .padding(10)
                .frame(minHeight: 180, maxHeight: 280)
                .background(Theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("What should people know before joining?")
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.sub.opacity(0.7))
                            .padding(.horizontal, 15)
                            .padding(.top, 18)
                            .allowsHitTesting(false)
                    }
                }
            Spacer()
        }
        .padding(16)
        .background(Theme.background)
        .navigationTitle("Description")
        .toolbarTitleDisplayMode(.inline)
        .onAppear { focused = true }
    }
}

/// Left-aligned wrapping chip row (category picker).
private struct WrapChips: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: proposal.width ?? max(0, x - spacing), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
