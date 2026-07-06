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

    // Sign in as the seeded demo host "Maya Chen" (Supabase test OTP, see
    // docs/demo-data.md). Maya hosts several events and owns the ramen event
    // group chat, so the Inbox / chat / profile screens render with live data
    // instead of empty states — unlike the reserved +11111111111 UI-test
    // account, which has no chats or hosted events. Typing 10 digits + the UI's
    // +1 prefix normalizes to +18005550123; OTP 789012 auto-verifies on the 6th
    // digit. Maya already has a display name/handle, so first-run profile setup
    // is skipped.
    private let testPhoneDigits = "8005550123"
    private let testOTP = "789012"

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
            // Let the scroll settle so the shot isn't caught mid-animation with
            // the header overlapping the status bar.
            self.waitUntil(timeout: 0.8) { false }
        }

        goToTab("Explore", prefix: prefix)
        // Let the default sections (contacts prompt + friend suggestions) load
        // so the shot isn't the skeleton placeholder state.
        _ = app.staticTexts["Find friends"].waitForExistence(timeout: 8)
        waitUntil(timeout: 1.0) { false }
        capture("\(prefix)05-explore")

        // NOTE: we deliberately do NOT drive the searchable field here. Typing
        // into Explore search triggers the contacts-sync flow (a springboard
        // "would like to access your Contacts" system alert) and iOS 26's
        // searchable dismiss control isn't a plain "Cancel" button, so the
        // keyboard would stay up and swallow every subsequent tab tap — which
        // corrupted the Create / Inbox / Profile / event-detail shots. A clean
        // Explore capture is a better store asset than a keyboard-up search.

        // Invoke Create from a clean Home tab.
        goToTab("Home", prefix: prefix)
        captureCreateSheet(prefix: prefix)

        goToTab("Inbox", prefix: prefix)
        // Maya's seeded conversations are event threads (the ramen run), which
        // live under the "Events" segment. Select it so the inbox shows a real
        // thread row instead of the Direct tab's empty state.
        selectInboxEventsTab()
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

    /// Select the "Events" segment of the inbox filter so seeded event threads
    /// (the ramen group chat) are listed. The control is a segmented Picker.
    private func selectInboxEventsTab() {
        let events = app.buttons["Events"]
        if events.waitForExistence(timeout: 5), events.isHittable {
            events.tap()
        } else if app.segmentedControls.buttons["Events"].exists {
            app.segmentedControls.buttons["Events"].tap()
        }
        // Let the (already-loaded) list re-filter.
        waitUntil(timeout: 0.6) { false }
    }

    private func captureFirstChatThread(prefix: String) {
        // Thread rows are NavigationLinks inside the inbox list. Only tap a real
        // row (a cell/button inside the scroll view) — a loose "first enabled
        // button" fallback used to tap the tab bar and capture the wrong screen
        // when the inbox was empty. Match a row by its seeded thread title.
        let ramenRow = app.buttons.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "ramen")
        ).firstMatch
        let firstCell = app.scrollViews.otherElements.buttons.firstMatch
        let target: XCUIElement = ramenRow.waitForExistence(timeout: 4)
            ? ramenRow
            : firstCell
        if target.exists {
            target.tap()
            // Confirm we actually pushed a chat (a nav bar back button appears)
            // before capturing, so we never shoot the inbox list by mistake.
            if app.navigationBars.buttons.firstMatch.waitForExistence(timeout: 4) {
                // Wait for the message bubbles to load — the thread opens on a
                // spinner and the bodies arrive async. Poll for a seeded bubble
                // (the ramen thread's last line) so we don't capture the empty
                // loading state.
                let bubble = app.staticTexts.matching(
                    NSPredicate(format: "label CONTAINS[c] %@", "grab us a table")
                ).firstMatch
                if !bubble.waitForExistence(timeout: 6) {
                    // Fallback: any non-trivial text bubble beyond the nav title.
                    waitUntil(timeout: 3) { self.app.staticTexts.count > 4 }
                }
                waitUntil(timeout: 0.6) { false }
                capture("\(prefix)11-chat-thread")
                let back = app.navigationBars.buttons.firstMatch
                if back.exists { back.tap() }
                return
            }
        }
        log("No chat thread to open — capturing inbox instead")
        capture("\(prefix)11-chat-empty")
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
        // Event cards are NavigationLinks whose accessibilityLabel starts with
        // the event title (e.g. "Dinner at Wilbur, …"). Match a card by its
        // title prefix rather than a positional index — index-based taps hit the
        // All/Friends/category filter chips instead of a real card.
        var tapped = false
        // Match a card by any of the seeded event titles (demo-data.md). The
        // live feed also carries a few extra events; whichever renders first
        // gives a clean detail shot.
        let titles = ["Finals grind", "Late night ramen", "Sunrise Dish",
                      "Movie night", "Pickup basketball", "Dinner at Wilbur"]
        let predicate = NSPredicate(
            format: "label MATCHES[c] %@",
            "(" + titles.map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "|") + ").*"
        )
        let byTitle = app.buttons.matching(predicate).firstMatch
        if byTitle.waitForExistence(timeout: 5) {
            byTitle.tap()
            tapped = true
        } else {
            // Fallback: any card-shaped button below the filter chips.
            let cards = app.scrollViews.firstMatch.buttons
            let candidate = cards.element(boundBy: min(cards.count - 1, 4))
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
