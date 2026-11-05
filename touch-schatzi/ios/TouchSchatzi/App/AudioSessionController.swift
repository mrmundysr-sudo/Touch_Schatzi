import AVFoundation

/// Keeps the shared audio session sensible for a casual game:
/// `.ambient` follows the silent switch, mixes with the player's own music/podcasts and never
/// interrupts other apps. The web audio engine (Web Audio API) renders through this session.
final class AudioSessionController: NSObject {
    static let shared = AudioSessionController()
    private override init() { super.init() }

    /// Called with `true` when an interruption (phone call, Siri, alarm) starts and `false` when it ends.
    var onInterruption: ((Bool) -> Void)?
    private var observing = false

    func configure() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.ambient, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            NSLog("TouchSchatzi: audio session setup failed: \(error.localizedDescription)")
        }
        guard !observing else { return }
        observing = true
        NotificationCenter.default.addObserver(self, selector: #selector(interruption(_:)),
                                               name: AVAudioSession.interruptionNotification, object: session)
    }

    func reactivate() {
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    @objc private func interruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
            onInterruption?(true)
        case .ended:
            reactivate()
            onInterruption?(false)
        @unknown default:
            break
        }
    }
}
