import UIKit
import WebKit

/// Full-screen host for the Touch Schatzi web game.
///
/// The game itself (rules, AI, art, audio, UI) is the same `www/` bundle the Android app ships; this
/// controller adds the native pieces iPhone and iPad need: an offline URL-scheme origin, safe-area aware
/// full-screen layout, haptics, persistent storage, pause-on-background, audio-session handling,
/// keyboard resizing and a branded error/retry screen.
final class GameViewController: UIViewController {
    private static let bootTimeout: TimeInterval = 15
    private static let maxAutoReloads = 3

    private var webView: WKWebView!
    private let launchView = UIView()
    private var errorView: LoadErrorView?
    private var webBottom: NSLayoutConstraint!

    private let store = NativeStore()
    private let haptics = HapticsEngine()
    private var isReady = false
    private var autoReloads = 0
    private var watchdog: DispatchWorkItem?
    private var observers: [NSObjectProtocol] = []

    // MARK: Lifecycle

    override func loadView() {
        let root = UIView()
        root.backgroundColor = Theme.background
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .dark
        buildWebView()
        buildLaunchOverlay()
        observeSystemEvents()
        loadGame()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIApplication.shared.isIdleTimerDisabled = true // keep the screen awake while playing, like Android
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        watchdog?.cancel()
    }

