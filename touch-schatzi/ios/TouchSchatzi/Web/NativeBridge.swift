import Foundation
import WebKit

/// Messages the web layer can send to the app, and the script that wires them up.
///
/// JavaScript side (all optional, silently ignored in a plain browser / on Android):
///   - `webkit.messageHandlers.haptics.postMessage({ pattern: [ms, ...] })`
///   - `webkit.messageHandlers.nativeStore.postMessage({ op: 'set'|'remove'|'clear', k, v })`
///   - `webkit.messageHandlers.appState.postMessage({ type: 'ready' | 'error', message })`
enum NativeBridge {
    static let hapticsHandler = "haptics"
    static let storeHandler = "nativeStore"
    static let appStateHandler = "appState"

    /// Injected at document start, before the game's own scripts run.
    static func bootstrapScript(snapshotJSON: String, hapticsSupported: Bool) -> WKUserScript {
        let source = """
        (function () {
          try {
            window.__TS_NATIVE = { platform: 'ios', haptics: \(hapticsSupported ? "true" : "false") };
            var ls = window.localStorage;
            var snap = \(snapshotJSON);
            for (var k in snap) { if (Object.prototype.hasOwnProperty.call(snap, k) && ls.getItem(k) === null) ls.setItem(k, snap[k]); }
            var post = function (m) { try { window.webkit.messageHandlers.\(storeHandler).postMessage(m); } catch (e) {} };
            var proto = Storage.prototype, set = proto.setItem, del = proto.removeItem, clr = proto.clear;
            proto.setItem = function (k, v) { set.call(this, k, v); if (this === ls) post({ op: 'set', k: String(k), v: String(v) }); };
            proto.removeItem = function (k) { del.call(this, k); if (this === ls) post({ op: 'remove', k: String(k) }); };
            proto.clear = function () { clr.call(this); if (this === ls) post({ op: 'clear' }); };
          } catch (e) {}
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    /// Applies a `nativeStore` message to the store. Returns false for malformed input.
    @discardableResult
    static func handleStore(_ body: Any, store: NativeStore) -> Bool {
        guard let dict = body as? [String: Any], let op = dict["op"] as? String else { return false }
        switch op {
        case "set":
            guard let k = dict["k"] as? String, let v = dict["v"] as? String else { return false }
            return store.set(k, v)
        case "remove":
            guard let k = dict["k"] as? String else { return false }
            store.remove(k)
            return true
        case "clear":
            store.removeAll()
            return true
        default:
            return false
        }
    }
}

/// `WKUserContentController` retains its handlers strongly; this proxy avoids a retain cycle with the view controller.
final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) {
        self.target = target
        super.init()
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
