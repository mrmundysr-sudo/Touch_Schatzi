import XCTest
@testable import TouchSchatzi

final class AssetSchemeHandlerTests: XCTestCase {
    private let root = URL(fileURLWithPath: "/tmp/www", isDirectory: true)

    func testRootAndEmptyPathsServeIndex() {
        XCTAssertEqual(AssetSchemeHandler.resolve(urlPath: "/", root: root)?.path, "/tmp/www/index.html")
        XCTAssertEqual(AssetSchemeHandler.resolve(urlPath: "", root: root)?.path, "/tmp/www/index.html")
    }

    func testNestedAssetsResolveInsideRoot() {
        XCTAssertEqual(AssetSchemeHandler.resolve(urlPath: "/js/game/Game.js", root: root)?.path, "/tmp/www/js/game/Game.js")
        XCTAssertEqual(AssetSchemeHandler.resolve(urlPath: "/assets/bg/menu.webp", root: root)?.path, "/tmp/www/assets/bg/menu.webp")
    }

    func testTraversalIsRejected() {
        XCTAssertNil(AssetSchemeHandler.resolve(urlPath: "/../secret.txt", root: root))
        XCTAssertNil(AssetSchemeHandler.resolve(urlPath: "/js/../../secret.txt", root: root))
        XCTAssertNil(AssetSchemeHandler.resolve(urlPath: "/a\\b", root: root))
    }

    func testMimeTypes() {
        XCTAssertEqual(AssetSchemeHandler.mimeType(forExtension: "js"), "application/javascript")
        XCTAssertEqual(AssetSchemeHandler.mimeType(forExtension: "MJS"), "application/javascript")
        XCTAssertEqual(AssetSchemeHandler.mimeType(forExtension: "webp"), "image/webp")
        XCTAssertEqual(AssetSchemeHandler.mimeType(forExtension: "json"), "application/json")
        XCTAssertEqual(AssetSchemeHandler.mimeType(forExtension: "xyz"), "application/octet-stream")
        XCTAssertTrue(AssetSchemeHandler.isTextual(mime: "text/css"))
        XCTAssertFalse(AssetSchemeHandler.isTextual(mime: "image/webp"))
    }

    func testAppURLRecognition() {
        XCTAssertTrue(AssetSchemeHandler.isAppURL(AssetSchemeHandler.indexURL))
        XCTAssertFalse(AssetSchemeHandler.isAppURL(URL(string: "https://example.com/index.html")!))
        XCTAssertFalse(AssetSchemeHandler.isAppURL(URL(string: "touchschatzi://evil.example/index.html")!))
    }

    /// The real bundled game must be present in the app: index.html, the entry module and the config files.
    func testBundledGameIsPackaged() throws {
        let www = try XCTUnwrap(Bundle(for: AssetSchemeHandler.self).resourceURL?.appendingPathComponent("www"))
        for rel in ["index.html", "js/main.js", "config/game.json", "assets/manifest.json", "assets/bg/splash.webp", "assets/chars/cat.webp"] {
            let file = try XCTUnwrap(AssetSchemeHandler.resolve(urlPath: "/" + rel, root: www), rel)
            XCTAssertTrue(FileManager.default.fileExists(atPath: file.path), "missing bundled file: \(rel)")
        }
    }
}
