import XCTest

/// Full visual walkthrough of the plus1 iOS app.
///
/// One ordered flow: sign in (or resume an existing session), complete the
/// first-run profile setup if shown, dismiss the push-permission system alert,
/// then drive every major screen and attach a screenshot at each state. Every
/// walkthrough step is wrapped in `capture(...)` so one failing navigation
/// never aborts the whole run — the shot is taken, the failure logged, and the
/// walkthrough continues.
final class SmokeTests: XCTestCase {
    private var app: XCUIApplication!

    // Test account (Supabase test OTP). Typing 10 ones + the UI's +1 prefix
    // normalizes to +11111111111; the OTP 111111 auto-verifies on the 6th digit.
    private let testPhoneDigits = "1111111111"
    private let testOTP = "111111"

    override func setUpWithError() throws {
        continueAfterFailure = true
        app = XCUIApplication()
    }

    // MARK: - Light-mode full walkthrough

    func testWalkthrough() throws {
        app.launch()
        installPushInterruptionMonitor()

        // If we're on the auth screen, sign in. Otherwise the session persisted
        // and we're already inside the app — skip straight to the walkthrough.
        if onAuthScreen(timeout: 8) {
            capture("01-auth")
            signIn()
        }

        completeProfileSetupIfNeeded()

        // Land on Home. The push alert fires ~1s after the signed-in UI settles;
        // poke the app so the interruption monitor gets a chance to fire, and
        // also dismiss it explicitly via springboard as a fallback.
        waitForHome()
        dismissPushAlertIfPresent()
        app.swipeUp()
        app.swipeDown()
        dismissPushAlertIfPresent()

        runWalkthrough(prefix: "")
    }

    // MARK: - Dark-mode subset (gated on an env var set by the dark run)

    /// Dark-mode subset. The simulator appearance is set to dark externally
    /// (`simctl ui <udid> appearance dark`) before running only this method, so
    /// the captured shots differ from the light run.
    func testWalkthroughDark() throws {
        app.launch()
        installPushInterruptionMonitor()

        if onAuthScreen(timeout: 8) {
            signIn()
        }
        completeProfileSetupIfNeeded()
        waitForHome()
        dismissPushAlertIfPresent()

        capture("dark-01-home")
        openFirstEventFromHome(prefix: "dark-")
        goToTab("Profile", prefix: "dark-")
        capture("dark-04-profile")
    }

    // MARK: - Sign-in flow

    private func onAuthScreen(timeout: TimeInterval) -> Bool {
        // The "Send code" button is unique to the phone step of AuthView.
        app.buttons["Send code"].waitForExistence(timeout: timeout)
    }

    private func signIn() {
        // Phone step: the only numberPad text field on screen.
        let phoneField = app.textFields.firstMatch
        if phoneField.waitForExistence(timeout: 5) {
            phoneField.tap()
            phoneField.typeText(testPhoneDigits)
        }
        let sendButton = app.buttons["Send code"]
        if sendButton.exists { sendButton.tap() }

        // Code step: single field, auto-verifies on the 6th digit.
        let codeField = app.textFields.firstMatch
        if codeField.waitForExistence(timeout: 10) {
            codeField.tap()
            codeField.typeText(testOTP)
        }
        // Explicit verify as a fallback in case auto-verify didn't fire.
        let verifyButton = app.buttons["Verify"]
        if verifyButton.waitForExistence(timeout: 2), verifyButton.isEnabled {
            verifyButton.tap()
        }
    }

    // MARK: - Profile setup (first run)

    private func completeProfileSetupIfNeeded() {
        // "Set up your profile" heading marks the ProfileSetupView.
        let heading = app.staticTexts["Set up your profile"]
        guard heading.waitForExistence(timeout: 8) else { return }
        capture("02-profile-setup")

        let fields = app.textFields
        // Order in the view: Name, then Handle.
        if fields.count >= 1 {
            let nameField = fields.element(boundBy: 0)
            nameField.tap()
            nameField.typeText("Sam Test")
        }
        if fields.count >= 2 {
            let handleField = fields.element(boundBy: 1)
            handleField.tap()
            // Random suffix so re-runs don't collide on an already-taken handle.
            let suffix = String(Int.random(in: 100...9999))
            handleField.typeText("samtest\(suffix)")
        }

        // Give the async handle-availability check a moment, then continue.
        let go = app.buttons["Let's go"]
        _ = go.waitForExistence(timeout: 3)
        waitUntil(timeout: 6) { go.isEnabled }
        if go.isEnabled {
            go.tap()
        }
    }

    // MARK: - Push permission alert

