(function () {
  "use strict";

  const n = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const localDate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const utcDate = (date = new Date()) => date.toISOString().split("T")[0];

  const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  };

  const tokenTotal = (obj = {}) =>
    n(obj.text_total_tokens) ||
    n(obj.cached_text_input_tokens) +
      n(obj.uncached_text_input_tokens) +
      n(obj.text_output_tokens);

  const tokenInput = (obj = {}) =>
    n(obj.cached_text_input_tokens) + n(obj.uncached_text_input_tokens);

  const cacheRatio = (obj = {}) => {
    const cached = n(obj.cached_text_input_tokens);
    const input = tokenInput(obj);
    return input > 0 ? cached / input : 0;
  };

  const formatNumber = (value, locale, digits = 2) => {
    const num = n(value);
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(digits)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(digits)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(digits)}K`;
    return num.toLocaleString(locale || undefined);
  };

  const formatCredits = (value, digits = 3) => n(value).toFixed(digits);

  const formatUsd = (credits, usdPerCredit) =>
    `$ ${(n(credits) * n(usdPerCredit)).toFixed(2)}`;

  const DAY_SECONDS = 24 * 60 * 60;

  const isSubDayLimitWindow = (window) => {
    const seconds = n(window?.limitWindowSeconds);
    return seconds > 0 && seconds < DAY_SECONDS;
  };

  const windowRoleFromPath = (path) => {
    const role = [...path]
      .reverse()
      .map((part) => String(part).toLowerCase().replace(/_window$/, ""))
      .find((part) => /^(primary|secondary|tertiary)$/.test(part));
    return role || null;
  };

  const normalizeLimitWindow = (value, path, { labelFromPath, locale } = {}) => {
    const usedPercent =
      value.used_percent != null
        ? n(value.used_percent)
        : value.remaining_percent != null
          ? Math.max(0, 100 - n(value.remaining_percent))
          : null;
    const remainingPercent =
      value.remaining_percent != null
        ? n(value.remaining_percent)
        : usedPercent != null
          ? Math.max(0, 100 - usedPercent)
          : null;
    const resetAt = n(value.reset_at);
    const seconds = n(value.limit_window_seconds);
    const cycleStart =
      resetAt > 0 && seconds > 0 ? utcDate(new Date((resetAt - seconds) * 1000)) : null;

    return {
      key: path.join("."),
      label: labelFromPath?.(path) || path.join("."),
      role: windowRoleFromPath(path),
      usedPercent,
      remainingPercent,
      resetAt: resetAt || null,
      resetAtIso: resetAt ? new Date(resetAt * 1000).toISOString() : null,
      resetAtLocal: resetAt ? new Date(resetAt * 1000).toLocaleString(locale || undefined) : null,
      limitWindowSeconds: seconds || null,
      cycleStart,
      raw: {
        limit: value.limit ?? null,
        used: value.used ?? null,
        remaining: value.remaining ?? null,
      },
    };
  };

  const extractLimitWindows = (root, options = {}) => {
    const windows = [];
    const seen = new Set();

    const visit = (value, path = []) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      const looksLikeWindow =
        value.reset_at != null &&
        value.limit_window_seconds != null &&
        (value.used_percent != null ||
          value.remaining_percent != null ||
          value.limit != null ||
          value.remaining != null);

      if (looksLikeWindow) {
        const key = path.join(".");
        if (!seen.has(key)) {
          seen.add(key);
          windows.push(normalizeLimitWindow(value, path, options));
        }
      }

      for (const [key, child] of Object.entries(value)) {
        if (child && typeof child === "object") visit(child, [...path, key]);
      }
    };

    visit(root, []);
    return windows.sort((a, b) => {
      const secondsDelta = n(b.limitWindowSeconds) - n(a.limitWindowSeconds);
      if (secondsDelta !== 0) return secondsDelta;
      return a.label.localeCompare(b.label);
    });
  };

  const isSparkLimit = (limit = {}) => {
    const name = String(limit.limit_name ?? "").toLowerCase();
    const feature = String(limit.metered_feature ?? "").toLowerCase();
    return feature === "codex_bengalfox" || name.includes("gpt-5.3-codex-spark");
  };

  const extractAdditionalLimitWindows = (additionalRateLimits, options = {}) => {
    if (!Array.isArray(additionalRateLimits)) return [];

    return additionalRateLimits.flatMap((limit, index) => {
      if (!isSparkLimit(limit)) return [];
      const windows = extractLimitWindows(limit.rate_limit || {}, options);
      if (!windows.length) return [];

      const weeklyCandidates = windows.filter((window) =>
        window.limitWindowSeconds == null || window.limitWindowSeconds >= DAY_SECONDS,
      );
      const shortCandidates = windows.filter(isSubDayLimitWindow);
      const selectedWeekly = [...weeklyCandidates].sort(
        (a, b) => n(b.limitWindowSeconds) - n(a.limitWindowSeconds),
      )[0];
      const selectedShort = [...shortCandidates].sort(
        (a, b) => n(b.limitWindowSeconds) - n(a.limitWindowSeconds),
      )[0];
      const result = [];
      if (selectedWeekly) {
        result.push({
          ...selectedWeekly,
          key: `additional_rate_limits.${index}.spark_weekly`,
          label: "GPT-5.3-Codex-Spark Weekly",
          source: "spark",
          kind: "weekly",
        });
      }
      if (selectedShort) {
        result.push({
          ...selectedShort,
          key: `additional_rate_limits.${index}.spark_short`,
          label: "GPT-5.3-Codex-Spark 5-hour",
          source: "spark",
          kind: "short",
        });
      }
      return result;
    });
  };

  // Ordinary Codex and Spark use the same WHAM window shape, but their sub-day primary
  // windows have different ownership. Keep ordinary primary bursts out of the generic
  // short quota; Spark bursts are returned only through extractAdditionalLimitWindows.
  const extractOrdinaryLimitWindows = (root, options = {}) =>
    extractLimitWindows(root, options).filter(
      (window) => !(window.role === "primary" && isSubDayLimitWindow(window)),
    );

  const getStats = (list) => {
    const totals = list.reduce(
      (sum, row) => {
        const rowTotals = row.totals || {};
        sum.credits += n(rowTotals.credits);
        sum.turns += n(rowTotals.turns);
        sum.threads += n(rowTotals.threads);
        sum.tokens += tokenTotal(rowTotals);
        sum.inputTokens += tokenInput(rowTotals);
        sum.cachedInputTokens += n(rowTotals.cached_text_input_tokens);
        sum.uncachedInputTokens += n(rowTotals.uncached_text_input_tokens);
        return sum;
      },
      {
        credits: 0,
        turns: 0,
        threads: 0,
        tokens: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        uncachedInputTokens: 0,
      },
    );
    totals.cacheRatio = totals.inputTokens > 0 ? totals.cachedInputTokens / totals.inputTokens : 0;
    totals.creditsPerMillionTokens =
      totals.tokens > 0 ? totals.credits / (totals.tokens / 1e6) : 0;
    return totals;
  };

  const compactReport = (report) => ({
    id: report.id,
    capturedAt: report.capturedAt,
    capturedAtLocal: report.capturedAtLocal,
    pageUrl: report.pageUrl,
    startDate: report.startDate,
    endDate: report.endDate,
    cycleStartDate: report.cycleStartDate,
    windows: report.windows,
    customWindows: report.customWindows || [],
    primaryWindow: report.primaryWindow,
    currentStats: report.currentStats,
    historyStats: report.historyStats,
    totalStats: report.totalStats,
    currentCycleList: report.currentCycleList,
    historyList: report.historyList,
    dailyList: report.dailyList,
  });

  window.CodexMeterDomain = {
    addDays,
    cacheRatio,
    compactReport,
    extractLimitWindows,
    extractOrdinaryLimitWindows,
    extractAdditionalLimitWindows,
    isSubDayLimitWindow,
    formatCredits,
    formatNumber,
    formatUsd,
    getStats,
    localDate,
    n,
    tokenInput,
    tokenTotal,
    utcDate,
  };
})();
