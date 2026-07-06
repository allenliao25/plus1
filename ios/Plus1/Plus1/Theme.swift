import SwiftUI
import UIKit

/// plus1's mint design system, mirroring the approved v3 mockups.
/// Light: iOS grouped-light bones with mint #4ADE9E and dark ink on mint.
/// Dark: near-black with brighter mint #6EF0BC, still dark ink on mint.
enum Theme {
    static let background = dynamic(light: 0xF4F5F4, dark: 0x0E100F)
    static let card = dynamic(light: 0xFFFFFF, dark: 0x1A1D1B)
    static let foreground = dynamic(light: 0x101312, dark: 0xF3F5F4)
    static let sub = dynamic(light: 0x8A908C, dark: 0x8F968F)
    static let accent = dynamic(light: 0x4ADE9E, dark: 0x6EF0BC)
    /// Dark ink on mint in BOTH modes — passes contrast where white-on-mint fails.
    static let accentInk = dynamic(light: 0x05291B, dark: 0x06281A)
    /// Mint FOREGROUND (text / small icons) on `background`/`card` surfaces.
    /// Rule: filled controls use `accent` + `accentInk` label; mint text or icons
    /// sitting on light/dark surfaces use `accentText` — the lighter `accent`
    /// would fail contrast on white in light mode.
    static let accentText = dynamic(light: 0x0E9F6E, dark: 0x4ADE9E)
    static let chip = dynamic(light: 0xE8EAE8, dark: 0x232725)
    static let hair = Color(UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor.white.withAlphaComponent(0.10)
            : UIColor(hex: 0x3C433F).withAlphaComponent(0.14)
    })
    static let destructive = dynamic(light: 0xE0453A, dark: 0xF06A5E)

    private static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { trait in
            UIColor(hex: trait.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

// MARK: - Category artwork

/// Gradient + emoji identity per quest category (default cover when the
/// host hasn't uploaded a photo — same fallback the web app uses).
extension QuestCategory {
    var emoji: String {
        switch self {
        case .food: "🍜"
        case .study: "📚"
        case .fitness: "🏀"
        case .outdoors: "🌄"
        case .social: "🎬"
        case .sidequest: "✨"
        case .other: "🤙"
        }
    }

    var gradient: LinearGradient {
        let colors: [UInt32] = switch self {
        case .food: [0xFFB176, 0xF4694B, 0xD8434F]
        case .study: [0x7FB4FA, 0x4479EE, 0x2E56C9]
        case .fitness: [0x4ED8A4, 0x14A97C, 0x0B7E66]
        case .outdoors: [0x76C893, 0x2E9B6B, 0x156450]
        case .social: [0xC99BF7, 0x8E5CE8, 0x6A3DC4]
        case .sidequest: [0xF7C86B, 0xE89A3C, 0xC96F24]
        case .other: [0xA6ADA9, 0x6E7672, 0x494F4C]
        }
        return LinearGradient(
            colors: colors.map { Color(UIColor(hex: $0)) },
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
    }
}

/// The square artwork tile used in lists, grids, and heroes.
struct CategoryArtwork: View {
    let category: QuestCategory
    var imageURL: URL?
    var emojiSize: CGFloat = 22

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            if let imageURL {
                Color.clear.overlay(
                    AsyncImage(url: imageURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        category.gradient
                    }
                )
            } else {
                category.gradient
                Text(category.emoji)
                    .font(.system(size: emojiSize))
                    .opacity(0.55)
                    .rotationEffect(.degrees(-10))
                    .offset(x: emojiSize * 0.18, y: emojiSize * 0.2)
            }
        }
        .clipped()
    }
}

// MARK: - Chrome

/// Bold compact screen title on the leading edge of the toolbar row —
/// the concert-tracker header pattern Allen wants everywhere.
extension View {
    func compactNavTitle(_ title: String) -> some View {
        navigationTitle("")
            .toolbarTitleDisplayMode(.inline)
            .toolbar {
                if #available(iOS 26.0, *) {
                    ToolbarItem(placement: .topBarLeading) { CompactTitle(title: title) }
                        .sharedBackgroundVisibility(.hidden)
                } else {
                    ToolbarItem(placement: .topBarLeading) { CompactTitle(title: title) }
                }
            }
    }
}

private struct CompactTitle: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.system(size: 25, weight: .heavy))
            .foregroundStyle(Theme.foreground)
            .fixedSize()
    }
}

/// Section header: bold title left, mono uppercase count right.
struct SectionHeader: View {
    let title: String
    var caption: String = ""

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.system(size: 20, weight: .heavy))
                .foregroundStyle(Theme.foreground)
            Spacer()
            if !caption.isEmpty {
                Text(caption.uppercased())
                    .font(.system(size: 10, design: .monospaced))
                    .kerning(1.2)
                    .foregroundStyle(Theme.sub)
            }
        }
    }
}

