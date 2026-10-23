// Haptics via the Android bridge when present, else the Vibration API. Silent no-op elsewhere.
let enabled = true;
export const Haptics = {
  setEnabled(v) { enabled = !!v; },
  pulse(pattern = 12) {
    if (!enabled) return;
    try {
      if (window.AndroidBridge && window.AndroidBridge.vibrate) {
        const p = Array.isArray(pattern) ? pattern : [pattern];
        window.AndroidBridge.vibrate(JSON.stringify(p));
      } else if (navigator.vibrate) navigator.vibrate(pattern);
    } catch { /* ignore */ }
  },
  tap() { this.pulse(8); }, thud() { this.pulse(22); }, success() { this.pulse([18, 40, 18]); }, big() { this.pulse([30, 50, 30, 50, 80]); },
};
