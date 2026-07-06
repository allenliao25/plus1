import SwiftUI
import UIKit

/// Story-format shareable event card (1080×1920) rendered off-screen with
/// `ImageRenderer` so it can be dropped into an Instagram story. One clear
/// idea: the event, big, on its category color. No stacked effects.
///
/// `ImageRenderer` cannot render `AsyncImage`, so a cover photo must be
/// pre-loaded into a `UIImage` and passed in; otherwise we fall back to the
/// category gradient.
struct ShareCard: View {
    let quest: Quest
    let coverImage: UIImage?
    let shareURL: URL?

    private var usesPhoto: Bool { coverImage != nil }

    var body: some View {
        ZStack {
            background
            // Dark scrim only when a photo backs the card, for text legibility.
            if usesPhoto {
                Color.black.opacity(0.42)
            }
            content
        }
        .frame(width: 1080, height: 1920)
    }

    @ViewBuilder private var background: some View {
        if let coverImage {
            Image(uiImage: coverImage)
                .resizable()
                .scaledToFill()
                .frame(width: 1080, height: 1920)
                .clipped()
        } else {
            quest.category.gradient
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            Spacer()

            Text(quest.category.emoji)
                .font(.system(size: 92))

            Text(quest.title)
                .font(.system(size: 118, weight: .heavy))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .minimumScaleFactor(0.5)
                .padding(.top, 40)
                .padding(.horizontal, 96)

            Text(Fmt.eventTime(quest.row.startTime))
                .font(.system(size: 52, weight: .bold))
                .foregroundStyle(.white)
                .padding(.top, 44)

            Text(quest.location)
                .font(.system(size: 40, weight: .medium))
                .foregroundStyle(.white.opacity(0.9))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .padding(.top, 12)
                .padding(.horizontal, 96)

            if let host = quest.host {
                Text("hosted by \(host.displayName)")
                    .font(.system(size: 36, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))
                    .padding(.top, 12)
            }

            Spacer()

            VStack(spacing: 24) {
                Text("join me on plus1")
                    .font(.system(size: 46, weight: .heavy))
                    .foregroundStyle(Theme.accentInk)
                    .padding(.horizontal, 72)
                    .padding(.vertical, 34)
                    .background(Theme.accent, in: Capsule())

                if let shareURL {
                    Text(shareURL.absoluteString)
                        .font(.system(size: 30, weight: .regular))
                        .foregroundStyle(.white.opacity(0.75))
                }
            }
            .padding(.bottom, 150)
        }
    }
}

/// Fetches the event cover photo (if any) then renders `ShareCard` to a
/// `UIImage`. Returns `nil` only if rendering fails; a missing/failed photo
/// falls back to the category gradient.
@MainActor
func renderShareCard(quest: Quest, coverImage: UIImage?, shareURL: URL?) async -> UIImage? {
    let renderer = ImageRenderer(
        content: ShareCard(quest: quest, coverImage: coverImage, shareURL: shareURL)
    )
    renderer.scale = 1
    return renderer.uiImage
}

/// Loads a cover photo URL into a `UIImage` for `renderShareCard`. Non-throwing;
/// returns `nil` on any failure so callers fall back to the gradient.
func loadCoverImage(_ url: URL?) async -> UIImage? {
    guard let url else { return nil }
    do {
        let (data, _) = try await URLSession.shared.data(from: url)
        return UIImage(data: data)
    } catch {
        return nil
    }
}