/// Card container.
struct CardStyle: ViewModifier {
    var padding: CGFloat = 12
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

extension View {
    func card(padding: CGFloat = 12) -> some View { modifier(CardStyle(padding: padding)) }
}

/// Filled mint pill button with dark ink (the contrast-safe treatment).
struct MintButtonStyle: ButtonStyle {
    var fullWidth = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(Theme.accentInk)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .padding(.vertical, 13)
            .padding(.horizontal, fullWidth ? 0 : 18)
            .background(Theme.accent)
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}

/// Neutral secondary pill.
struct GhostButtonStyle: ButtonStyle {
    var fullWidth = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(Theme.foreground)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .padding(.vertical, 13)
            .padding(.horizontal, fullWidth ? 0 : 18)
            .background(Theme.chip)
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}

/// Avatar circle: photo if present, otherwise tinted initials.
struct AvatarView: View {
    let initials: String
    var url: URL?
    var size: CGFloat = 32

    private var tint: Color {
        let palette: [UInt32] = [0xDB7A50, 0x5B8DEF, 0x3FA97A, 0x9B6FD8, 0xD8628F]
        let index = abs(initials.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }) % palette.count
        return Color(UIColor(hex: palette[index]))
    }

    var body: some View {
        ZStack {
            Circle().fill(tint)
            if let url {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    initialsText
                }
            } else {
                initialsText
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var initialsText: some View {
        Text(initials)
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(.white)
    }
}

/// Overlapping avatar row for "going" stacks.
struct AvatarStack: View {
    let attendees: [QuestAttendee]
    var size: CGFloat = 24
    var max: Int = 3

    var body: some View {
        HStack(spacing: -size * 0.28) {
            ForEach(attendees.prefix(max)) { person in
                AvatarView(initials: person.avatarInitials, url: person.avatarUrl.flatMap(URL.init), size: size)
                    .overlay(Circle().stroke(Theme.card, lineWidth: 2))
            }
        }
    }
}

/// Centered icon + line + CTA empty-state block (the shared pattern
/// from the first-run designs).
struct EmptyStateCard: View {
    let emoji: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 6) {
            Text(emoji).font(.system(size: 30))
            Text(title).font(.system(size: 15, weight: .heavy))
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(Theme.sub)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(MintButtonStyle(fullWidth: false))
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .card()
    }
}

// MARK: - Loading + feedback primitives

/// Card-shaped placeholder with a subtle pulse — shown by feed screens
/// while their first load is in flight.
struct SkeletonCard: View {
    var height: CGFloat = 72
    @State private var pulsing = false

    var body: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(Theme.chip)
            .frame(height: height)
            .opacity(pulsing ? 0.5 : 1)
            .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: pulsing)
            .onAppear { pulsing = true }
    }
}

/// Transient capsule notice overlaid at the top of a screen.
struct ToastView: View {
    let message: String
    var body: some View {
        Text(message)
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(Theme.foreground)
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(Theme.hair, lineWidth: 0.5))
            .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
    }
}

extension View {
    /// Overlay a top toast bound to `message`; auto-dismisses after 2s.
    func toast(_ message: Binding<String?>) -> some View {
        overlay(alignment: .top) {
            if let text = message.wrappedValue {
                ToastView(message: text)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .task {
                        try? await Task.sleep(nanoseconds: 2_000_000_000)
                        withAnimation { message.wrappedValue = nil }
                    }
            }
        }
        .animation(.spring(duration: 0.3), value: message.wrappedValue)
    }
}

/// Haptic feedback shortcuts for taps and successful mutations.
enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

/// Relative/absolute display helpers for Postgres `timestamp` strings.
enum Fmt {
    static let pg: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return formatter
    }()

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parse(_ raw: String?) -> Date? {
        guard let raw else { return nil }
        // Honor any explicit offset (ISO8601 preserves non-UTC zones);
        // fall back to UTC-naive strings like "2026-07-06T18:00:00".
        // The DB stores these columns as Postgres `timestamp` (no tz), and the
        // dominant shape carries microseconds ("2026-07-06T18:00:00.123456").
        // ISO8601DateFormatter rejects offset-less strings and `pg` has no
        // fractional pattern, so for the naive fallback we strip the fractional
        // suffix (everything from the first ".") before formatting. Do not
        // "clean this up" — naive microsecond timestamps are what the DB emits.
        return isoFractional.date(from: raw)
            ?? iso.date(from: raw)
            ?? pg.date(from: String(raw.prefix(while: { $0 != "." })))
    }

    static func eventTime(_ raw: String?) -> String {
        guard let date = parse(raw) else { return "Right now" }
        let calendar = Calendar.current
        let time = date.formatted(date: .omitted, time: .shortened)
        if calendar.isDateInToday(date) { return "Today \(time)" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow \(time)" }
        let weekday = date.formatted(.dateTime.weekday(.abbreviated))
        if let days = calendar.dateComponents([.day], from: Date(), to: date).day, days < 7, days > 0 {
            return "\(weekday) \(time)"
        }
        return date.formatted(.dateTime.month(.abbreviated).day()) + " \(time)"
    }

    static func relative(_ raw: String?) -> String {
        guard let date = parse(raw) else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
