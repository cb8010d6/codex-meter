(function () {
  "use strict";

  const normalizedHash = String(location.hash || "")
    .split("?")[0]
    .replace(/\/+$/, "")
    .toLowerCase();

  window.__codexMeterInitialAnalyticsRoute =
    location.origin === "https://chatgpt.com" &&
    location.pathname === "/" &&
    normalizedHash === "#settings/analytics";
})();
