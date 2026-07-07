import SwiftUI
import Supabase

/// Phone OTP sign-in — wordmark + phone entry, then the 6-digit code step.
/// Mirrors web sendPhoneOtp/verifyPhoneOtp; SessionStore's auth listener
/// routes onward after a successful verify.
struct AuthView: View {
    private enum Step {
        case phone, code
    }

    private enum Field {
        case phone, code
    }

    @State private var step: Step = .phone
    @State private var phone = ""
    @State private var code = ""
    @State private var error: String?
    @State private var busy = false
    @State private var resendSeconds = 0
    @State private var toastMessage: String?
    @FocusState private var focused: Field?

    private static let phoneInputError = "Enter a 3-digit area code and 7-digit phone number."
    private static let termsURL = URL(string: "https://plus1-livid.vercel.app/terms")!
    private static let privacyURL = URL(string: "https://plus1-livid.vercel.app/privacy")!

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
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focused = nil }
            }
        }
        .toast($toastMessage)
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
                        .focused($focused, equals: .phone)
                }
            }

            Button(action: sendCode) {
                if busy {
                    ProgressView().tint(Theme.accentInk)
                } else {
                    Text("Send code")
                }
            }
            .buttonStyle(MintButtonStyle())
            .disabled(busy)

            Text("We'll text you a 6-digit code. No passwords.")
                .font(.system(size: 11))
                .foregroundStyle(Theme.sub)

            legalFooter
        }
    }

    private var legalFooter: some View {
        (Text("By continuing you agree to our ")
            + Text("[Terms of Service](\(Self.termsURL.absoluteString))")
            + Text(" and ")
            + Text("[Privacy Policy](\(Self.privacyURL.absoluteString))."))
            .font(.system(size: 11))
            .foregroundStyle(Theme.sub)
            .tint(Theme.accentText)
            .multilineTextAlignment(.center)
            .padding(.top, 4)
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
                    .focused($focused, equals: .code)
                    .onChange(of: code) { _, next in
                        let filtered = String(next.filter(\.isNumber).prefix(6))
                        if filtered != code { code = filtered }
                        // Auto-verify once the 6th digit lands.
                        if filtered.count == 6, !busy {
                            verifyCode()
                        }
                    }
            }

            Button(action: verifyCode) {
                if busy {
                    ProgressView().tint(Theme.accentInk)
                } else {
                    Text("Verify")
                }
            }
            .buttonStyle(MintButtonStyle())
            .disabled(busy)

            Text("Sent to \(normalizedPhone)")
                .font(.system(size: 11))
                .foregroundStyle(Theme.sub)

            HStack(spacing: 20) {
                Button(resendSeconds > 0 ? "Resend in \(resendSeconds)s" : "Resend code", action: sendCode)
                    .disabled(busy || resendSeconds > 0)
                Button("Change number") {
                    step = .phone
                    code = ""
                    error = nil
                }
                .disabled(busy)
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Theme.accentText)
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

    /// Map raw auth/network errors to one friendly line.
    private static func friendlyMessage(_ error: Error) -> String {
        if error is URLError { return "You're offline — check your connection." }
        let text = error.localizedDescription.lowercased()
        if text.contains("rate") { return "Too many tries — wait a minute and try again." }
        if text.contains("invalid") || text.contains("expired") || text.contains("token") || text.contains("otp") {
            return "That code didn't match — check it and try again."
        }
        return "Something went wrong — try again in a moment."
    }

    // MARK: Actions

    private func sendCode() {
        let normalized = normalizedPhone
        guard Self.isValidE164(normalized) else {
            error = Self.phoneInputError
            return
        }
        let resending = step == .code
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                try await Supa.client.auth.signInWithOTP(phone: normalized)
                Analytics.track("signup_otp_sent")
                step = .code
                startResendCooldown()
                if resending { toastMessage = "Code sent" }
            } catch {
                self.error = Self.friendlyMessage(error)
            }
        }
    }

    private func startResendCooldown() {
        resendSeconds = 30
        Task {
            while resendSeconds > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                resendSeconds -= 1
            }
        }
    }

    private func verifyCode() {
        guard !busy else { return }
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
                Analytics.track("signup_otp_verified")
                // Success: SessionStore's auth listener routes to setup/app.
            } catch {
                self.error = Self.friendlyMessage(error)
            }
        }
    }
}