    // MARK: Appearance and orientation

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    /// The score card slides up from the bottom edge; deferring the home gesture keeps that drag from leaving the app.
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }
    override var shouldAutorotate: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        UIDevice.current.userInterfaceIdiom == .pad ? .all : .allButUpsideDown
    }

    // MARK: Setup

    private func buildWebView() {
        let content = WKUserContentController()
        content.addUserScript(NativeBridge.bootstrapScript(snapshotJSON: store.snapshotJSON(), hapticsSupported: haptics.isSupported))
        let proxy = WeakScriptMessageHandler(self)
        [NativeBridge.hapticsHandler, NativeBridge.storeHandler, NativeBridge.appStateHandler].forEach {
            content.add(proxy, name: $0)
        }

        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.setURLSchemeHandler(AssetSchemeHandler(), forURLScheme: AssetSchemeHandler.scheme)
        config.mediaTypesRequiringUserActionForPlayback = [] // lets music start on the splash screen
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.applicationNameForUserAgent = "TouchSchatzi-iOS"

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = Theme.background
        web.underPageBackgroundColor = Theme.background
        web.scrollView.backgroundColor = Theme.background
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        web.alpha = 0
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif

        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        webBottom = web.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.topAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webBottom,
        ])
        webView = web
    }

    /// Same purple + logo as the system launch screen, so launching feels like one continuous screen.
    private func buildLaunchOverlay() {
        launchView.backgroundColor = Theme.background
        launchView.translatesAutoresizingMaskIntoConstraints = false
        launchView.isUserInteractionEnabled = false
        launchView.isAccessibilityElement = true
        launchView.accessibilityLabel = "Touch Schatzi, loading"
        view.addSubview(launchView)
        NSLayoutConstraint.activate([
            launchView.topAnchor.constraint(equalTo: view.topAnchor),
            launchView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            launchView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            launchView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        if let logo = UIImage(named: "LaunchLogo") {
            let imageView = UIImageView(image: logo)
            imageView.translatesAutoresizingMaskIntoConstraints = false
            launchView.addSubview(imageView)
            NSLayoutConstraint.activate([
                imageView.centerXAnchor.constraint(equalTo: launchView.centerXAnchor),
                imageView.centerYAnchor.constraint(equalTo: launchView.centerYAnchor),
            ])
        }
    }

    private func observeSystemEvents() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.setGamePaused(true)
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            AudioSessionController.shared.reactivate()
            self?.setGamePaused(false)
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main) { [weak self] note in
            self?.adjustForKeyboard(note)
        })
        observers.append(center.addObserver(forName: UIResponder.keyboardWillHideNotification, object: nil, queue: .main) { [weak self] note in
            self?.adjustForKeyboard(note, hiding: true)
        })
        AudioSessionController.shared.onInterruption = { [weak self] began in self?.setGamePaused(began) }
    }

    // MARK: Loading and error handling

    private func loadGame() {
        isReady = false
        webView.alpha = 0
        launchView.alpha = 1
        webView.load(URLRequest(url: startURL(), cachePolicy: .reloadIgnoringLocalCacheData))
        armWatchdog()
    }

    private func startURL() -> URL {
        #if DEBUG
        // Debug builds only: `-TSStartQuery "screen=play&opp=lily,max"` opens a specific screen (used by CI screenshots).
        if let query = UserDefaults.standard.string(forKey: "TSStartQuery"), !query.isEmpty,
           let url = URL(string: AssetSchemeHandler.indexURL.absoluteString + "?" + query) {
            return url
        }
        #endif
        return AssetSchemeHandler.indexURL
    }

    private func armWatchdog() {
        watchdog?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self = self, !self.isReady else { return }
            self.showError()
        }
        watchdog = item
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.bootTimeout, execute: item)
    }

    private func gameDidBecomeReady() {
        isReady = true
        autoReloads = 0
        watchdog?.cancel()
        UIView.animate(withDuration: 0.3, delay: 0, options: [.curveEaseOut, .allowUserInteraction]) {
            self.webView.alpha = 1
            self.launchView.alpha = 0
        }
    }

    private func showError() {
        watchdog?.cancel()
        guard errorView == nil else { return }
        let overlay = LoadErrorView(frame: view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        overlay.alpha = 0
        overlay.onRetry = { [weak self] in self?.retry() }
        view.addSubview(overlay)
        errorView = overlay
        UIView.animate(withDuration: 0.2) { overlay.alpha = 1 }
        UIAccessibility.post(notification: .screenChanged, argument: overlay)
    }

    private func retry() {
        errorView?.removeFromSuperview()
        errorView = nil
        autoReloads = 0
        loadGame()
    }

    // MARK: Native -> web

    private func setGamePaused(_ paused: Bool) {
        guard isViewLoaded, isReady else { return }
        webView.evaluateJavaScript("window.TS&&TS.setPaused&&TS.setPaused(\(paused ? "true" : "false"))", completionHandler: nil)
    }

    /// Resizes the web view above the on-screen keyboard (like Android's `adjustResize`), so the name field stays visible.
    private func adjustForKeyboard(_ note: Notification, hiding: Bool = false) {
        guard let info = note.userInfo, isViewLoaded else { return }
        var overlap: CGFloat = 0
        if !hiding, let frame = (info[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue {
            overlap = max(0, view.bounds.maxY - view.convert(frame, from: nil).minY)
        }
        let duration = (info[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
        webBottom.constant = -overlap
        UIView.animate(withDuration: duration) {
            self.view.layoutIfNeeded()
        } completion: { _ in
            if overlap == 0 { self.webView.scrollView.setContentOffset(.zero, animated: false) }
        }
    }
}

// MARK: - WKScriptMessageHandler

extension GameViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Only our own bundled pages may talk to the app.
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, AssetSchemeHandler.isAppURL(url) else { return }
        switch message.name {
        case NativeBridge.hapticsHandler:
            guard UIApplication.shared.applicationState == .active, let body = message.body as? [String: Any] else { return }
            haptics.play(rawPattern: body["pattern"])
        case NativeBridge.storeHandler:
            NativeBridge.handleStore(message.body, store: store)
        case NativeBridge.appStateHandler:
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            if type == "ready" { gameDidBecomeReady() } else if type == "error" { showError() }
        default:
            break
        }
    }
}

// MARK: - WKNavigationDelegate / WKUIDelegate

extension GameViewController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // The game is fully offline and has no external links: never navigate away from the bundled app.
        if let url = navigationAction.request.url, AssetSchemeHandler.isAppURL(url) || url.absoluteString == "about:blank" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        reportNavigationFailure(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        reportNavigationFailure(error)
    }

    /// A navigation that was merely superseded (e.g. a reload during recovery) is not a failure.
    private func reportNavigationFailure(_ error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        showError()
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // iOS reclaimed the web process (memory pressure). Reload quietly a few times before giving up.
        autoReloads += 1
        if autoReloads > Self.maxAutoReloads { showError() } else { loadGame() }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        nil // no pop-ups
    }
}
