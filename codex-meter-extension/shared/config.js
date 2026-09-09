(function () {
  "use strict";

  const CONFIG = {
    USD_PER_CREDIT: 40 / 1000,
    LOOKBACK_DAYS: 45,
    MAX_SNAPSHOTS: 180,
    // ChatGPT credit-equivalent rates per 1M tokens. Spark is intentionally
    // omitted because OpenAI does not publish a token rate for its separate
    // research-preview allowance.
    TOKEN_CREDIT_RATES: {
      "gpt-6-astra": { uncachedInput: 250, cachedInput: 25, output: 1250 },
      "gpt-5.6-sol": { uncachedInput: 100, cachedInput: 10, output: 500 },
      "gpt-5.6-terra": { uncachedInput: 50, cachedInput: 5, output: 300 },
      "gpt-5.6-luna": { uncachedInput: 5, cachedInput: 0.5, output: 30 },
      "gpt-5.5": { uncachedInput: 125, cachedInput: 12.5, output: 750 },
      "gpt-5.4": { uncachedInput: 62.5, cachedInput: 6.25, output: 375 },
      "gpt-5.4-mini": { uncachedInput: 18.75, cachedInput: 1.875, output: 113 },
    },
    TOKEN_RATE_CARD_DATE: "2026-09-09",
    TOKEN_RATE_CARD_URL: "https://learn.chatgpt.com/docs/pricing",
    STORAGE_LATEST: "codexQuotaCompassLatest",
    STORAGE_SNAPSHOTS: "codexQuotaCompassSnapshots",
    STORAGE_SETTINGS: "codexMeterSettings",
  };

  const DEFAULT_SETTINGS = {
    showPageButton: true,
    showChartControls: true,
    defaultChartMode: "source",
  };

  const IDS = {
    button: "codex-quota-compass-button",
    overlay: "codex-meter-dialog-overlay",
    panel: "codex-quota-compass-panel",
  };

  const ROUTES = {
    analyticsOrigin: "https://chatgpt.com",
    analyticsPath: "/codex/cloud/settings/analytics",
    settingsAnalyticsPath: "/",
    settingsAnalyticsHash: "#settings/analytics",
    analyticsUrl: "https://chatgpt.com/#settings/Analytics",
  };

  const normalizedHash = (value) =>
    String(value || "")
      .split("?")[0]
      .replace(/\/+$/, "")
      .toLowerCase();

  const isSettingsAnalyticsRoute = (currentLocation = window.location) =>
    currentLocation.origin === ROUTES.analyticsOrigin &&
    currentLocation.pathname === ROUTES.settingsAnalyticsPath &&
    (normalizedHash(currentLocation.hash) === ROUTES.settingsAnalyticsHash ||
      (window.__codexMeterInitialAnalyticsRoute === true &&
        normalizedHash(currentLocation.hash) === "#settings"));

  const isAnalyticsRoute = (currentLocation = window.location) => {
    if (currentLocation.origin !== ROUTES.analyticsOrigin) return false;
    if (currentLocation.pathname === ROUTES.analyticsPath) return true;
    return isSettingsAnalyticsRoute(currentLocation);
  };

  window.CodexMeterConfig = {
    CONFIG,
    DEFAULT_SETTINGS,
    IDS,
    ROUTES,
    isAnalyticsRoute,
    isSettingsAnalyticsRoute,
  };
})();
