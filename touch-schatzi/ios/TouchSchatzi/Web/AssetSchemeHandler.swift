import Foundation
import WebKit

/// Serves the bundled web game (`www/` inside the app) to the web view through a private URL scheme,
/// `touchschatzi://localhost/...`. A real origin (instead of `file://`) is what lets ES modules and
/// `fetch()` work offline, mirroring the virtual https origin the Android app uses.
final class AssetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "touchschatzi"
    static let host = "localhost"
    static var indexURL: URL { URL(string: "\(scheme)://\(host)/index.html")! }

    static func isAppURL(_ url: URL) -> Bool {
        url.scheme?.lowercased() == scheme && url.host?.lowercased() == host
    }

    private let root: URL

    /// - Parameter root: folder to serve; defaults to the app bundle's `www` folder.
    init(root: URL? = nil) {
        if let custom = root {
            self.root = custom.standardizedFileURL
        } else {
            let resources = Bundle.main.resourceURL ?? URL(fileURLWithPath: "/")
            self.root = resources.appendingPathComponent("www", isDirectory: true).standardizedFileURL
        }
        super.init()
    }

    // MARK: Pure helpers (unit-tested)

    /// Maps a URL path to a file inside `root`. Returns nil for anything that would escape it.
    static func resolve(urlPath: String, root: URL) -> URL? {
        var path = urlPath
        if path.isEmpty || path == "/" { path = "/index.html" }
        let parts = path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        if parts.isEmpty || parts.contains("..") || parts.contains(".") || parts.contains(where: { $0.contains("\0") || $0.contains("\\") }) {
            return nil
        }
        var url = root
        for part in parts { url.appendPathComponent(part) }
        url = url.standardizedFileURL
        let rootPath = root.standardizedFileURL.path.hasSuffix("/") ? root.standardizedFileURL.path : root.standardizedFileURL.path + "/"
        guard url.path.hasPrefix(rootPath) else { return nil }
        return url
    }

    static func mimeType(forExtension ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "application/javascript"
        case "css": return "text/css"
        case "json", "map": return "application/json"
        case "webp": return "image/webp"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "ogg": return "audio/ogg"
        case "mp3": return "audio/mpeg"
        case "m4a": return "audio/mp4"
        case "wav": return "audio/wav"
        case "txt": return "text/plain"
        default: return "application/octet-stream"
        }
    }

    static func isTextual(mime: String) -> Bool {
        mime.hasPrefix("text/") || mime == "application/javascript" || mime == "application/json" || mime == "image/svg+xml"
    }

    // MARK: WKURLSchemeHandler

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let request = urlSchemeTask.request
        guard let url = request.url, Self.isAppURL(url) else {
            return fail(urlSchemeTask, code: NSURLErrorBadURL)
        }
        guard let file = Self.resolve(urlPath: url.path, root: root),
              let data = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            return respond(urlSchemeTask, url: url, status: 404, mime: "text/plain", body: Data("Not Found".utf8))
        }
        respond(urlSchemeTask, url: url, status: 200, mime: Self.mimeType(forExtension: file.pathExtension),
                body: request.httpMethod == "HEAD" ? Data() : data, contentLength: data.count)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Requests are answered synchronously inside `start`, so there is nothing left to cancel.
    }

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, mime: String, body: Data, contentLength: Int? = nil) {
        let type = Self.isTextual(mime: mime) ? mime + "; charset=utf-8" : mime
        let headers = [
            "Content-Type": type,
            "Content-Length": String(contentLength ?? body.count),
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            return fail(task, code: NSURLErrorUnknown)
        }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }

    private func fail(_ task: WKURLSchemeTask, code: Int) {
        task.didFailWithError(NSError(domain: NSURLErrorDomain, code: code))
    }
}
