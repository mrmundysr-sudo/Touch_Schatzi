import XCTest
@testable import TouchSchatzi

final class HapticPatternTests: XCTestCase {
    func testSingleNumber() {
        XCTAssertEqual(HapticPattern.steps(from: NSNumber(value: 22)), [HapticStep(start: 0, duration: 22)])
    }

    func testOnOffPatternKeepsOnlyOnSegmentsAtCorrectTimes() {
        // [on 18, off 40, on 18] -> pulses at 0 and 58 ms
        let steps = HapticPattern.steps(from: [18, 40, 18] as [Any])
        XCTAssertEqual(steps, [HapticStep(start: 0, duration: 18), HapticStep(start: 58, duration: 18)])
    }

    func testBigPatternFromTheGame() {
        let steps = HapticPattern.steps(from: [30, 50, 30, 50, 80] as [Any])
        XCTAssertEqual(steps.map { $0.start }, [0, 80, 160])
        XCTAssertEqual(steps.map { $0.duration }, [30, 30, 80])
    }

    func testInvalidInputIsRejected() {
        XCTAssertTrue(HapticPattern.steps(from: nil).isEmpty)
        XCTAssertTrue(HapticPattern.steps(from: "boom").isEmpty)
        XCTAssertTrue(HapticPattern.steps(from: [10, "x"] as [Any]).isEmpty)
        XCTAssertTrue(HapticPattern.steps(from: [Any]()).isEmpty)
        XCTAssertTrue(HapticPattern.steps(from: Array(repeating: 5, count: 100) as [Any]).isEmpty)
        XCTAssertTrue(HapticPattern.steps(from: [Double.nan] as [Any]).isEmpty)
    }

    func testLengthsAreClamped() {
        XCTAssertEqual(HapticPattern.steps(from: NSNumber(value: 999_999)).first?.duration, HapticPattern.maxEntryMs)
        XCTAssertEqual(HapticPattern.steps(from: NSNumber(value: -5)).first?.duration, 1)
    }

    func testTransientVersusContinuousAndIntensity() {
        XCTAssertTrue(HapticPattern.isTransient(HapticStep(start: 0, duration: 22)))
        XCTAssertFalse(HapticPattern.isTransient(HapticStep(start: 0, duration: 80)))
        XCTAssertLessThanOrEqual(HapticPattern.intensity(for: HapticStep(start: 0, duration: 1000)), 1.0)
        XCTAssertGreaterThan(HapticPattern.intensity(for: HapticStep(start: 0, duration: 1)), 0.3)
    }
}
