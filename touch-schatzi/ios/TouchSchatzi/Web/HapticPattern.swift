import Foundation

/// One vibration "pulse" of a pattern, in milliseconds.
struct HapticStep: Equatable {
    let start: Int
    let duration: Int
}

/// Parses the web layer's pattern format: a number or `[on, off, on, off, ...]` in milliseconds
/// (the same format the Android bridge and the Vibration API use). Pure logic so it can be unit-tested.
enum HapticPattern {
    static let maxEntries = 32
    static let maxTotalMs = 2000
    static let maxEntryMs = 1000

    /// Returns the pulses to play, or an empty array for invalid input.
    static func steps(from raw: Any?) -> [HapticStep] {
        var values: [Double] = []
        if let list = raw as? [Any] {
            values = list.compactMap { ($0 as? NSNumber)?.doubleValue }
            if values.count != list.count { return [] }
        } else if let single = (raw as? NSNumber)?.doubleValue {
            values = [single]
        }
        guard !values.isEmpty, values.count <= maxEntries else { return [] }

        var steps: [HapticStep] = []
        var clock = 0
        for (index, value) in values.enumerated() {
            guard value.isFinite else { return [] }
            let ms = min(maxEntryMs, max(1, Int(value.rounded())))
            if index % 2 == 0 { steps.append(HapticStep(start: clock, duration: ms)) }
            clock += ms
            if clock > maxTotalMs { break }
        }
        return steps.filter { $0.start < maxTotalMs }
    }

    /// Transient "tap" for short pulses, continuous buzz for long ones.
    static func isTransient(_ step: HapticStep) -> Bool { step.duration <= 30 }

    /// Perceived strength 0.35...1.0, growing with pulse length.
    static func intensity(for step: HapticStep) -> Float {
        min(1.0, 0.45 + Float(step.duration) / 120.0)
    }
}