    private func installPushInterruptionMonitor() {
        addUIInterruptionMonitor(withDescription: "System alerts") { alert in
            // Push permission: pick Allow. Dictation prompt: dismiss with Not Now.
            for label in ["Allow", "Allow While Using App", "Not Now", "OK"] {
                let button = alert.buttons[label]
                if button.exists {
                    button.tap()
                    return true
                }
            }
            return false
        }
    }

    /// Dismiss any lingering springboard system alert (push permission or the
    /// keyboard "Enable Dictation?" prompt) that would otherwise block taps.
    private func dismissSystemAlertIfPresent() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "Allow While Using App", "Not Now"] {
            let button = springboard.buttons[label]
            if button.exists {
                button.tap()
                return
            }
        }
    }

    /// Explicit springboard fallback — the interruption monitor only fires on a
    /// subsequent interaction, so we also tap the alert directly.
    private func dismissPushAlertIfPresent() {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for label in ["Allow", "Allow While Using App"] {
            let button = springboard.buttons[label]
            if button.waitForExistence(timeout: 3) {
                button.tap()
                return
            }
        }
    }

    // MARK: - Walkthrough

    private func waitForHome() {
        // The Home tab bar button confirms we reached the signed-in shell.
        _ = app.tabBars.buttons["Home"].waitForExistence(timeout: 20)
    }

    private func runWalkthrough(prefix: String) {
        capture("\(prefix)03-home-feed")

        capture("\(prefix)04-home-dock") {
            self.app.swipeUp()
        }

        goToTab("Explore", prefix: prefix)
        capture("\(prefix)05-explore")

        capture("\(prefix)06-explore-search") {
            self.searchExplore("maya")
        }
        // A keyboard "Enable Dictation?" prompt can pop on first text entry and
        // block subsequent taps — dismiss it before moving on.
        dismissSystemAlertIfPresent()
        // Clear search so it doesn't bleed into later tabs.
        dismissKeyboardAndSearch()

        // Invoke Create from a clean Home tab (not with the Explore search
        // keyboard up, which can swallow the tap and leave the sheet unopened).
        goToTab("Home", prefix: prefix)
        captureCreateSheet(prefix: prefix)

        goToTab("Inbox", prefix: prefix)
        capture("\(prefix)10-inbox")
        captureFirstChatThread(prefix: prefix)

        // Activity is pushed from the Home bell.
        goToTab("Home", prefix: prefix)
        captureActivity(prefix: prefix)

        goToTab("Profile", prefix: prefix)
        capture("\(prefix)13-profile")
        captureSettings(prefix: prefix)

        // Event detail from the first Home card.
        goToTab("Home", prefix: prefix)
        openFirstEventFromHome(prefix: prefix)
    }

    private func searchExplore(_ text: String) {
        let searchField = app.searchFields.firstMatch
        if searchField.waitForExistence(timeout: 5) {
            searchField.tap()
            searchField.typeText(text)
            // Let the debounced people search resolve.
            waitUntil(timeout: 3) { false }  // just a short settle
        }
    }

    private func dismissKeyboardAndSearch() {
        let cancel = app.buttons["Cancel"]
        if cancel.exists { cancel.tap() }
        let searchField = app.searchFields.firstMatch
        if searchField.exists {
            // Clear any residual text.
            let clear = searchField.buttons["Clear text"]
            if clear.exists { clear.tap() }
        }
    }

    private func captureCreateSheet(prefix: String) {
        // Compose step — the big title field placeholder is "What's the move?".
        let titleField = app.textFields["What's the move?"].firstMatch
        // Create is the center tab; selecting it presents the create sheet.
        // Retry once — a stray tab-bar state can swallow the first tap.
        var opened = false
        for _ in 0..<2 {
            let createTab = tabButton("Create")
            guard createTab.waitForExistence(timeout: 5) else {
                log("Create tab not found")
                continue
            }
            createTab.tap()
            if titleField.waitForExistence(timeout: 5) {
                opened = true
                break
            }
            log("Create sheet didn't open — retrying")
        }
        guard opened else {
            log("Create sheet failed to open")
            capture("\(prefix)07-create-sheet-fallback")
            return
        }
        capture("\(prefix)07-create-sheet")

        capture("\(prefix)08-create-filled") {
            if titleField.exists {
                titleField.tap()
                titleField.typeText("Coffee walk")
            }
            // Pick a category chip (Coffee) if visible.
            let coffeeChip = self.app.buttons["Coffee"]
            if coffeeChip.exists { coffeeChip.tap() }
        }

        // Try to reach the preview step (needs a location to be valid). It may
        // not be reachable without a place, which is fine — we still cancel out.
        capture("\(prefix)09-create-preview") {
            let preview = self.app.buttons["Preview event"]
            if preview.exists, preview.isEnabled {
                preview.tap()
                _ = self.app.staticTexts["Preview"].waitForExistence(timeout: 3)
            }
        }

        // Cancel out of the sheet (may be behind the preview push).
        let edit = app.buttons["Edit"]
        if edit.exists { edit.tap() }
        let cancel = app.buttons["Cancel"]
        if cancel.waitForExistence(timeout: 3) {
            cancel.tap()
        } else {
            // Fallback: swipe the sheet down.
            app.swipeDown()
        }
    }

    private func captureFirstChatThread(prefix: String) {
        // A thread row shows a title; tapping the first cell opens ChatThreadView.
        let firstCell = app.scrollViews.otherElements.buttons.firstMatch
        let anyLink = app.buttons.matching(NSPredicate(format: "isEnabled == true")).firstMatch
        // Prefer a cell inside the list; fall back to the first tappable button.
        let target = firstCell.exists ? firstCell : anyLink
        if target.exists {
            target.tap()
            capture("\(prefix)11-chat-thread")
            // Back out to the inbox.
            let back = app.navigationBars.buttons.firstMatch
            if back.exists { back.tap() }
        } else {
            log("No chat thread to open — capturing inbox empty state instead")
            capture("\(prefix)11-chat-empty")
        }
    }

    private func captureActivity(prefix: String) {
        let bell = app.buttons["Activity"]
        if bell.waitForExistence(timeout: 5) {
            bell.tap()
            _ = app.navigationBars["Activity"].waitForExistence(timeout: 5)
            capture("\(prefix)12-activity")
            let back = app.navigationBars.buttons.firstMatch
            if back.exists { back.tap() }
        } else {
            log("Activity bell not found")
        }
    }

    private func captureSettings(prefix: String) {
        let gear = app.buttons["Settings"]
        if gear.waitForExistence(timeout: 5) {
            gear.tap()
            _ = app.navigationBars["Settings"].waitForExistence(timeout: 5)
            capture("\(prefix)14-settings")
            let done = app.buttons["Done"]
            if done.exists { done.tap() }
        } else {
            log("Settings gear not found")
        }
    }

    private func openFirstEventFromHome(prefix: String) {
        // Event cards are NavigationLinks in the Home scroll view. Tap the first
        // enabled cell/button that isn't a tab or filter chip.
        let cards = app.scrollViews.firstMatch.buttons
        var tapped = false
        if cards.count > 0 {
            // Skip the filter chips (All/Friends/categories) — try cells lower down.
            let candidate = cards.element(boundBy: min(cards.count - 1, 3))
            if candidate.exists {
                candidate.tap()
                tapped = true
            }
        }
        if tapped, app.navigationBars.buttons.firstMatch.waitForExistence(timeout: 4) {
            capture("\(prefix)15-event-detail")
            let back = app.navigationBars.buttons.firstMatch
            if back.exists { back.tap() }
        } else {
            log("No event card to open — capturing home (possibly empty) instead")
            capture("\(prefix)15-event-detail-fallback")
        }
    }

    // MARK: - Tab navigation

    private func goToTab(_ name: String, prefix: String) {
        let tab = tabButton(name)
        if tab.waitForExistence(timeout: 5) {
            tab.tap()
        } else {
            log("Tab \(name) not found")
        }
        // Dismiss any system alert (push / dictation) if it fires mid-walkthrough.
        dismissSystemAlertIfPresent()
    }

    /// Resolve a tab-bar button, un-minimizing the Liquid Glass tab bar first if
    /// a prior scroll collapsed it (a swipe-down restores it), so the label is
    /// hittable.
    private func tabButton(_ name: String) -> XCUIElement {
        var button = app.tabBars.buttons[name]
        if !button.exists {
            app.swipeDown()
            button = app.tabBars.buttons[name]
        }
        return button
    }

    // MARK: - Helpers

    /// Attach a screenshot for the current screen state, running an optional
    /// action first. Any thrown error is caught and logged so the run continues.
    private func capture(_ name: String, _ action: (() -> Void)? = nil) {
        if let action {
            action()
        }
        // Small settle so animations finish before the shot.
        waitUntil(timeout: 0.6) { false }
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        log("captured \(name)")
    }

    private func log(_ message: String) {
        NSLog("[SmokeTests] \(message)")
    }

    /// Poll a condition up to `timeout`, returning early once true.
    @discardableResult
    private func waitUntil(timeout: TimeInterval, _ condition: () -> Bool) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if condition() { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.15))
        }
        return condition()
    }
}
