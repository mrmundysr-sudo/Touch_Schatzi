import XCTest
@testable import TouchSchatzi

final class NativeStoreTests: XCTestCase {
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "TouchSchatziTests.\(UUID().uuidString)")
    }

    func testSetPersistsAcrossInstances() {
        let a = NativeStore(defaults: defaults)
        XCTAssertTrue(a.set("ts.best", "230"))
        XCTAssertEqual(NativeStore(defaults: defaults).values["ts.best"], "230")
    }

    func testOnlyGameKeysAreAccepted() {
        let store = NativeStore(defaults: defaults)
        XCTAssertFalse(store.set("other.key", "x"))
        XCTAssertFalse(store.set("ts.big", String(repeating: "a", count: NativeStore.maxValueBytes + 1)))
        XCTAssertTrue(store.values.isEmpty)
    }

    func testRemoveAndClear() {
        let store = NativeStore(defaults: defaults)
        store.set("ts.a", "1"); store.set("ts.b", "2")
        store.remove("ts.a")
        XCTAssertEqual(store.values, ["ts.b": "2"])
        store.removeAll()
        XCTAssertTrue(NativeStore(defaults: defaults).values.isEmpty)
    }

    func testSnapshotIsValidJSON() throws {
        let store = NativeStore(defaults: defaults)
        store.set("ts.settings", "{\"name\":\"Zoë \\\"Z\\\"\",\"music\":true}")
        let object = try JSONSerialization.jsonObject(with: Data(store.snapshotJSON().utf8)) as? [String: String]
        XCTAssertEqual(object?["ts.settings"], "{\"name\":\"Zoë \\\"Z\\\"\",\"music\":true}")
    }

    func testBridgeMessages() {
        let store = NativeStore(defaults: defaults)
        XCTAssertTrue(NativeBridge.handleStore(["op": "set", "k": "ts.best", "v": "10"], store: store))
        XCTAssertEqual(store.values["ts.best"], "10")
        XCTAssertTrue(NativeBridge.handleStore(["op": "remove", "k": "ts.best"], store: store))
        XCTAssertNil(store.values["ts.best"])
        XCTAssertFalse(NativeBridge.handleStore(["op": "set", "k": "ts.best"], store: store))
        XCTAssertFalse(NativeBridge.handleStore("junk", store: store))
        XCTAssertFalse(NativeBridge.handleStore(["op": "explode"], store: store))
    }
}
