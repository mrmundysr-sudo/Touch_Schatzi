import UIKit

/// Brand colours shared with the web UI (see www/css/main.css).
enum Theme {
    /// Deep purple used by the Android splash, theme colour and launch background (#2A0F4D).
    static let background = UIColor(red: 0x2A / 255, green: 0x0F / 255, blue: 0x4D / 255, alpha: 1)
    /// Gold accent (#FFD24A).
    static let gold = UIColor(red: 0xFF / 255, green: 0xD2 / 255, blue: 0x4A / 255, alpha: 1)
    /// Dark brown text colour used on gold buttons (#5A2C00).
    static let brown = UIColor(red: 0x5A / 255, green: 0x2C / 255, blue: 0x00 / 255, alpha: 1)
    static let cream = UIColor(red: 0xFF / 255, green: 0xF3 / 255, blue: 0xDC / 255, alpha: 1)
}

/// User-facing native strings (everything else lives in the shared web UI).
enum Strings {
    static let errorTitle = "Touch Schatzi couldn't start"
    static let errorBody = "Something went wrong while loading the game. Your scores and settings are safe."
    static let retry = "Try Again"
}
