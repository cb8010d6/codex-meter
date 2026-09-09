(function () {
  "use strict";

  const createReportService = ({
    chatGptClient,
    config,
    domain,
    getPageLocale,
    pageHref,
    reportRepository,
    translate,
  }) => {
    const labelFromPath = (path) => {
      const raw = path
        .join(".")
        .replaceAll("_", " ")
        .replace(/\bwindow\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (/secondary/i.test(path.join("."))) return translate("limits.secondary");
      if (/primary/i.test(path.join("."))) return translate("limits.primary");
      return raw || translate("limits.fallback");
    };

    const buildReport = async () => {
      const token = chatGptClient.getBootstrapToken();
      if (!token) throw new Error(translate("noToken"));

      const now = new Date();
      const endDate = domain.localDate(domain.addDays(now, 1));
      const startDate = domain.localDate(domain.addDays(now, -config.LOOKBACK_DAYS));
      const usage = await chatGptClient.apiGet("/backend-api/wham/usage", token);
      const windows = domain.extractOrdinaryLimitWindows(usage?.rate_limit || {}, {
        labelFromPath,
        locale: getPageLocale(),
      });
      const customWindows = domain.extractAdditionalLimitWindows(usage?.additional_rate_limits, {
        labelFromPath,
        locale: getPageLocale(),
      });
      const primaryWindow =
        windows.find(
          (window) =>
            Number(window?.limitWindowSeconds) >= 6 * 24 * 60 * 60 &&
            !/spark/i.test(`${window?.key || ""} ${window?.label || ""}`),
        ) ||
        windows[0] ||
        null;
      const cycleStartDate = primaryWindow?.cycleStart || startDate;
      const [dailyData, tokenBreakdownData] = await Promise.all([
        chatGptClient.apiGet(
          `/backend-api/wham/analytics/daily-workspace-usage-counts?start_date=${startDate}&end_date=${endDate}&group_by=day`,
          token,
        ),
        chatGptClient
          .apiGet(
            `/backend-api/wham/usage/daily-workspace-user-token-usage-breakdown?start_date=${startDate}&end_date=${endDate}&group_by=day`,
            token,
          )
          .catch(() => null),
      ]);
      const dailyList = Array.isArray(dailyData?.data) ? dailyData.data : [];
      const tokenBreakdownList = Array.isArray(tokenBreakdownData?.data) ? tokenBreakdownData.data : [];
      const currentCycleList = dailyList.filter(
        (item) => item?.date && new Date(`${item.date}T00:00:00`) >= new Date(`${cycleStartDate}T00:00:00`),
      );
      const historyList = dailyList.filter(
        (item) => item?.date && new Date(`${item.date}T00:00:00`) < new Date(`${cycleStartDate}T00:00:00`),
      );
      const currentTokenBreakdownList = tokenBreakdownList.filter(
        (item) => item?.date && new Date(`${item.date}T00:00:00`) >= new Date(`${cycleStartDate}T00:00:00`),
      );

      return {
        id: `${Date.now()}`,
        capturedAt: now.toISOString(),
        capturedAtLocal: now.toLocaleString(getPageLocale()),
        pageUrl: pageHref(),
        startDate,
        endDate,
        cycleStartDate,
        windows,
        customWindows,
        primaryWindow,
        currentCycleList,
        historyList,
        dailyList,
        tokenBreakdownList,
        currentTokenBreakdownList,
        currentStats: domain.getStats(currentCycleList),
        historyStats: domain.getStats(historyList),
        totalStats: domain.getStats(dailyList),
        currentModelTokenStats: domain.getModelTokenStats(
          currentTokenBreakdownList,
          config.TOKEN_CREDIT_RATES,
        ),
        modelTokenStats: domain.getModelTokenStats(tokenBreakdownList, config.TOKEN_CREDIT_RATES),
        tokenRateCardDate: config.TOKEN_RATE_CARD_DATE,
        tokenRateCardUrl: config.TOKEN_RATE_CARD_URL,
      };
    };

    const refreshReport = async () => {
      const report = await buildReport();
      await reportRepository.save(report);
      return report;
    };

    return {
      buildReport,
      refreshReport,
    };
  };

  window.CodexMeterReportService = {
    createReportService,
  };
})();
