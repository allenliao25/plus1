import SwiftUI

/// Shared report flow for any UGC target (event, message, profile).
/// Presents reason chips + optional details, submits via `Repo.report`.
struct ReportSheet: View {
    /// One of "quest", "message", "profile" — matches `reports.target_kind`.
    let kind: String
    let targetId: UUID
    var onDone: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var reason: String?
    @State private var details = ""
    @State private var submitting = false
    @State private var error: String?
    @State private var submitted = false

    private static let reasons = [
        "Spam", "Harassment or hate", "Inappropriate content", "Safety concern", "Other",
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if submitted {
                        VStack(spacing: 8) {
                            Text("✅").font(.system(size: 34))
                            Text("Report received")
                                .font(.system(size: 17, weight: .heavy))
                            Text("Thanks for flagging this. We review every report within 24 hours.")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.sub)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 28)
                    } else {
                        Text("What's wrong?")
                            .font(.system(size: 15, weight: .heavy))
                        VStack(spacing: 8) {
                            ForEach(Self.reasons, id: \.self) { option in
                                Button {
                                    reason = option
                                    Haptics.tap()
                                } label: {
                                    HStack {
                                        Text(option)
                                            .font(.system(size: 15, weight: .semibold))
                                            .foregroundStyle(Theme.foreground)
                                        Spacer()
                                        Image(systemName: reason == option ? "checkmark.circle.fill" : "circle")
                                            .foregroundStyle(reason == option ? Theme.accentText : Theme.sub)
                                    }
                                    .padding(.vertical, 12)
                                    .padding(.horizontal, 14)
                                    .background(Theme.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
                            }
                        }
                        TextField("Anything else we should know? (optional)", text: $details, axis: .vertical)
                            .lineLimit(3 ... 5)
                            .onChange(of: details) { _, newValue in
                                if newValue.count > 2000 { details = String(newValue.prefix(2000)) }
                            }
                            .font(.system(size: 14))
                            .padding(12)
                            .background(Theme.card)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        if let error {
                            Text(error)
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.destructive)
                        }
                        Button {
                            Task { await submit() }
                        } label: {
                            if submitting {
                                ProgressView().tint(Theme.accentInk)
                            } else {
                                Text("Submit report")
                            }
                        }
                        .buttonStyle(MintButtonStyle())
                        .disabled(reason == nil || submitting)
                        .opacity(reason == nil ? 0.5 : 1)
                    }
                }
                .padding(16)
            }
            .background(Theme.background)
            .navigationTitle("Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(submitted ? "Done" : "Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func submit() async {
        guard let reason else { return }
        submitting = true
        error = nil
        do {
            let trimmed = details.trimmingCharacters(in: .whitespacesAndNewlines)
            try await Repo.report(kind: kind, id: targetId, reason: reason, details: trimmed.isEmpty ? nil : trimmed)
            Haptics.success()
            submitted = true
            onDone?()
        } catch {
            self.error = "Couldn't send the report. Check your connection and try again."
        }
        submitting = false
    }
}
