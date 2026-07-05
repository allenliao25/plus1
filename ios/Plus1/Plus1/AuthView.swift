import SwiftUI
import Supabase

/// Phone OTP sign-in — wordmark + phone entry, then the 6-digit code step.
/// Mirrors web sendPhoneOtp/verifyPhoneOtp; SessionStore's auth listener
/// routes onward after a successful verify.
struct AuthView: View {
    private enum Step {
        case phone, code
    }

    @State private var step: Step = .phone
    @State private var phone = ""
    @State private var code = ""
    @State private var error: String?
    @State private var busy = false

    private static let phoneInputError = "Enter a 3-digit area code and 7-digit phone number."

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer()

                wordmark

                Spacer().frame(height: 26)

                switch step {
                case .phone: phoneStep
                case .code: codeStep
                }

                if let error {
                    Text(error)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.destructive)
                        .multilineTextAlignment(.center)
                        .padding(.top, 12)
                }

                Spacer()
                Spacer()
            }
            .padding(.horizontal, 24)
        }
    }

    // MARK: Pieces

    private var wordmark: some View {
        VStack(spacing: 2) {
            (Text("plus").foregroundStyle(Theme.foreground)
                + Text("1").foregroundStyle(Theme.accent))
                .font(.system(size: 40, weight: .heavy))
                .kerning(-1)
            Text("never do stuff alone")
                .font(.system(size: 13))
                .foregroundStyle(Theme.sub)
        }
    }

    private var phoneStep: some View {
        VStack(spacing: 12) {
            field("Phone number") {
                HStack(spacing: 8) {
                    Text("+1")
                        .font(.system(size: 16))
                        .foregroundStyle(Theme.sub)
                    TextField("650 555 0134", text: $phone)
                        .keyboardType(.numberPad)
                        .textContentType(.telephoneNumber)
                        .font(.system(size: 16))
                }
            }

            Button(action: sendCode) {
                Text(busy ? "Sending…" : "Send code")
            }
            .buttonStyle(MintButtonStyle())
            .disabled(busy)

            Text("We'll text you a 6-digit code. No passwords.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.sub)
        }
    }

    private var codeStep: some View {
        VStack(spacing: 12) {
            field("6-digit code") {
                TextField("123456", text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .kerning(6)
                    .multilineTextAlignment(.center)
                    .onChange(of: code) { _, next in
                        code = String(next.filter(\.isNumber).prefix(6))
                    }
            }

            Button(action: verifyCode) {
                Text(busy ? "Verifying…" : "Verify")
            }
            .buttonStyle(MintButtonStyle())
            .disabled(busy)

            Text("Sent to \(normalizedPhone)")
                .font(.system(size: 11))
                .foregroundStyle(Theme.sub)

            HStack(spacing: 20) {
                Button("Resend code", action: sendCode)
                Button("Change number") {
                    step = .phone
                    code = ""
                    error = nil
                }
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.accent)
            .disabled(busy)
            .padding(.top, 4)
        }
    }

    private func field(_ label: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 5) {
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

    // MARK: Phone normalization (web normalizePhoneNumber parity)

    private var normalizedPhone: String {
        Self.normalizePhoneNumber(phone)
    }

    /// Port of lib/authService.ts normalizePhoneNumber: 10 digits → +1XXXXXXXXXX,
    /// 11 digits starting with 1 → +digits, leading + or 00 handled.
    static func normalizePhoneNumber(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        var digits = trimmed.filter(\.isNumber)
        let hadPlus = trimmed.hasPrefix("+")

        if !hadPlus, digits.hasPrefix("00") {
            digits = String(digits.dropFirst(2))
        }
        guard !digits.isEmpty else { return "" }

        if hadPlus { return "+\(digits)" }
        if digits.count == 10 { return "+1\(digits)" }
        return "+\(digits)"
    }

    /// Web E164_PATTERN parity.
    static func isValidE164(_ phone: String) -> Bool {
        phone.range(of: #"^\+[1-9]\d{1,14}$"#, options: .regularExpression) != nil
    }

    // MARK: Actions

    private func sendCode() {
        let normalized = normalizedPhone
        guard Self.isValidE164(normalized) else {
            error = Self.phoneInputError
            return
        }
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                try await Supa.client.auth.signInWithOTP(phone: normalized)
                step = .code
            } catch {
                self.error = error.localizedDescription
            }
        }
    }

    private func verifyCode() {
        let normalized = normalizedPhone
        let token = code.trimmingCharacters(in: .whitespaces)
        guard token.count == 6 else {
            error = "Enter the 6-digit code."
            return
        }
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                try await Supa.client.auth.verifyOTP(phone: normalized, token: token, type: .sms)
                // Success: SessionStore's auth listener routes to setup/app.
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
