import UIKit
import CoreHaptics

/// Plays the web layer's vibration patterns with Core Haptics (iPhone 8 and later), falling back to
/// UIKit feedback generators. iPads have no Taptic Engine, so `isSupported` is false there and the
/// web UI hides its Haptics toggle.
final class HapticsEngine {
    let isSupported: Bool
    private var engine: CHHapticEngine?
    private let queue = DispatchQueue(label: "com.touchschatzi.haptics", qos: .userInteractive)

    init() {
        isSupported = UIDevice.current.userInterfaceIdiom == .phone
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        queue.async { [weak self] in self?.prepareEngine() }
    }

    private func prepareEngine() {
        do {
            let engine = try CHHapticEngine()
            engine.isAutoShutdownEnabled = true
            engine.resetHandler = { [weak self] in
                self?.queue.async { try? self?.engine?.start() }
            }
            engine.stoppedHandler = { _ in }
            try engine.start()
            self.engine = engine
        } catch {
            engine = nil
        }
    }

    /// Plays a pattern received from JavaScript. Safe to call from any thread.
    func play(rawPattern: Any?) {
        let steps = HapticPattern.steps(from: rawPattern)
        guard !steps.isEmpty, isSupported else { return }
        queue.async { [weak self] in self?.play(steps) }
    }

    private func play(_ steps: [HapticStep]) {
        if let engine = engine, let pattern = makePattern(steps) {
            do {
                try engine.start()
                let player = try engine.makePlayer(with: pattern)
                try player.start(atTime: CHHapticTimeImmediate)
                return
            } catch {
                // fall through to the UIKit fallback
            }
        }
        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: steps.contains(where: { !HapticPattern.isTransient($0) }) ? .medium : .light)
            generator.impactOccurred()
        }
    }

    private func makePattern(_ steps: [HapticStep]) -> CHHapticPattern? {
        let events: [CHHapticEvent] = steps.map { step in
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: HapticPattern.intensity(for: step))
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.55)
            let time = TimeInterval(step.start) / 1000
            if HapticPattern.isTransient(step) {
                return CHHapticEvent(eventType: .hapticTransient, parameters: [intensity, sharpness], relativeTime: time)
            }
            return CHHapticEvent(eventType: .hapticContinuous, parameters: [intensity, sharpness],
                                 relativeTime: time, duration: TimeInterval(step.duration) / 1000)
        }
        return try? CHHapticPattern(events: events, parameters: [])
    }
}
