// Haptics through whichever native bridge is present:
//   - iOS:     window.webkit.messageHandlers.haptics (CoreHaptics / UIKit feedback, see ios/)
//   - Android: window.AndroidBridge.vibrate (Vibrator)
//   - Browser: the Vibration API
// Silent no-op anywhere else. `pattern` is a number (ms) or [on, off, on, ...] in ms.
let enabled = true;
const iosHandler = () => { try { return window.webkit?.messageHandlers?.haptics || null; } catch { return null; } };
const hasIOS = () => !!iosHandler();
const hasAndroid = () => !!(window.AndroidBridge && window.AndroidBridge.vibrate);

export const Haptics = {
  setEnabled(v) { enabled = !!v; },
  /** True when this device can plausibly give feedback (used to decide whether to show the toggle). */
  supported() {
    if (hasIOS()) return window.__TS_NATIVE ? window.__TS_NATIVE.haptics !== false : true;
    return hasAndroid() || (typeof navigator !== 'undefined' && !!navigator.vibrate);
  },
  pulse(pattern = 12) {
    if (!enabled) return;
    try {
      const p = Array.isArray(pattern) ? pattern : [pattern];
      const ios = iosHandler();
      if (ios) ios.postMessage({ pattern: p });
      else if (hasAndroid()) window.AndroidBridge.vibrate(JSON.stringify(p));
      else if (navigator.vibrate) navigator.vibrate(pattern);
    } catch { /* ignore */ }
  },
  tap() { this.pulse(8); }, thud() { this.pulse(22); }, success() { this.pulse([18, 40, 18]); }, big() { this.pulse([30, 50, 30, 50, 80]); },
};
