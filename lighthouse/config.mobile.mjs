/**
 * Perfil MOBILE da auditoria (versionado).
 *
 * Equivale ao padrão do Lighthouse 13 para mobile, declarado explicitamente para que a medição seja
 * reproduzível mesmo se os padrões da ferramenta mudarem:
 *  - emulação Moto G Power (412 × 823, DPR 1,75);
 *  - throttling simulado (Lantern): 4G lento — RTT 150 ms, 1,6 Mbps — e CPU 4× mais lenta.
 */
export default {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: 'mobile',
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.56,
      uploadThroughputKbps: 675,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
    emulatedUserAgent:
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36',
    maxWaitForLoad: 45_000,
  },
}
