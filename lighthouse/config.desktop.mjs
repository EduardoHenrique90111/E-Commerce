/**
 * Perfil DESKTOP da auditoria (versionado).
 *
 * Equivale ao `desktop-config` do Lighthouse 13, declarado explicitamente:
 *  - janela 1350 × 940, DPR 1;
 *  - throttling simulado (Lantern): RTT 40 ms, 10 Mbps, sem desaceleração de CPU.
 */
export default {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'desktop',
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10 * 1024,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    emulatedUserAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    maxWaitForLoad: 45_000,
  },
}
