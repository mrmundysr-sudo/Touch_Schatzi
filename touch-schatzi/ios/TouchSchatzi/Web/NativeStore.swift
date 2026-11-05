import Foundation

/// Native copy of the game's `localStorage` entries (settings, best score, ...).
///
/// iOS can purge a web view's `localStorage` under storage pressure, which would silently reset a
/// player's name, options and best score. Every `ts.*` key written by the game is mirrored here
/// (UserDefaults) and restored into `localStorage` at document start if it has gone missing.
final class NativeStore {
    static let keyPrefix = "ts."
    static let maxValueBytes = 64 * 1024
    static let maxEntries = 64

    private let defaults: UserDefaults
    private let defaultsKey = "localStorageMirror.v1"
    private(set) var values: [String: String]

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.values = (defaults.dictionary(forKey: defaultsKey) as? [String: String]) ?? [:]
    }

    static func isValid(key: String, value: String? = nil) -> Bool {
        guard key.hasPrefix(keyPrefix), key.utf8.count <= 64 else { return false }
        if let value = value, value.utf8.count > maxValueBytes { return false }
        return true
    }

    @discardableResult
    func set(_ key: String, _ value: String) -> Bool {
        guard Self.isValid(key: key, value: value) else { return false }
        guard values[key] != nil || values.count < Self.maxEntries else { return false }
        values[key] = value
        persist()
        return true
    }

    func remove(_ key: String) {
        guard Self.isValid(key: key) else { return }
        values.removeValue(forKey: key)
        persist()
    }

    func removeAll() {
        values.removeAll()
        persist()
    }

    /// JSON object text, safe to embed in a JavaScript source string.
    func snapshotJSON() -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: values, options: [.sortedKeys]),
              let text = String(data: data, encoding: .utf8) else { return "{}" }
        // U+2028/2029 are valid in modern JS string literals, but escape them anyway for older engines.
        return text.replacingOccurrences(of: "\u{2028}", with: "\\u2028").replacingOccurrences(of: "\u{2029}", with: "\\u2029")
    }

    private func persist() { defaults.set(values, forKey: defaultsKey) }
}
