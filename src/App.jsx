import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  LabelList,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import KpiCard from "./components/KpiCard";
import Panel from "./components/Panel";
import { loadBenchmarkData } from "./lib/api.js";
import { getCompanyLogoSrc } from "./lib/companyLogos.js";
import {
  buildAggregatedRowsFromMonthly,
  buildMonthDate,
  filterInterfaceRows,
  getAvailableMonthsForYear,
  getAvailablePeriods,
  getAvailableRangeBounds,
  getAvailableYears,
  getAvailableYearPeriods,
  getForecastScenario,
  getForecastRows,
  getMetricAvailability,
  getMarkets,
  getPeriodTypes,
  getRankingRows,
  getRowsForPeriod,
  getUniqueCompanies,
  groupSeriesByCompetitor,
  formatMonthLabelFromKey,
  getDemoMonthLabel,
  hasDataForMetric,
  isBenchmarkRow,
  isComparableRow,
  isForecastRow,
  isObservedRow,
  isRealCompanyRow,
  normalizeInterfaceRows,
  toMultiLineChartData,
} from "./lib/data.js";
import {
  formatCompact,
  formatCurrency,
  formatCurrencyDecimal,
  formatMetric,
  formatNumber,
  formatPercent,
  formatPercentagePoints,
  formatPp,
  formatSignedPercent,
  safeNumber,
} from "./lib/formatters.js";
import { benchmarkConfig } from "./config/benchmarkConfig.js";
import {
  RANKING_SORTS,
  LOCAL_RANKING_SORTS,
  EXECUTIVE_METRIC_OPTIONS,
  GLOBAL_CONTEXT_METRICS,
  PROFILE_CHART_TABS,
  PROFILE_FORECAST_METRICS,
  DASHBOARD_CHART_METRICS,
  FORECAST_DETAIL_METRICS,
  DISTRIBUTION_METRICS,
  INDEXED_METRIC_OPTIONS,
  MOMENTUM_METRIC_OPTIONS,
  BATTLE_METRICS,
  BATTLE_FORECAST_METRIC_OPTIONS,
} from "./config/metricRegistry.js";
import {
  getDataSourceStatus,
  getSourcePeriodType,
} from "./viewModels/dashboardViewModel.js";
import {
  filterRowsByForecastScenario,
  getAvailableForecastScenarios,
  getForecastScenarioLabel,
} from "./viewModels/forecastViewModel.js";
import {
  getCurrentRoute,
  getProfileHashFromId as getProfileHash,
  navigateToHash,
  HOME_HASH,
  FORECAST_HASH,
  BATTLE_ARENA_HASH,
} from "./app/routes.js";
import { formatAppDateTime } from "./app/locale.js";
import {
  getCompanyLabel,
  getBattleDeltaLabel,
  getBattleWinner,
  formatBattleCurrency,
  formatBattleMetricValue,
  getBattleOptionLabel,
  getBattlePlayerOptions,
  getPreferredBattlePlayer,
  getProfileBattleOptions,
  getDefaultProfileBattleTarget,
  getBattleMetricOptions,
  getBattleShare,
  buildHistoricalBattleRounds,
  getBattleScore,
  buildHistoricalBattleInsight,
  getBattleHeroKpiDefinitions,
  getHeroKpisForPlayer,
} from "./features/battle/battleLogic.js";
import {
  mergeForecastMetricRows,
  preferObservedRows,
  getForecastWindow,
} from "./features/forecast/forecastUtils.js";
import {
  buildForecastBattle,
  buildForecastBattleInsight,
} from "./features/forecast-battle/forecastBattleLogic.js";
import {
  calculateProfileMetricDelta,
  formatProfileRankChange,
  formatProfileSignedGap as formatProfileSignedGapBase,
  getAveragePreviousValueForMetric,
  getLatestCompanyMetricRow,
  getProfileExecutiveInsight as getProfileExecutiveInsightBase,
  getProfileMomentumEntry,
  getProfileRowLabel,
  getProfileRowSortValue,
  getSortedCompanyMetricRows,
} from "./features/profile/profileMetrics.js";

const OWN_COMPANY_ID = benchmarkConfig.identity.focusEntityId;
const MARKET_BENCHMARK_ID = benchmarkConfig.identity.benchmarkEntityId;
const CORE_RACE_COMPANY_IDS = benchmarkConfig.comparisonSets.coreRaceEntityIds;
const BATTLE_TARGET_IDS = benchmarkConfig.comparisonSets.battleTargetEntityIds;
const PERIOD_TYPE_LABELS = benchmarkConfig.periods.labels;
const TIME_MODE_OPTIONS = benchmarkConfig.periods.timeModes;
const TIME_MODE_KEYS = TIME_MODE_OPTIONS.map((option) => option.key);
const FORECAST_TIME_MODE_OPTIONS = benchmarkConfig.periods.forecastTimeModes;
const FORECAST_TIME_MODE_KEYS = FORECAST_TIME_MODE_OPTIONS.map((option) => option.key);
const FORECAST_SCENARIO_ORDER = benchmarkConfig.forecast.scenarioOrder;
const COMPETITIVE_MAP_OPTIONS = benchmarkConfig.views.competitiveMapOptions;

const FOCUS_LOGO_SRC = "";
const EMPTY_HIDDEN_COMPANY_IDS = new Set();
const PROFILE_FORECAST_SCENARIO_ORDER = FORECAST_SCENARIO_ORDER;

const PROFILE_MAIN_TABS = benchmarkConfig.views.profileMainTabs;
const INDEXED_SOURCE_METRICS = benchmarkConfig.views.indexedSourceMetrics;
const MOMENTUM_READING_OPTIONS = benchmarkConfig.views.momentumReadingOptions;
const EXECUTIVE_METRIC_LABELS = benchmarkConfig.views.executiveMetricLabels;
const BATTLE_MODE_OPTIONS = benchmarkConfig.views.battleModeOptions;

function normalizeCompanyId(companyId) {
  return String(companyId ?? "")
    .trim()
    .toLowerCase();
}

function sameCompany(a, b) {
  return normalizeCompanyId(a) === normalizeCompanyId(b);
}

function formatProfileSignedGap(delta, metricKey = "") {
  return formatProfileSignedGapBase(delta, metricKey, formatSignedMetricDelta);
}

function getProfileExecutiveInsight(row = {}, companyTitle = "Player", periodRows = []) {
  return getProfileExecutiveInsightBase(row, companyTitle, periodRows, OWN_COMPANY_ID);
}

function formatGeneratedAt(value) {
  return formatAppDateTime(value);
}

function getSeriesVisibilityKey(series = []) {
  return series.map((companySeries) => normalizeCompanyId(companySeries.company_id)).join("|");
}

function getCompanyIdSet(companyIds = []) {
  return new Set(companyIds.map(normalizeCompanyId).filter(Boolean));
}

function mergeSeriesForLegend(seriesGroups = []) {
  const seriesMap = new Map();

  seriesGroups.flat().forEach((companySeries) => {
    const companyKey = normalizeCompanyId(companySeries?.company_id);
    if (!companyKey || seriesMap.has(companyKey)) return;

    seriesMap.set(companyKey, companySeries);
  });

  return Array.from(seriesMap.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );
}

function DataTypeBadge({ row }) {
  if (!isForecastRow(row)) return null;

  return <span className="data-type-badge data-type-badge-forecast">Proyección</span>;
}

function getRowYear(row) {
  const explicitYear = Number(row?.year);
  if (Number.isFinite(explicitYear) && explicitYear > 0) return String(explicitYear);

  const dateMatch = String(row?.date || "").match(/^(\d{4})/);
  return dateMatch ? dateMatch[1] : "";
}

function hasMetricValue(row, metricKey) {
  return hasDataForMetric(row, metricKey);
}

function filterRowsWithMetrics(rows = [], metricKeys = [], requireAll = true) {
  const keys = Array.isArray(metricKeys) ? metricKeys.filter(Boolean) : [];
  if (!keys.length) return rows;

  return rows.filter((row) => {
    const checks = keys.map((metricKey) => hasMetricValue(row, metricKey));
    return requireAll ? checks.every(Boolean) : checks.some(Boolean);
  });
}

function getAvailableChartYearOptions(rows = [], metricKeys = []) {
  const rowsWithData = filterRowsWithMetrics(rows, metricKeys, false);

  return getAvailableYearPeriods(rowsWithData).sort((a, b) => b.key.localeCompare(a.key));
}

function filterRowsByChartRange(rows = [], chartRangeMode, selectedChartYear) {
  if (chartRangeMode !== "year" || !selectedChartYear) return rows;

  return rows.filter((row) => getRowYear(row) === selectedChartYear);
}

function getMonthKeyFromParts(year, month) {
  if (!year || !month) return "";
  return `${String(year)}-${String(month).padStart(2, "0")}`;
}

function getMonthParts(monthKey = "") {
  const [year, month] = String(monthKey || "").slice(0, 7).split("-");
  return {
    year,
    month: Number(month),
  };
}

function getRangeMonthDate(monthKey = "") {
  return monthKey ? `${monthKey}-01` : "";
}

function compareRangeMonthKeys(a = "", b = "") {
  return String(a).localeCompare(String(b));
}

function getGlobalContextMonthKey(row = {}) {
  const dateMonthKey = String(row?.date || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(dateMonthKey)) return dateMonthKey;

  return getMonthKeyFromParts(row?.year, row?.month);
}

function hasGlobalContextData(row = {}) {
  return GLOBAL_CONTEXT_METRICS.some((metricKey) => hasMetricValue(row, metricKey));
}

function getGlobalContextRows(rows = [], options = {}) {
  const { market = "", includeBenchmark = false, includeForecasts = false } = options;

  return preferObservedRows(
    filterInterfaceRows(
      rows,
      { periodType: "monthly", market },
      { includeBenchmark, includeForecasts, realOnly: !includeBenchmark },
    ).filter(hasGlobalContextData),
  );
}

function getGlobalAvailableYears(rows = [], options = {}) {
  const years = new Set(
    getGlobalContextRows(rows, options)
      .map((row) => String(row?.year || getGlobalContextMonthKey(row).slice(0, 4)))
      .filter(Boolean),
  );

  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

function getGlobalAvailableMonthsForYear(rows = [], year = "", options = {}) {
  const selectedYear = String(year || "");
  const months = new Set(
    getGlobalContextRows(rows, options)
      .filter((row) => String(row?.year || getGlobalContextMonthKey(row).slice(0, 4)) === selectedYear)
      .map((row) => Number(row?.month || getGlobalContextMonthKey(row).slice(5, 7)))
      .filter((month) => Number.isFinite(month) && month >= 1 && month <= 12),
  );

  return Array.from(months).sort((a, b) => a - b);
}

function getGlobalAvailableRangeBounds(rows = [], options = {}) {
  const monthMap = new Map();

  getGlobalContextRows(rows, options).forEach((row) => {
    const monthKey = getGlobalContextMonthKey(row);
    if (!monthKey || monthMap.has(monthKey)) return;

    const [year, month] = monthKey.split("-");
    monthMap.set(monthKey, {
      key: monthKey,
      date: buildMonthDate(year, month),
      year,
      month: Number(month),
      label: formatMonthLabelFromKey(monthKey),
      sortValue: new Date(buildMonthDate(year, month)).getTime(),
    });
  });

  const months = Array.from(monthMap.values()).sort((a, b) =>
    compareRangeMonthKeys(a.key, b.key),
  );

  return {
    months,
    first: months[0] ?? null,
    last: months[months.length - 1] ?? null,
  };
}

function getForecastMonthOptions(rows = [], metricKeys = FORECAST_DETAIL_METRICS) {
  const monthMap = new Map();
  const keys = Array.isArray(metricKeys) ? metricKeys.filter(Boolean) : [];

  rows
    .filter((row) => row?.period_type === "monthly")
    .filter((row) => isForecastRow(row))
    .filter((row) => !keys.length || keys.some((metricKey) => hasMetricValue(row, metricKey)))
    .forEach((row) => {
      const monthKey = getGlobalContextMonthKey(row);
      if (!monthKey || monthMap.has(monthKey)) return;
      const [year, month] = monthKey.split("-");

      monthMap.set(monthKey, {
        key: monthKey,
        date: buildMonthDate(year, month),
        year,
        month: Number(month),
        label: formatMonthLabelFromKey(monthKey),
        sortValue: new Date(buildMonthDate(year, month)).getTime(),
      });
    });

  return Array.from(monthMap.values()).sort((a, b) => compareRangeMonthKeys(a.key, b.key));
}

function getForecastAvailableYears(monthOptions = []) {
  return Array.from(new Set(monthOptions.map((month) => month.year).filter(Boolean))).sort((a, b) =>
    b.localeCompare(a),
  );
}

function getForecastMonthsForYear(monthOptions = [], year = "") {
  const selectedYear = String(year || "");
  return monthOptions
    .filter((month) => String(month.year) === selectedYear)
    .map((month) => month.month)
    .filter((month) => Number.isFinite(month))
    .sort((a, b) => a - b);
}

function getForecastRangeMonthOptions(monthOptions = []) {
  return monthOptions.map((month) => ({
    key: month.key,
    label: month.label,
    date: month.date,
    year: month.year,
    month: month.month,
  }));
}

function getForecastSelectionWindow(selection = {}, monthOptions = []) {
  if (!monthOptions.length) return null;

  const timeMode = FORECAST_TIME_MODE_KEYS.includes(selection.selectedTimeMode)
    ? selection.selectedTimeMode
    : "horizon";
  const firstMonth = monthOptions[0];
  const lastMonth = monthOptions[monthOptions.length - 1];
  const selectedYear = String(selection.selectedYear || lastMonth.year || "");
  const yearMonths = monthOptions.filter((month) => String(month.year) === selectedYear);

  if (timeMode === "month") {
    const monthKey = getMonthKeyFromParts(selectedYear, Number(selection.selectedMonth));
    const selectedMonth = monthOptions.find((month) => month.key === monthKey) ?? lastMonth;

    return {
      mode: "month",
      startMonth: selectedMonth.key,
      endMonth: selectedMonth.key,
      startDate: selectedMonth.date,
      endDate: selectedMonth.date,
      label: selectedMonth.label,
      detail: "Periodo forecast mensual seleccionado.",
      monthCount: 1,
      closeLabel: selectedMonth.label,
    };
  }

  if (timeMode === "annual") {
    const selectedYearMonths = yearMonths.length ? yearMonths : monthOptions;
    const start = selectedYearMonths[0];
    const end = selectedYearMonths[selectedYearMonths.length - 1];
    const fullYear = selectedYearMonths.length === 12;
    const label = fullYear
      ? `Año ${end.year}`
      : `${end.year} parcial · ${getDemoMonthLabel(start.month)}-${getDemoMonthLabel(end.month)}`;

    return {
      mode: "annual",
      startMonth: start.key,
      endMonth: end.key,
      startDate: start.date,
      endDate: end.date,
      label,
      detail: fullYear
        ? `Forecast acumulado Ene-Dic ${end.year}.`
        : `Forecast parcial ${end.year}: ${getDemoMonthLabel(start.month)}-${getDemoMonthLabel(end.month)}.`,
      monthCount: selectedYearMonths.length,
      closeLabel: end.label,
    };
  }

  if (timeMode === "range") {
    const requestedStart = selection.rangeStartMonth || firstMonth.key;
    const requestedEnd = selection.rangeEndMonth || lastMonth.key;
    const start = monthOptions.find((month) => month.key === requestedStart) ?? firstMonth;
    const end = monthOptions.find((month) => month.key === requestedEnd) ?? lastMonth;
    const [safeStart, safeEnd] =
      compareRangeMonthKeys(start.key, end.key) <= 0 ? [start, end] : [end, start];
    const monthCount = monthOptions.filter(
      (month) =>
        compareRangeMonthKeys(month.key, safeStart.key) >= 0 &&
        compareRangeMonthKeys(month.key, safeEnd.key) <= 0,
    ).length;

    return {
      mode: "range",
      startMonth: safeStart.key,
      endMonth: safeEnd.key,
      startDate: safeStart.date,
      endDate: safeEnd.date,
      label: `Rango · ${safeStart.label}-${safeEnd.label}`,
      detail: "Forecast agregado para el rango seleccionado.",
      monthCount,
      closeLabel: safeEnd.label,
    };
  }

  return {
    mode: "horizon",
    startMonth: firstMonth.key,
    endMonth: lastMonth.key,
    startDate: firstMonth.date,
    endDate: lastMonth.date,
    label: `Horizonte · ${firstMonth.label}-${lastMonth.label}`,
    detail: "Horizonte forecast completo. Ranking y tabla muestran el cierre proyectado.",
    monthCount: monthOptions.length,
    closeLabel: lastMonth.label,
  };
}

function filterRowsByForecastWindow(rows = [], window = null) {
  if (!window?.startMonth || !window?.endMonth) return [];

  return rows.filter((row) => {
    const monthKey = getGlobalContextMonthKey(row);
    return (
      monthKey &&
      compareRangeMonthKeys(monthKey, window.startMonth) >= 0 &&
      compareRangeMonthKeys(monthKey, window.endMonth) <= 0
    );
  });
}

function getForecastPeriodRowsForWindow(rows = [], window = null) {
  if (!window) return [];

  if (window.mode === "horizon" || window.mode === "month") {
    return rows.filter((row) => getGlobalContextMonthKey(row) === window.endMonth);
  }

  return buildAggregatedRowsFromMonthly(rows, {
    startDate: window.startDate,
    endDate: window.endDate,
    aggregationType: window.mode === "annual" ? "annual" : "range",
    includeBenchmark: false,
    includeForecasts: true,
  });
}

function getForecastCoverageItem(rows = [], metricKey = "", label = "") {
  const months = getForecastMonthOptions(rows, [metricKey]);
  const first = months[0] ?? null;
  const last = months[months.length - 1] ?? null;
  const source = getProfileSourceLabel(metricKey);

  return {
    key: metricKey,
    label,
    available: Boolean(first && last),
    statusLabel: first && last ? `${first.label}-${last.label}` : "No disponible",
    reason: first && last ? source : `Forecast de ${label.toLowerCase()} no disponible`,
  };
}

function getForecastPeriodStatusItems(rows = []) {
  return [
    {
      key: "visits",
      label: "Forecast visitas",
      available: hasAnyMetric(rows, "visits"),
      statusLabel: hasAnyMetric(rows, "visits") ? "Disponible" : "No disponible",
      reason: "Mock benchmark dataset",
    },
    {
      key: "revenue",
      label: "Forecast facturación",
      available: hasAnyMetric(rows, "revenue"),
      statusLabel: hasAnyMetric(rows, "revenue") ? "Disponible" : "No disponible",
      reason: "ECDB",
    },
  ];
}

function getPrimaryAvailabilityMetric(metricKeys = [], selectedMetric = "") {
  if (selectedMetric) return selectedMetric;

  const keys = Array.isArray(metricKeys) ? metricKeys.filter(Boolean) : [];
  if (!keys.length) return "revenue";
  if (keys.some((key) => key.includes("share_revenue_change"))) return "market_share_revenue";
  if (keys.some((key) => key.includes("share_visits_change"))) return "market_share_visits";
  if (keys.includes("market_share_revenue") && keys.includes("market_share_visits")) {
    return "monetization_gap";
  }

  return keys[0];
}

function getRankingMetricKey(sortKey = "", timeMode = "") {
  if (sortKey === "growth_revenue") {
    return timeMode === "month" ? "revenue_mom_growth" : "revenue_yoy_growth";
  }

  if (sortKey === "growth_visits") {
    return timeMode === "month" ? "visits_mom_growth" : "visits_yoy_growth";
  }

  return sortKey;
}

function getRankingSortLabel(sortKey = "", timeMode = "") {
  const optionLabel = LOCAL_RANKING_SORTS.find((sort) => sort.key === sortKey)?.label;
  if (!sortKey.startsWith("growth_")) return optionLabel || sortKey;

  const normalizedTimeMode = normalizeTimeMode(timeMode);
  const cadence =
    normalizedTimeMode === "month"
      ? "mensual"
      : normalizedTimeMode === "historical"
        ? "histórico"
        : "interanual";
  return `${optionLabel || "Crecimiento"} ${cadence}`;
}

function withRankingAvailability(options = [], availability = {}, timeMode = "") {
  return options.map((option) => {
    const metricKey = getRankingMetricKey(option.key, timeMode);
    const item = availability?.[metricKey] ?? availability?.[option.key] ?? null;
    const available = item ? item.available : true;

    return {
      ...option,
      metricKey,
      availability: item,
      disabled: !available,
      reason: item?.reason || "",
    };
  });
}

function capitalizeCopy(value = "") {
  const text = String(value || "").trim();
  return text ? `${text.slice(0, 1).toUpperCase()}${text.slice(1)}` : "";
}

function getTimeModeLabel(timeMode = "") {
  return TIME_MODE_OPTIONS.find((option) => option.key === timeMode)?.label || timeMode;
}

function getHistoricalStartMonth(selection = {}) {
  const rangeMonthOptions = Array.isArray(selection.rangeMonthOptions)
    ? selection.rangeMonthOptions
    : [];
  return rangeMonthOptions[0]?.key || selection.rangeStartMonth || "";
}

function getHistoricalEndMonth(selection = {}) {
  const rangeMonthOptions = Array.isArray(selection.rangeMonthOptions)
    ? selection.rangeMonthOptions
    : [];
  const selectedEnd = selection.rangeEndMonth || "";
  const hasSelectedEnd = rangeMonthOptions.some((month) => month.key === selectedEnd);
  return (hasSelectedEnd && selectedEnd) || rangeMonthOptions[rangeMonthOptions.length - 1]?.key || selectedEnd;
}

function getHistoricalRangeLabel(startMonth = "", endMonth = "") {
  const startLabel = formatMonthLabelFromKey(startMonth);
  const endLabel = formatMonthLabelFromKey(endMonth);
  if (!startLabel || !endLabel) return "";
  return startMonth === endMonth ? startLabel : `${startLabel}–${endLabel}`;
}

function getRangeMonthCount(months = [], startMonth = "", endMonth = "") {
  if (!startMonth || !endMonth) return 0;
  return months.filter(
    (month) =>
      compareRangeMonthKeys(month.key, startMonth) >= 0 &&
      compareRangeMonthKeys(month.key, endMonth) <= 0,
  ).length;
}

function normalizeTimeMode(timeMode = "") {
  // Legacy fallback for old URLs/state only. Not exposed in UI.
  return timeMode === "ytd" ? "historical" : timeMode || "month";
}

function getMonthOptionFromKey(monthKey = "") {
  if (!monthKey) return null;
  const [year, month] = String(monthKey).split("-");
  if (!year || !month) return null;

  return {
    key: monthKey,
    date: buildMonthDate(year, Number(month)),
    year,
    month: Number(month),
    label: formatMonthLabelFromKey(monthKey),
    sortValue: new Date(buildMonthDate(year, Number(month))).getTime(),
  };
}

function normalizeMetricRequirement(metricRequirement = "any") {
  const requirement = String(metricRequirement || "any");
  if (requirement === "market_share_revenue") return "revenue_share";
  if (requirement === "market_share_visits") return "visits_share";
  if (requirement === "monetization_gap" || requirement === "revenue_per_visit") {
    return requirement;
  }
  if (requirement === "efficiency") return "efficiency";
  if (requirement === "comparable_revenue_visits") return "comparable_revenue_visits";
  if (requirement === "growth") return "growth";
  if (requirement === "revenue_share" || requirement === "visits_share") return requirement;
  if (requirement === "visits") return "visits";
  if (requirement === "revenue") return "revenue";
  return "any";
}

function getMetricRequirementForMetric(metricKey = "") {
  const metric = String(metricKey || "");
  if (!metric) return "any";
  if (
    metric === "visits" ||
    metric === "indexed_visits" ||
    metric === "rank_visits" ||
    (metric.includes("visits_") && metric.includes("growth"))
  ) {
    return "visits";
  }
  if (
    metric === "market_share_visits" ||
    metric === "rank_share_visits" ||
    metric.includes("share_visits_change")
  ) {
    return "visits_share";
  }
  if (
    metric === "market_share_revenue" ||
    metric === "rank_share_revenue" ||
    metric.includes("share_revenue_change")
  ) {
    return "revenue_share";
  }
  if (metric === "revenue_per_visit") return "efficiency";
  if (metric === "monetization_gap" || metric === "revenue_share_vs_visit_share") {
    return "monetization_gap";
  }
  if (metric === "indexed_market_share_revenue") return "revenue_share";
  if (
    (metric.includes("revenue_") && metric.includes("growth")) ||
    metric.includes("revenue_growth") ||
    metric === "indexed_revenue" ||
    metric === "rank_revenue" ||
    metric === "revenue"
  ) {
    return "revenue";
  }
  if (metric.includes("growth")) return "growth";
  return "any";
}

function getMetricRequirementForFilters(metricKeys = [], selectedMetric = "") {
  if (selectedMetric) return getMetricRequirementForMetric(selectedMetric);
  const keys = Array.isArray(metricKeys) ? metricKeys.filter(Boolean) : [];
  if (!keys.length) return "any";
  if (keys.some((key) => getMetricRequirementForMetric(key) === "monetization_gap")) {
    return "monetization_gap";
  }
  if (keys.some((key) => getMetricRequirementForMetric(key) === "efficiency")) {
    return "efficiency";
  }
  if (keys.some((key) => getMetricRequirementForMetric(key) === "revenue") &&
      keys.some((key) => getMetricRequirementForMetric(key) === "visits")) {
    return "comparable_revenue_visits";
  }
  return getMetricRequirementForMetric(keys[0]);
}

function getRequirementAvailabilityMetric(metricRequirement = "any") {
  const requirement = normalizeMetricRequirement(metricRequirement);
  if (requirement === "revenue" || requirement === "revenue_share") return "revenue";
  if (requirement === "visits" || requirement === "visits_share") return "visits";
  if (
    requirement === "monetization_gap" ||
    requirement === "efficiency" ||
    requirement === "comparable_revenue_visits"
  ) {
    return "comparable_revenue_visits";
  }
  return "any";
}

function getCoverageSourceRows(rows = [], { market = "" } = {}) {
  return preferObservedRows(
    filterInterfaceRows(
      rows,
      { periodType: "monthly", market },
      { includeBenchmark: false, includeForecasts: false, realOnly: true },
    ),
  );
}

function getCoverageMonthsForRequirement(rows = [], metricRequirement = "any", options = {}) {
  const requirement = normalizeMetricRequirement(metricRequirement);
  const sourceRows = getCoverageSourceRows(rows, options);
  const monthMap = new Map();

  if (
    requirement === "monetization_gap" ||
    requirement === "efficiency" ||
    requirement === "comparable_revenue_visits"
  ) {
    const monthState = new Map();

    sourceRows.forEach((row) => {
      const monthKey = getGlobalContextMonthKey(row);
      if (!monthKey) return;

      const current = monthState.get(monthKey) ?? { hasRevenue: false, hasVisits: false };
      current.hasRevenue = current.hasRevenue || hasMetricValue(row, "revenue");
      current.hasVisits = current.hasVisits || hasMetricValue(row, "visits");
      monthState.set(monthKey, current);
    });

    monthState.forEach((state, monthKey) => {
      if (!state.hasRevenue || !state.hasVisits) return;
      const monthOption = getMonthOptionFromKey(monthKey);
      if (monthOption) monthMap.set(monthKey, monthOption);
    });
  } else {
    const availabilityMetric = getRequirementAvailabilityMetric(requirement);

    sourceRows.forEach((row) => {
      const monthKey = getGlobalContextMonthKey(row);
      if (!monthKey || monthMap.has(monthKey)) return;

      const hasCoverage =
        availabilityMetric === "any"
          ? GLOBAL_CONTEXT_METRICS.some((metricKey) => hasMetricValue(row, metricKey))
          : hasMetricValue(row, availabilityMetric);

      if (!hasCoverage) return;
      const monthOption = getMonthOptionFromKey(monthKey);
      if (monthOption) monthMap.set(monthKey, monthOption);
    });
  }

  return Array.from(monthMap.values()).sort((a, b) => compareRangeMonthKeys(a.key, b.key));
}

function getCoverageRangeForRequirement(rows = [], metricRequirement = "any", options = {}) {
  const months = getCoverageMonthsForRequirement(rows, metricRequirement, options);
  const first = months[0] ?? null;
  const last = months[months.length - 1] ?? null;

  return {
    months,
    first,
    last,
    label: first && last ? getHistoricalRangeLabel(first.key, last.key) : "",
  };
}

function getHistoricalPeriodPrefix(metricRequirement = "any") {
  const requirement = normalizeMetricRequirement(metricRequirement);
  return requirement === "monetization_gap" ||
    requirement === "efficiency" ||
    requirement === "comparable_revenue_visits"
    ? "Histórico comparable"
    : "Histórico";
}

function getPeriodLabelFromRows(rows = [], fallback = "") {
  return rows.find((row) => row?.period_label)?.period_label || fallback;
}

function getTimeSelectionDates(selection = {}) {
  const selectedTimeMode = normalizeTimeMode(
    selection.timeMode || selection.selectedTimeMode || selection.periodType,
  );
  const selectedYear = selection.selectedYear || "";
  const selectedMonth = Number(selection.selectedMonth);
  const annualEndMonth = Number(selection.annualEndMonth);

  if (selectedTimeMode === "month") {
    const date = buildMonthDate(selectedYear, selectedMonth);
    return { startDate: date, endDate: date };
  }

  if (selectedTimeMode === "historical") {
    return {
      startDate: getRangeMonthDate(getHistoricalStartMonth(selection)),
      endDate: getRangeMonthDate(getHistoricalEndMonth(selection)),
    };
  }

  if (selectedTimeMode === "annual") {
    return {
      startDate: buildMonthDate(selectedYear, 1),
      endDate: buildMonthDate(selectedYear, annualEndMonth || 12),
    };
  }

  return {
    startDate: getRangeMonthDate(selection.rangeStartMonth),
    endDate: getRangeMonthDate(selection.rangeEndMonth),
  };
}

function _buildSelectedPeriod(selection = {}) {
  const { startDate, endDate } = getTimeSelectionDates(selection);
  const selectedTimeMode = normalizeTimeMode(
    selection.timeMode || selection.selectedTimeMode || selection.periodType,
  );
  const selectedYear = selection.selectedYear || "";
  const selectedMonth = Number(selection.selectedMonth);
  const annualEndMonth = Number(selection.annualEndMonth);
  const selectedMonthKey = getMonthKeyFromParts(selectedYear, selectedMonth);
  const annualEndLabel = getDemoMonthLabel(annualEndMonth);
  const monthOptions = selection.monthOptions || [];
  const rangeMonthOptions = selection.rangeMonthOptions || [];
  const historicalStartMonth = getHistoricalStartMonth(selection);
  const historicalEndMonth = getHistoricalEndMonth(selection);
  const historicalStartLabel = formatMonthLabelFromKey(historicalStartMonth);
  const historicalEndLabel = formatMonthLabelFromKey(historicalEndMonth);
  const historicalRangeLabel = getHistoricalRangeLabel(historicalStartMonth, historicalEndMonth);
  const isFullYear = monthOptions.length === 12 && monthOptions.every((month, index) => month === index + 1);
  const isPartialYear = selectedTimeMode === "annual" && !isFullYear;

  if (!startDate || !endDate) return null;

  if (selectedTimeMode === "month") {
    if (!selectedYear || !selectedMonth) return null;
    return {
      key: startDate,
      date: startDate,
      label: formatMonthLabelFromKey(selectedMonthKey),
      sortValue: new Date(startDate).getTime(),
      time_mode: "month",
      aggregation_type: "month",
    };
  }

  if (selectedTimeMode === "historical") {
    if (!historicalStartMonth || !historicalEndMonth) return null;
    return {
      key: "historical",
      date: endDate,
      label: "Histórico",
      detail: `Cada módulo usa su histórico disponible. Cobertura global: ${historicalRangeLabel}.`,
      sortValue: new Date(endDate).getTime(),
      time_mode: "historical",
      aggregation_type: "historical",
      start_month_label: historicalStartLabel,
      latest_month: Number(historicalEndMonth.slice(5, 7)),
      latest_month_label: historicalEndLabel,
      month_count: getRangeMonthCount(rangeMonthOptions, historicalStartMonth, historicalEndMonth),
    };
  }

  if (selectedTimeMode === "annual") {
    if (!selectedYear || !annualEndMonth) return null;
    return {
      key: `annual:${selectedYear}`,
      date: endDate,
      label: isPartialYear
        ? `${selectedYear} parcial · Ene-${annualEndLabel}`
        : `Año ${selectedYear}`,
      detail: isPartialYear
        ? `${selectedYear} parcial: acumulado Ene-${annualEndLabel}.`
        : `Año ${selectedYear}: acumulado enero-diciembre.`,
      sortValue: new Date(endDate).getTime(),
      time_mode: "annual",
      aggregation_type: "annual",
      partial_year: isPartialYear,
      latest_month: annualEndMonth,
      latest_month_label: annualEndLabel,
      month_count: monthOptions.length,
    };
  }

  if (!selection.rangeStartMonth || !selection.rangeEndMonth) return null;

  return {
    key: `range:${selection.rangeStartMonth}:${selection.rangeEndMonth}`,
    date: endDate,
    label: `Rango · ${formatMonthLabelFromKey(selection.rangeStartMonth)}–${formatMonthLabelFromKey(
      selection.rangeEndMonth,
    )}`,
    detail: "Rango calculado desde datos mensuales disponibles.",
    sortValue: new Date(endDate).getTime(),
    time_mode: "range",
    aggregation_type: "range",
    month_count: rangeMonthOptions.filter(
      (month) =>
        compareRangeMonthKeys(month.key, selection.rangeStartMonth) >= 0 &&
        compareRangeMonthKeys(month.key, selection.rangeEndMonth) <= 0,
    ).length,
  };
}

function buildGlobalPeriod(selection = {}) {
  const { startDate, endDate } = getTimeSelectionDates(selection);
  const selectedTimeMode = normalizeTimeMode(selection.selectedTimeMode);
  const selectedYear = selection.selectedYear || "";
  const selectedMonth = Number(selection.selectedMonth);
  const annualEndMonth = Number(selection.annualEndMonth);
  const selectedMonthKey = getMonthKeyFromParts(selectedYear, selectedMonth);
  const annualEndLabel = getDemoMonthLabel(annualEndMonth);
  const monthOptions = selection.monthOptions || [];
  const rangeMonthOptions = selection.rangeMonthOptions || [];
  const historicalStartMonth = getHistoricalStartMonth(selection);
  const historicalEndMonth = getHistoricalEndMonth(selection);
  const historicalStartLabel = formatMonthLabelFromKey(historicalStartMonth);
  const historicalEndLabel = formatMonthLabelFromKey(historicalEndMonth);
  const historicalRangeLabel = getHistoricalRangeLabel(historicalStartMonth, historicalEndMonth);
  const isFullYear =
    monthOptions.length === 12 && monthOptions.every((month, index) => month === index + 1);
  const isPartialYear = selectedTimeMode === "annual" && !isFullYear;

  if (!startDate || !endDate) return null;

  if (selectedTimeMode === "month") {
    if (!selectedYear || !selectedMonth) return null;
    return {
      key: startDate,
      date: startDate,
      label: formatMonthLabelFromKey(selectedMonthKey),
      sortValue: new Date(startDate).getTime(),
      time_mode: "month",
      aggregation_type: "month",
    };
  }

  if (selectedTimeMode === "historical") {
    if (!historicalStartMonth || !historicalEndMonth) return null;
    return {
      key: "historical",
      date: endDate,
      label: "Histórico",
      detail: `Cada módulo usa su histórico disponible. Cobertura global: ${historicalRangeLabel}.`,
      sortValue: new Date(endDate).getTime(),
      time_mode: "historical",
      aggregation_type: "historical",
      start_month_label: historicalStartLabel,
      latest_month: Number(historicalEndMonth.slice(5, 7)),
      latest_month_label: historicalEndLabel,
      month_count: getRangeMonthCount(rangeMonthOptions, historicalStartMonth, historicalEndMonth),
    };
  }

  if (selectedTimeMode === "annual") {
    if (!selectedYear || !annualEndMonth) return null;
    return {
      key: `annual:${selectedYear}`,
      date: endDate,
      label: isPartialYear ? `${selectedYear} parcial · Ene-${annualEndLabel}` : `Año ${selectedYear}`,
      detail: isPartialYear
        ? `${selectedYear} parcial: acumulado Ene-${annualEndLabel}.`
        : `Año ${selectedYear}: acumulado enero-diciembre.`,
      sortValue: new Date(endDate).getTime(),
      time_mode: "annual",
      aggregation_type: "annual",
      partial_year: isPartialYear,
      latest_month: annualEndMonth,
      latest_month_label: annualEndLabel,
      month_count: monthOptions.length,
    };
  }

  if (!selection.rangeStartMonth || !selection.rangeEndMonth) return null;

  return {
    key: `range:${selection.rangeStartMonth}:${selection.rangeEndMonth}`,
    date: endDate,
    label: `Rango · ${formatMonthLabelFromKey(selection.rangeStartMonth)}–${formatMonthLabelFromKey(
      selection.rangeEndMonth,
    )}`,
    detail: "Rango calculado desde datos mensuales disponibles.",
    sortValue: new Date(endDate).getTime(),
    time_mode: "range",
    aggregation_type: "range",
    month_count: rangeMonthOptions.filter(
      (month) =>
        compareRangeMonthKeys(month.key, selection.rangeStartMonth) >= 0 &&
        compareRangeMonthKeys(month.key, selection.rangeEndMonth) <= 0,
    ).length,
  };
}

function buildRowsForPeriod(rows = [], context = {}, metricRequirement = "any", options = {}) {
  const {
    market = context.market || "",
    includeBenchmark = false,
    includeForecasts = false,
  } = options;
  const timeMode = normalizeTimeMode(
    context.timeMode || context.selectedTimeMode || context.periodType,
  );
  const requirement = normalizeMetricRequirement(metricRequirement);
  const sourceRows = preferObservedRows(
    filterInterfaceRows(
      rows,
      {
        periodType: "monthly",
        market,
      },
      { includeBenchmark, includeForecasts, realOnly: !includeBenchmark },
    ),
  );
  const selection = { ...context, selectedTimeMode: timeMode };
  const historicalRange =
    timeMode === "historical"
      ? getCoverageRangeForRequirement(rows, requirement, { market })
      : null;
  const periodDates =
    timeMode === "historical"
      ? {
          startDate: historicalRange?.first?.date || "",
          endDate: historicalRange?.last?.date || "",
        }
      : getTimeSelectionDates(selection);
  const { startDate, endDate } = periodDates;

  if (!sourceRows.length || !startDate || !endDate) return [];

  if (timeMode === "month") {
    return getRowsForPeriod(sourceRows, endDate);
  }

  const aggregationType =
    timeMode === "annual" ? "annual" : timeMode === "historical" ? "historical" : timeMode;
  const periodRows = buildAggregatedRowsFromMonthly(sourceRows, {
    startDate,
    endDate,
    aggregationType,
    selectedMetric: requirement,
    includeBenchmark,
    includeForecasts,
  });

  if (timeMode !== "historical" || !historicalRange?.label) return periodRows;

  const historicalPrefix = getHistoricalPeriodPrefix(requirement);
  const periodLabel = `${historicalPrefix} · ${historicalRange.label}`;
  const periodDetail = `${historicalPrefix} calculado desde ${historicalRange.first.label} hasta ${historicalRange.last.label}.`;

  return periodRows.map((row) => ({
    ...row,
    period_label: periodLabel,
    period_display_label: periodLabel,
    period_detail: periodDetail,
    time_mode: "historical",
    aggregation_type: "historical",
    metric_requirement: requirement,
  }));
}


function buildRowsForTimeSelection(rows = [], selection = {}, options = {}) {
  const {
    market = "",
    metricKeys = [],
    requireAll = true,
    selectedMetric = "",
    includeBenchmark = false,
    includeForecasts = false,
  } = options;
  const metricFilters = Array.isArray(metricKeys) ? metricKeys.filter(Boolean) : [];
  const fallbackMetric = selectedMetric ? [selectedMetric] : [];
  const filters = metricFilters.length ? metricFilters : fallbackMetric;
  const metricRequirement =
    options.metricRequirement || getMetricRequirementForFilters(filters, selectedMetric);
  const periodRows = buildRowsForPeriod(rows, { ...selection, market }, metricRequirement, {
    market,
    includeBenchmark,
    includeForecasts,
  });

  return filters.length ? filterRowsWithMetrics(periodRows, filters, requireAll) : periodRows;
}

function filterRowsForTimeSeries(rows = [], selection = {}, options = {}) {
  const {
    market = "",
    metricKeys = [],
    includeBenchmark = true,
    includeForecasts = false,
  } = options;
  const { startDate, endDate } = getTimeSelectionDates(selection);
  const startMonthKey = String(startDate || "").slice(0, 7);
  const endMonthKey = String(endDate || "").slice(0, 7);
  if (!startMonthKey || !endMonthKey) return [];

  return preferObservedRows(
    filterRowsWithMetrics(
      filterInterfaceRows(
        rows,
        { periodType: "monthly", market },
        { includeBenchmark, includeForecasts },
      ),
      metricKeys,
      false,
    ),
  ).filter((row) => {
    const monthKey = String(row?.date || "").slice(0, 7);
    return monthKey >= startMonthKey && monthKey <= endMonthKey;
  });
}

function buildDataCoverageItems(rows = [], { market = "" } = {}) {
  const coverageDefinitions = [
    {
      key: "revenue",
      label: "Facturación",
      requirement: "revenue",
      availableReason: "Datos disponibles",
      unavailableReason: "No disponible",
    },
    {
      key: "visits",
      label: "Visitas",
      requirement: "visits",
      availableReason: "Datos disponibles",
      unavailableReason: "No disponible",
    },
    {
      key: "market_share_revenue",
      label: "Cuota facturación",
      requirement: "revenue_share",
      availableReason: "Recalculada desde facturación",
      unavailableReason: "Requiere facturación",
    },
    {
      key: "market_share_visits",
      label: "Cuota visitas",
      requirement: "visits_share",
      availableReason: "Recalculada desde visitas",
      unavailableReason: "Requiere visitas",
    },
    {
      key: "monetization_gap",
      label: "Brecha monetización",
      requirement: "comparable_revenue_visits",
      availableReason: "Rango común facturación + visitas",
      unavailableReason: "Requiere facturación + visitas",
    },
  ];

  return coverageDefinitions.map((definition) => {
    const coverage = getCoverageRangeForRequirement(rows, definition.requirement, { market });
    const available = Boolean(coverage.first && coverage.last);

    return {
      key: definition.key,
      label: definition.label,
      available,
      statusLabel: available ? coverage.label : "No disponible",
      reason: available ? definition.availableReason : definition.unavailableReason,
      first: coverage.first,
      last: coverage.last,
    };
  });
}

function buildPeriodStatusItems(metricAvailability = {}) {
  return [
    metricAvailability.revenue,
    metricAvailability.visits,
    metricAvailability.market_share_revenue,
    metricAvailability.market_share_visits,
    metricAvailability.monetization_gap,
  ].filter(Boolean);
}

function useScopedPeriodSelection({
  rows = [],
  metricKeys = [],
  requireAll = true,
  periodRowsValidator,
  selectedMetric = "",
  includeBenchmark = false,
  includeForecasts = false,
} = {}) {
  const [selectedTimeMode, setSelectedTimeMode] = useState("month");
  const [market, setMarket] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [rangeStartMonth, setRangeStartMonth] = useState("");
  const [rangeEndMonth, setRangeEndMonth] = useState("");
  const requestedMetricKeys = useMemo(
    () => (Array.isArray(metricKeys) ? metricKeys.filter(Boolean) : []),
    [metricKeys],
  );
  const isMetricScoped = requestedMetricKeys.length > 0 || Boolean(selectedMetric);
  const availabilityMetric = isMetricScoped
    ? getPrimaryAvailabilityMetric(requestedMetricKeys, selectedMetric)
    : "";
  const effectiveMetricKeys = useMemo(() => {
    const keys = requestedMetricKeys;
    if (!keys.length) return [];
    if (keys.every((key) => key.includes("share_") && key.includes("_change_"))) {
      return [availabilityMetric];
    }
    return keys;
  }, [availabilityMetric, requestedMetricKeys]);
  const filteredRows = useMemo(
    () =>
      filterRowsWithMetrics(
        rows,
        effectiveMetricKeys,
        effectiveMetricKeys.length ? requireAll : false,
      ),
    [effectiveMetricKeys, requireAll, rows],
  );

  const markets = useMemo(
    () => getMarkets(filteredRows, "monthly", { includeBenchmark, includeForecasts }),
    [filteredRows, includeBenchmark, includeForecasts],
  );

  useEffect(() => {
    if (!markets.length) {
      setMarket("");
      return;
    }

    if (!market || !markets.includes(market)) {
      setMarket(markets[0]);
    }
  }, [market, markets]);

  const metricAvailabilityOptions = useMemo(
    () => ({ market, includeBenchmark: false, includeForecasts, mode: selectedTimeMode }),
    [includeForecasts, market, selectedTimeMode],
  );
  const availableYears = useMemo(
    () =>
      isMetricScoped
        ? getAvailableYears(filteredRows, availabilityMetric, metricAvailabilityOptions)
        : getGlobalAvailableYears(filteredRows, metricAvailabilityOptions),
    [availabilityMetric, filteredRows, isMetricScoped, metricAvailabilityOptions],
  );

  useEffect(() => {
    if (!TIME_MODE_KEYS.includes(selectedTimeMode)) {
      setSelectedTimeMode("month");
    }
  }, [selectedTimeMode]);

  useEffect(() => {
    if (!availableYears.length) {
      setSelectedYear("");
      return;
    }

    if (!selectedYear || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedTimeMode, selectedYear]);

  const monthOptions = useMemo(
    () =>
      isMetricScoped
        ? getAvailableMonthsForYear(
            filteredRows,
            selectedYear,
            availabilityMetric,
            metricAvailabilityOptions,
          )
        : getGlobalAvailableMonthsForYear(filteredRows, selectedYear, metricAvailabilityOptions),
    [availabilityMetric, filteredRows, isMetricScoped, metricAvailabilityOptions, selectedYear],
  );

  useEffect(() => {
    if (!monthOptions.length) {
      setSelectedMonth("");
      return;
    }

    const latestMonth = monthOptions[monthOptions.length - 1];
    if (!selectedMonth || !monthOptions.includes(Number(selectedMonth))) {
      setSelectedMonth(String(latestMonth));
    }
  }, [monthOptions, selectedMonth]);

  const rangeBounds = useMemo(
    () =>
      isMetricScoped
        ? getAvailableRangeBounds(filteredRows, availabilityMetric, metricAvailabilityOptions)
        : getGlobalAvailableRangeBounds(filteredRows, metricAvailabilityOptions),
    [availabilityMetric, filteredRows, isMetricScoped, metricAvailabilityOptions],
  );
  const rangeMonthOptions = rangeBounds.months;

  useEffect(() => {
    if (!rangeMonthOptions.length) {
      setRangeStartMonth("");
      setRangeEndMonth("");
      return;
    }

    const first = rangeBounds.first?.key || rangeMonthOptions[0].key;
    const last = rangeBounds.last?.key || rangeMonthOptions[rangeMonthOptions.length - 1].key;

    if (!rangeStartMonth || !rangeMonthOptions.some((month) => month.key === rangeStartMonth)) {
      setRangeStartMonth(first);
    }

    if (!rangeEndMonth || !rangeMonthOptions.some((month) => month.key === rangeEndMonth)) {
      setRangeEndMonth(last);
    }
  }, [rangeBounds.first?.key, rangeBounds.last?.key, rangeEndMonth, rangeMonthOptions, rangeStartMonth]);

  useEffect(() => {
    if (selectedTimeMode !== "range") return;
    if (!rangeStartMonth || !rangeEndMonth) return;
    if (compareRangeMonthKeys(rangeStartMonth, rangeEndMonth) <= 0) return;

    setRangeEndMonth(rangeStartMonth);
  }, [rangeEndMonth, rangeStartMonth, selectedTimeMode]);

  const annualEndMonth = monthOptions.includes(12)
    ? 12
    : monthOptions[monthOptions.length - 1] || "";
  const timeSelection = useMemo(
    () => ({
      selectedTimeMode: normalizeTimeMode(selectedTimeMode),
      timeMode: normalizeTimeMode(selectedTimeMode),
      selectedYear,
      selectedMonth: Number(selectedMonth),
      annualEndMonth: Number(annualEndMonth),
      rangeStartMonth,
      rangeEndMonth,
      monthOptions,
      rangeMonthOptions,
    }),
    [
      annualEndMonth,
      monthOptions,
      rangeMonthOptions,
      rangeEndMonth,
      rangeStartMonth,
      selectedMonth,
      selectedTimeMode,
      selectedYear,
    ],
  );
  const selectedPeriod = useMemo(() => buildGlobalPeriod(timeSelection), [timeSelection]);
  const globalContext = useMemo(
    () => ({
      market,
      timeMode: normalizeTimeMode(selectedTimeMode),
      selectedTimeMode: normalizeTimeMode(selectedTimeMode),
      selectedYear,
      selectedMonth: Number(selectedMonth) || null,
      rangeStart: rangeStartMonth,
      rangeEnd: rangeEndMonth,
      rangeStartMonth,
      rangeEndMonth,
      selectedPeriod,
      periodLabel: selectedPeriod?.label || "",
    }),
    [
      market,
      rangeEndMonth,
      rangeStartMonth,
      selectedMonth,
      selectedPeriod,
      selectedTimeMode,
      selectedYear,
    ],
  );
  const periodRows = useMemo(
    () =>
      buildRowsForTimeSelection(filteredRows, timeSelection, {
        market,
        metricKeys: effectiveMetricKeys,
        requireAll,
        selectedMetric: isMetricScoped ? availabilityMetric : "",
        includeBenchmark,
        includeForecasts,
      }),
    [
      availabilityMetric,
      filteredRows,
      effectiveMetricKeys,
      includeBenchmark,
      includeForecasts,
      isMetricScoped,
      market,
      requireAll,
      timeSelection,
    ],
  );
  const validPeriodRows = useMemo(() => {
    if (!periodRowsValidator || periodRowsValidator(periodRows)) return periodRows;
    return [];
  }, [periodRows, periodRowsValidator]);
  const latestAvailableMonth = rangeBounds.last;
  const metricLabel = capitalizeCopy(getMetricCopy(availabilityMetric));
  const metricAvailability = useMemo(
    () =>
      getMetricAvailability(validPeriodRows, filteredRows, {
        market,
        selectedPeriod,
      }),
    [filteredRows, market, selectedPeriod, validPeriodRows],
  );
  const availabilityItems = useMemo(
    () => buildDataCoverageItems(filteredRows, { market }),
    [filteredRows, market],
  );
  const periodStatusItems = useMemo(
    () => buildPeriodStatusItems(metricAvailability),
    [metricAvailability],
  );
  const dataNote = useMemo(() => {
    if (!isMetricScoped) {
      if (!latestAvailableMonth) return "No hay datos reales disponibles para este mercado.";
      if (selectedTimeMode !== "month" && selectedPeriod?.detail) return selectedPeriod.detail;
      return `Datos reales disponibles hasta ${latestAvailableMonth.label}.`;
    }
    if (selectedTimeMode === "annual" && !availableYears.length) {
      return `No hay años completos Ene-Dic para ${metricLabel.toLowerCase()}.`;
    }
    if (!latestAvailableMonth) return "No hay datos disponibles para esta métrica.";
    if (selectedTimeMode === "annual" && selectedPeriod) {
      return selectedPeriod.partial_year
        ? `${selectedYear} parcial: acumulado Ene-${selectedPeriod.latest_month_label}.`
        : `Año ${selectedYear}: acumulado enero-diciembre.`;
    }
    if (selectedTimeMode === "historical" && selectedPeriod) {
      return selectedPeriod.detail || "Histórico calculado desde los datos mensuales disponibles.";
    }
    if (selectedTimeMode === "range" && selectedPeriod) {
      return selectedPeriod.detail || "Rango calculado desde datos mensuales disponibles.";
    }

    return `${metricLabel} disponible hasta ${latestAvailableMonth.label}.`;
  }, [
    availableYears.length,
    isMetricScoped,
    latestAvailableMonth,
    metricLabel,
    selectedPeriod,
    selectedPeriod?.latest_month_label,
    selectedPeriod?.partial_year,
    selectedTimeMode,
    selectedYear,
  ]);
  const periodOptions = useMemo(
    () => [
      selectedPeriod,
    ].filter(Boolean),
    [selectedPeriod],
  );

  const setSafeTimeMode = (mode) => {
    if (!TIME_MODE_KEYS.includes(mode)) return;
    setSelectedTimeMode(mode);
  };

  const selectableRangeEndMonths = useMemo(
    () =>
      rangeMonthOptions.filter(
        (month) => !rangeStartMonth || compareRangeMonthKeys(month.key, rangeStartMonth) >= 0,
      ),
    [rangeMonthOptions, rangeStartMonth],
  );
  const selectableRangeStartMonths = useMemo(
    () =>
      rangeMonthOptions.filter(
        (month) => !rangeEndMonth || compareRangeMonthKeys(month.key, rangeEndMonth) <= 0,
      ),
    [rangeEndMonth, rangeMonthOptions],
  );

  return {
    market,
    markets,
    onMarketChange: setMarket,
    selectedTimeMode,
    timeModeOptions: TIME_MODE_OPTIONS,
    onTimeModeChange: setSafeTimeMode,
    selectedYear,
    onSelectedYearChange: setSelectedYear,
    selectedMonth: String(selectedMonth || ""),
    onSelectedMonthChange: setSelectedMonth,
    rangeStartMonth,
    onRangeStartMonthChange: setRangeStartMonth,
    rangeEndMonth,
    onRangeEndMonthChange: setRangeEndMonth,
    availableYears,
    monthOptions,
    rangeMonthOptions,
    selectableRangeStartMonths,
    selectableRangeEndMonths,
    dataNote,
    availabilityItems,
    periodStatusItems,
    datasetCoverageItems: availabilityItems,
    metricAvailability,
    selectedMetric: availabilityMetric,
    periodType: normalizeTimeMode(selectedTimeMode) === "month" ? "monthly" : normalizeTimeMode(selectedTimeMode),
    periodTypes: TIME_MODE_KEYS,
    onPeriodTypeChange: setSafeTimeMode,
    sourcePeriodType: "monthly",
    selectedPeriod,
    periodLabel: selectedPeriod?.label || "",
    selectedPeriodKey: selectedPeriod?.key || "",
    onSelectedPeriodChange: () => {},
    periodOptions,
    periodRows: validPeriodRows,
    rawPeriodRows: periodRows,
    timeSelection,
    globalContext,
  };
}

function EmptyState({ title, message, actions = [] }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-black/15 bg-[#fbf8f5] p-8 text-center">
      <div>
        <p className="text-sm font-semibold text-black">{title}</p>
        {message && <p className="mt-2 text-sm leading-6 text-neutral-500">{message}</p>}
        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="empty-state-action"
                onClick={action.onClick}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ForecastCaveat({ className = "" }) {
  return <span className={`forecast-caveat ${className}`}>Forecast = proyección. No debe leerse como dato observado.</span>;
}

function SelectField({ label, value, onChange, children, disabled = false, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="analysis-label">{label}</span>
      <select
        className="control w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function withAvailability(options = [], availability = {}) {
  return options.map((option) => {
    const item = availability?.[option.key] ?? null;
    const available = item ? item.available : true;

    return {
      ...option,
      availability: item,
      disabled: !available,
      reason: item?.reason || "",
    };
  });
}

function getPreferredAvailableOption(options = [], preferredKeys = []) {
  const preferred = preferredKeys
    .map((key) => options.find((option) => option.key === key && !option.disabled))
    .find(Boolean);

  return preferred ?? options.find((option) => !option.disabled) ?? null;
}

function getSelectOptionLabel(option = {}) {
  if (!option.disabled) return `${option.label} · disponible`;

  return [option.label, "no disponible", option.reason].filter(Boolean).join(" · ");
}

function AvailabilityList({ items = [] }) {
  if (!items.length) return null;

  return (
    <ul className="data-coverage-list">
      {items.map((item) => (
        <li
          key={item.key}
          className={`data-coverage-item ${item.available ? "data-coverage-item-ok" : ""}`}
        >
          <span>{item.label}</span>
          <strong>{item.statusLabel}</strong>
          {item.reason && <small>{item.reason}</small>}
        </li>
      ))}
    </ul>
  );
}

function DataCoveragePanel({ periodItems = [], coverageItems = [] }) {
  if (!periodItems.length && !coverageItems.length) return null;

  return (
    <section className="data-coverage-panel" aria-label="Estado y cobertura de datos">
      {periodItems.length > 0 && (
        <div className="data-coverage-section">
          <p className="analysis-label">Estado del periodo seleccionado</p>
          <AvailabilityList items={periodItems} />
        </div>
      )}
      {coverageItems.length > 0 && (
        <div className="data-coverage-section">
          <p className="analysis-label">Cobertura general del dataset</p>
          <AvailabilityList items={coverageItems} />
        </div>
      )}
    </section>
  );
}

function StatusShell({ title, message }) {
  return (
    <main className="app-shell">
      <div className="mx-auto max-w-3xl">
        <Panel eyebrow="Inteligencia competitiva" title="Focus Brand">
          <EmptyState title={title} message={message} />
        </Panel>
      </div>
    </main>
  );
}

function FocusLogo() {
  if (FOCUS_LOGO_SRC) {
    return <img className="brand-logo" src={FOCUS_LOGO_SRC} alt="Focus Brand" />;
  }

  return (
    <span className="brand-logo brand-logo-fallback" aria-label="Focus Brand">
      FB
    </span>
  );
}

function getCompanyFallbackLabel(label, companyId) {
  const displayLabel = label || companyId || "Empresa";

  return String(displayLabel).trim().slice(0, 1).toUpperCase() || "?";
}

function CompanyMark({ companyId, label, color = "#6F6864", className = "" }) {
  const [hasLogoError, setHasLogoError] = useState(false);
  const logoSrc = getCompanyLogoSrc(companyId);
  const fallbackLabel = getCompanyFallbackLabel(label, companyId);

  return (
    <span className={`company-mark ${className}`} aria-hidden="true">
      {logoSrc && !hasLogoError ? (
        <img
          src={logoSrc}
          alt=""
          loading="lazy"
          className="company-mark-logo"
          onError={() => setHasLogoError(true)}
        />
      ) : (
        <span className="company-mark-fallback" style={{ backgroundColor: color }}>
          {fallbackLabel}
        </span>
      )}
    </span>
  );
}

function SvgCompanyLogoBadge({
  companyId,
  label,
  color = "#6F6864",
  x = 0,
  y = 0,
  width = 34,
  height = 24,
}) {
  const logoSrc = getCompanyLogoSrc(companyId);
  const fallbackLabel = getCompanyFallbackLabel(label, companyId);
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect
        width={width}
        height={height}
        rx="4"
        fill="#ffffff"
        stroke="rgba(0,0,0,0.16)"
        strokeWidth="1"
      />
      {logoSrc ? (
        <image
          href={logoSrc}
          x="4"
          y="4"
          width={width - 8}
          height={height - 8}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <>
          <circle cx={centerX} cy={centerY} r={Math.min(width, height) / 3} fill={color} />
          <text
            x={centerX}
            y={centerY}
            fill="#ffffff"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {fallbackLabel}
          </text>
        </>
      )}
    </g>
  );
}

function ChartTooltipShell({ title, children }) {
  return (
    <div className="chart-tooltip">
      {title && <p className="chart-tooltip-title">{title}</p>}
      <div className="chart-tooltip-list">{children}</div>
    </div>
  );
}

function isIndexedMetric(metricKey = "") {
  return String(metricKey).startsWith("indexed_");
}

function getIndexedSourceMetric(metricKey = "") {
  return INDEXED_SOURCE_METRICS[metricKey] || metricKey;
}

function getIndexedMetricDisplayLabel(metricKey = "") {
  const sourceMetric = getIndexedSourceMetric(metricKey);
  return sourceMetric === "revenue" ? "facturación" : "visitas";
}

function formatIndexedTooltipValue(value) {
  const number = safeNumber(value);
  if (number === null) return "";
  const indexValue = formatNumber(number, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `Índice: ${indexValue}`;
}

function getIndexedTooltipDetails(point = {}, fallbackValue = null, metricKey = "") {
  const sourceMetric = point.sourceMetric || getIndexedSourceMetric(metricKey);
  const currentValue = safeNumber(point.actualValue);
  const baseValue = safeNumber(point.baseValue);
  const indexValue = safeNumber(fallbackValue);
  const changeVsBase =
    currentValue !== null && baseValue !== null && baseValue > 0
      ? currentValue / baseValue - 1
      : indexValue !== null
        ? indexValue / 100 - 1
        : null;

  return [
    currentValue !== null ? `Valor actual: ${formatMetric(currentValue, sourceMetric)}` : "",
    point.baseLabel ? `Base: ${point.baseLabel}` : "",
    baseValue !== null ? `Valor base: ${formatMetric(baseValue, sourceMetric)}` : "",
    changeVsBase !== null ? `Cambio vs base: ${formatSignedPercent(changeVsBase)}` : "",
  ].filter(Boolean);
}

function getAnnualGrowthTooltipDetails(point = {}, metricKey = "") {
  const sourceMetric = point.sourceMetric || getGrowthBaseMetricKey(metricKey);
  const currentValue = safeNumber(point.currentValue ?? point.actualValue);
  const previousValue = safeNumber(point.previousValue);

  return [
    point.comparisonLabel ? `Comparativa: ${point.comparisonLabel}` : "",
    point.monthRange ? `Periodo comparable: ${point.monthRange}` : "",
    currentValue !== null ? `Valor actual: ${formatMetric(currentValue, sourceMetric)}` : "",
    previousValue !== null ? `Año anterior: ${formatMetric(previousValue, sourceMetric)}` : "",
  ].filter(Boolean);
}

function formatIndexedAxisTick(value) {
  const number = safeNumber(value);
  if (number === null) return "";
  return formatNumber(number, { maximumFractionDigits: 0 });
}

function MultiSeriesTooltip({ active, payload = [], label, metricKey, seriesById }) {
  if (!active || !payload.length) return null;

  const rows = payload
    .map((item) => {
      const value = safeNumber(item.value);
      if (value === null) return null;

      const companyInfo = seriesById.get(normalizeCompanyId(item.dataKey)) ?? {};
      const point =
        item.payload?.__points?.[companyInfo.company_id || item.dataKey] ||
        item.payload?.__points?.[normalizeCompanyId(item.dataKey)] ||
        {};
      const isIndexed = isIndexedMetric(metricKey);
      const isGrowth = isGrowthMetric(metricKey);

      return {
        id: companyInfo.company_id || item.dataKey,
        name: companyInfo.display_name || item.name,
        color: companyInfo.company_color || item.color || "#6F6864",
        value,
        valueLabel: isIndexed
          ? formatIndexedTooltipValue(value)
          : isGrowth
            ? formatSignedPercent(value)
            : formatMetric(value, metricKey),
        details: isIndexed
          ? getIndexedTooltipDetails(point, value, metricKey)
          : isGrowth
            ? getAnnualGrowthTooltipDetails(point, metricKey)
            : [],
      };
    })
    .filter(Boolean);

  if (!rows.length) return null;

  return (
    <ChartTooltipShell title={`Período: ${formatChartPeriodLabel(label)}`}>
      {rows.map((row) => (
        <div key={`${row.id}-${row.value}`} className="chart-tooltip-row">
          <span className="chart-tooltip-company">
            <CompanyMark
              companyId={row.id}
              label={row.name}
              color={row.color}
              className="company-mark-tooltip"
            />
            <span>{row.name}</span>
          </span>
          <span className="chart-tooltip-value">
            {row.valueLabel}
            {row.details.map((detail) => (
              <small key={`${row.id}-${detail}`}>{detail}</small>
            ))}
          </span>
        </div>
      ))}
    </ChartTooltipShell>
  );
}

function SingleMetricTooltip({ active, payload = [], metricKey, totalValue = null }) {
  if (!active || !payload.length) return null;

  const item = payload[0];
  const entry = item.payload ?? {};
  const value = safeNumber(item.value ?? entry.value);
  if (value === null) return null;

  const share = totalValue ? value / totalValue : null;
  const hasGrowthBreakdown =
    entry.previousValue !== undefined &&
    entry.currentValue !== undefined &&
    entry.baseMetricKey;

  return (
    <ChartTooltipShell title={entry.name || item.name}>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-company">
          <CompanyMark
            companyId={entry.id}
            label={entry.name}
            color={entry.color || item.color}
            className="company-mark-tooltip"
          />
          <span>{entry.name || item.name}</span>
        </span>
        <span className="chart-tooltip-value">
          {isGrowthMetric(metricKey) ? formatSignedPercent(value) : formatMetric(value, metricKey)}
          {share !== null ? ` · ${formatPercent(share)}` : ""}
        </span>
      </div>
      {hasGrowthBreakdown && (
        <div className="chart-tooltip-yoy">
          <span>
            <small>Antes</small>
            {formatMetric(entry.previousValue, entry.baseMetricKey)}
          </span>
          <span>
            <small>Crecimiento</small>
            {formatSignedPercent(entry.growthValue)}
          </span>
          <span>
            <small>Ahora</small>
            {formatMetric(entry.currentValue, entry.baseMetricKey)}
          </span>
        </div>
      )}
    </ChartTooltipShell>
  );
}

function getLastValueIndexes(chartData = [], series = []) {
  const indexes = new Map();

  series.forEach((companySeries) => {
    for (let index = chartData.length - 1; index >= 0; index -= 1) {
      if (safeNumber(chartData[index]?.[companySeries.company_id]) !== null) {
        indexes.set(normalizeCompanyId(companySeries.company_id), index);
        break;
      }
    }
  });

  return indexes;
}

function LineLogoLabel({ x, y, index, companySeries, lastPointIndex }) {
  const pointX = Number(x);
  const pointY = Number(y);

  if (index !== lastPointIndex || !Number.isFinite(pointX) || !Number.isFinite(pointY)) {
    return null;
  }

  if (isBenchmarkRow(companySeries)) {
    const label = companySeries.display_name || "Market Average";
    const width = Math.max(118, Math.min(156, label.length * 7 + 18));

    return (
      <g transform={`translate(${pointX + 8}, ${pointY - 12})`} pointerEvents="none">
        <rect
          width={width}
          height="24"
          rx="4"
          fill="#ffffff"
          stroke={companySeries.company_color}
          strokeWidth="1"
        />
        <text
          x="9"
          y="12"
          fill={companySeries.company_color}
          fontSize="11"
          fontWeight="700"
          dominantBaseline="central"
        >
          {label}
        </text>
      </g>
    );
  }

  return (
    <SvgCompanyLogoBadge
      companyId={companySeries.company_id}
      label={companySeries.display_name}
      color={companySeries.company_color}
      x={pointX + 8}
      y={pointY - 12}
    />
  );
}

function PieLogoLabel({ cx, cy, midAngle, outerRadius, payload, percent }) {
  if (!payload || percent < 0.04) return null;

  const radius = Number(outerRadius) + 14;
  const angle = (-midAngle * Math.PI) / 180;
  const x = Number(cx) + radius * Math.cos(angle) - 17;
  const y = Number(cy) + radius * Math.sin(angle) - 12;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return (
    <SvgCompanyLogoBadge
      companyId={payload.id}
      label={payload.name}
      color={payload.color}
      x={x}
      y={y}
    />
  );
}

function RankingBarLogoTick({ x, y, payload, entriesById }) {
  const entry = entriesById.get(normalizeCompanyId(payload?.value));
  const pointX = Number(x);
  const pointY = Number(y);

  if (!entry || !Number.isFinite(pointX) || !Number.isFinite(pointY)) return null;

  return (
    <SvgCompanyLogoBadge
      companyId={entry.id}
      label={entry.name}
      color={entry.color}
      x={pointX - 48}
      y={pointY - 12}
    />
  );
}

function LoadingShell() {
  return (
    <main className="app-shell">
      <div className="mx-auto max-w-7xl">
        <section className="surface-card border-t-4 border-t-accent-500 p-6 md:p-8">
          <div className="brand-lockup">
            <FocusLogo />
            <span className="metric-pill">Inteligencia competitiva</span>
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-black md:text-5xl">
            Comparativa competitiva
          </h1>
          <p className="mt-4 text-sm text-neutral-600">Cargando datos del análisis.</p>
        </section>
      </div>
    </main>
  );
}

function AppHeader({
  view,
  onGoBenchmark,
  onOpenPlayers,
  onOpenBattleArena,
  onOpenForecast,
  generatedAt,
  rowCount,
  dataSourceStatus,
}) {
  const isProfile = view === "profile";
  const isForecast = view === "forecast";
  const isBattle = view === "battle";
  const title = isProfile
    ? "Ficha individual"
    : isForecast
      ? "Proyección de mercado"
      : isBattle
        ? "Battle Arena"
      : "Comparativa competitiva";

  return (
    <header className="surface-card border-t-4 border-t-accent-500 p-5 md:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="brand-lockup">
            <FocusLogo />
            <span className="metric-pill">Inteligencia competitiva</span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold text-black md:text-5xl">
            {title}
          </h1>
        </div>
        <div className="grid gap-1 text-sm text-neutral-500 sm:grid-cols-[auto_auto] lg:text-right">
          <span>Actualizado</span>
          <span className="font-medium text-black">{generatedAt}</span>
          <span>Filas interface</span>
          <span className="font-medium text-black">{rowCount}</span>
          <span>Fuente de datos</span>
          <span>
            <span
              className={`data-source-badge data-source-badge-${dataSourceStatus.type}`}
            >
              {dataSourceStatus.label}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/10 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onGoBenchmark}
            className={!isProfile && !isForecast && !isBattle ? "primary-action" : "section-link"}
          >
            Panel principal
          </button>
          <button
            type="button"
            onClick={onOpenPlayers}
            className={isProfile ? "primary-action" : "section-link"}
          >
            Players
          </button>
          <button
            type="button"
            onClick={onOpenBattleArena}
            className={isBattle ? "primary-action" : "section-link"}
          >
            Battle Arena
          </button>
          <button
            type="button"
            onClick={onOpenForecast}
            className={isForecast ? "primary-action" : "section-link"}
          >
            Forecast
          </button>
          {isProfile && (
            <span className="metric-pill bg-white text-black">Ficha por empresa</span>
          )}
          {isForecast && (
            <span className="metric-pill bg-white text-black">Proyección</span>
          )}
          {isBattle && (
            <span className="metric-pill bg-white text-black">Rondas comparativas</span>
          )}
        </div>
      </div>
    </header>
  );
}

function CompanyLegend({
  series,
  hiddenCompanyIds = EMPTY_HIDDEN_COMPANY_IDS,
  onToggleCompany,
  onShowAll,
  onHideAll,
}) {
  if (!series.length) return null;

  const activeCount = series.filter(
    (companySeries) => !hiddenCompanyIds.has(normalizeCompanyId(companySeries.company_id)),
  ).length;

  return (
    <details className="legend-disclosure">
      <summary className="legend-summary">
        <span>Series visibles {activeCount}/{series.length}</span>
        <span className="legend-summary-hint">Editar selección</span>
      </summary>

      <div className="legend-panel">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="legend-action" onClick={onShowAll}>
            Todos
          </button>
          <button type="button" className="legend-action" onClick={onHideAll}>
            Ninguno
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
        {series.map((companySeries) => {
          const companyKey = normalizeCompanyId(companySeries.company_id);
          const isActive = !hiddenCompanyIds.has(companyKey);

          return (
            <button
              key={companySeries.company_id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggleCompany(companySeries.company_id)}
              className={`legend-toggle ${isActive ? "legend-toggle-active" : "legend-toggle-muted"}`}
            >
              <CompanyMark
                companyId={companySeries.company_id}
                label={companySeries.display_name}
                color={companySeries.company_color}
                className="company-mark-legend"
              />
              <span className="truncate">{companySeries.display_name}</span>
            </button>
          );
        })}
        </div>
      </div>
    </details>
  );
}

function useCompanyVisibility(series, defaultVisibleCompanyIds = []) {
  const [hiddenCompanyIds, setHiddenCompanyIds] = useState(new Set());
  const seriesVisibilityKey = useMemo(() => getSeriesVisibilityKey(series), [series]);
  const defaultVisibilityKey = useMemo(
    () => defaultVisibleCompanyIds.map(normalizeCompanyId).filter(Boolean).join("|"),
    [defaultVisibleCompanyIds],
  );

  useEffect(() => {
    const availableCompanyIds = getCompanyIdSet(series.map((companySeries) => companySeries.company_id));
    const normalizedDefaults = new Set(
      [...getCompanyIdSet(defaultVisibleCompanyIds)].filter((companyId) =>
        availableCompanyIds.has(companyId),
      ),
    );

    setHiddenCompanyIds((currentHiddenCompanyIds) => {
      if (normalizedDefaults.size) {
        return new Set(
          [...availableCompanyIds].filter((companyId) => !normalizedDefaults.has(companyId)),
        );
      }

      return new Set(
        [...currentHiddenCompanyIds].filter((companyId) => availableCompanyIds.has(companyId)),
      );
    });
  }, [defaultVisibilityKey, seriesVisibilityKey]);

  const handleToggleCompany = (companyId) => {
    const companyKey = normalizeCompanyId(companyId);
    if (!companyKey) return;

    setHiddenCompanyIds((currentHiddenCompanyIds) => {
      const nextHiddenCompanyIds = new Set(currentHiddenCompanyIds);

      if (nextHiddenCompanyIds.has(companyKey)) {
        nextHiddenCompanyIds.delete(companyKey);
      } else {
        nextHiddenCompanyIds.add(companyKey);
      }

      return nextHiddenCompanyIds;
    });
  };

  const handleShowAll = () => {
    setHiddenCompanyIds(new Set());
  };

  const handleHideAll = () => {
    setHiddenCompanyIds(getCompanyIdSet(series.map((companySeries) => companySeries.company_id)));
  };

  return {
    hiddenCompanyIds,
    handleToggleCompany,
    handleShowAll,
    handleHideAll,
  };
}

function MetricChart({
  title,
  metricKey,
  series,
  chartData,
  emptyTitle,
  hiddenCompanyIds = EMPTY_HIDDEN_COMPANY_IDS,
  yAxisReversed = false,
}) {
  const activeSeries = useMemo(
    () =>
      series.filter(
        (companySeries) => !hiddenCompanyIds.has(normalizeCompanyId(companySeries.company_id)),
      ),
    [hiddenCompanyIds, series],
  );
  const hasSourceData = series.length > 0 && chartData.length > 0;
  const hasData = activeSeries.length > 0 && chartData.length > 0;
  const forecastWindow = useMemo(() => getForecastWindow(chartData), [chartData]);
  const seriesById = useMemo(() => {
    const seriesMap = new Map();
    activeSeries.forEach((companySeries) => {
      seriesMap.set(normalizeCompanyId(companySeries.company_id), companySeries);
    });
    return seriesMap;
  }, [activeSeries]);
  const lastValueIndexes = useMemo(
    () => getLastValueIndexes(chartData, activeSeries),
    [activeSeries, chartData],
  );

  return (
    <Panel eyebrow="Evolución" title={title}>
      <div className="h-[340px] min-w-0 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData} margin={{ top: 10, right: 62, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
              {forecastWindow && forecastWindow.start.label !== forecastWindow.end.label && (
                <ReferenceArea
                  x1={forecastWindow.start.label}
                  x2={forecastWindow.end.label}
                  fill="#E4032C"
                  fillOpacity={0.06}
                  strokeOpacity={0}
                />
              )}
              {forecastWindow && (
                <ReferenceLine
                  x={forecastWindow.start.label}
                  stroke="#E4032C"
                  strokeDasharray="4 4"
                  label={{
                    value: "Proyección",
                    position: "insideTopRight",
                    fill: "#E4032C",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              )}
              <XAxis
                dataKey="label"
                minTickGap={28}
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={formatChartPeriodLabel}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={(value) => formatMetric(value, metricKey)}
                tickLine={false}
                axisLine={false}
                width={82}
                reversed={yAxisReversed}
              />
              <Tooltip
                cursor={{ stroke: "rgba(0,0,0,0.18)" }}
                content={
                  <MultiSeriesTooltip metricKey={metricKey} seriesById={seriesById} />
                }
              />
              {activeSeries.map((companySeries) => (
                <Line
                  key={`${metricKey}-${companySeries.company_id}`}
                  type="monotone"
                  dataKey={companySeries.company_id}
                  name={companySeries.display_name}
                  stroke={companySeries.company_color}
                  strokeDasharray={isBenchmarkRow(companySeries) ? "6 5" : undefined}
                  strokeWidth={sameCompany(companySeries.company_id, OWN_COMPANY_ID) ? 3.2 : 2.2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls={false}
                >
                  <LabelList
                    content={(props) => (
                      <LineLogoLabel
                        {...props}
                        companySeries={companySeries}
                        lastPointIndex={lastValueIndexes.get(
                          normalizeCompanyId(companySeries.company_id),
                        )}
                      />
                    )}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : hasSourceData ? (
          <EmptyState
            title="No hay competidores activos."
            message="Activa al menos un competidor desde el selector de gráficas."
          />
        ) : (
          <EmptyState
            title={emptyTitle}
            message="Selecciona otro período o mercado con histórico comparable para mostrar la evolución."
          />
        )}
      </div>
      {forecastWindow && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="forecast-chip">Proyección desde {forecastWindow.start.label}</span>
          <ForecastCaveat />
        </div>
      )}
    </Panel>
  );
}

function PeriodTypeSegment({ label = "Vista", value, onChange, periodTypes = [] }) {
  if (periodTypes.length <= 1) return null;

  return (
    <div className="compact-segment-group">
      <p className="analysis-label mb-2">{label}</p>
      <div className="segmented-control">
        {periodTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`segmented-button ${value === type ? "segmented-button-active" : ""}`}
          >
            {PERIOD_TYPE_LABELS[type] || getTimeModeLabel(type)}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarketSelect({ market, onMarketChange, markets, className = "" }) {
  if (markets.length <= 1) return null;

  return (
    <SelectField
      label="Mercado"
      value={market}
      onChange={onMarketChange}
      className={`compact-select ${className}`}
    >
      {markets.map((marketOption) => (
        <option key={marketOption} value={marketOption}>
          {marketOption}
        </option>
      ))}
    </SelectField>
  );
}

function getSelectedPeriodOption(periodOptions = [], selectedPeriodKey = "") {
  return periodOptions.find((period) => period.key === selectedPeriodKey) ?? null;
}

function AnnualPeriodNote({ periodType, periodOptions = [], selectedPeriodKey = "" }) {
  if (periodType !== "annual") return null;

  const selectedPeriod = getSelectedPeriodOption(periodOptions, selectedPeriodKey);
  const selectedYear = String(selectedPeriod?.date || "").slice(0, 4) ||
    String(selectedPeriod?.key || "").replace(/^annual:/, "");
  const detail = selectedPeriod?.partial_year
    ? `${selectedYear} parcial · Ene-${selectedPeriod.latest_month_label}`
    : "Año completo · Ene-Dic";

  return <p className="period-context-note">{detail}</p>;
}

function TimeModeSegment({ value, onChange, options = TIME_MODE_OPTIONS }) {
  return (
    <div className="compact-segment-group temporal-view-segment">
      <p className="analysis-label mb-2">Vista</p>
      <div className="segmented-control temporal-mode-control">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`segmented-button ${value === option.key ? "segmented-button-active" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthSelect({ label, value, onChange, months = [], disabled = false }) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled || !months.length}
      className="compact-select compact-month-select"
    >
      {months.map((month) => (
        <option key={month} value={month}>
          {getDemoMonthLabel(month)}
        </option>
      ))}
    </SelectField>
  );
}

function RangeMonthSelect({ label, value, onChange, months = [], disabled = false }) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      disabled={disabled || !months.length}
      className="compact-select"
    >
      {months.map((month) => (
        <option key={month.key} value={month.key}>
          {month.label}
        </option>
      ))}
    </SelectField>
  );
}

function TemporalControls({
  market,
  onMarketChange,
  markets,
  selectedTimeMode,
  onTimeModeChange,
  timeModeOptions = TIME_MODE_OPTIONS,
  selectedYear,
  onSelectedYearChange,
  availableYears = [],
  selectedMonth,
  onSelectedMonthChange,
  monthOptions = [],
  rangeStartMonth,
  onRangeStartMonthChange,
  rangeEndMonth,
  onRangeEndMonthChange,
  rangeMonthOptions = [],
  selectableRangeStartMonths = rangeMonthOptions,
  selectableRangeEndMonths = rangeMonthOptions,
  dataNote = "",
  periodLabel = "",
  availabilityItems = [],
  periodStatusItems = [],
  datasetCoverageItems = availabilityItems,
}) {
  const hasYears = availableYears.length > 0;
  const showContextControls = selectedTimeMode !== "historical";
  const isPartialAnnualSelection =
    selectedTimeMode === "annual" && /parcial/i.test(String(periodLabel));
  const periodSummaryNote = isPartialAnnualSelection
    ? "Acumulado parcial, no año cerrado."
    : "";
  const trailingDataNote = isPartialAnnualSelection ? "" : dataNote;

  return (
    <div className="period-control-stack temporal-control-stack">
      <div className="temporal-control-row temporal-control-row-primary">
        <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

        <TimeModeSegment
          value={selectedTimeMode}
          onChange={onTimeModeChange}
          options={timeModeOptions}
        />
      </div>

      {showContextControls && (
        <div className="temporal-control-row temporal-control-row-context">
          {selectedTimeMode === "month" && (
            <>
              <SelectField
                label="Año"
                value={selectedYear}
                onChange={onSelectedYearChange}
                disabled={!hasYears}
                className="compact-select compact-year-select"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </SelectField>
              <MonthSelect
                label="Mes"
                value={selectedMonth}
                onChange={onSelectedMonthChange}
                months={monthOptions}
              />
            </>
          )}

          {selectedTimeMode === "annual" && (
            <SelectField
              label="Año"
              value={selectedYear}
              onChange={onSelectedYearChange}
              disabled={!hasYears}
              className="compact-select compact-year-select"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </SelectField>
          )}

          {selectedTimeMode === "range" && (
            <>
              <RangeMonthSelect
                label="Desde"
                value={rangeStartMonth}
                onChange={onRangeStartMonthChange}
                months={selectableRangeStartMonths}
              />
              <RangeMonthSelect
                label="Hasta"
                value={rangeEndMonth}
                onChange={onRangeEndMonthChange}
                months={selectableRangeEndMonths}
              />
            </>
          )}
        </div>
      )}

      {periodLabel && (
        <div className="period-summary-card">
          <span>Periodo seleccionado</span>
          <strong>{periodLabel}</strong>
          {periodSummaryNote && <small>{periodSummaryNote}</small>}
        </div>
      )}

      <DataCoveragePanel
        periodItems={periodStatusItems}
        coverageItems={datasetCoverageItems}
      />

      {trailingDataNote && <p className="period-context-note">{trailingDataNote}</p>}
    </div>
  );
}

function _RankingControls({
  market,
  onMarketChange,
  markets,
  periodType,
  onPeriodTypeChange,
  periodTypes,
  selectedPeriodKey,
  onSelectedPeriodChange,
  periodOptions,
  selectedTimeMode,
  onTimeModeChange,
  timeModeOptions,
  selectedYear,
  onSelectedYearChange,
  availableYears,
  selectedMonth,
  onSelectedMonthChange,
  monthOptions,
  rangeStartMonth,
  onRangeStartMonthChange,
  rangeEndMonth,
  onRangeEndMonthChange,
  rangeMonthOptions,
  selectableRangeStartMonths,
  selectableRangeEndMonths,
  dataNote,
  rankingSort,
  onRankingSortChange,
  rankingSortOptions = RANKING_SORTS,
  sortLabel = "Orden",
}) {
  if (selectedTimeMode) {
    return (
      <TemporalControls
        market={market}
        onMarketChange={onMarketChange}
        markets={markets}
        selectedTimeMode={selectedTimeMode}
        onTimeModeChange={onTimeModeChange}
        timeModeOptions={timeModeOptions}
        selectedYear={selectedYear}
        onSelectedYearChange={onSelectedYearChange}
        availableYears={availableYears}
        selectedMonth={selectedMonth}
        onSelectedMonthChange={onSelectedMonthChange}
        monthOptions={monthOptions}
        rangeStartMonth={rangeStartMonth}
        onRangeStartMonthChange={onRangeStartMonthChange}
        rangeEndMonth={rangeEndMonth}
        onRangeEndMonthChange={onRangeEndMonthChange}
        rangeMonthOptions={rangeMonthOptions}
        selectableRangeStartMonths={selectableRangeStartMonths}
        selectableRangeEndMonths={selectableRangeEndMonths}
        dataNote={dataNote}
      />
    );
  }

  return (
    <div className="period-control-stack">
      <div className="block-controls">
        <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

        <PeriodTypeSegment
          value={periodType}
          onChange={onPeriodTypeChange}
          periodTypes={periodTypes}
        />

        <SelectField
          label={PERIOD_TYPE_LABELS[periodType] || "Período"}
          value={selectedPeriodKey}
          onChange={onSelectedPeriodChange}
          disabled={!periodOptions.length}
          className="compact-select"
        >
          {periodOptions.map((period) => (
            <option key={period.key} value={period.key}>
              {period.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={sortLabel}
          value={rankingSort}
          onChange={onRankingSortChange}
          className="compact-select"
        >
          {rankingSortOptions.map((sort) => (
            <option key={sort.key} value={sort.key}>
              {sort.label}
            </option>
          ))}
        </SelectField>
      </div>
      <AnnualPeriodNote
        periodType={periodType}
        periodOptions={periodOptions}
        selectedPeriodKey={selectedPeriodKey}
      />
    </div>
  );
}

function PeriodContextControls({
  market,
  onMarketChange,
  markets,
  periodType,
  onPeriodTypeChange,
  periodTypes,
  selectedPeriodKey,
  onSelectedPeriodChange,
  periodOptions,
  selectedTimeMode,
  onTimeModeChange,
  timeModeOptions,
  selectedYear,
  onSelectedYearChange,
  availableYears,
  selectedMonth,
  onSelectedMonthChange,
  monthOptions,
  rangeStartMonth,
  onRangeStartMonthChange,
  rangeEndMonth,
  onRangeEndMonthChange,
  rangeMonthOptions,
  selectableRangeStartMonths,
  selectableRangeEndMonths,
  dataNote,
  availabilityItems,
  periodStatusItems,
  datasetCoverageItems,
}) {
  if (selectedTimeMode) {
    return (
      <TemporalControls
        market={market}
        onMarketChange={onMarketChange}
        markets={markets}
        selectedTimeMode={selectedTimeMode}
        onTimeModeChange={onTimeModeChange}
        timeModeOptions={timeModeOptions}
        selectedYear={selectedYear}
        onSelectedYearChange={onSelectedYearChange}
        availableYears={availableYears}
        selectedMonth={selectedMonth}
        onSelectedMonthChange={onSelectedMonthChange}
        monthOptions={monthOptions}
        rangeStartMonth={rangeStartMonth}
        onRangeStartMonthChange={onRangeStartMonthChange}
        rangeEndMonth={rangeEndMonth}
        onRangeEndMonthChange={onRangeEndMonthChange}
        rangeMonthOptions={rangeMonthOptions}
        selectableRangeStartMonths={selectableRangeStartMonths}
        selectableRangeEndMonths={selectableRangeEndMonths}
        dataNote={dataNote}
        availabilityItems={availabilityItems}
        periodStatusItems={periodStatusItems}
        datasetCoverageItems={datasetCoverageItems}
      />
    );
  }

  return (
    <div className="period-control-stack">
      <div className="block-controls">
        <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

        <PeriodTypeSegment
          value={periodType}
          onChange={onPeriodTypeChange}
          periodTypes={periodTypes}
        />

        <SelectField
          label={PERIOD_TYPE_LABELS[periodType] || "Período"}
          value={selectedPeriodKey}
          onChange={onSelectedPeriodChange}
          disabled={!periodOptions.length}
          className="compact-select"
        >
          {periodOptions.map((period) => (
            <option key={period.key} value={period.key}>
              {period.label}
            </option>
          ))}
        </SelectField>
      </div>
      <AnnualPeriodNote
        periodType={periodType}
        periodOptions={periodOptions}
        selectedPeriodKey={selectedPeriodKey}
      />
    </div>
  );
}

function ForecastControls({
  forecastScenarios = [],
  forecastScenario = "",
  onForecastScenarioChange,
  market,
  onMarketChange,
  markets,
  periodType,
  onPeriodTypeChange,
  periodTypes,
  showMarketAndPeriod = true,
}) {
  const scenarioOptions = useMemo(() => {
    const scenarioSet = new Set(
      forecastScenarios
        .map((scenario) => getForecastScenario({ forecast_scenario: scenario }))
        .filter(Boolean),
    );

    return Array.from(scenarioSet).sort((a, b) => {
      const aIndex = FORECAST_SCENARIO_ORDER.indexOf(a);
      const bIndex = FORECAST_SCENARIO_ORDER.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
      }
      return a.localeCompare(b);
    });
  }, [forecastScenarios]);
  const selectedScenario = getForecastScenario({ forecast_scenario: forecastScenario });
  const scenarioSwitchOptions = scenarioOptions.map((scenario) => ({
    key: scenario,
    label: getForecastScenarioLabel(scenario),
  }));

  return (
    <div className="block-controls">
      <MetricSwitch
        options={scenarioSwitchOptions}
        value={selectedScenario}
        onChange={onForecastScenarioChange}
        label="Escenario forecast"
      />

      {showMarketAndPeriod && (
        <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />
      )}

      {showMarketAndPeriod && (
        <PeriodTypeSegment
          label="Vista"
          value={periodType}
          onChange={onPeriodTypeChange}
          periodTypes={periodTypes}
        />
      )}
    </div>
  );
}

function ForecastCoveragePanel({ periodItems = [], coverageItems = [] }) {
  if (!periodItems.length && !coverageItems.length) return null;

  return (
    <section className="data-coverage-panel" aria-label="Estado y cobertura del forecast">
      {periodItems.length > 0 && (
        <div className="data-coverage-section">
          <p className="analysis-label">Estado del forecast seleccionado</p>
          <AvailabilityList items={periodItems} />
        </div>
      )}
      {coverageItems.length > 0 && (
        <div className="data-coverage-section">
          <p className="analysis-label">Cobertura del forecast</p>
          <AvailabilityList items={coverageItems} />
        </div>
      )}
    </section>
  );
}

function ForecastContextControls({
  forecastScenarios = [],
  forecastScenario = "",
  onForecastScenarioChange,
  market,
  onMarketChange,
  markets = [],
  selectedTimeMode,
  onTimeModeChange,
  selectedYear,
  onSelectedYearChange,
  availableYears = [],
  selectedMonth,
  onSelectedMonthChange,
  monthOptions = [],
  rangeStartMonth,
  onRangeStartMonthChange,
  rangeEndMonth,
  onRangeEndMonthChange,
  rangeMonthOptions = [],
  selectableRangeStartMonths = rangeMonthOptions,
  selectableRangeEndMonths = rangeMonthOptions,
  periodLabel = "",
  periodDetail = "",
  periodStatusItems = [],
  coverageItems = [],
  dataNote = "",
}) {
  const hasYears = availableYears.length > 0;
  const showContextControls = selectedTimeMode !== "horizon";

  return (
    <div className="period-control-stack temporal-control-stack">
      <ForecastControls
        forecastScenarios={forecastScenarios}
        forecastScenario={forecastScenario}
        onForecastScenarioChange={onForecastScenarioChange}
        market={market}
        onMarketChange={onMarketChange}
        markets={markets}
        showMarketAndPeriod={false}
      />

      <div className="temporal-control-row temporal-control-row-primary">
        <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

        <TimeModeSegment
          value={selectedTimeMode}
          onChange={onTimeModeChange}
          options={FORECAST_TIME_MODE_OPTIONS}
        />
      </div>

      {showContextControls && (
        <div className="temporal-control-row temporal-control-row-context">
          {selectedTimeMode === "month" && (
            <>
              <SelectField
                label="Año"
                value={selectedYear}
                onChange={onSelectedYearChange}
                disabled={!hasYears}
                className="compact-select compact-year-select"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </SelectField>
              <MonthSelect
                label="Mes forecast"
                value={selectedMonth}
                onChange={onSelectedMonthChange}
                months={monthOptions}
              />
            </>
          )}

          {selectedTimeMode === "annual" && (
            <SelectField
              label="Año forecast"
              value={selectedYear}
              onChange={onSelectedYearChange}
              disabled={!hasYears}
              className="compact-select compact-year-select"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </SelectField>
          )}

          {selectedTimeMode === "range" && (
            <>
              <RangeMonthSelect
                label="Desde forecast"
                value={rangeStartMonth}
                onChange={onRangeStartMonthChange}
                months={selectableRangeStartMonths}
              />
              <RangeMonthSelect
                label="Hasta forecast"
                value={rangeEndMonth}
                onChange={onRangeEndMonthChange}
                months={selectableRangeEndMonths}
              />
            </>
          )}
        </div>
      )}

      {periodLabel && (
        <div className="period-summary-card">
          <span>Periodo forecast seleccionado</span>
          <strong>{periodLabel}</strong>
          {periodDetail && <small>{periodDetail}</small>}
        </div>
      )}

      <ForecastCoveragePanel periodItems={periodStatusItems} coverageItems={coverageItems} />

      {dataNote && <p className="period-context-note">{dataNote}</p>}
    </div>
  );
}

function ChartRangeControls({
  market,
  onMarketChange,
  markets,
  periodType,
  onPeriodTypeChange,
  periodTypes,
  chartRangeMode,
  onChartRangeModeChange,
  selectedChartYear,
  onSelectedChartYearChange,
  chartYears,
  chartYearOptions = [],
}) {
  const yearOptions = chartYearOptions.length
    ? chartYearOptions
    : chartYears.map((year) => ({ key: year, label: year }));
  const selectedYearOption = getSelectedPeriodOption(yearOptions, selectedChartYear);
  const hasYears = yearOptions.length > 0;
  const rangeNote =
    chartRangeMode === "year" && selectedYearOption?.partial_year
      ? `${selectedYearOption.key} parcial · Ene-${selectedYearOption.latest_month_label}`
      : "";

  return (
    <div className="period-control-stack">
      <div className="block-controls">
        <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

        <PeriodTypeSegment
          label="Serie"
          value={periodType}
          onChange={onPeriodTypeChange}
          periodTypes={periodTypes}
        />

        <div className="compact-segment-group chart-range-segment">
          <p className="analysis-label mb-2">Rango visual del gráfico</p>
          <div className="segmented-control">
            {[
              { key: "all", label: "Todo el histórico disponible" },
              { key: "year", label: "Año seleccionado" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onChartRangeModeChange(option.key)}
                disabled={option.key === "year" && !hasYears}
                className={`segmented-button ${
                  chartRangeMode === option.key ? "segmented-button-active" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {chartRangeMode === "year" && (
          <SelectField
            label="Año"
            value={selectedChartYear}
            onChange={(year) => {
              onSelectedChartYearChange(year);
              onChartRangeModeChange("year");
            }}
            disabled={!hasYears}
            className="compact-select compact-year-select"
          >
            {yearOptions.map((year) => (
              <option key={year.key} value={year.key}>
                {year.label}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      {rangeNote && <p className="period-context-note">{rangeNote}</p>}
    </div>
  );
}

function isDistributionMetric(metricKey) {
  return DISTRIBUTION_METRICS.has(metricKey);
}

function isMoMGrowthMetric(metricKey) {
  return metricKey === "revenue_mom_growth" || metricKey === "visits_mom_growth";
}

function isGrowthMetric(metricKey) {
  return (
    metricKey === "revenue_yoy_growth" ||
    metricKey === "visits_yoy_growth" ||
    isMoMGrowthMetric(metricKey)
  );
}

function getGrowthBaseMetricKey(metricKey) {
  if (metricKey === "revenue_yoy_growth" || metricKey === "revenue_mom_growth") {
    return "revenue";
  }

  if (metricKey === "visits_yoy_growth" || metricKey === "visits_mom_growth") {
    return "visits";
  }

  return "";
}

function normalizeGrowthRate(value) {
  const number = safeNumber(value);
  if (number === null) return null;

  return number;
}

function getGrowthBreakdown(row, growthMetricKey) {
  if (!isGrowthMetric(growthMetricKey)) return null;

  const baseMetricKey = getGrowthBaseMetricKey(growthMetricKey);
  const explicitPreviousValue = safeNumber(row?.[`${baseMetricKey}_growth_previous_value`]);
  const explicitCurrentValue = safeNumber(row?.[`${baseMetricKey}_growth_current_value`]);
  const explicitGrowthValue = safeNumber(row?.[growthMetricKey]);

  if (
    explicitPreviousValue !== null &&
    explicitCurrentValue !== null &&
    explicitGrowthValue !== null
  ) {
    return {
      baseMetricKey,
      previousValue: explicitPreviousValue,
      growthValue: explicitGrowthValue,
      currentValue: explicitCurrentValue,
    };
  }

  const currentValue = safeNumber(row?.[baseMetricKey]);
  const growthValue = safeNumber(row?.[growthMetricKey]);
  const growthRate = normalizeGrowthRate(growthValue);

  if (currentValue === null || growthValue === null || growthRate === null) return null;

  const denominator = 1 + growthRate;
  const previousValue = denominator === 0 ? null : currentValue / denominator;

  if (previousValue === null || !Number.isFinite(previousValue)) return null;

  return {
    baseMetricKey,
    previousValue,
    growthValue,
    currentValue,
  };
}

function hasAnyMetric(rows = [], metricKey) {
  return rows.some((row) => safeNumber(row?.[metricKey]) !== null);
}

function getCompanyRow(rows = [], companyId = "") {
  return rows.find((row) => sameCompany(row?.company_id, companyId)) ?? null;
}

function getBenchmarkRow(rows = []) {
  return rows.find(isBenchmarkRow) ?? getCompanyRow(rows, MARKET_BENCHMARK_ID);
}

function getMetricCopy(metricKey) {
  return EXECUTIVE_METRIC_LABELS[metricKey] || metricKey;
}

function isHistoricalPeriodLabel(periodLabel = "") {
  return String(periodLabel || "").startsWith("Histórico");
}

function getGrowthMetricCopy(metricKey = "", periodLabel = "") {
  const baseLabel = metricKey.includes("revenue") ? "facturación" : "visitas";
  if (isHistoricalPeriodLabel(periodLabel)) return `crecimiento histórico de ${baseLabel}`;
  if (metricKey.includes("_mom_")) return `crecimiento mensual de ${baseLabel}`;
  return `crecimiento interanual de ${baseLabel}`;
}

function getFocusBrandGrowthKpiLabel(periodLabel = "") {
  return isHistoricalPeriodLabel(periodLabel)
    ? "Crecimiento histórico Focus Brand"
    : "Crecimiento interanual Focus Brand";
}

function getPeriodNarrativeLabel(periodLabel = "") {
  const label = String(periodLabel || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return formatMonthLabelFromKey(label.slice(0, 7));
  }
  return label.replace(/^Año\s+/i, "").trim();
}

const CHART_MONTH_TOKEN_MAP = {
  ene: 1,
  enero: 1,
  jan: 1,
  january: 1,
  feb: 2,
  febrero: 2,
  february: 2,
  mar: 3,
  marzo: 3,
  march: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  april: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  june: 6,
  jul: 7,
  julio: 7,
  july: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  september: 9,
  oct: 10,
  octubre: 10,
  october: 10,
  nov: 11,
  noviembre: 11,
  november: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
  december: 12,
};

function getChartMonthKey(value = "") {
  const label = String(value ?? "").trim();
  const isoMatch = label.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const textMatch = label.match(/^([A-Za-zÁÉÍÓÚÜáéíóúüÑñ.]+)\s+(\d{4})$/);
  if (!textMatch) return "";

  const monthToken = textMatch[1]
    .replace(/\./g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const month = CHART_MONTH_TOKEN_MAP[monthToken];
  if (!month) return "";

  return `${textMatch[2]}-${String(month).padStart(2, "0")}`;
}

function formatChartPeriodLabel(value = "") {
  const monthKey = getChartMonthKey(value);
  if (monthKey) return formatMonthLabelFromKey(monthKey);
  return String(value ?? "");
}

function formatDisplayPeriodLabel(value = "") {
  const label = String(value ?? "");
  return formatChartPeriodLabel(label);
}

function sumMetric(rows = [], metricKey) {
  return rows.reduce((total, row) => {
    const value = safeNumber(row?.[metricKey]);
    return value === null ? total : total + value;
  }, 0);
}

function getPrimaryMetricContext(rows = [], preferredMetric = "revenue") {
  const hasRevenue = hasAnyMetric(rows, "revenue");
  const hasVisits = hasAnyMetric(rows, "visits");
  const primaryMetric = preferredMetric === "visits" && hasVisits
    ? "visits"
    : hasRevenue
      ? "revenue"
      : "visits";
  const shareMetric =
    primaryMetric === "revenue" && hasAnyMetric(rows, "market_share_revenue")
      ? "market_share_revenue"
      : "market_share_visits";
  const growthMetric =
    primaryMetric === "revenue" && hasAnyMetric(rows, "revenue_yoy_growth")
      ? "revenue_yoy_growth"
      : "visits_yoy_growth";

  return {
    primaryMetric,
    primaryLabel: primaryMetric === "revenue" ? "facturación" : "visitas",
    shareMetric,
    growthMetric,
  };
}

function getShareChangeMetric(rows = [], preferredMetric = "revenue") {
  const row = rows.find(Boolean) ?? {};
  const timeMode = row.time_mode || row.aggregation_type || row.period_type || "";
  const suffixes =
    timeMode === "annual"
      ? ["yoy", "range", "mom"]
      : timeMode === "month" || timeMode === "monthly"
        ? ["yoy", "mom", "range"]
        : ["range", "yoy", "mom"];
  const revenueCandidates = suffixes.map((suffix) => `share_revenue_change_${suffix}`);
  const visitsCandidates = suffixes.map((suffix) => `share_visits_change_${suffix}`);
  const orderedCandidates =
    preferredMetric === "revenue"
      ? [...revenueCandidates, ...visitsCandidates]
      : [...visitsCandidates, ...revenueCandidates];

  return orderedCandidates.find((metricKey) => hasAnyMetric(rows, metricKey)) || "";
}

function getShareChangeMode(metricKey = "") {
  return metricKey.includes("revenue") ? "revenue" : "visits";
}

function getShareChangeContextLabel(metricKey = "", rows = []) {
  if (!metricKey) return "";

  const shareLabel = metricKey.includes("revenue")
    ? "Cuota facturación"
    : "Cuota visitas";
  const row = rows.find(Boolean) ?? {};
  const year = row.year || String(row.date || "").slice(0, 4);
  const timeMode = row.time_mode || row.aggregation_type || row.period_type || "";
  let comparisonLabel = "";

  if (metricKey.includes("_yoy")) {
    comparisonLabel = timeMode === "annual" && year
      ? `variación anual agregada ${year} vs ${Number(year) - 1}`
      : "vs mismo mes del año anterior";
  } else if (metricKey.includes("_mom")) {
    comparisonLabel = "vs mes anterior";
  } else if (metricKey.includes("_range")) {
    comparisonLabel = timeMode === "historical"
      ? "cambio entre primer y último periodo disponible"
      : "cambio entre inicio y final del rango";
  }

  return [shareLabel, comparisonLabel].filter(Boolean).join(" · ");
}

function getShareChangeRows(rows = [], metricKey = "") {
  if (!metricKey) return [];

  return rows
    .filter(isRealCompanyRow)
    .map((row) => ({
      id: row.company_id,
      name: getCompanyLabel(row),
      color: row.company_color || "#6F6864",
      value: safeNumber(row?.[metricKey]),
      row,
    }))
    .filter((entry) => entry.value !== null)
    .sort((a, b) => b.value - a.value);
}

function getShareWinnersLosers(rows = [], metricKey = "") {
  const rankedRows = getShareChangeRows(rows, metricKey);
  const gainers = rankedRows.filter((entry) => entry.value > 0).slice(0, 5);
  const losers = rankedRows
    .filter((entry) => entry.value < 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 5);

  return {
    gainers,
    losers,
    topGainer: gainers[0] ?? null,
    topLoser: losers[0] ?? null,
  };
}

function formatMetricDelta(metricKey, value) {
  if (
    metricKey?.includes("market_share") ||
    metricKey?.includes("share_")
  ) {
    return formatPp(value);
  }

  if (metricKey?.includes("growth")) {
    return formatPercentagePoints(value);
  }

  return formatMetric(value, metricKey);
}

function formatVsBenchmark(focusValue, benchmarkValue, metricKey) {
  const focusNumber = safeNumber(focusValue);
  const benchmarkNumber = safeNumber(benchmarkValue);

  if (focusNumber === null || benchmarkNumber === null) return "Sin promedio comparable";

  const delta = focusNumber - benchmarkNumber;
  if (Math.abs(delta) < 0.000001) return "En línea con el promedio del mercado medido";

  const direction = delta > 0 ? "por encima del" : "por debajo del";
  const formattedDelta =
    metricKey?.includes("market_share")
      ? formatPp(delta)
      : metricKey?.includes("growth")
        ? formatPercentagePoints(delta)
      : benchmarkNumber !== 0
        ? formatSignedPercent(delta / Math.abs(benchmarkNumber))
        : formatMetricDelta(metricKey, delta);

  return `${formattedDelta} ${direction} promedio del mercado medido`;
}

function getBenchmarkComparisonItems(focusRow, benchmarkRow, preferredMetric) {
  if (!focusRow || !benchmarkRow) return [];

  const metricKeys = [
    preferredMetric,
    preferredMetric === "revenue" ? "market_share_revenue" : "market_share_visits",
    preferredMetric === "revenue" ? "revenue_per_visit" : "visits_yoy_growth",
  ];

  return metricKeys
    .filter((metricKey, index, list) => metricKey && list.indexOf(metricKey) === index)
    .map((metricKey) => {
      const focusValue = safeNumber(focusRow?.[metricKey]);
      const benchmarkValue = safeNumber(benchmarkRow?.[metricKey]);
      if (focusValue === null || benchmarkValue === null) return null;

      return {
        key: metricKey,
        label: getMetricCopy(metricKey),
        focusValue,
        benchmarkValue,
        deltaLabel: formatVsBenchmark(focusValue, benchmarkValue, metricKey),
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function getBenchmarkDirectionSentence(focusRow, benchmarkRow, metricKey) {
  const focusNumber = safeNumber(focusRow?.[metricKey]);
  const benchmarkNumber = safeNumber(benchmarkRow?.[metricKey]);

  if (focusNumber === null || benchmarkNumber === null) return "";

  const delta = focusNumber - benchmarkNumber;
  const relation = Math.abs(delta) < 0.000001
    ? "en línea con el"
    : delta > 0
      ? "superior al"
      : "inferior al";

  if (metricKey === "revenue" || metricKey === "market_share_revenue") {
    return `Focus Brand mantiene una cuota de facturación ${relation} promedio del mercado medido.`;
  }

  if (metricKey === "visits" || metricKey === "market_share_visits") {
    return `Focus Brand mantiene una cuota de visitas ${relation} promedio del mercado medido.`;
  }

  if (metricKey === "revenue_per_visit") {
    const efficiencyRelation = Math.abs(delta) < 0.000001
      ? "en línea con el"
      : delta > 0
        ? "por encima del"
        : "por debajo del";
    return `Focus Brand monetiza por visita ${efficiencyRelation} promedio del mercado medido.`;
  }

  return `Focus Brand se mantiene ${relation} promedio del mercado medido.`;
}

function getLeaderMetricLabel(metricKey, fallbackLabel) {
  if (metricKey === "visits") return "las visitas";
  if (metricKey === "revenue") return "la facturación";
  return `la ${fallbackLabel}`;
}

function buildExecutiveHeadline({
  leader,
  context,
  selectedPeriod,
  shareWinners,
  focusShare,
  benchmarkSentence,
}) {
  const periodLabel = selectedPeriod?.label || "el período seleccionado";
  const narrativePeriodLabel = getPeriodNarrativeLabel(periodLabel);
  const isHistorical = isHistoricalPeriodLabel(periodLabel);
  const mainParts = [];

  if (isHistorical) {
    const leaderCopy = leader
      ? `En ${narrativePeriodLabel}, ${getCompanyLabel(leader)} acumula el mayor volumen de ${context.primaryLabel}`
      : `En ${narrativePeriodLabel}, no hay un líder claro de ${context.primaryLabel}`;
    const focusShareCopy =
      focusShare !== null
        ? `Focus Brand cierra con ${formatMetric(focusShare, context.shareMetric)} de ${getMetricCopy(context.shareMetric)}`
        : "";
    const shareMoveCopy = shareWinners.topGainer
      ? sameCompany(shareWinners.topGainer.id, OWN_COMPANY_ID)
        ? `mejora ${formatPp(shareWinners.topGainer.value, { signed: false })} en la ventana`
        : `${shareWinners.topGainer.name} es quien más gana cuota: ${formatPp(shareWinners.topGainer.value, { signed: false })}`
      : "";
    const historicalSecondSentence = [focusShareCopy, shareMoveCopy].filter(Boolean).join(" y ");

    return [
      `${leaderCopy}.`,
      historicalSecondSentence ? `${historicalSecondSentence}.` : "",
      benchmarkSentence,
    ].filter(Boolean).slice(0, 3).join(" ");
  }

  if (leader) {
    mainParts.push(`${getCompanyLabel(leader)} lidera ${getLeaderMetricLabel(context.primaryMetric, context.primaryLabel)} en ${narrativePeriodLabel}`);
  }

  if (shareWinners.topGainer) {
    mainParts.push(
      `${shareWinners.topGainer.name} gana ${formatPp(shareWinners.topGainer.value, { signed: false })}`,
    );
  } else if (focusShare !== null) {
    mainParts.push(
      `Focus Brand alcanza ${formatMetric(focusShare, context.shareMetric)} de ${getMetricCopy(context.shareMetric)}`,
    );
  }

  const firstSentence = mainParts.length
    ? `${mainParts[0]}${mainParts[1] ? `, mientras ${mainParts[1]}` : ""}.`
    : "No hay datos suficientes para una lectura ejecutiva robusta en este período.";

  return [firstSentence, benchmarkSentence].filter(Boolean).slice(0, 2).join(" ");
}

function getCompetitiveRisks(rows = [], context = {}) {
  const focusRow = getCompanyRow(rows, OWN_COMPANY_ID);
  if (!focusRow) return [];

  const risks = [];
  const rivals = rows.filter((row) => isRealCompanyRow(row) && !sameCompany(row.company_id, OWN_COMPANY_ID));
  const shareChangeMetric = context.shareChangeMetric || "";
  const focusShareChange = safeNumber(focusRow?.[shareChangeMetric]);
  const focusGrowth = safeNumber(focusRow?.[context.growthMetric]);
  const focusRpv = safeNumber(focusRow?.revenue_per_visit);

  if (shareChangeMetric) {
    const shareThreat = rivals
      .map((row) => ({
        row,
        value: safeNumber(row?.[shareChangeMetric]),
      }))
      .filter((entry) => entry.value !== null && entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .find((entry) => focusShareChange === null || entry.value > focusShareChange);

    if (shareThreat) {
      risks.push({
        id: `share-${shareThreat.row.company_id}`,
        title: "Presión competitiva",
        body: `${getCompanyLabel(shareThreat.row)} gana ${formatPp(shareThreat.value)} de ${getMetricCopy(shareChangeMetric)}${context.shareChangeContext ? ` · ${context.shareChangeContext}` : ""}.`,
        row: shareThreat.row,
      });
    }
  }

  if (context.growthMetric) {
    const growthThreat = rivals
      .map((row) => ({
        row,
        value: safeNumber(row?.[context.growthMetric]),
      }))
      .filter((entry) => entry.value !== null)
      .sort((a, b) => b.value - a.value)
      .find((entry) => focusGrowth === null || entry.value > focusGrowth);

    if (growthThreat) {
      const averagePreviousValue = getAveragePreviousValueForMetric(
        rows,
        context.growthMetric === "revenue_yoy_growth" ? "revenue" : "visits",
      );
      const previousValue = getGrowthBreakdown(growthThreat.row, context.growthMetric)?.previousValue;
      const lowBaseCaveat =
        isLowBaseMomentum(previousValue, averagePreviousValue) && growthThreat.value > 1
          ? " Crecimiento sobre base inicial pequeÃ±a; revisar impacto absoluto."
          : "";
      risks.push({
        id: `growth-${growthThreat.row.company_id}`,
        title: "Crecimiento superior",
        body: `${getCompanyLabel(growthThreat.row)} crece ${formatSignedPercent(growthThreat.value)} en ${getGrowthMetricCopy(context.growthMetric, context.periodLabel)}.${lowBaseCaveat}`,
        row: growthThreat.row,
      });
    }
  }

  if (focusRpv !== null) {
    const efficiencyThreat = rivals
      .map((row) => ({
        row,
        value: safeNumber(row?.revenue_per_visit),
      }))
      .filter((entry) => entry.value !== null && entry.value > focusRpv)
      .sort((a, b) => b.value - a.value)[0];

    if (efficiencyThreat) {
      const threatVisits = safeNumber(efficiencyThreat.row?.visits);
      const caveat =
        efficiencyThreat.value >= 10 || (threatVisits !== null && threatVisits < 1_000_000)
          ? " Dato sensible a base de tráfico/cobertura; revisar antes de usar como conclusión ejecutiva."
          : "";
      risks.push({
        id: `efficiency-${efficiencyThreat.row.company_id}`,
        title: "Mejor monetización",
        body: `${getCompanyLabel(efficiencyThreat.row)} logra ${formatCurrencyDecimal(efficiencyThreat.value)} por visita frente a ${formatCurrencyDecimal(focusRpv)} de Focus Brand.${caveat}`,
        row: efficiencyThreat.row,
      });
    }
  }

  return risks.slice(0, 3);
}

function getDataTrustBadges(rows = []) {
  const badges = new Map();

  rows.forEach((row) => {
    const dataType = normalizeCompanyId(row?.data_type);
    const source = String(row?.source || "");

    if (dataType === "actual") badges.set("actual", "dato real");
    if (dataType === "estimated") badges.set("estimated", "estimado");
    if (dataType === "forecast") badges.set("forecast", "proyección");
    if (dataType === "calculated") badges.set("calculated", "calculado");
    if (/mock_source/i.test(source)) badges.set("mock_source", "Mock benchmark dataset");
    if (/ecdb/i.test(source)) badges.set("ecdb", "ECDB");
    if (/calculated|calculado/i.test(source)) badges.set("calculated", "calculado");
  });

  return Array.from(badges.entries())
    .map(([key, label]) => ({ key, label }))
    .slice(0, 4);
}

function buildExecutiveSnapshot(
  realRows = [],
  comparisonRows = [],
  selectedPeriod = null,
  preferredMetric = "revenue",
) {
  const context = getPrimaryMetricContext(realRows, preferredMetric);
  const shareChangeMetric = getShareChangeMetric(realRows, context.primaryMetric);
  const shareWinners = getShareWinnersLosers(realRows, shareChangeMetric);
  const focusRow = getCompanyRow(realRows, OWN_COMPANY_ID);
  const benchmarkRow = getBenchmarkRow(comparisonRows);
  const leader = realRows
    .filter((row) => safeNumber(row?.[context.primaryMetric]) !== null)
    .slice()
    .sort((a, b) => safeNumber(b?.[context.primaryMetric]) - safeNumber(a?.[context.primaryMetric]))[0] ?? null;
  const totalMarketValue = hasAnyMetric(realRows, context.primaryMetric)
    ? sumMetric(realRows, context.primaryMetric)
    : null;
  const focusShare = safeNumber(focusRow?.[context.shareMetric]);
  const focusGrowth = safeNumber(focusRow?.[context.growthMetric]);
  const benchmarkComparisons = getBenchmarkComparisonItems(
    focusRow,
    benchmarkRow,
    context.primaryMetric,
  );
  const risks = getCompetitiveRisks(realRows, {
    ...context,
    shareChangeMetric,
    shareChangeContext: getShareChangeContextLabel(shareChangeMetric, realRows),
    periodLabel: selectedPeriod?.label || "",
  });
  const headline = buildExecutiveHeadline({
    leader,
    context,
    selectedPeriod,
    shareWinners,
    focusShare,
    benchmarkSentence: getBenchmarkDirectionSentence(focusRow, benchmarkRow, context.primaryMetric),
  });

  return {
    ...context,
    shareChangeMetric,
    shareChangeMode: getShareChangeMode(shareChangeMetric),
    periodLabel: selectedPeriod?.label || "",
    totalMarketValue,
    focusRow,
    benchmarkRow,
    focusShare,
    focusGrowth,
    leader,
    shareWinners,
    benchmarkComparisons,
    risks,
    headline,
    badges: getDataTrustBadges([...realRows, ...comparisonRows]),
  };
}

function getEfficiencyBadge(gap) {
  const value = safeNumber(gap);
  if (value === null) return "Sin dato";
  if (value > 0.005) return "Alta eficiencia";
  if (value < -0.005) return "Oportunidad de monetización";
  return "Equilibrado";
}

function getMonetizationRows(rows = []) {
  return rows
    .filter(isRealCompanyRow)
    .map((row) => {
      const revenueShare = safeNumber(row?.market_share_revenue);
      const visitShare = safeNumber(row?.market_share_visits);
      if (revenueShare === null || visitShare === null) return null;

      return {
        id: row.company_id,
        name: getCompanyLabel(row),
        color: row.company_color || "#6F6864",
        revenueShare,
        visitShare,
        value: revenueShare - visitShare,
        badge: getEfficiencyBadge(revenueShare - visitShare),
        row,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);
}

function getMedian(values = []) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;

  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2
    ? numbers[middle]
    : (numbers[middle - 1] + numbers[middle]) / 2;
}

function getStrategicConclusion(snapshot) {
  if (!snapshot) return "Selecciona un período con datos comparables para cerrar la lectura.";

  const risk = snapshot.risks[0];
  if (risk) {
    return `${risk.title}: ${risk.body}`;
  }

  if (snapshot.shareWinners?.topGainer) {
    return `${snapshot.shareWinners.topGainer.name} marca el movimiento competitivo más relevante. Conviene compararlo con Focus Brand y el promedio del mercado medido.`;
  }

  if (snapshot.leader) {
    return `${getCompanyLabel(snapshot.leader)} concentra la lectura principal del período por ${snapshot.primaryLabel}.`;
  }

  return "No hay señales suficientes para una conclusión estratégica sin forzar la lectura.";
}

function getPieData(rows = [], metricKey, maxSlices = 5) {
  const rankedRows = rows
    .map((row) => ({
      id: row.company_id,
      name: getCompanyLabel(row),
      value: safeNumber(row?.[metricKey]),
      color: row.company_color || "#6F6864",
    }))
    .filter((row) => row.value !== null && row.value > 0)
    .sort((a, b) => b.value - a.value);

  const topRows = rankedRows.slice(0, maxSlices);
  const restRows = rankedRows.slice(maxSlices);
  const restValue = restRows.reduce((total, row) => total + row.value, 0);

  return restValue > 0
    ? [...topRows, { id: "rest", name: "Resto", value: restValue, color: "#D8D2CD" }]
    : topRows;
}

function RankingPieChart({ rows, metricKey, title }) {
  const pieData = useMemo(() => getPieData(rows, metricKey), [metricKey, rows]);
  const totalValue = useMemo(
    () => pieData.reduce((total, row) => total + row.value, 0),
    [pieData],
  );

  return (
    <aside className="ranking-side-card" aria-label={title}>
      <div>
        <p className="analysis-label text-accent-500">Distribución</p>
        <h3 className="mt-2 text-lg font-semibold text-black">{title}</h3>
      </div>

      {pieData.length ? (
        <>
          <div className="ranking-pie-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart margin={{ top: 22, right: 28, bottom: 22, left: 28 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="54%"
                  outerRadius="82%"
                  paddingAngle={2}
                  label={PieLogoLabel}
                  labelLine={false}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <SingleMetricTooltip metricKey={metricKey} totalValue={totalValue} />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="ranking-pie-legend">
            {pieData.map((entry) => (
              <div key={`${entry.id}-legend`} className="ranking-pie-legend-row">
                <span className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={entry.id}
                    label={entry.name}
                    color={entry.color}
                    className="company-mark-legend"
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span>{formatPercent(totalValue ? entry.value / totalValue : null)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Sin datos positivos para el pie."
          message="El ranking actual no tiene valores suficientes para calcular una distribución."
        />
      )}
    </aside>
  );
}

function getBarData(rows = [], metricKey, maxItems = 8) {
  return rows
    .map((row) => {
      const growthBreakdown = getGrowthBreakdown(row, metricKey);

      return {
        id: row.company_id,
        name: getCompanyLabel(row),
        value: safeNumber(row?.[metricKey]),
        color: row.company_color || "#6F6864",
        ...(growthBreakdown || {}),
      };
    })
    .filter((row) => row.value !== null)
    .slice(0, maxItems);
}

function getGrowthAxisTicks(values = []) {
  const numericValues = values.filter((value) => Number.isFinite(value));
  if (!numericValues.length) return [-1, 0, 1];

  const min = Math.min(0, ...numericValues);
  const max = Math.max(0, ...numericValues);
  const step = 0.25;
  const start = Math.floor(min / step) * step;
  const end = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];

  for (let value = start; value <= end + 0.000001; value += step) {
    ticks.push(Number(value.toFixed(2)));
  }

  return ticks;
}

function RankingBarChart({ rows, metricKey, title }) {
  const barData = useMemo(() => getBarData(rows, metricKey), [metricKey, rows]);
  const showGrowthBreakdown = isGrowthMetric(metricKey);
  const growthTicks = useMemo(
    () => (showGrowthBreakdown ? getGrowthAxisTicks(barData.map((row) => row.value)) : []),
    [barData, showGrowthBreakdown],
  );
  const domain = useMemo(() => {
    if (showGrowthBreakdown && growthTicks.length) {
      return [growthTicks[0], growthTicks[growthTicks.length - 1]];
    }
    const values = barData.map((row) => row.value);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);

    return min === max ? [-1, 1] : [min, max];
  }, [barData, growthTicks, showGrowthBreakdown]);
  const entriesById = useMemo(() => {
    const entriesMap = new Map();
    barData.forEach((entry) => {
      entriesMap.set(normalizeCompanyId(entry.id), entry);
    });
    return entriesMap;
  }, [barData]);

  return (
    <aside className="ranking-side-card" aria-label={title}>
      <div>
        <p className="analysis-label text-accent-500">Comparativa</p>
        <h3 className="mt-2 text-lg font-semibold text-black">{title}</h3>
      </div>

      {barData.length ? (
        <div className="ranking-bar-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 8, right: 10, bottom: 8, left: 0 }}
            >
              <CartesianGrid stroke="rgba(0,0,0,0.08)" horizontal={false} />
              <ReferenceLine x={0} stroke="rgba(0,0,0,0.36)" />
              <XAxis
                type="number"
                domain={domain}
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={(value) =>
                  showGrowthBreakdown ? formatSignedPercent(value) : formatMetric(value, metricKey)
                }
                ticks={showGrowthBreakdown ? growthTicks : undefined}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="id"
                width={56}
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={(props) => <RankingBarLogoTick {...props} entriesById={entriesById} />}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                content={<SingleMetricTooltip metricKey={metricKey} />}
              />
              <Bar dataKey="value" radius={[3, 3, 3, 3]} barSize={18}>
                {barData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="Sin datos para la comparativa."
          message="El ranking actual no tiene valores suficientes para representar esta métrica."
        />
      )}

      {barData.length > 0 && (
        <div className={showGrowthBreakdown ? "ranking-yoy-list" : "ranking-bar-legend"}>
          {barData.map((entry) => (
            showGrowthBreakdown ? (
              <div key={`${entry.id}-yoy-legend`} className="ranking-yoy-row">
                <span className="ranking-yoy-company">
                  <CompanyMark
                    companyId={entry.id}
                    label={entry.name}
                    color={entry.color}
                    className="company-mark-legend"
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="ranking-yoy-metrics">
                  <span>
                    <small>Pre</small>
                    {formatMetric(entry.previousValue, entry.baseMetricKey)}
                  </span>
                  <span>
                    <small>Crec.</small>
                    {formatSignedPercent(entry.growthValue ?? entry.value)}
                  </span>
                  <span>
                    <small>Post</small>
                    {formatMetric(entry.currentValue, entry.baseMetricKey)}
                  </span>
                </span>
              </div>
            ) : (
              <div key={`${entry.id}-bar-legend`} className="ranking-pie-legend-row">
                <span className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={entry.id}
                    label={entry.name}
                    color={entry.color}
                    className="company-mark-legend"
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span>{formatMetric(entry.value, metricKey)}</span>
              </div>
            )
          ))}
        </div>
      )}
    </aside>
  );
}

function RankingSideVisual({ rows, sortKey, sortLabel }) {
  if (isDistributionMetric(sortKey)) {
    return <RankingPieChart rows={rows} metricKey={sortKey} title={sortLabel} />;
  }

  return <RankingBarChart rows={rows} metricKey={sortKey} title={sortLabel} />;
}

function BenchmarkRankingPanel({
  rows,
  sortKey,
  sortLabel,
  selectedPeriod,
  availability,
  emptyActions = [],
  onOpenProfile,
}) {
  const resolvedSortLabel = sortLabel || getMetricCopy(sortKey);
  const topRows = rows.slice(0, 8);
  const emptyTitle = `No hay datos de ${resolvedSortLabel.toLowerCase()} para ${
    selectedPeriod?.label || "este periodo"
  }.`;
  const emptyMessage = availability?.lastAvailablePeriod
    ? `Último dato disponible: ${availability.lastAvailablePeriod.label}.`
    : availability?.reason || "Selecciona un periodo con empresas reales y datos disponibles.";

  return (
    <Panel
      eyebrow="Ranking"
      title="Ranking del período"
    >
      {selectedPeriod && (
        <p className="mb-4 text-sm text-neutral-500">
          {selectedPeriod.label}. Top empresas por {resolvedSortLabel}.
        </p>
      )}

      {topRows.length ? (
        <div className="ranking-with-pie">
          <div className="divide-y divide-black/10 overflow-hidden rounded-sm border border-black/10">
            {topRows.map((row, index) => {
              const growthBreakdown = getGrowthBreakdown(row, sortKey);

              return (
                <button
                  key={`${row.company_id}-${row.date}-ranking-card`}
                  type="button"
                  onClick={() => onOpenProfile(row.company_id)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 bg-white px-4 py-3 text-left transition hover:bg-[#fbf8f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-500 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4"
                  aria-label={`Abrir ficha de ${getCompanyLabel(row)}`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-sm text-sm font-semibold ${
                      index === 0 ? "bg-accent-500 text-white" : "bg-[#fbf8f5] text-black"
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <CompanyMark
                        companyId={row.company_id}
                        label={getCompanyLabel(row)}
                        color={row.company_color}
                        className="company-mark-row"
                      />
                      <span className="truncate font-semibold text-black">{getCompanyLabel(row)}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs uppercase text-neutral-500">
                      {row.segment || row.market || "Competidor"}
                    </span>
                    <DataTypeBadge row={row} />
                  </span>
                  <span className="col-span-2 text-left sm:col-span-1 sm:text-right">
                    <span className="block text-sm font-semibold text-black">
                      {isGrowthMetric(sortKey)
                        ? formatSignedPercent(row?.[sortKey])
                        : formatMetric(row?.[sortKey], sortKey)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold uppercase text-neutral-500">
                      {resolvedSortLabel}
                    </span>
                    {growthBreakdown && (
                      <span className="ranking-row-yoy">
                        <span>Antes {formatMetric(growthBreakdown.previousValue, growthBreakdown.baseMetricKey)}</span>
                        <span>Ahora {formatMetric(growthBreakdown.currentValue, growthBreakdown.baseMetricKey)}</span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <RankingSideVisual rows={rows} sortKey={sortKey} sortLabel={resolvedSortLabel} />
        </div>
      ) : (
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          actions={emptyActions}
        />
      )}
    </Panel>
  );
}

function RankingTable({
  rows,
  selectedPeriod,
  onOpenProfile,
  title = "Tabla completa del ranking",
  description,
}) {
  const hasForecastRows = rows.some(isForecastRow);

  return (
    <Panel
      eyebrow="Detalle"
      title={title}
    >
      {selectedPeriod && (
        <p className="mb-4 text-sm text-neutral-500">
          {description || `Período seleccionado: ${selectedPeriod.label}. Ranking detallado por empresas.`}
        </p>
      )}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-black/10 bg-[#fbf8f5] text-left text-xs uppercase text-neutral-500">
                <th className="px-3 py-3 font-semibold">Posición</th>
                <th className="px-3 py-3 font-semibold">Empresa</th>
                <th className="px-3 py-3 text-right font-semibold">Facturación</th>
                <th className="px-3 py-3 text-right font-semibold">Visitas</th>
                <th className="px-3 py-3 text-right font-semibold">Cuota facturación</th>
                <th className="px-3 py-3 text-right font-semibold">Cuota visitas</th>
                <th className="px-3 py-3 text-right font-semibold">Facturación por visita</th>
                <th className="px-3 py-3 font-semibold">Prioridad</th>
                {hasForecastRows && <th className="px-3 py-3 font-semibold">Tipo</th>}
                <th className="px-3 py-3 text-right font-semibold">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {rows.map((row) => (
                <tr
                  key={`${row.company_id}-${row.date}`}
                  className="cursor-pointer bg-white transition hover:bg-[#fbf8f5]"
                  onClick={() => onOpenProfile(row.company_id)}
                >
                  <td className="px-3 py-3 font-semibold text-black">
                    {formatMetric(row.rank_revenue, "rank_revenue")}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CompanyMark
                        companyId={row.company_id}
                        label={getCompanyLabel(row)}
                        color={row.company_color}
                        className="company-mark-table"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-black">{getCompanyLabel(row)}</p>
                        <p className="truncate text-xs text-neutral-500">{row.segment || row.market}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-black">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-black">
                    {formatCompact(row.visits)}
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">
                    {formatPercent(row.market_share_revenue)}
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">
                    {formatPercent(row.market_share_visits)}
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">
                    {formatCurrencyDecimal(row.revenue_per_visit)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-sm border border-black/10 bg-[#fbf8f5] px-3 py-1 text-xs font-medium text-neutral-700">
                      {row.strategic_priority_label || row.strategic_priority || "N/A"}
                    </span>
                  </td>
                  {hasForecastRows && (
                    <td className="px-3 py-3">
                      <DataTypeBadge row={row} />
                    </td>
                  )}
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenProfile(row.company_id);
                      }}
                      className="primary-action"
                      aria-label={`Abrir ficha de ${getCompanyLabel(row)}`}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No hay datos comparables para esta tabla."
          message="Selecciona un período con datos disponibles para las empresas reales."
        />
      )}
    </Panel>
  );
}

function ForecastRankingList({ rows, onOpenProfile }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Proyección no disponible para esta selección."
        message="Cambia el escenario o vuelve al panel para revisar otro contexto."
      />
    );
  }

  return (
    <div className="ranking-with-pie">
      <div className="clean-list">
        {rows.map((row, index) => (
          <button
            key={`${row.company_id}-${row.date}-forecast-detail`}
            type="button"
            onClick={() => onOpenProfile(row.company_id)}
            className="clean-list-row"
            aria-label={`Abrir ficha de ${getCompanyLabel(row)}`}
          >
            <span
              className={`rank-token ${index === 0 ? "rank-token-lead" : ""}`}
            >
              #{index + 1}
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <CompanyMark
                  companyId={row.company_id}
                  label={getCompanyLabel(row)}
                  color={row.company_color}
                  className="company-mark-row"
                />
                <span className="truncate font-semibold text-black">{getCompanyLabel(row)}</span>
              </span>
              <span className="mt-1 block truncate text-xs uppercase text-neutral-500">
                {row.segment || row.market || "Competidor"}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold text-black">
                {formatCompact(row.visits)}
              </span>
              <span className="mt-1 block text-xs font-semibold uppercase text-neutral-500">
                Visitas proyectadas
              </span>
            </span>
          </button>
        ))}
      </div>

      <RankingPieChart rows={rows} metricKey="visits" title="Visitas proyectadas" />
    </div>
  );
}

function ForecastDetailView({
  rows,
  forecastScenarios,
  forecastScenario,
  onForecastScenarioChange,
  forecastScenarioLabel,
  forecastMarket,
  onForecastMarketChange,
  forecastMarkets,
  forecastPeriodType: _forecastPeriodType,
  onForecastPeriodTypeChange: _onForecastPeriodTypeChange,
  forecastPeriodTypes: _forecastPeriodTypes,
  onBack,
  onOpenProfile,
}) {
  const [selectedForecastTimeMode, setSelectedForecastTimeMode] = useState("horizon");
  const [selectedForecastYear, setSelectedForecastYear] = useState("");
  const [selectedForecastMonth, setSelectedForecastMonth] = useState("");
  const [forecastRangeStartMonth, setForecastRangeStartMonth] = useState("");
  const [forecastRangeEndMonth, setForecastRangeEndMonth] = useState("");
  const forecastRows = useMemo(() => getForecastRows(rows), [rows]);
  const forecastMonthOptions = useMemo(() => getForecastMonthOptions(forecastRows), [forecastRows]);
  const forecastYears = useMemo(() => getForecastAvailableYears(forecastMonthOptions), [forecastMonthOptions]);
  const forecastRangeMonthOptions = useMemo(
    () => getForecastRangeMonthOptions(forecastMonthOptions),
    [forecastMonthOptions],
  );

  useEffect(() => {
    if (!FORECAST_TIME_MODE_KEYS.includes(selectedForecastTimeMode)) {
      setSelectedForecastTimeMode("horizon");
    }
  }, [selectedForecastTimeMode]);

  useEffect(() => {
    if (!forecastYears.length) {
      setSelectedForecastYear("");
      return;
    }

    if (!selectedForecastYear || !forecastYears.includes(selectedForecastYear)) {
      setSelectedForecastYear(forecastYears[0]);
    }
  }, [forecastYears, selectedForecastYear]);

  const forecastMonthOptionsForYear = useMemo(
    () => getForecastMonthsForYear(forecastMonthOptions, selectedForecastYear),
    [forecastMonthOptions, selectedForecastYear],
  );

  useEffect(() => {
    if (!forecastMonthOptionsForYear.length) {
      setSelectedForecastMonth("");
      return;
    }

    const latestMonth = forecastMonthOptionsForYear[forecastMonthOptionsForYear.length - 1];
    if (!selectedForecastMonth || !forecastMonthOptionsForYear.includes(Number(selectedForecastMonth))) {
      setSelectedForecastMonth(String(latestMonth));
    }
  }, [forecastMonthOptionsForYear, selectedForecastMonth]);

  useEffect(() => {
    if (!forecastRangeMonthOptions.length) {
      setForecastRangeStartMonth("");
      setForecastRangeEndMonth("");
      return;
    }

    const first = forecastRangeMonthOptions[0].key;
    const last = forecastRangeMonthOptions[forecastRangeMonthOptions.length - 1].key;

    if (
      !forecastRangeStartMonth ||
      !forecastRangeMonthOptions.some((month) => month.key === forecastRangeStartMonth)
    ) {
      setForecastRangeStartMonth(first);
    }

    if (
      !forecastRangeEndMonth ||
      !forecastRangeMonthOptions.some((month) => month.key === forecastRangeEndMonth)
    ) {
      setForecastRangeEndMonth(last);
    }
  }, [forecastRangeEndMonth, forecastRangeMonthOptions, forecastRangeStartMonth]);

  useEffect(() => {
    if (selectedForecastTimeMode !== "range") return;
    if (!forecastRangeStartMonth || !forecastRangeEndMonth) return;
    if (compareRangeMonthKeys(forecastRangeStartMonth, forecastRangeEndMonth) <= 0) return;

    setForecastRangeEndMonth(forecastRangeStartMonth);
  }, [forecastRangeEndMonth, forecastRangeStartMonth, selectedForecastTimeMode]);

  const selectedForecastWindow = useMemo(
    () =>
      getForecastSelectionWindow(
        {
          selectedTimeMode: selectedForecastTimeMode,
          selectedYear: selectedForecastYear,
          selectedMonth: Number(selectedForecastMonth),
          rangeStartMonth: forecastRangeStartMonth,
          rangeEndMonth: forecastRangeEndMonth,
        },
        forecastMonthOptions,
      ),
    [
      forecastMonthOptions,
      forecastRangeEndMonth,
      forecastRangeStartMonth,
      selectedForecastMonth,
      selectedForecastTimeMode,
      selectedForecastYear,
    ],
  );
  const forecastPeriods = useMemo(
    () => getAvailablePeriods(forecastRows, { includeForecasts: true, realOnly: true }),
    [forecastRows],
  );
  const firstForecastPeriod = forecastPeriods[0] ?? null;
  const lastForecastPeriod = forecastPeriods[forecastPeriods.length - 1] ?? null;
  const selectedForecastMonthlyRows = useMemo(
    () => filterRowsByForecastWindow(forecastRows, selectedForecastWindow),
    [forecastRows, selectedForecastWindow],
  );
  const selectedForecastPeriodRows = useMemo(
    () => getForecastPeriodRowsForWindow(forecastRows, selectedForecastWindow),
    [forecastRows, selectedForecastWindow],
  );
  const selectedForecastPeriod = useMemo(() => {
    if (!selectedForecastWindow) return null;

    const isHorizon = selectedForecastWindow.mode === "horizon";
    return {
      key: isHorizon
        ? `forecast-close:${selectedForecastWindow.endMonth}`
        : `forecast:${selectedForecastWindow.mode}:${selectedForecastWindow.startMonth}:${selectedForecastWindow.endMonth}`,
      date: selectedForecastWindow.endDate,
      label: isHorizon ? `Cierre ${selectedForecastWindow.closeLabel}` : selectedForecastWindow.label,
      detail: selectedForecastWindow.detail,
      sortValue: new Date(selectedForecastWindow.endDate).getTime(),
    };
  }, [selectedForecastWindow]);
  const selectedForecastPeriods = useMemo(
    () => getAvailablePeriods(selectedForecastMonthlyRows, { includeForecasts: true, realOnly: true }),
    [selectedForecastMonthlyRows],
  );
  const firstSelectedForecastPeriod = selectedForecastPeriods[0] ?? firstForecastPeriod;
  const lastSelectedForecastPeriod =
    selectedForecastPeriods[selectedForecastPeriods.length - 1] ?? lastForecastPeriod;
  const firstForecastRows = useMemo(
    () => getRowsForPeriod(selectedForecastMonthlyRows, firstSelectedForecastPeriod?.key),
    [firstSelectedForecastPeriod?.key, selectedForecastMonthlyRows],
  );
  const lastForecastRows = useMemo(
    () => getRowsForPeriod(selectedForecastMonthlyRows, lastSelectedForecastPeriod?.key),
    [lastSelectedForecastPeriod?.key, selectedForecastMonthlyRows],
  );
  const _forecastCompanies = useMemo(
    () => getUniqueCompanies(forecastRows, { includeForecasts: true }),
    [forecastRows],
  );
  const focusStartRow = useMemo(
    () => firstForecastRows.find((row) => sameCompany(row.company_id, OWN_COMPANY_ID)) ?? null,
    [firstForecastRows],
  );
  const focusEndRow = useMemo(
    () => lastForecastRows.find((row) => sameCompany(row.company_id, OWN_COMPANY_ID)) ?? null,
    [lastForecastRows],
  );
  const topForecastRows = useMemo(
    () => getRankingRows(selectedForecastPeriodRows, "visits", { includeForecasts: true }).slice(0, 8),
    [selectedForecastPeriodRows],
  );
  const defaultVisibleCompanyIds = useMemo(() => {
    const ids = topForecastRows.slice(0, 5).map((row) => row.company_id);

    if (!ids.some((companyId) => sameCompany(companyId, OWN_COMPANY_ID))) {
      ids.unshift(OWN_COMPANY_ID);
    }

    return ids;
  }, [topForecastRows]);
  const visitsSeries = useMemo(
    () => groupSeriesByCompetitor(selectedForecastMonthlyRows, "visits", [], { includeForecasts: true }),
    [selectedForecastMonthlyRows],
  );
  const revenueSeries = useMemo(
    () => groupSeriesByCompetitor(selectedForecastMonthlyRows, "revenue", [], { includeForecasts: true }),
    [selectedForecastMonthlyRows],
  );
  const visitsChartData = useMemo(() => toMultiLineChartData(visitsSeries), [visitsSeries]);
  const revenueChartData = useMemo(() => toMultiLineChartData(revenueSeries), [revenueSeries]);
  const forecastLegendSeries = useMemo(
    () => mergeSeriesForLegend([visitsSeries, revenueSeries]),
    [revenueSeries, visitsSeries],
  );
  const forecastVisibility = useCompanyVisibility(forecastLegendSeries, defaultVisibleCompanyIds);
  const forecastCoverageItems = useMemo(
    () => [
      getForecastCoverageItem(forecastRows, "visits", "Forecast visitas"),
      getForecastCoverageItem(forecastRows, "revenue", "Forecast facturación"),
    ],
    [forecastRows],
  );
  const forecastPeriodStatusItems = useMemo(
    () => getForecastPeriodStatusItems(selectedForecastPeriodRows),
    [selectedForecastPeriodRows],
  );
  const selectableRangeStartMonths = useMemo(
    () =>
      forecastRangeMonthOptions.filter(
        (month) => !forecastRangeEndMonth || compareRangeMonthKeys(month.key, forecastRangeEndMonth) <= 0,
      ),
    [forecastRangeEndMonth, forecastRangeMonthOptions],
  );
  const selectableRangeEndMonths = useMemo(
    () =>
      forecastRangeMonthOptions.filter(
        (month) => !forecastRangeStartMonth || compareRangeMonthKeys(month.key, forecastRangeStartMonth) >= 0,
      ),
    [forecastRangeMonthOptions, forecastRangeStartMonth],
  );

  if (!forecastRows.length || !firstForecastPeriod || !selectedForecastWindow) {
    return (
      <div className="space-y-6">
        <button type="button" className="section-link" onClick={onBack}>
          Volver al panel
        </button>
        <EmptyState
          title="No hay proyección disponible."
          message="Los datos actuales no incluyen proyección para el contexto seleccionado."
        />
      </div>
    );
  }

  const horizonLabel =
    firstForecastPeriod.key === lastForecastPeriod?.key
      ? firstForecastPeriod.label
      : `${firstForecastPeriod.label} - ${lastForecastPeriod?.label}`;

  return (
    <div className="home-temporal-layout">
      <aside className="temporal-sidebar" aria-label="Controles temporales de forecast">
        <section className="global-temporal-panel forecast-temporal-panel">
          <div className="global-temporal-copy">
            <p className="analysis-label text-accent-500">Contexto forecast</p>
            <h2>Dónde y cuándo proyectamos</h2>
            <p>
              Este selector controla escenario, mercado y fechas del forecast. Forecast =
              proyección, no dato observado.
            </p>
          </div>
          <ForecastContextControls
            forecastScenarios={forecastScenarios}
            forecastScenario={forecastScenario}
            onForecastScenarioChange={onForecastScenarioChange}
            market={forecastMarket}
            onMarketChange={onForecastMarketChange}
            markets={forecastMarkets}
            selectedTimeMode={selectedForecastTimeMode}
            onTimeModeChange={setSelectedForecastTimeMode}
            selectedYear={selectedForecastYear}
            onSelectedYearChange={setSelectedForecastYear}
            availableYears={forecastYears}
            selectedMonth={selectedForecastMonth}
            onSelectedMonthChange={setSelectedForecastMonth}
            monthOptions={forecastMonthOptionsForYear}
            rangeStartMonth={forecastRangeStartMonth}
            onRangeStartMonthChange={setForecastRangeStartMonth}
            rangeEndMonth={forecastRangeEndMonth}
            onRangeEndMonthChange={setForecastRangeEndMonth}
            rangeMonthOptions={forecastRangeMonthOptions}
            selectableRangeStartMonths={selectableRangeStartMonths}
            selectableRangeEndMonths={selectableRangeEndMonths}
            periodLabel={selectedForecastWindow.label}
            periodDetail={selectedForecastWindow.detail}
            periodStatusItems={forecastPeriodStatusItems}
            coverageItems={forecastCoverageItems}
            dataNote={`Horizonte disponible: ${horizonLabel}. Escenario ${forecastScenarioLabel}.`}
          />
        </section>
      </aside>

      <div className="home-content-stack">
      <section className="forecast-detail-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <button type="button" className="section-link" onClick={onBack}>
              Volver al panel
            </button>
            <p className="analysis-label mt-6 text-accent-500">Proyección</p>
            <h2 className="mt-2 text-3xl font-semibold text-black md:text-4xl">
              Proyección de mercado
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
              Horizonte disponible: {horizonLabel}. Selección: {selectedForecastWindow.label}.
              Escenario {forecastScenarioLabel}. Muestra visitas y facturación esperadas.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <TrustBadges badges={getDataTrustBadges(forecastRows)} />
              <ForecastCaveat />
            </div>
          </div>

        </div>

        <dl className="forecast-stat-strip">
          <div>
            <dt>Horizonte</dt>
            <dd>{forecastPeriods.length} períodos</dd>
          </div>
          <div>
            <dt>Selección</dt>
            <dd>{selectedForecastWindow.monthCount} períodos</dd>
          </div>
          <div>
            <dt>Focus Brand inicio</dt>
            <dd>{formatCompact(focusStartRow?.visits)}</dd>
          </div>
          <div>
            <dt>Focus Brand cierre</dt>
            <dd>{formatCompact(focusEndRow?.visits)}</dd>
          </div>
        </dl>
      </section>

      <ContentSection
        eyebrow="Evolución"
        title="Proyección por competidor"
        detail={selectedForecastWindow.label}
      >
        <CompanyLegend
          series={forecastLegendSeries}
          hiddenCompanyIds={forecastVisibility.hiddenCompanyIds}
          onToggleCompany={forecastVisibility.handleToggleCompany}
          onShowAll={forecastVisibility.handleShowAll}
          onHideAll={forecastVisibility.handleHideAll}
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <MetricChart
            title="Proyección de visitas"
            metricKey="visits"
            series={visitsSeries}
            chartData={visitsChartData}
            emptyTitle="No hay datos de visitas para esta proyección."
            hiddenCompanyIds={forecastVisibility.hiddenCompanyIds}
          />
          <MetricChart
            title="Proyección de facturación"
            metricKey="revenue"
            series={revenueSeries}
            chartData={revenueChartData}
            emptyTitle="No hay datos de facturación para esta proyección."
            hiddenCompanyIds={forecastVisibility.hiddenCompanyIds}
          />
        </section>
      </ContentSection>

      <ContentSection
        eyebrow="Ranking de proyección"
        title={selectedForecastWindow.mode === "horizon" ? "Cierre proyectado" : "Periodo forecast seleccionado"}
        detail={selectedForecastPeriod?.label}
      >
        <ForecastRankingList rows={topForecastRows} onOpenProfile={onOpenProfile} />
      </ContentSection>

      <ContentSection
        eyebrow="Detalle"
        title="Tabla de forecast"
        detail={selectedForecastPeriod?.label}
      >
        <RankingTable
          rows={selectedForecastPeriodRows}
          selectedPeriod={selectedForecastPeriod}
          onOpenProfile={onOpenProfile}
          title="Tabla de forecast por empresa"
          description={
            selectedForecastWindow.mode === "horizon"
              ? `Cierre proyectado: ${selectedForecastWindow.closeLabel}. Horizonte disponible: ${horizonLabel}.`
              : `Periodo forecast: ${selectedForecastWindow.label}. Detalle completo por competidor.`
          }
        />
      </ContentSection>
    </div>
    </div>
  );
}

function ContentSection({ eyebrow, title, detail, action, children }) {
  return (
    <section className="content-section">
      <div className="content-section-header">
        <div>
          <p className="analysis-label text-accent-500">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-black">{title}</h2>
        </div>
        <div className="content-section-actions">
          {action}
          {detail && !action && <span className="scope-pill">{detail}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}

function TrustBadges({ badges = [] }) {
  if (!badges.length) return null;

  return (
    <div className="trust-badge-row" aria-label="Contexto de datos">
      {badges.map((badge) => (
        <span key={badge.key} className={`trust-badge trust-badge-${badge.key}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function ExecutiveMoverList({ title, metricLabel = "", items = [], emptyMessage }) {
  return (
    <div className="executive-list-card">
      <p className="analysis-label">{title}</p>
      {metricLabel && <p className="executive-list-context">{metricLabel}</p>}
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.slice(0, 3).map((item) => (
            <div key={`${title}-${item.id}`} className="executive-list-row">
              <span className="flex min-w-0 items-center gap-2">
                <CompanyMark
                  companyId={item.id}
                  label={item.name}
                  color={item.color}
                  className="company-mark-legend"
                />
                <span className="truncate font-semibold text-black">{item.name}</span>
              </span>
              <span className={item.value >= 0 ? "value-positive" : "value-negative"}>
                {formatPp(item.value, { compact: true })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-500">{emptyMessage}</p>
      )}
    </div>
  );
}

function BenchmarkComparisonStrip({ items = [] }) {
  if (!items.length) {
    return (
      <div className="executive-benchmark-strip">
        <p className="text-sm font-semibold text-black">Market Average</p>
        <p className="mt-1 text-sm text-neutral-500">
          No hay métricas comparables contra el promedio del mercado medido para este período.
        </p>
      </div>
    );
  }

  return (
    <div className="executive-benchmark-strip">
      <div>
        <p className="analysis-label">Market Average</p>
        <h3 className="mt-1 text-lg font-semibold text-black">Focus Brand frente al promedio del mercado medido</h3>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Benchmark calculado, no empresa real.
        </p>
      </div>
      <div className="executive-benchmark-grid">
        {items.map((item) => (
          <div key={item.key} className="executive-benchmark-item">
            <span>{item.label}</span>
            <strong>{formatMetric(item.focusValue, item.key)}</strong>
            <small>{item.deltaLabel}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitiveRiskList({ risks = [] }) {
  return (
    <div className="executive-list-card">
      <p className="analysis-label">Riesgos competitivos</p>
      {risks.length ? (
        <div className="mt-3 space-y-3">
          {risks.map((risk) => (
            <div key={risk.id} className="risk-row">
              <CompanyMark
                companyId={risk.row?.company_id}
                label={getCompanyLabel(risk.row)}
                color={risk.row?.company_color}
                className="company-mark-legend"
              />
              <div className="min-w-0">
                <p className="font-semibold text-black">{risk.title}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{risk.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          No hay alertas con datos suficientes para este periodo.
        </p>
      )}
    </div>
  );
}

function ExecutiveMarketHome({
  snapshot,
  rows = [],
  selectedMetric = "revenue",
  lastAvailableLabel = "",
  emptyActions = [],
}) {
  if (!rows.length) {
    const metricLabel = getMetricCopy(selectedMetric);
    const periodLabel = snapshot?.periodLabel || "este periodo";
    if (selectedMetric) {
      return (
        <EmptyState
          title={`No hay datos de ${metricLabel} para ${periodLabel}.`}
          message={
            lastAvailableLabel
              ? `Último dato disponible: ${lastAvailableLabel}.`
              : "Selecciona otro periodo o cambia la métrica local."
          }
          actions={emptyActions}
        />
      );
    }
    return (
      <EmptyState
        title="Selecciona un período con datos comparables."
        message="Selecciona un período con datos reales de competidores."
      />
    );
  }

  const totalLabel =
    snapshot.primaryMetric === "revenue" ? "Facturación mercado medido" : "Visitas mercado medido";
  const hasRevenueInPeriod = hasAnyMetric(rows, "revenue");
  const metricBasisNote =
    snapshot.primaryMetric === "visits" && !hasRevenueInPeriod
      ? "No hay facturación disponible para este periodo; la lectura se basa en tráfico."
      : `Métrica principal: ${snapshot.primaryMetric === "revenue" ? "Facturación" : "Visitas"}.`;
  const focusShareDetail = snapshot.benchmarkComparisons.find(
    (item) => item.key === snapshot.shareMetric,
  )?.deltaLabel;
  const shareChangeLabel = snapshot.shareChangeMetric
    ? getMetricCopy(snapshot.shareChangeMetric)
    : "cuota";
  const shareChangeContextLabel = getShareChangeContextLabel(snapshot.shareChangeMetric, rows);
  const focusShareLabel =
    snapshot.shareMetric === "market_share_visits"
      ? "Cuota visitas de Focus Brand"
      : "Cuota facturación de Focus Brand";
  const focusGrowthLabel = getFocusBrandGrowthKpiLabel(snapshot.periodLabel);
  const growthDetailLabel = getGrowthMetricCopy(snapshot.growthMetric, snapshot.periodLabel);

  return (
    <Panel eyebrow="Inicio ejecutivo" title="Qué está pasando en el mercado">
      <div className="executive-hero">
        <div className="min-w-0">
          <p className="analysis-label text-accent-500">Lectura ejecutiva</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-black md:text-3xl">
            {snapshot.headline}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {snapshot.periodLabel && <span className="scope-pill">{snapshot.periodLabel}</span>}
            <span className="scope-pill">
              Lectura basada en {snapshot.primaryMetric === "revenue" ? "facturación" : "visitas"}
            </span>
            <TrustBadges badges={snapshot.badges} />
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-600">{metricBasisNote}</p>
        </div>
        <div className="executive-hero-aside">
          <span>Pregunta estratégica</span>
          <strong>Quién lidera, quién gana cuota y dónde queda Focus Brand frente al mercado.</strong>
        </div>
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={totalLabel}
          value={snapshot.totalMarketValue !== null ? formatMetric(snapshot.totalMarketValue, snapshot.primaryMetric) : "N/A"}
          detail={`${rows.length} competidores reales medidos`}
          accentColor="#000000"
        />
        <KpiCard
          label={focusShareLabel}
          value={formatMetric(snapshot.focusShare, snapshot.shareMetric)}
          detail={focusShareDetail || getMetricCopy(snapshot.shareMetric)}
          accentColor="#000000"
        />
        <KpiCard
          label={focusGrowthLabel}
          value={snapshot.focusGrowth !== null ? formatSignedPercent(snapshot.focusGrowth) : "N/A"}
          detail={
            snapshot.focusGrowth !== null
              ? growthDetailLabel
              : `Sin ${focusGrowthLabel.toLowerCase()} disponible para este periodo`
          }
          accentColor="#000000"
        />
        <KpiCard
          label="Mayor movimiento de cuota"
          value={snapshot.shareWinners.topGainer ? formatPp(snapshot.shareWinners.topGainer.value) : "N/A"}
          detail={
            snapshot.shareWinners.topGainer
              ? `${shareChangeContextLabel || shareChangeLabel}: gana ${snapshot.shareWinners.topGainer.name}${snapshot.shareWinners.topLoser ? ` / pierde ${snapshot.shareWinners.topLoser.name}` : ""}`
              : `Sin datos de ${shareChangeLabel}`
          }
          accentColor="#E4032C"
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <ExecutiveMoverList
            title="Mayores subidas de cuota"
            metricLabel={shareChangeContextLabel}
            items={snapshot.shareWinners.gainers}
            emptyMessage="No hay ganadores de cuota detectables."
          />
          <ExecutiveMoverList
            title="Mayores bajadas de cuota"
            metricLabel={shareChangeContextLabel}
            items={snapshot.shareWinners.losers}
            emptyMessage="No hay perdedores de cuota detectables."
          />
        </div>
        <BenchmarkComparisonStrip items={snapshot.benchmarkComparisons} />
        <CompetitiveRiskList risks={snapshot.risks} />
      </section>
    </Panel>
  );
}

function MetricSwitch({ options = [], value, onChange, label = "Métrica" }) {
  if (options.length <= 1) return null;

  return (
    <div className="compact-segment-group">
      <p className="analysis-label mb-2">{label}</p>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            disabled={option.disabled}
            title={option.disabled && option.reason ? `${option.label}: ${option.reason}` : option.label}
            aria-label={getSelectOptionLabel(option)}
            className={`segmented-button ${value === option.key ? "segmented-button-active" : ""}`}
          >
            <span>{option.label}</span>
            {option.disabled && option.reason && <small>{option.reason}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

function getWindowRangeLabel(startMonth = "", endMonth = "") {
  const start = getMonthParts(startMonth);
  const end = getMonthParts(endMonth);
  const startLabel = getDemoMonthLabel(start.month);
  const endLabel = getDemoMonthLabel(end.month);
  if (!start.year || !end.year || !startLabel || !endLabel) return "";
  if (startMonth === endMonth) return `${startLabel} ${start.year}`;
  if (start.year === end.year) return `${startLabel}-${endLabel} ${end.year}`;
  return `${startLabel} ${start.year}-${endLabel} ${end.year}`;
}

function getIndexedRowSortValue(row = {}) {
  const monthKey = getGlobalContextMonthKey(row);
  if (!monthKey) return 0;
  const [year, month] = monthKey.split("-");
  return new Date(buildMonthDate(year, month)).getTime();
}

function getVisibleTimeSeriesWindow(rows = [], context = {}, metricKey = "indexed_visits") {
  const metric = getIndexedSourceMetric(metricKey);
  const rawTimeMode = context.timeMode || context.selectedTimeMode || context.periodType;
  const timeMode = rawTimeMode ? normalizeTimeMode(rawTimeMode) : "all";
  const market = context.market || "";
  const sourceRows = preferObservedRows(
    filterInterfaceRows(
      rows,
      { periodType: "monthly", market },
      { includeBenchmark: true, includeForecasts: false },
    ),
  )
    .filter((row) => {
      const value = safeNumber(row?.[metric]);
      return value !== null && value > 0;
    })
    .sort((a, b) => getIndexedRowSortValue(a) - getIndexedRowSortValue(b));

  if (timeMode === "month") {
    const { startDate } = getTimeSelectionDates(context);
    const monthKey = String(startDate || "").slice(0, 7);
    return {
      rows: [],
      startMonth: monthKey,
      endMonth: monthKey,
      label: monthKey ? getWindowRangeLabel(monthKey, monthKey) : "",
      timeMode,
      isSinglePoint: true,
    };
  }

  let startDate = "";
  let endDate = "";

  if (timeMode === "historical") {
    const range = getCoverageRangeForRequirement(rows, metric, { market });
    startDate = range.first?.date || "";
    endDate = range.last?.date || "";
  } else if (timeMode === "annual" || timeMode === "range") {
    const dates = getTimeSelectionDates(context);
    startDate = dates.startDate || "";
    endDate = dates.endDate || "";
  } else {
    startDate = sourceRows[0]?.date || "";
    endDate = sourceRows[sourceRows.length - 1]?.date || "";
  }

  const startMonth = String(startDate || "").slice(0, 7);
  const endMonth = String(endDate || "").slice(0, 7);
  const windowRows = sourceRows.filter((row) => {
    const monthKey = getGlobalContextMonthKey(row);
    return monthKey >= startMonth && monthKey <= endMonth;
  });
  const metricLabel = getIndexedMetricDisplayLabel(metricKey);
  const label =
    timeMode === "historical"
      ? `histórico disponible de ${metricLabel}`
      : getWindowRangeLabel(startMonth, endMonth);

  return {
    rows: windowRows,
    startMonth,
    endMonth,
    label,
    timeMode,
    isSinglePoint: startMonth && startMonth === endMonth,
  };
}

function _buildIndexedSeries(rows = [], options = {}) {
  const {
    metric = "indexed_visits",
    context = {},
    companies = [],
  } = options;
  const sourceMetric = getIndexedSourceMetric(metric);
  const companySet = new Set((companies || []).map(normalizeCompanyId).filter(Boolean));
  const window = getVisibleTimeSeriesWindow(rows, context, metric);
  const groupedRows = new Map();

  window.rows.forEach((row) => {
    const companyId = normalizeCompanyId(row.company_id);
    if (!companyId || (companySet.size && !companySet.has(companyId))) return;
    const value = safeNumber(row?.[sourceMetric]);
    if (value === null || value <= 0) return;
    const group = groupedRows.get(companyId) || [];
    group.push(row);
    groupedRows.set(companyId, group);
  });

  const series = Array.from(groupedRows.entries())
    .map(([, companyRows]) => {
      const sortedRows = companyRows
        .slice()
        .sort((a, b) => getIndexedRowSortValue(a) - getIndexedRowSortValue(b));
      const baseRow = sortedRows.find((row) => {
        const value = safeNumber(row?.[sourceMetric]);
        return value !== null && value > 0;
      });
      const baseValue = safeNumber(baseRow?.[sourceMetric]);
      if (!baseRow || baseValue === null || baseValue <= 0) return null;

      const baseMonth = getGlobalContextMonthKey(baseRow);
      const baseLabel = formatMonthLabelFromKey(baseMonth);
      const latestRow = sortedRows[sortedRows.length - 1] || baseRow;
      const points = sortedRows
        .map((row) => {
          const currentValue = safeNumber(row?.[sourceMetric]);
          if (currentValue === null || currentValue <= 0) return null;
          const monthKey = getGlobalContextMonthKey(row);
          const indexValue = (currentValue / baseValue) * 100;
          if (!Number.isFinite(indexValue)) return null;

          return {
            date: buildMonthDate(row.year, row.month) || row.date,
            label: formatMonthLabelFromKey(monthKey) || row.period_label || row.date,
            period_key: monthKey,
            sortValue: getIndexedRowSortValue(row),
            value: indexValue,
            actualValue: currentValue,
            baseValue,
            baseDate: baseRow.date,
            baseLabel,
            baseMonth,
            sourceMetric,
            changeVsBase: currentValue / baseValue - 1,
          };
        })
        .filter(Boolean);

      if (points.length < 2) return null;

      return {
        company_id: latestRow.company_id,
        display_name: latestRow.display_name || latestRow.company_name || latestRow.company_id,
        company_color: isBenchmarkRow(latestRow) ? "#94A3B8" : latestRow.company_color,
        type: latestRow.type,
        data_type: latestRow.data_type,
        value_type: latestRow.value_type,
        visual_role: latestRow.visual_role,
        baseMonth,
        baseLabel,
        baseValue,
        sourceMetric,
        points,
      };
    })
    .filter(Boolean);

  const hasLateBases = series.some((companySeries) => companySeries.baseMonth !== window.startMonth);

  return {
    series,
    window,
    hasLateBases,
  };
}

function _getIndexedAxisTicks(chartData = [], series = []) {
  const companyIds = new Set(series.map((companySeries) => companySeries.company_id));
  const values = chartData.flatMap((row) =>
    Array.from(companyIds)
      .map((companyId) => safeNumber(row?.[companyId]))
      .filter((value) => value !== null && Number.isFinite(value)),
  );
  const maxValue = values.length ? Math.max(...values) : 200;
  const upper = Math.max(200, Math.ceil(maxValue / 50) * 50);
  const ticks = [];
  for (let value = 0; value <= upper; value += 50) ticks.push(value);
  return ticks.includes(100) ? ticks : [...ticks, 100].sort((a, b) => a - b);
}

function getAnnualGrowthMetricKey(metricKey = "indexed_visits") {
  const sourceMetric = getIndexedSourceMetric(metricKey);
  return sourceMetric === "revenue" ? "revenue_yoy_growth" : "visits_yoy_growth";
}

function getYearMonthNumber(row = {}) {
  const month = safeNumber(row.month);
  if (month !== null) return month;
  const monthKey = getGlobalContextMonthKey(row);
  return monthKey ? Number(monthKey.slice(5, 7)) : null;
}

function buildAnnualYoYGrowthSeries(rows = [], options = {}) {
  const {
    metric = "indexed_visits",
    context = {},
    companies = [],
  } = options;
  const sourceMetric = getIndexedSourceMetric(metric);
  const companySet = new Set((companies || []).map(normalizeCompanyId).filter(Boolean));
  const market = context.market || "";
  const sourceRows = preferObservedRows(
    filterInterfaceRows(
      rows,
      { periodType: "monthly", market },
      { includeBenchmark: true, includeForecasts: false },
    ),
  ).filter((row) => {
    const companyId = normalizeCompanyId(row.company_id);
    const value = safeNumber(row?.[sourceMetric]);
    return companyId && (!companySet.size || companySet.has(companyId)) && value !== null && value > 0;
  });
  const groups = new Map();

  sourceRows.forEach((row) => {
    const companyId = normalizeCompanyId(row.company_id);
    const year = Number(row.year || String(row.date || "").slice(0, 4));
    const month = getYearMonthNumber(row);
    const value = safeNumber(row?.[sourceMetric]);
    if (!companyId || !year || !month || value === null || value <= 0) return;

    const companyGroup = groups.get(companyId) ?? {
      company_id: row.company_id,
      display_name: getCompanyLabel(row),
      company_color: isBenchmarkRow(row) ? "#94A3B8" : row.company_color,
      type: row.type,
      value_type: row.value_type,
      visual_role: row.visual_role,
      years: new Map(),
    };
    const yearGroup = companyGroup.years.get(year) ?? { year, months: new Map() };
    yearGroup.months.set(month, value);
    companyGroup.years.set(year, yearGroup);
    groups.set(companyId, companyGroup);
  });

  const series = Array.from(groups.values())
    .map((companyGroup) => {
      const points = Array.from(companyGroup.years.keys())
        .sort((a, b) => a - b)
        .map((year) => {
          const currentGroup = companyGroup.years.get(year);
          const previousGroup = companyGroup.years.get(year - 1);
          if (!currentGroup || !previousGroup) return null;

          const currentMonths = Array.from(currentGroup.months.keys()).sort((a, b) => a - b);
          const comparableMonths = currentMonths.filter((month) => previousGroup.months.has(month));
          if (!comparableMonths.length) return null;

          const currentValue = comparableMonths.reduce(
            (total, month) => total + (safeNumber(currentGroup.months.get(month)) ?? 0),
            0,
          );
          const previousValue = comparableMonths.reduce(
            (total, month) => total + (safeNumber(previousGroup.months.get(month)) ?? 0),
            0,
          );
          if (!previousValue || currentValue <= 0) return null;

          const firstMonth = comparableMonths[0];
          const lastMonth = comparableMonths.at(-1);
          const monthRange =
            comparableMonths.length === 12
              ? "año completo"
              : `${getDemoMonthLabel(firstMonth)}-${getDemoMonthLabel(lastMonth)}`;
          const isPartial = comparableMonths.length < 12;

          return {
            date: `${year}-12-01`,
            label: isPartial ? `${year} parcial` : String(year),
            period_key: String(year),
            sortValue: year,
            value: currentValue / previousValue - 1,
            actualValue: currentValue,
            currentValue,
            previousValue,
            previousYear: year - 1,
            year,
            monthCount: comparableMonths.length,
            monthRange,
            sourceMetric,
            comparisonLabel: `${year} vs ${year - 1}`,
            isPartial,
          };
        })
        .filter(Boolean);

      return points.length
        ? {
            ...companyGroup,
            points,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  return {
    series,
    hasPartialYears: series.some((companySeries) => companySeries.points.some((point) => point.isPartial)),
  };
}

function getMomentumGrowthMetric(metricKey = "visits") {
  return metricKey === "revenue" ? "revenue_yoy_growth" : "visits_yoy_growth";
}

function getMomentumMetricLabel(metricKey = "visits") {
  return metricKey === "revenue" ? "facturación" : "visitas";
}

function calculateMomentumGrowth(currentValue, previousValue) {
  const current = safeNumber(currentValue);
  const previous = safeNumber(previousValue);
  if (current === null || previous === null || previous <= 0) return null;
  return current / previous - 1;
}

function getMomentumPeriodRows(rows = [], context = {}, metricKey = "visits") {
  return buildRowsForTimeSelection(rows, context, {
    market: context.market,
    metricKeys: [metricKey],
    requireAll: true,
    selectedMetric: metricKey,
  });
}

function getMomentumComparisonLabel(context = {}) {
  const timeMode = normalizeTimeMode(context.timeMode || context.selectedTimeMode);
  const selectedYear = Number(context.selectedYear);
  const selectedMonth = Number(context.selectedMonth);
  const annualEndMonth = Number(context.annualEndMonth);

  if (timeMode === "month") {
    const monthLabel = getDemoMonthLabel(selectedMonth);
    return monthLabel && selectedYear
      ? `${monthLabel} ${selectedYear - 1}`
      : "mismo mes del año anterior";
  }

  if (timeMode === "annual") {
    if (!selectedYear) return "año anterior comparable";
    const endLabel = getDemoMonthLabel(annualEndMonth);
    return annualEndMonth && annualEndMonth < 12 && endLabel
      ? `Ene-${endLabel} ${selectedYear - 1}`
      : `${selectedYear - 1}`;
  }

  if (timeMode === "range") return "mismo rango del año anterior";
  if (timeMode === "historical") return "primer vs último dato disponible";
  return "periodo comparable";
}

function getMomentumWindowLabel(periodRows = [], context = {}, fallback = "") {
  return getPeriodLabelFromRows(periodRows, context.selectedPeriod?.label || fallback || "Periodo seleccionado");
}

function isLowBaseMomentum(previousValue, averagePreviousValue) {
  const previous = safeNumber(previousValue);
  if (previous === null) return false;
  const absoluteThreshold = 1_000_000;
  const relativeThreshold =
    averagePreviousValue && averagePreviousValue > 0 ? averagePreviousValue * 0.25 : 0;
  return previous < Math.max(absoluteThreshold, relativeThreshold);
}

function isHistoricalContext(context = {}) {
  const rawTimeMode = context.timeMode || context.selectedTimeMode || context.periodType;
  return normalizeTimeMode(rawTimeMode) === "historical";
}

function buildMomentumEntries(rows = [], options = {}) {
  const { metric = "visits", reading = "vs_market", context = {}, maxItems = 8 } = options;
  const isHistorical = isHistoricalContext(context);
  const normalizedReading = reading === "vs_market" && isHistorical ? "absolute" : reading;
  const growthMetric = getMomentumGrowthMetric(metric);
  const periodRows = getMomentumPeriodRows(rows, context, metric)
    .filter(isRealCompanyRow)
    .filter((row) => !isBenchmarkRow(row) && !isForecastRow(row));
  const periodLabel = getMomentumWindowLabel(periodRows, context);
  const comparableLabel = getMomentumComparisonLabel(context);

  const comparableEntries = periodRows
    .map((row) => {
      const breakdown = getGrowthBreakdown(row, growthMetric);
      const currentValue = safeNumber(breakdown?.currentValue ?? row?.[metric]);
      const previousValue = safeNumber(breakdown?.previousValue);
      const growth = safeNumber(breakdown?.growthValue ?? row?.[growthMetric]);

      if (
        currentValue === null ||
        previousValue === null ||
        previousValue <= 0 ||
        growth === null
      ) {
        return null;
      }

      const absoluteDelta = currentValue - previousValue;

      return {
        id: row.company_id,
        name: getCompanyLabel(row),
        row,
        color: row.company_color || "#6F6864",
        metric,
        currentValue,
        previousValue,
        absoluteDelta,
        growth,
      };
    })
    .filter(Boolean);

  const averagePreviousValue =
    comparableEntries.length
      ? sumMetric(comparableEntries, "previousValue") / comparableEntries.length
      : null;
  const benchmarkOutlierIds = new Set();
  const benchmarkEntries = comparableEntries.filter((entry) => {
    const lowBase = isLowBaseMomentum(entry.previousValue, averagePreviousValue);
    const isOutlier = lowBase && entry.growth > 1;
    if (isOutlier) benchmarkOutlierIds.add(normalizeCompanyId(entry.id));
    return !isOutlier;
  });
  const benchmarkCurrentRows = periodRows.filter(
    (row) => !benchmarkOutlierIds.has(normalizeCompanyId(row.company_id)),
  );
  const currentMarketValue = sumMetric(benchmarkCurrentRows, metric);
  const previousMarketValue = sumMetric(benchmarkEntries, "previousValue");
  const marketGrowth = isHistorical
    ? null
    : calculateMomentumGrowth(currentMarketValue, previousMarketValue);

  const entries = comparableEntries
    .map((entry) => {
      const vsMarket =
        marketGrowth !== null && entry.growth !== null ? entry.growth - marketGrowth : null;
      const sortValue =
        normalizedReading === "absolute"
          ? entry.absoluteDelta
          : normalizedReading === "yoy"
            ? entry.growth
            : vsMarket;

      return {
        ...entry,
        vsMarket,
        sortValue,
        isLowBase: isLowBaseMomentum(entry.previousValue, averagePreviousValue),
      };
    })
    .filter((entry) => safeNumber(entry.sortValue) !== null)
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, maxItems);

  let emptyReason = "";
  if (!periodRows.length) {
    emptyReason = "No disponible para este periodo.";
  } else if (!comparableEntries.length) {
    emptyReason = "No hay periodo comparable suficiente para calcular crecimiento interanual.";
  } else if (normalizedReading === "vs_market" && marketGrowth === null) {
    emptyReason = "No hay crecimiento de mercado comparable para este periodo.";
  }

  return {
    entries,
    periodRows,
    periodLabel,
    comparableLabel,
    marketGrowth,
    metric,
    reading: normalizedReading,
    emptyReason,
  };
}

function formatSignedMetricDelta(value, metricKey = "visits") {
  const number = safeNumber(value);
  if (number === null) return "N/A";
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  if (metricKey === "revenue") return `${sign}${formatBattleCurrency(Math.abs(number))}`;
  return `${sign}${formatMetric(Math.abs(number), metricKey)}`;
}

function formatProfileMomentumValue(value, metricKey = "visits") {
  if (metricKey === "revenue") return formatBattleCurrency(value);
  return formatMetric(value, metricKey);
}

function formatMomentumPrimaryValue(entry = {}, reading = "vs_market") {
  if (reading === "absolute") {
    return `${formatSignedMetricDelta(entry.absoluteDelta, entry.metric)} · ${formatSignedPercent(entry.growth)}`;
  }
  if (reading === "yoy") {
    return `${formatSignedPercent(entry.growth)} · ${formatSignedMetricDelta(entry.absoluteDelta, entry.metric)}`;
  }
  return `${formatPercentagePoints(entry.vsMarket)} vs mercado`;
}

function getMomentumReadingDescription(reading = "absolute", options = {}) {
  const { isHistorical = false } = options;
  if (reading === "vs_market") {
    return "Compara el crecimiento de cada empresa con el crecimiento del mercado medido.";
  }

  if (reading === "yoy") {
    return "Ordenado por porcentaje de crecimiento. Revisa el volumen añadido para separar impacto real de efecto base.";
  }

  return isHistorical
    ? "Ordenado por volumen añadido entre el primer y el último dato disponible. El porcentaje muestra el crecimiento relativo."
    : "Ordenado por volumen añadido frente al periodo comparable. El porcentaje muestra el crecimiento relativo.";
}

function getMomentumExecutiveInsight(momentum = {}, reading = "absolute", metricKey = "visits") {
  const entries = momentum.entries || [];
  const topEntry = entries[0];
  if (!topEntry) return "";

  const metricLabel = getMomentumMetricLabel(metricKey);
  const comparable = momentum.comparableLabel || "el periodo comparable";

  if (reading === "absolute") {
    const comparisonCopy = comparable.includes("primer vs último")
      ? "desde el primer dato disponible"
      : `frente a ${comparable}`;
    return `${topEntry.name} lidera el crecimiento real de ${metricLabel} con ${formatSignedMetricDelta(
      topEntry.absoluteDelta,
      metricKey,
    )} ${comparisonCopy}.`;
  }

  if (reading === "vs_market") {
    const focus = entries.find((entry) => sameCompany(entry.id, OWN_COMPANY_ID));
    const peer_a = entries.find((entry) => sameCompany(entry.id, "peer_a"));

    if (focus && peer_a) {
      const focusDirection = focus.vsMarket >= 0 ? "por encima" : "por debajo";
      const peer_aCopy =
        peer_a.growth >= 0 && peer_a.vsMarket < 0
          ? "Northline crece, pero por debajo del ritmo medio"
          : peer_a.vsMarket >= 0
            ? "Northline también crece por encima del mercado"
            : "Northline queda por debajo del mercado";
      return `Focus Brand crece ${focusDirection} del mercado medido; ${peer_aCopy}.`;
    }

    return `${topEntry.name} lidera frente al mercado con ${formatPercentagePoints(
      topEntry.vsMarket,
    )}.`;
  }

  const hasLowBaseEntries = entries.some((entry) => entry.isLowBase);
  return hasLowBaseEntries
    ? `${topEntry.name} lidera en porcentaje, pero los casos con asterisco parten de una base inicial pequeña.`
    : `${topEntry.name} lidera en crecimiento porcentual con ${formatSignedPercent(topEntry.growth)}.`;
}

const LOW_BASE_TOOLTIP =
  "Base inicial pequeña.";

function LowBaseAsterisk({ className = "" }) {
  return (
    <span
      className={`momentum-low-base-asterisk ${className}`}
      title={LOW_BASE_TOOLTIP}
      aria-label={LOW_BASE_TOOLTIP}
    >
      *
    </span>
  );
}

function getMomentumCardStats(entry = {}, reading = "absolute", metricKey = "visits", marketGrowth = null) {
  const marketDifference =
    marketGrowth !== null && entry.vsMarket !== null
      ? { label: "Vs mercado", value: formatPercentagePoints(entry.vsMarket, { compact: true }) }
      : null;

  if (reading === "vs_market") {
    return [
      { label: "Empresa", value: formatSignedPercent(entry.growth) },
      { label: "Mercado", value: marketGrowth !== null ? formatSignedPercent(marketGrowth) : "N/A" },
      { label: "Antes", value: formatMetric(entry.previousValue, metricKey) },
      { label: "Ahora", value: formatMetric(entry.currentValue, metricKey) },
    ];
  }

  if (reading === "yoy") {
    return [
      { label: "Antes", value: formatMetric(entry.previousValue, metricKey) },
      { label: "Ahora", value: formatMetric(entry.currentValue, metricKey) },
      { label: "Volumen", value: formatSignedMetricDelta(entry.absoluteDelta, metricKey) },
      marketDifference,
    ].filter(Boolean);
  }

  return [
    { label: "Antes", value: formatMetric(entry.previousValue, metricKey) },
    { label: "Ahora", value: formatMetric(entry.currentValue, metricKey) },
    marketDifference,
  ].filter(Boolean);
}

function MomentumCardList({
  entries = [],
  reading = "absolute",
  metricKey = "visits",
  marketGrowth = null,
  onOpenProfile,
}) {
  const hasLowBaseEntries = entries.some((entry) => entry.isLowBase);

  return (
    <div className="momentum-card-list" aria-label="Ranking de momentum">
      {reading === "vs_market" && marketGrowth !== null && (
        <div className="momentum-market-benchmark">
          <span>Mercado medido</span>
          <strong>{formatSignedPercent(marketGrowth)}</strong>
          <small>Benchmark del crecimiento total del periodo seleccionado.</small>
        </div>
      )}
      <div className="momentum-cards">
        {entries.map((entry, index) => {
          const accentColor = entry.color || "#6F6864";
          const RowTag = onOpenProfile ? "button" : "div";
          const statItems = getMomentumCardStats(entry, reading, metricKey, marketGrowth);

          return (
            <RowTag
              key={`${entry.id}-${reading}-card`}
              type={onOpenProfile ? "button" : undefined}
              onClick={onOpenProfile ? () => onOpenProfile(entry.id) : undefined}
              className="momentum-card-row"
              style={{ "--company-color": accentColor }}
            >
              <span className={`rank-token ${index === 0 ? "rank-token-lead" : ""}`}>
                #{index + 1}
              </span>
              <span className="momentum-card-main">
                <span className="momentum-card-header">
                  <span className="momentum-card-name">
                    <CompanyMark
                      companyId={entry.id}
                      label={entry.name}
                      color={entry.color}
                      className="company-mark-legend"
                    />
                    <span className="truncate">
                      {entry.name}
                      {entry.isLowBase && reading !== "yoy" && <LowBaseAsterisk />}
                    </span>
                  </span>
                  <strong className="momentum-card-value">
                    {formatMomentumPrimaryValue(entry, reading)}
                    {entry.isLowBase && reading === "yoy" && <LowBaseAsterisk />}
                  </strong>
                </span>
                <span className="momentum-card-stats">
                  {statItems.map((item) => (
                    <span key={`${entry.id}-${reading}-${item.label}`} className="momentum-card-stat">
                      <small>{item.label}</small>
                      <strong>{item.value}</strong>
                    </span>
                  ))}
                </span>
              </span>
            </RowTag>
          );
        })}
      </div>
      {hasLowBaseEntries && (
        <p className="momentum-low-base-note">
          * Crecimiento porcentual elevado sobre una base inicial pequeña; revisar volumen añadido antes de concluir.
        </p>
      )}
    </div>
  );
}

function GrowthMomentum({ rows = [], context = {}, rangeLabel = "", onOpenProfile }) {
  const [selectedMetric, setSelectedMetric] = useState("visits");
  const [selectedReading, setSelectedReading] = useState("absolute");
  const isHistoricalMomentum = isHistoricalContext(context);

  const metricOptions = useMemo(
    () =>
      MOMENTUM_METRIC_OPTIONS.map((option) => {
        const periodRows = getMomentumPeriodRows(rows, context, option.key);
        const available = periodRows.some((row) => hasMetricValue(row, option.key));

        return {
          ...option,
          disabled: !available,
          reason: available ? "" : "No disponible para este periodo",
        };
      }),
    [context, rows],
  );
  const defaultMetric =
    getPreferredAvailableOption(metricOptions, ["visits", "revenue"])?.key || "";
  const readingOptions = useMemo(
    () => MOMENTUM_READING_OPTIONS,
    [],
  );

  useEffect(() => {
    const selectedOption = metricOptions.find((option) => option.key === selectedMetric);
    if (!defaultMetric) {
      setSelectedMetric("");
      return;
    }
    if (!selectedMetric || selectedOption?.disabled) {
      setSelectedMetric(defaultMetric);
    }
  }, [defaultMetric, metricOptions, selectedMetric]);

  useEffect(() => {
    const selectedOption = readingOptions.find((option) => option.key === selectedReading);
    if (!selectedReading || !selectedOption || selectedOption.disabled) {
      setSelectedReading("absolute");
    }
  }, [readingOptions, selectedReading]);

  const metricKey = selectedMetric || defaultMetric || "visits";
  const momentum = useMemo(
    () =>
      metricKey
        ? buildMomentumEntries(rows, {
            metric: metricKey,
            reading: selectedReading,
            context,
          })
        : {
            entries: [],
            periodRows: [],
            periodLabel: rangeLabel,
            comparableLabel: "",
            marketGrowth: null,
            emptyReason: "No hay datos disponibles para este periodo.",
          },
    [context, metricKey, rangeLabel, rows, selectedReading],
  );
  const metricLabel = getMomentumMetricLabel(metricKey);
  const periodLabel = momentum.periodLabel || rangeLabel;
  const executiveInsight = getMomentumExecutiveInsight(momentum, selectedReading, metricKey);
  const emptyMessage =
    momentum.emptyReason ||
    "No hay periodo comparable suficiente para calcular crecimiento interanual.";

  return (
    <Panel
      eyebrow="Crecimiento competitivo"
      title="Momentum de crecimiento"
      className="momentum-panel"
      action={
        <div className="block-controls">
          <MetricSwitch
            options={metricOptions}
            value={metricKey}
            onChange={setSelectedMetric}
            label="Métrica"
          />
          <MetricSwitch
            options={readingOptions}
            value={selectedReading}
            onChange={setSelectedReading}
            label="Lectura"
          />
        </div>
      }
    >
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Separa volumen añadido y crecimiento porcentual. El mercado medido queda como referencia, no como una lectura separada.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="scope-pill">Métrica: {metricLabel}</span>
        {isHistoricalMomentum ? (
          <>
            <span className="scope-pill">Histórico disponible</span>
            <span className="scope-pill">Primer vs último dato disponible</span>
          </>
        ) : (
          <>
            {periodLabel && <span className="scope-pill">{formatChartPeriodLabel(periodLabel)}</span>}
            {momentum.comparableLabel && <span className="scope-pill">Comparable: {momentum.comparableLabel}</span>}
          </>
        )}
        {momentum.marketGrowth !== null && (
          <span className="scope-pill">
            Mercado medido: {formatSignedPercent(momentum.marketGrowth)}
          </span>
        )}
      </div>

      <div className="momentum-reading-note">
        <strong>{executiveInsight}</strong>
        <span>{getMomentumReadingDescription(selectedReading, { isHistorical: isHistoricalMomentum })}</span>
      </div>

      {momentum.entries.length ? (
        <MomentumCardList
          entries={momentum.entries}
          reading={selectedReading}
          metricKey={metricKey}
          marketGrowth={momentum.marketGrowth}
          onOpenProfile={onOpenProfile}
        />
      ) : (
        <EmptyState
          title={`No hay momentum de ${metricLabel} para este periodo.`}
          message={emptyMessage}
        />
      )}
    </Panel>
  );
}

function MonetizationTooltip({ active, payload = [] }) {
  if (!active || !payload.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <ChartTooltipShell title={entry.name}>
      <div className="chart-tooltip-row">
        <span>Brecha de monetización</span>
        <span className="chart-tooltip-value">{formatPp(entry.value)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>Cuota facturación</span>
        <span className="chart-tooltip-value">{formatPercent(entry.revenueShare)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>Cuota visitas</span>
        <span className="chart-tooltip-value">{formatPercent(entry.visitShare)}</span>
      </div>
    </ChartTooltipShell>
  );
}

function MonetizationBarValueLabel({ x = 0, y = 0, width = 0, height = 0, value }) {
  const number = safeNumber(value);
  if (number === null) return null;

  const isPositive = number >= 0;
  const textX = Number(x) + (isPositive ? Number(width) + 8 : -8);
  const textY = Number(y) + Number(height) / 2 + 4;

  return (
    <text
      x={textX}
      y={textY}
      textAnchor={isPositive ? "start" : "end"}
      className="monetization-bar-value"
    >
      {formatPp(number, { compact: true })}
    </text>
  );
}

function MonetizationLegendGroup({ title, subtitle, entries = [], tone = "positive" }) {
  if (!entries.length) return null;

  return (
    <section className="monetization-legend-group">
      <div>
        <p className="analysis-label">{title}</p>
        <small>{subtitle}</small>
      </div>
      <div className="monetization-legend-list">
        {entries.map((entry) => (
          <div key={`${entry.id}-gap`} className={`monetization-row is-${tone}`}>
            <span className="monetization-row-company">
              <CompanyMark
                companyId={entry.id}
                label={entry.name}
                color={entry.color}
                className="company-mark-legend"
              />
              <span>
                <strong>{entry.name}</strong>
                <small>{tone === "positive" ? "Factura por encima de su tráfico" : "Tráfico por encima de su facturación"}</small>
              </span>
            </span>
            <span className={entry.value >= 0 ? "value-positive" : "value-negative"}>
              {formatPp(entry.value, { compact: true })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function getMonetizationInsight(efficiencyLeader, opportunityLeader) {
  if (efficiencyLeader && opportunityLeader) {
    return `${opportunityLeader.name} concentra la mayor oportunidad de monetización (${formatPp(
      opportunityLeader.value,
      { compact: true },
    )}); ${efficiencyLeader.name} lidera la eficiencia comercial (${formatPp(
      efficiencyLeader.value,
      { compact: true },
    )}).`;
  }

  if (efficiencyLeader) {
    return `${efficiencyLeader.name} lidera la eficiencia comercial con ${formatPp(
      efficiencyLeader.value,
      { compact: true },
    )}.`;
  }

  if (opportunityLeader) {
    return `${opportunityLeader.name} concentra la mayor oportunidad de monetización con ${formatPp(
      opportunityLeader.value,
      { compact: true },
    )}.`;
  }

  return "La brecha mide la diferencia entre cuota de facturación y cuota de visitas.";
}

function MonetizationGap({ rows = [] }) {
  const data = useMemo(() => getMonetizationRows(rows), [rows]);
  const chartData = useMemo(() => {
    const positiveRows = data.filter((entry) => entry.value > 0).slice(0, 4);
    const negativeRows = data
      .filter((entry) => entry.value < 0)
      .sort((a, b) => a.value - b.value)
      .slice(0, 4);
    return [...positiveRows, ...negativeRows].sort((a, b) => b.value - a.value);
  }, [data]);
  const domain = useMemo(() => {
    const maxAbs = Math.max(0.01, ...chartData.map((entry) => Math.abs(entry.value)));
    return [-maxAbs, maxAbs];
  }, [chartData]);
  const positiveRows = useMemo(
    () => chartData.filter((entry) => entry.value > 0),
    [chartData],
  );
  const negativeRows = useMemo(
    () => chartData.filter((entry) => entry.value < 0).sort((a, b) => a.value - b.value),
    [chartData],
  );
  const efficiencyLeader = positiveRows[0] ?? null;
  const opportunityLeader = negativeRows[0] ?? null;
  const insight = getMonetizationInsight(efficiencyLeader, opportunityLeader);

  return (
    <Panel eyebrow="Eficiencia comercial" title="Brecha de monetización">
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Compara la cuota de facturación con la cuota de visitas. Positivo = monetiza por encima de su peso en tráfico; negativo = oportunidad de convertir mejor el tráfico.
      </p>
      {chartData.length ? (
        <div className="monetization-layout">
          <div className="monetization-insight-strip">
            <strong>{insight}</strong>
            <span>0 = equilibrio · puntos de cuota</span>
          </div>

          <div className="monetization-main-grid">
            <div className="monetization-chart-card">
              <div className="monetization-direction-row" aria-hidden="true">
                <span>Más tráfico que facturación</span>
                <strong>0 = equilibrio</strong>
                <span>Más facturación que tráfico</span>
              </div>
              <div className="h-[340px] min-w-0 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 16, right: 88, bottom: 10, left: 8 }}
                  >
                    <CartesianGrid stroke="rgba(0,0,0,0.08)" horizontal={false} />
                    <ReferenceLine
                      x={0}
                      stroke="rgba(0,0,0,0.42)"
                      strokeWidth={1.5}
                    />
                    <XAxis
                      type="number"
                      domain={domain}
                      tick={{ fill: "#6F6864", fontSize: 12 }}
                      tickFormatter={(value) => formatPp(value, { compact: true })}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={112}
                      tick={{ fill: "#393330", fontSize: 12, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<MonetizationTooltip />} />
                    <Bar dataKey="value" radius={[5, 5, 5, 5]} barSize={20}>
                      {chartData.map((entry) => (
                        <Cell key={entry.id} fill={entry.value >= 0 ? entry.color : "#94A3B8"} />
                      ))}
                      <LabelList dataKey="value" content={<MonetizationBarValueLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="monetization-legend">
              <div className="monetization-legend-heading">
                <p className="analysis-label">Lectura ejecutiva</p>
                <strong>Quién monetiza mejor y dónde hay oportunidad</strong>
              </div>
              <MonetizationLegendGroup
                title="Alta eficiencia comercial"
                subtitle="Factura más que su peso en tráfico."
                entries={positiveRows}
                tone="positive"
              />
              <MonetizationLegendGroup
                title="Oportunidad de monetización"
                subtitle="Tiene más tráfico que peso en facturación."
                entries={negativeRows}
                tone="negative"
              />
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No hay datos suficientes para calcular brecha de monetización."
          message="Esta métrica requiere facturación y visitas en el mismo periodo."
        />
      )}
    </Panel>
  );
}

function ShareGainLossCompact({ rows = [], rowsByMode = null }) {
  const [mode, setMode] = useState("revenue");
  const availableModes = useMemo(
    () =>
      [
        { key: "revenue", label: "Cuota facturación", availabilityKey: "market_share_revenue" },
        { key: "visits", label: "Cuota visitas", availabilityKey: "market_share_visits" },
      ].map((option) => {
        const optionRows = rowsByMode?.[option.key] ?? rows;
        const changeMetric = getShareChangeMetric(optionRows, option.key);
        const availability = getMetricAvailability(optionRows, optionRows, {
          metric: option.availabilityKey,
        });
        const disabled = !changeMetric;

        return {
          ...option,
          disabled,
          reason: disabled
            ? availability.available
              ? "requiere periodo comparable"
              : availability.reason
            : "",
        };
      }),
    [rows, rowsByMode],
  );

  useEffect(() => {
    const selectedMode = availableModes.find((option) => option.key === mode);
    const fallbackMode = getPreferredAvailableOption(availableModes, ["revenue", "visits"]);

    if (!fallbackMode) {
      setMode("");
      return;
    }

    if (!mode || selectedMode?.disabled) {
      setMode(fallbackMode.key);
    }
  }, [availableModes, mode]);

  const activeRows = mode ? rowsByMode?.[mode] ?? rows : rows;
  const metricKey = mode ? getShareChangeMetric(activeRows, mode) : "";
  const movers = useMemo(() => getShareWinnersLosers(activeRows, metricKey), [activeRows, metricKey]);
  const metricLabel = metricKey ? getMetricCopy(metricKey) : "";
  const metricContextLabel = getShareChangeContextLabel(metricKey, activeRows);
  const periodLabel = getPeriodLabelFromRows(activeRows, "");

  return (
    <Panel
      eyebrow="Cuota facturación/visitas"
      title="Ganancias y pérdidas de cuota"
      action={<MetricSwitch options={availableModes} value={mode} onChange={setMode} label="Métrica" />}
    >
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Movimiento compacto de cuota para detectar cambios relevantes sin listar todo el mercado.
      </p>
      {metricKey ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <ExecutiveMoverList
              title="Ganadores"
              metricLabel={metricContextLabel}
              items={movers.gainers}
              emptyMessage="Sin ganadores de cuota para esta vista."
            />
            <ExecutiveMoverList
              title="Perdedores"
              metricLabel={metricContextLabel}
              items={movers.losers}
              emptyMessage="Sin perdedores de cuota para esta vista."
            />
          </div>
          <div className="mt-3">
            <span className="scope-pill">{metricLabel}</span>
            {periodLabel && <span className="scope-pill">{periodLabel}</span>}
          </div>
        </>
      ) : (
        <EmptyState
          title="No hay datos suficientes para cuota ganada/perdida."
          message="El cambio de cuota requiere comparar el inicio y el final del periodo seleccionado."
        />
      )}
    </Panel>
  );
}

function CompetitiveMapTooltip({ active, payload = [], xMetric, yMetric, sizeMetric }) {
  if (!active || !payload.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <ChartTooltipShell title={entry.name}>
      <div className="chart-tooltip-row">
        <span>{getMetricCopy(xMetric)}</span>
        <span className="chart-tooltip-value">{formatMetric(entry.x, xMetric)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>{getMetricCopy(yMetric)}</span>
        <span className="chart-tooltip-value">{formatMetric(entry.y, yMetric)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>{getMetricCopy(sizeMetric)}</span>
        <span className="chart-tooltip-value">{formatMetric(entry.z, sizeMetric)}</span>
      </div>
    </ChartTooltipShell>
  );
}

function CompetitiveMapLabel({ x, y, payload }) {
  if (!payload?.showLabel) return null;
  const pointX = Number(x);
  const pointY = Number(y);
  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return null;

  return (
    <text
      x={pointX + 10}
      y={pointY - 8}
      fill="#111111"
      fontSize="11"
      fontWeight="700"
      pointerEvents="none"
    >
      {payload.name}
    </text>
  );
}

function CompetitiveMap({ rows = [] }) {
  const modeOptions = useMemo(
    () =>
      COMPETITIVE_MAP_OPTIONS.map((option) => {
        const candidates = rows
          .filter(isRealCompanyRow)
          .filter((row) => {
            const x = safeNumber(row?.[option.xMetric]);
            const y = safeNumber(row?.[option.yMetric]);
            const z = safeNumber(row?.[option.sizeMetric]);
            return x !== null && y !== null && z !== null;
          });
        const available = candidates.length >= 2;
        return {
          ...option,
          disabled: !available,
          reason: available ? "" : option.unavailableReason || "sin datos suficientes",
        };
      }),
    [rows],
  );
  const availableModes = modeOptions.filter((option) => !option.disabled);
  const defaultMode = availableModes[0]?.key || "";
  const [mode, setMode] = useState(defaultMode);

  useEffect(() => {
    if (!availableModes.length) {
      setMode("");
      return;
    }
    if (!mode || !availableModes.some((option) => option.key === mode)) {
      setMode(defaultMode);
    }
  }, [availableModes, defaultMode, mode]);

  const selectedMode = modeOptions.find((option) => option.key === mode && !option.disabled) ?? availableModes[0];
  const xMetric = selectedMode?.xMetric || "visits";
  const yMetric = selectedMode?.yMetric || "revenue_per_visit";
  const sizeMetric = selectedMode?.sizeMetric || "market_share_revenue";
  const scatterData = useMemo(() => {
    const baseData = rows
      .filter(isRealCompanyRow)
      .map((row) => {
        const x = safeNumber(row?.[xMetric]);
        const y = safeNumber(row?.[yMetric]);
        const z = safeNumber(row?.[sizeMetric]);
        if (x === null || y === null || z === null) return null;

        return {
          id: row.company_id,
          name: getCompanyLabel(row),
          x,
          y,
          z,
          color: row.company_color || "#6F6864",
        };
      })
      .filter(Boolean);
    const labelledIds = new Set(
      baseData
        .slice()
        .sort((a, b) => b.z - a.z)
        .slice(0, 4)
        .map((entry) => normalizeCompanyId(entry.id)),
    );
    labelledIds.add(OWN_COMPANY_ID);

    return baseData.map((entry) => ({
      ...entry,
      showLabel: labelledIds.has(normalizeCompanyId(entry.id)),
    }));
  }, [rows, sizeMetric, xMetric, yMetric]);
  const medianX = useMemo(() => getMedian(scatterData.map((entry) => entry.x)), [scatterData]);
  const medianY = useMemo(() => getMedian(scatterData.map((entry) => entry.y)), [scatterData]);
  const yTicks = useMemo(
    () => (isGrowthMetric(yMetric) ? getGrowthAxisTicks(scatterData.map((entry) => entry.y)) : undefined),
    [scatterData, yMetric],
  );
  const yDomain = yTicks?.length ? [yTicks[0], yTicks[yTicks.length - 1]] : undefined;

  return (
    <Panel
      eyebrow="Mapa competitivo"
      title="Mapa competitivo"
      action={<MetricSwitch options={modeOptions} value={mode} onChange={setMode} label="Ejes" />}
    >
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        {selectedMode?.description || "Selecciona un preset con datos suficientes para situar competidores reales."}
      </p>
      {scatterData.length >= 2 ? (
        <>
          <div className="h-[390px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ScatterChart margin={{ top: 20, right: 24, bottom: 16, left: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.08)" />
                {medianX !== null && (
                  <ReferenceLine x={medianX} stroke="rgba(0,0,0,0.22)" strokeDasharray="3 3" />
                )}
                {medianY !== null && (
                  <ReferenceLine y={medianY} stroke="rgba(0,0,0,0.22)" strokeDasharray="3 3" />
                )}
                <XAxis
                  type="number"
                  dataKey="x"
                  name={getMetricCopy(xMetric)}
                  tick={{ fill: "#6F6864", fontSize: 12 }}
                  tickFormatter={(value) => formatMetric(value, xMetric)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={getMetricCopy(yMetric)}
                  tick={{ fill: "#6F6864", fontSize: 12 }}
                  tickFormatter={(value) => formatMetric(value, yMetric)}
                  ticks={yTicks}
                  domain={yDomain}
                  tickLine={false}
                  axisLine={false}
                  width={82}
                />
                <ZAxis type="number" dataKey="z" range={[70, 560]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={
                    <CompetitiveMapTooltip
                      xMetric={xMetric}
                      yMetric={yMetric}
                      sizeMetric={sizeMetric}
                    />
                  }
                />
                <Scatter data={scatterData} isAnimationActive={false}>
                  {scatterData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                  <LabelList content={<CompetitiveMapLabel />} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="quadrant-guide">
            {(selectedMode?.quadrants || []).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="No hay datos suficientes para el mapa competitivo."
          message={selectedMode?.reason || "Este preset no está disponible para el periodo seleccionado."}
        />
      )}
    </Panel>
  );
}

function BattleCards({ rows = [], onOpenBattleArena }) {
  const focusRow = getCompanyRow(rows, OWN_COMPANY_ID);
  const cards = BATTLE_TARGET_IDS.map((targetId) => ({
    targetId,
    targetRow: getCompanyRow(rows, targetId),
    isBenchmark: sameCompany(targetId, MARKET_BENCHMARK_ID),
  }));

  return (
    <Panel
      eyebrow="Comparativas rápidas"
      title="Comparativas rápidas"
      action={
        onOpenBattleArena ? (
          <button type="button" className="section-link" onClick={onOpenBattleArena}>
            Abrir Battle Arena
          </button>
        ) : null
      }
    >
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Accesos rápidos de Focus Brand frente a Northline, Velora y el promedio del mercado.
      </p>
      {focusRow ? (
        <div className="battle-grid">
          {cards.map(({ targetId, targetRow, isBenchmark }) => (
            <article key={targetId} className="battle-card">
              <div className="battle-card-header">
                <div className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={OWN_COMPANY_ID}
                    label="Focus Brand"
                    color="#000000"
                    className="company-mark-legend"
                  />
                  <span className="font-semibold text-black">Focus Brand</span>
                </div>
                <span className="battle-versus">vs</span>
                <div className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={targetId}
                    label={targetRow ? getCompanyLabel(targetRow) : targetId}
                    color={targetRow?.company_color || (isBenchmark ? "#94A3B8" : "#6F6864")}
                    className="company-mark-legend"
                  />
                  <span className="battle-entity-name">
                    {targetRow ? getCompanyLabel(targetRow) : targetId}
                  </span>
                </div>
              </div>
              {targetRow ? (
                <div className="battle-metrics">
                  {BATTLE_METRICS.map((metric) => {
                    const focusValue = safeNumber(focusRow?.[metric.key]);
                    const targetValue = safeNumber(targetRow?.[metric.key]);
                    const hasBoth = focusValue !== null && targetValue !== null;

                    return (
                      <div key={`${targetId}-${metric.key}`} className="battle-metric-row">
                        <span className="battle-metric-name">{metric.label}</span>
                        {hasBoth ? (
                          <>
                            <span className="battle-metric-values">
                              {metric.formatter(focusValue)} / {metric.formatter(targetValue)}
                            </span>
                            <span className="battle-metric-winner">
                              Gana: {getBattleWinner(metric, focusRow, targetRow)}
                            </span>
                            <small>
                              {getBattleDeltaLabel(
                                metric,
                                focusValue,
                                targetValue,
                                "Focus Brand",
                                getCompanyLabel(targetRow),
                              )}
                            </small>
                          </>
                        ) : (
                          <span className="battle-empty">Sin dato comparable</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No hay datos para esta comparativa directa."
                  message="Selecciona un período en el que exista la entidad comparada."
                />
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No hay datos de Focus Brand para comparar."
          message="Las comparativas directas necesitan una fila real de Focus Brand en el período seleccionado."
        />
      )}
    </Panel>
  );
}

function BattleRoundCard({ round, aLabel, bLabel, index = 0 }) {
  if (!round.available) {
    return (
      <article
        className="battle-arena-round battle-arena-round-empty"
        style={{ "--battle-round-delay": `${Math.min(index, 7) * 45}ms` }}
      >
        <div className="battle-arena-round-head">
          <span>{round.label}</span>
          <strong>No disponible</strong>
        </div>
        <p>{round.message}</p>
      </article>
    );
  }

  return (
    <article
      className="battle-arena-round"
      style={{
        "--battle-a-share": `${round.share}%`,
        "--battle-a-color": round.aColor || "#E4032C",
        "--battle-b-color": round.bColor || "#111111",
        "--battle-round-delay": `${Math.min(index, 7) * 45}ms`,
      }}
    >
      <div className="battle-arena-round-head">
        <span>{round.label}</span>
        <strong>{round.winnerLabel}</strong>
      </div>
      <div className="battle-arena-round-values">
        <span><b>{aLabel}</b> {round.aValueLabel}</span>
        <span><b>{bLabel}</b> {round.bValueLabel}</span>
      </div>
      <div className="battle-arena-bar" aria-hidden="true">
        <span className="battle-arena-bar-a" />
        <span className="battle-arena-bar-b" />
        <span className="battle-arena-bar-marker" />
      </div>
      <div className="battle-arena-round-foot">
        <span>Ganador de ronda: {round.winnerLabel}</span>
        <strong>Gap: {round.gapLabel}</strong>
      </div>
      {round.detail && <p>{round.detail}</p>}
    </article>
  );
}

function BattlePlayerHero({ player, row, kpis = [], side = "a", onOpenProfile }) {
  const label = getBattleOptionLabel(player) || getCompanyLabel(row);
  const color = row?.company_color || player?.company_color || (side === "a" ? "#E4032C" : "#111111");

  return (
    <div className={`battle-arena-player battle-arena-player-${side}`}>
      <button type="button" className="battle-arena-player-name" onClick={() => onOpenProfile?.(player?.id)}>
        <CompanyMark companyId={player?.id} label={label} color={color} className="company-mark-profile" />
        <span>{label}</span>
      </button>
      <span className="battle-arena-strength-label">Resumen de {label}</span>
      <div className="battle-arena-kpis">
        {kpis.length ? (
          kpis.map((kpi) => (
            <div key={`${side}-${kpi.key}`}>
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
            </div>
          ))
        ) : (
          <div>
            <span>Datos</span>
            <strong>No disponible</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function BattleScore({ score, aLabel, bLabel }) {
  return (
    <div
      className="battle-arena-score"
      title="El resultado cuenta rondas ganadas por métrica disponible. No es un índice ponderado."
    >
      <span>Rondas ganadas</span>
      <strong>{aLabel} {score.a} · {bLabel} {score.b} · Empates {score.draw}</strong>
    </div>
  );
}

function BattleArenaView({
  realRows = [],
  comparableRows = [],
  forecastSourceRows = [],
  companies = [],
  globalScope = {},
  forecastScenarios = [],
  onOpenProfile,
}) {
  const playerOptions = useMemo(
    () => getBattlePlayerOptions(companies, realRows),
    [companies, realRows],
  );
  const [playerAId, setPlayerAId] = useState(OWN_COMPANY_ID);
  const [playerBId, setPlayerBId] = useState("peer_a");
  const [battleMode, setBattleMode] = useState("historical");
  const [battleScenario, setBattleScenario] = useState("base_case");
  const [forecastMetric, setForecastMetric] = useState("visits");
  const scenarioOptions = useMemo(
    () => getProfileForecastScenarioOptions(forecastSourceRows),
    [forecastSourceRows],
  );
  const selectedScenario = getPreferredForecastScenario(
    scenarioOptions.length ? scenarioOptions : forecastScenarios,
    battleScenario,
  );

  useEffect(() => {
    if (!playerOptions.length) return;
    const nextA = getPreferredBattlePlayer(playerOptions, playerAId || OWN_COMPANY_ID, playerBId);
    if (nextA !== playerAId) {
      setPlayerAId(nextA);
      return;
    }

    const nextB = getPreferredBattlePlayer(playerOptions, playerBId || "peer_a", nextA);
    if (nextB !== playerBId) setPlayerBId(nextB);
  }, [playerAId, playerBId, playerOptions]);

  useEffect(() => {
    if (selectedScenario && selectedScenario !== battleScenario) {
      setBattleScenario(selectedScenario);
    }
  }, [battleScenario, selectedScenario]);

  const playerA = playerOptions.find((option) => sameCompany(option.id, playerAId)) ?? null;
  const playerB = playerOptions.find((option) => sameCompany(option.id, playerBId)) ?? null;
  const aLabel = getBattleOptionLabel(playerA) || "Player A";
  const bLabel = getBattleOptionLabel(playerB) || "Player B";
  const selectedPeriodLabel = globalScope.periodLabel || globalScope.selectedPeriod?.label || "Periodo activo";
  const battleTimeMode = normalizeTimeMode(
    globalScope.timeMode ||
      globalScope.selectedTimeMode ||
      globalScope.timeSelection?.selectedTimeMode ||
      globalScope.timeSelection?.timeMode ||
      globalScope.selectedPeriod?.periodType,
  );
  const historicalRows = useMemo(
    () =>
      buildRowsForTimeSelection(comparableRows, globalScope.timeSelection, {
        market: globalScope.market,
        metricKeys: BATTLE_METRICS.map((metric) => metric.key),
        requireAll: false,
        includeBenchmark: true,
      }),
    [comparableRows, globalScope.market, globalScope.timeSelection],
  );
  const observedRows = useMemo(
    () =>
      filterInterfaceRows(
        realRows,
        { periodType: "monthly", market: globalScope.market },
        { includeForecasts: false, realOnly: true },
      ),
    [globalScope.market, realRows],
  );
  const scenarioRows = useMemo(
    () =>
      filterRowsWithMetrics(
        filterInterfaceRows(
          forecastSourceRows,
          { periodType: "monthly", market: globalScope.market },
          { includeForecasts: true, realOnly: true },
        ),
        FORECAST_DETAIL_METRICS,
        false,
      ).filter((row) => getForecastScenario(row) === selectedScenario),
    [forecastSourceRows, globalScope.market, selectedScenario],
  );
  const aHistoricalRow = getCompanyRow(historicalRows, playerAId);
  const bHistoricalRow = getCompanyRow(historicalRows, playerBId);
  const benchmarkRow = getBenchmarkRow(historicalRows);
  const historicalRounds = useMemo(
    () => buildHistoricalBattleRounds(aHistoricalRow, bHistoricalRow, aLabel, bLabel),
    [aHistoricalRow, aLabel, bHistoricalRow, bLabel],
  );
  const historicalHeroKpiDefinitions = useMemo(
    () =>
      getBattleHeroKpiDefinitions({
        timeMode: battleTimeMode,
        includeRevenue: hasMetricValue(aHistoricalRow, "revenue") || hasMetricValue(bHistoricalRow, "revenue"),
      }),
    [aHistoricalRow, bHistoricalRow, battleTimeMode],
  );
  const forecastBattle = useMemo(
    () =>
      buildForecastBattle({
        scenarioRows,
        observedRows,
        playerAId,
        playerBId,
        metricKey: forecastMetric,
        aLabel,
        bLabel,
        getForecastPeriodKey,
        getLatestCompanyMetricRow,
        getProfileRowLabel,
        getProfileRowSortValue,
      }),
    [aLabel, bLabel, forecastMetric, observedRows, playerAId, playerBId, scenarioRows],
  );
  const activeRounds = battleMode === "forecast" ? forecastBattle.rounds : historicalRounds;
  const score = getBattleScore(activeRounds);
  const insight =
    battleMode === "forecast"
      ? buildForecastBattleInsight({
          scenario: selectedScenario,
          metricKey: forecastMetric,
          projectedGap: forecastBattle.projectedGap,
          rounds: forecastBattle.rounds,
          aLabel,
          bLabel,
        })
      : buildHistoricalBattleInsight(historicalRounds, aLabel, bLabel);
  const aHeroRow = battleMode === "forecast" ? forecastBattle.primaryPair?.aRow : aHistoricalRow;
  const bHeroRow = battleMode === "forecast" ? forecastBattle.primaryPair?.bRow : bHistoricalRow;
  const aHeroKpis =
    battleMode === "forecast"
      ? [
          { key: "forecast", label: `Forecast ${forecastMetric === "revenue" ? "facturación" : "visitas"}`, value: formatBattleMetricValue(aHeroRow?.[forecastMetric], forecastMetric) },
          { key: "rank", label: "Ranking proyectado", value: formatBattleMetricValue(getProjectedRank(forecastBattle.rankingRows, playerAId), "rank_projected") },
        ]
      : getHeroKpisForPlayer(aHistoricalRow, historicalHeroKpiDefinitions);
  const bHeroKpis =
    battleMode === "forecast"
      ? [
          { key: "forecast", label: `Forecast ${forecastMetric === "revenue" ? "facturación" : "visitas"}`, value: formatBattleMetricValue(bHeroRow?.[forecastMetric], forecastMetric) },
          { key: "rank", label: "Ranking proyectado", value: formatBattleMetricValue(getProjectedRank(forecastBattle.rankingRows, playerBId), "rank_projected") },
        ]
      : getHeroKpisForPlayer(bHistoricalRow, historicalHeroKpiDefinitions);
  const samePlayerSelected = playerAId && playerBId && sameCompany(playerAId, playerBId);
  const forecastMetricOptions = useMemo(
    () =>
      BATTLE_FORECAST_METRIC_OPTIONS.map((option) => ({
        ...option,
        disabled: !scenarioRows.some(
          (row) =>
            (sameCompany(row.company_id, playerAId) || sameCompany(row.company_id, playerBId)) &&
            hasMetricValue(row, option.key),
        ),
      })),
    [playerAId, playerBId, scenarioRows],
  );

  useEffect(() => {
    const selectedMetric = forecastMetricOptions.find((option) => option.key === forecastMetric);
    if (selectedMetric && !selectedMetric.disabled) return;
    const nextMetric = forecastMetricOptions.find((option) => !option.disabled)?.key;
    if (nextMetric && nextMetric !== forecastMetric) setForecastMetric(nextMetric);
  }, [forecastMetric, forecastMetricOptions]);

  const battleAnimationKey = [
    normalizeCompanyId(playerAId),
    normalizeCompanyId(playerBId),
    battleMode,
    selectedScenario,
    forecastMetric,
    globalScope.market || "",
    selectedPeriodLabel,
    globalScope.selectedTimeMode || "",
    globalScope.selectedYear || "",
    globalScope.selectedMonth || "",
    globalScope.rangeStartMonth || "",
    globalScope.rangeEndMonth || "",
  ].join("|");
  const battleForecastSidebarContext = useMemo(() => {
    const aVisits = getLatestCompanyMetricRow(observedRows, playerAId, "visits");
    const aRevenue = getLatestCompanyMetricRow(observedRows, playerAId, "revenue");
    const visibleForecastRows = getFilteredForecastRowsAfterObserved(
      scenarioRows,
      observedRows,
      playerAId,
      forecastMetric,
    );
    const metricRows = getSortedCompanyMetricRows(visibleForecastRows, playerAId, forecastMetric);
    const firstForecastRow = metricRows[0] ?? null;
    const finalForecastRow = metricRows.at(-1) ?? null;

    return {
      activeScenario: selectedScenario,
      activeMetric: forecastMetric,
      playerLabel: aLabel,
      lastObservedVisitsLabel: aVisits ? getProfileRowLabel(aVisits) : "Sin dato observado",
      lastObservedRevenueLabel: aRevenue ? getProfileRowLabel(aRevenue) : "Sin dato observado",
      horizonLabel:
        firstForecastRow && finalForecastRow
          ? `${getProfileRowLabel(firstForecastRow)} – ${getProfileRowLabel(finalForecastRow)}`
          : forecastBattle.periodLabel
            ? formatDisplayPeriodLabel(forecastBattle.periodLabel)
            : "Sin horizonte forecast disponible",
    };
  }, [aLabel, forecastBattle.periodLabel, forecastMetric, observedRows, playerAId, scenarioRows, selectedScenario]);

  const battleTemporalControls = battleMode === "forecast" ? (
    <section className="global-temporal-panel battle-temporal-panel">
      <div className="global-temporal-copy">
        <p className="analysis-label text-accent-500">Contexto forecast</p>
        <h2>ProyecciÃ³n desde el Ãºltimo observado</h2>
        <p>
          En Forecast, la fecha no se selecciona manualmente: la proyecciÃ³n parte del Ãºltimo dato
          observado disponible.
        </p>
      </div>
      <div className="period-control-stack temporal-control-stack">
        <div className="period-summary-card">
          <span>Ãšltimo observado</span>
          <strong>{battleForecastSidebarContext.playerLabel}</strong>
          <small>Visitas Â· {battleForecastSidebarContext.lastObservedVisitsLabel}</small>
          <small>FacturaciÃ³n Â· {battleForecastSidebarContext.lastObservedRevenueLabel}</small>
        </div>
        <div className="period-summary-card">
          <span>Horizonte forecast</span>
          <strong>{battleForecastSidebarContext.horizonLabel}</strong>
        </div>
        <div className="period-summary-card">
          <span>Controles activos</span>
          <strong>Escenario: {getForecastScenarioLabel(battleForecastSidebarContext.activeScenario)}</strong>
          <small>MÃ©trica: {getProfileMetricLabel(battleForecastSidebarContext.activeMetric)}</small>
        </div>
      </div>
    </section>
  ) : (
    <section className="global-temporal-panel battle-temporal-panel">
      <div className="global-temporal-copy">
        <p className="analysis-label text-accent-500">Contexto de batalla</p>
        <h2>Dónde y cuándo comparamos</h2>
        <p>
          Este selector controla el mercado y la ventana temporal de las rondas históricas. En
          Forecast, la comparación usa el escenario elegido y mantiene la separación frente al dato
          observado.
        </p>
      </div>
      <TemporalControls
        market={globalScope.market}
        onMarketChange={globalScope.onMarketChange}
        markets={globalScope.markets}
        selectedTimeMode={globalScope.selectedTimeMode}
        onTimeModeChange={globalScope.onTimeModeChange}
        timeModeOptions={globalScope.timeModeOptions}
        selectedYear={globalScope.selectedYear}
        onSelectedYearChange={globalScope.onSelectedYearChange}
        availableYears={globalScope.availableYears}
        selectedMonth={globalScope.selectedMonth}
        onSelectedMonthChange={globalScope.onSelectedMonthChange}
        monthOptions={globalScope.monthOptions}
        rangeStartMonth={globalScope.rangeStartMonth}
        onRangeStartMonthChange={globalScope.onRangeStartMonthChange}
        rangeEndMonth={globalScope.rangeEndMonth}
        onRangeEndMonthChange={globalScope.onRangeEndMonthChange}
        rangeMonthOptions={globalScope.rangeMonthOptions}
        selectableRangeStartMonths={globalScope.selectableRangeStartMonths}
        selectableRangeEndMonths={globalScope.selectableRangeEndMonths}
        dataNote={globalScope.dataNote}
        periodLabel={globalScope.periodLabel}
        availabilityItems={globalScope.availabilityItems}
        periodStatusItems={globalScope.periodStatusItems}
        datasetCoverageItems={globalScope.datasetCoverageItems}
      />
    </section>
  );

  return (
    <div className="battle-arena-temporal-layout">
      <aside className="temporal-sidebar" aria-label="Controles temporales de Battle Arena">
        {battleTemporalControls}
      </aside>

      <div className="battle-arena-content-stack">
        <div className="battle-arena-page">
          <section className="battle-arena-control-panel">
            <div className="battle-arena-control-copy">
              <p className="analysis-label text-accent-500">Battle Arena</p>
              <h2>Comparar dos players cara a cara por escala, cuota, crecimiento y eficiencia.</h2>
            </div>
            <div className="battle-arena-controls">
              <SelectField label="Player A" value={playerAId} onChange={setPlayerAId} disabled={!playerOptions.length}>
                {playerOptions.map((option) => (
                  <option key={option.id} value={option.id} disabled={sameCompany(option.id, playerBId)}>
                    {getBattleOptionLabel(option)}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Player B" value={playerBId} onChange={setPlayerBId} disabled={playerOptions.length <= 1}>
                {playerOptions.map((option) => (
                  <option key={option.id} value={option.id} disabled={sameCompany(option.id, playerAId)}>
                    {getBattleOptionLabel(option)}
                  </option>
                ))}
              </SelectField>
              <div className="battle-arena-mode-control">
                <MetricSwitch options={BATTLE_MODE_OPTIONS} value={battleMode} onChange={setBattleMode} label="Modo" />
              </div>
              {battleMode === "forecast" && (
                <>
                  <div className="battle-arena-mode-control">
                    <MetricSwitch
                      options={(scenarioOptions.length ? scenarioOptions : forecastScenarios).map((scenario) => ({
                        key: scenario,
                        label: getForecastScenarioLabel(scenario),
                      }))}
                      value={selectedScenario}
                      onChange={setBattleScenario}
                      label="Escenario"
                    />
                  </div>
                  <div className="battle-arena-mode-control">
                    <MetricSwitch
                      options={forecastMetricOptions}
                      value={forecastMetric}
                      onChange={setForecastMetric}
                      label="Lectura destacada"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {samePlayerSelected ? (
            <EmptyState
              title="Selecciona dos players diferentes para iniciar la batalla."
              message="market_average no puede usarse como player principal; el market average queda como benchmark secundario."
            />
          ) : (
            <div key={battleAnimationKey} className="battle-arena-animation-stage">
              <section className="battle-arena-hero">
                <div className="battle-arena-hero-main">
                  <BattlePlayerHero player={playerA} row={aHeroRow} kpis={aHeroKpis} side="a" onOpenProfile={onOpenProfile} />
                  <div className="battle-arena-versus">
                    <span>{battleMode === "forecast" ? getForecastScenarioLabel(selectedScenario) : selectedPeriodLabel}</span>
                    <strong>{aLabel} vs {bLabel}</strong>
                    {battleMode === "forecast" && <ForecastCaveat />}
                  </div>
                  <BattlePlayerHero player={playerB} row={bHeroRow} kpis={bHeroKpis} side="b" onOpenProfile={onOpenProfile} />
                </div>
                <div className="battle-arena-hero-read">
                  <BattleScore score={score} aLabel={aLabel} bLabel={bLabel} />
                  <p>{insight}</p>
                  {battleMode === "forecast" && forecastBattle.projectedGap && (
                    <small>
                      Gap proyectado {forecastMetric === "revenue" ? "facturación" : "visitas"}: {forecastBattle.projectedGap.winnerLabel} +{formatBattleMetricValue(forecastBattle.projectedGap.value, forecastMetric)}
                      {forecastBattle.projectedGap.periodLabel ? ` · ${formatDisplayPeriodLabel(forecastBattle.projectedGap.periodLabel)}` : ""}
                    </small>
                  )}
                  {battleMode === "historical" && benchmarkRow && (
                    <small>
                      Market Average como benchmark secundario: visitas {formatBattleMetricValue(benchmarkRow.visits, "visits")} · facturación {formatBattleMetricValue(benchmarkRow.revenue, "revenue")}
                    </small>
                  )}
                </div>
              </section>

              <section className="battle-arena-round-list">
                {activeRounds.map((round, index) => (
                  <BattleRoundCard
                    key={round.key}
                    round={round}
                    aLabel={aLabel}
                    bLabel={bLabel}
                    index={index}
                  />
                ))}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// eslint-disable-next-line no-unused-vars
function ProfileBattleCard({
  rows = [],
  companies = [],
  selectedCompanyId = "",
  periodLabel = "",
}) {
  const battleOptions = useMemo(
    () => getProfileBattleOptions(rows, companies),
    [companies, rows],
  );
  const [baseCompanyId, setBaseCompanyId] = useState(selectedCompanyId || "");
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [metricKey, setMetricKey] = useState(BATTLE_METRICS[0]?.key || "revenue");

  useEffect(() => {
    if (!selectedCompanyId) return;
    if (!battleOptions.some((option) => sameCompany(option.id, selectedCompanyId))) return;

    setBaseCompanyId(selectedCompanyId);
  }, [battleOptions, selectedCompanyId]);

  useEffect(() => {
    if (!battleOptions.length) {
      setBaseCompanyId("");
      setTargetCompanyId("");
      return;
    }

    if (!baseCompanyId || !battleOptions.some((option) => sameCompany(option.id, baseCompanyId))) {
      setBaseCompanyId(battleOptions[0].id);
      return;
    }

    const targetIsValid =
      targetCompanyId &&
      !sameCompany(targetCompanyId, baseCompanyId) &&
      battleOptions.some((option) => sameCompany(option.id, targetCompanyId));

    if (!targetIsValid) {
      setTargetCompanyId(getDefaultProfileBattleTarget(battleOptions, baseCompanyId));
    }
  }, [baseCompanyId, battleOptions, targetCompanyId]);

  const baseRow = useMemo(() => getCompanyRow(rows, baseCompanyId), [baseCompanyId, rows]);
  const targetRow = useMemo(() => getCompanyRow(rows, targetCompanyId), [rows, targetCompanyId]);
  const metricOptions = useMemo(
    () => getBattleMetricOptions(baseRow, targetRow),
    [baseRow, targetRow],
  );
  const selectedMetric = metricOptions.find((metric) => metric.key === metricKey) ?? metricOptions[0];

  useEffect(() => {
    if (!metricOptions.length) return;

    const currentMetric = metricOptions.find((metric) => metric.key === metricKey);
    const fallbackMetric = metricOptions.find((metric) => !metric.disabled) ?? metricOptions[0];
    if (!currentMetric || currentMetric.disabled) {
      setMetricKey(fallbackMetric.key);
    }
  }, [metricKey, metricOptions]);

  const baseValue = safeNumber(baseRow?.[selectedMetric?.key]);
  const targetValue = safeNumber(targetRow?.[selectedMetric?.key]);
  const hasComparableValues = baseValue !== null && targetValue !== null;
  const baseLabel = baseRow ? getCompanyLabel(baseRow) : getBattleOptionLabel(
    battleOptions.find((option) => sameCompany(option.id, baseCompanyId)),
  );
  const targetLabel = targetRow ? getCompanyLabel(targetRow) : getBattleOptionLabel(
    battleOptions.find((option) => sameCompany(option.id, targetCompanyId)),
  );
  const baseColor = baseRow?.company_color || "#E4032C";
  const targetColor = targetRow?.company_color || "#6F6864";
  const winnerLabel = hasComparableValues
    ? getBattleWinner(selectedMetric, baseRow, targetRow, baseLabel)
    : "N/A";
  const battleShare = getBattleShare(baseValue, targetValue);
  const baseWins = hasComparableValues && baseValue > targetValue;
  const targetWins = hasComparableValues && targetValue > baseValue;
  const battleAnimationKey = [
    normalizeCompanyId(baseCompanyId),
    normalizeCompanyId(targetCompanyId),
    selectedMetric?.key || metricKey,
    baseValue ?? "na",
    targetValue ?? "na",
  ].join("|");
  const battleHitLabel = !hasComparableValues
    ? "No disponible"
    : baseWins
      ? "Ventaja"
      : targetWins
        ? "Ventaja"
        : "Empate tecnico";

  return (
    <section
      className="profile-battle-surface"
      style={{
        "--battle-base-color": baseColor,
        "--battle-target-color": targetColor,
        "--battle-base-share": `${battleShare}%`,
      }}
    >
      <div className="profile-battle-controls">
        <SelectField
          label="Player"
          value={baseCompanyId}
          onChange={setBaseCompanyId}
          disabled={!battleOptions.length}
        >
          {battleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {getBattleOptionLabel(option)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Comparar con"
          value={targetCompanyId}
          onChange={setTargetCompanyId}
          disabled={battleOptions.length <= 1}
        >
          {battleOptions
            .filter((option) => !sameCompany(option.id, baseCompanyId))
            .map((option) => (
              <option key={option.id} value={option.id}>
                {getBattleOptionLabel(option)}
              </option>
            ))}
        </SelectField>

        <SelectField
          label="Métrica"
          value={metricKey}
          onChange={setMetricKey}
          disabled={!baseRow || !targetRow || !metricOptions.length}
        >
          {metricOptions.map((metric) => (
            <option key={metric.key} value={metric.key} disabled={metric.disabled}>
              {getSelectOptionLabel(metric)}
            </option>
          ))}
        </SelectField>
      </div>

      {baseRow && targetRow ? (
        <div className="profile-battle-card">
          <div className={`profile-battle-player ${baseWins ? "profile-battle-player-winner" : ""}`}>
            <CompanyMark
              companyId={baseCompanyId}
              label={baseLabel}
              color={baseColor}
              className="company-mark-legend"
            />
            <span>{baseLabel}</span>
            <strong>{selectedMetric?.formatter?.(baseValue) || formatMetric(baseValue, metricKey)}</strong>
          </div>

          <div key={battleAnimationKey} className="profile-battle-arena" aria-hidden="true">
            <div className="profile-battle-lane">
              <span className="profile-battle-fighter profile-battle-fighter-left">
                <CompanyMark
                  companyId={baseCompanyId}
                  label={baseLabel}
                  color={baseColor}
                  className="company-mark-legend"
                />
              </span>
              <span className="profile-battle-fighter profile-battle-fighter-right">
                <CompanyMark
                  companyId={targetCompanyId}
                  label={targetLabel}
                  color={targetColor}
                  className="company-mark-legend"
                />
              </span>
              <span className="profile-battle-impact-ring" />
              <span className="profile-battle-impact-spark profile-battle-impact-spark-a" />
              <span className="profile-battle-impact-spark profile-battle-impact-spark-b" />
              <span className="profile-battle-hit-label">{battleHitLabel}</span>
            </div>
            <div className="profile-battle-vs">
              <span>VS</span>
              <strong>{selectedMetric?.label || getMetricCopy(metricKey)}</strong>
            </div>
          </div>

          <div className={`profile-battle-player ${targetWins ? "profile-battle-player-winner" : ""}`}>
            <CompanyMark
              companyId={targetCompanyId}
              label={targetLabel}
              color={targetColor}
              className="company-mark-legend"
            />
            <span>{targetLabel}</span>
            <strong>{selectedMetric?.formatter?.(targetValue) || formatMetric(targetValue, metricKey)}</strong>
          </div>

          <div className="profile-battle-bar" aria-hidden="true">
            <span className="profile-battle-bar-side profile-battle-bar-side-left" />
            <span className="profile-battle-bar-side profile-battle-bar-side-right" />
            <span
              key={`${battleAnimationKey}-left-push`}
              className="profile-battle-bar-shove profile-battle-bar-shove-left"
            />
            <span
              key={`${battleAnimationKey}-right-push`}
              className="profile-battle-bar-shove profile-battle-bar-shove-right"
            />
            <span
              className={`profile-battle-bar-clash ${
                baseWins
                  ? "profile-battle-bar-clash-left"
                  : targetWins
                    ? "profile-battle-bar-clash-right"
                    : "profile-battle-bar-clash-draw"
              }`}
            >
              <span
                key={`${battleAnimationKey}-clash-pulse`}
                className="profile-battle-bar-clash-pulse"
              />
            </span>
          </div>

          <div className="profile-battle-summary">
            {hasComparableValues ? (
              <>
                <span>Gana: {winnerLabel}</span>
                <strong>{getBattleDeltaLabel(selectedMetric, baseValue, targetValue, baseLabel, targetLabel)}</strong>
              </>
            ) : (
              <span>Sin dato comparable para esta métrica en el periodo seleccionado.</span>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No hay datos para esta batalla."
          message="Cambia el player, el rival o el periodo global para encontrar una comparativa disponible."
        />
      )}

      {periodLabel && <p className="profile-battle-period">{periodLabel}</p>}
    </section>
  );
}

function getPresentationChartMetricKey(rows = [], snapshot = {}) {
  const preferredIndexedMetric =
    snapshot?.primaryMetric === "visits"
      ? "indexed_visits"
      : snapshot?.primaryMetric === "revenue"
        ? "indexed_revenue"
        : "";

  if (preferredIndexedMetric && hasAnyMetric(rows, getIndexedSourceMetric(preferredIndexedMetric))) {
    return preferredIndexedMetric;
  }

  return (
    INDEXED_METRIC_OPTIONS.find((option) => hasAnyMetric(rows, getIndexedSourceMetric(option.key)))?.key ||
    (snapshot?.primaryMetric && hasAnyMetric(rows, snapshot.primaryMetric) ? snapshot.primaryMetric : "") ||
    "visits"
  );
}

function _getPresentationChartCopy(metricKey) {
  const growthDescription =
    "Barras por año. Cada barra compara el crecimiento frente al año anterior; los años parciales usan los mismos meses disponibles.";

  if (metricKey === "indexed_visits") {
    return {
      title: "Crecimiento anual YoY de visitas",
      description: growthDescription,
    };
  }

  if (metricKey === "indexed_revenue") {
    return {
      title: "Crecimiento anual YoY de facturación",
      description: growthDescription,
    };
  }

  return {
    title: `Evolución de ${getMetricCopy(metricKey)}`,
    description: "Serie temporal disponible para contextualizar la lectura del período seleccionado.",
  };
}

function getPresentationLegendSeries(rows = [], metricKey) {
  const sourceMetric = getIndexedSourceMetric(metricKey);
  return CORE_RACE_COMPANY_IDS.map((companyId) =>
    rows.find((row) => sameCompany(row.company_id, companyId) && safeNumber(row?.[sourceMetric]) !== null),
  )
    .filter(Boolean)
    .map((row) => ({
      company_id: row.company_id,
      label: getCompanyLabel(row),
      color: isBenchmarkRow(row) ? "#94A3B8" : row.company_color,
      isBenchmark: isBenchmarkRow(row),
    }));
}

function PresentationChartLegend({ rows = [], metricKey }) {
  const legendSeries = getPresentationLegendSeries(rows, metricKey);

  if (!legendSeries.length) return null;

  return (
    <div className="presentation-chart-legend" aria-label="Series visibles">
      {legendSeries.map((item) => (
        <span key={`presentation-legend-${item.company_id}`}>
          <i
            className={item.isBenchmark ? "is-benchmark" : ""}
            style={{ borderColor: item.color || "#6F6864" }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function PresentationChart({ rows = [], snapshot, metricKey: preferredMetricKey }) {
  const fallbackMetricKey = getPresentationChartMetricKey(rows, snapshot);
  const metricKey =
    preferredMetricKey && hasAnyMetric(rows, getIndexedSourceMetric(preferredMetricKey))
      ? preferredMetricKey
      : fallbackMetricKey;
  const sourceMetric = getIndexedSourceMetric(metricKey);
  const companyIds = CORE_RACE_COMPANY_IDS.filter((companyId) =>
    rows.some((row) => sameCompany(row.company_id, companyId) && safeNumber(row?.[sourceMetric]) !== null),
  );
  const { series } = isIndexedMetric(metricKey)
    ? buildAnnualYoYGrowthSeries(rows, { metric: metricKey, companies: companyIds })
    : { series: groupSeriesByCompetitor(rows, metricKey, companyIds).filter(
        (companySeries) => companySeries.points.length >= 2,
      ) };
  const chartData = toMultiLineChartData(series);
  const chartMetricKey = isIndexedMetric(metricKey) ? getAnnualGrowthMetricKey(metricKey) : metricKey;
  const seriesById = new Map(
    series.map((companySeries) => [normalizeCompanyId(companySeries.company_id), companySeries]),
  );

  if (series.length < 2 || chartData.length < 1) {
    return (
      <EmptyState
        title="No hay gráfico principal para modo presentación."
        message="Faltan al menos dos años comparables para calcular crecimiento."
      />
    );
  }

  if (isIndexedMetric(metricKey)) {
    return (
      <div className="presentation-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={chartData} margin={{ top: 10, right: 22, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
            <ReferenceLine y={0} stroke="rgba(0,0,0,0.28)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#6F6864", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#6F6864", fontSize: 12 }}
              tickFormatter={formatSignedPercent}
              tickLine={false}
              axisLine={false}
              width={74}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={<MultiSeriesTooltip metricKey={chartMetricKey} seriesById={seriesById} />}
            />
            {series.map((companySeries) => (
              <Bar
                key={`presentation-${companySeries.company_id}`}
                dataKey={companySeries.company_id}
                fill={isBenchmarkRow(companySeries) ? "#94A3B8" : companySeries.company_color}
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="presentation-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={chartData} margin={{ top: 10, right: 22, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
          {isIndexedMetric(metricKey) && (
            <ReferenceLine y={100} stroke="rgba(0,0,0,0.28)" strokeDasharray="3 3" />
          )}
          <XAxis
            dataKey="label"
            minTickGap={32}
            tick={{ fill: "#6F6864", fontSize: 12 }}
            tickFormatter={formatChartPeriodLabel}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#6F6864", fontSize: 12 }}
            tickFormatter={(value) =>
              isIndexedMetric(metricKey) ? formatIndexedAxisTick(value) : formatMetric(value, metricKey)
            }
            tickLine={false}
            axisLine={false}
            width={74}
          />
          <Tooltip
            cursor={{ stroke: "rgba(0,0,0,0.18)" }}
            content={<MultiSeriesTooltip metricKey={chartMetricKey} seriesById={seriesById} />}
          />
          {series.map((companySeries) => (
            <Line
              key={`presentation-${companySeries.company_id}`}
              type="monotone"
              dataKey={companySeries.company_id}
              stroke={isBenchmarkRow(companySeries) ? "#94A3B8" : companySeries.company_color}
              strokeDasharray={isBenchmarkRow(companySeries) ? "6 5" : undefined}
              strokeWidth={sameCompany(companySeries.company_id, OWN_COMPANY_ID) ? 3 : 2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function getPresentationSmartVisualCopy(snapshot = {}) {
  const metricLabel = snapshot.primaryMetric === "revenue" ? "facturación" : "visitas";
  const shareLabel = snapshot.shareMetric === "market_share_revenue" ? "cuota de facturación" : "cuota de visitas";
  const changeLabel =
    snapshot.shareChangeMode === "range"
      ? "cambio de cuota en el periodo"
      : "variación interanual de cuota";

  return {
    title: `Mapa ejecutivo de ${metricLabel}`,
    description: `Combina escala, ${shareLabel} y ${changeLabel} para explicar la presión competitiva del periodo.`,
  };
}

function getPresentationSmartRows(rows = [], snapshot = {}, maxRows = 6) {
  const rankedRows = rows
    .filter(isRealCompanyRow)
    .map((row) => {
      const value = safeNumber(row?.[snapshot.primaryMetric]);
      if (value === null) return null;

      return {
        id: row.company_id,
        row,
        name: getCompanyLabel(row),
        color: row.company_color || "#6F6864",
        value,
        share: safeNumber(row?.[snapshot.shareMetric]),
        shareChange: safeNumber(row?.[snapshot.shareChangeMetric]),
        growth: safeNumber(row?.[snapshot.growthMetric]),
        isFocusBrand: sameCompany(row.company_id, OWN_COMPANY_ID),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);

  const topRows = rankedRows.slice(0, maxRows);
  const focusEntry = rankedRows.find((entry) => entry.isFocusBrand);
  if (focusEntry && !topRows.some((entry) => entry.isFocusBrand)) {
    return [...topRows.slice(0, Math.max(0, maxRows - 1)), focusEntry];
  }

  return topRows;
}

function getPresentationDeltaCopy(value, metricKey = "visits") {
  const number = safeNumber(value);
  if (number === null) return "Sin gap";
  if (Math.abs(number) < 0.000001) return "Empate";
  const prefix = number > 0 ? "+" : "-";
  return `${prefix}${formatMetric(Math.abs(number), metricKey)}`;
}

function PresentationSmartVisual({ rows = [], snapshot = {} }) {
  const visualRows = useMemo(
    () => getPresentationSmartRows(rows, snapshot),
    [rows, snapshot],
  );
  const leader = visualRows[0] ?? null;
  const focus = visualRows.find((entry) => entry.isFocusBrand) ?? null;
  const mover =
    visualRows
      .filter((entry) => entry.shareChange !== null)
      .slice()
      .sort((a, b) => b.shareChange - a.shareChange)[0] ?? null;
  const maxValue = Math.max(...visualRows.map((entry) => entry.value), 0);

  if (!visualRows.length || !maxValue) {
    return (
      <EmptyState
        title="No hay visual principal para este periodo."
        message="Faltan datos de la métrica principal para construir la lectura capturable."
      />
    );
  }

  const focusGap =
    leader && focus
      ? focus.value - leader.value
      : null;
  const focusIsLeader = leader && focus && sameCompany(leader.id, OWN_COMPANY_ID);

  return (
    <div className="presentation-smart-visual">
      <div className="presentation-smart-summary">
        <div>
          <span>Líder del periodo</span>
          <strong>{leader?.name || "N/A"}</strong>
          <small>{leader ? formatMetric(leader.value, snapshot.primaryMetric) : "Sin dato"}</small>
        </div>
        <div>
          <span>{focusIsLeader ? "Focus Brand lidera" : "Focus Brand vs líder"}</span>
          <strong>{focusIsLeader ? "Líder del periodo" : getPresentationDeltaCopy(focusGap, snapshot.primaryMetric)}</strong>
          <small>{focus ? formatMetric(focus.share, snapshot.shareMetric) : "Sin Focus Brand"}</small>
        </div>
        <div>
          <span>Mayor avance cuota</span>
          <strong>{mover?.name || "N/A"}</strong>
          <small>{mover?.shareChange != null ? formatPercentagePoints(mover.shareChange, { compact: true }) : "Sin variación"}</small>
        </div>
      </div>

      <div className="presentation-smart-bars" aria-label="Mapa ejecutivo de posición competitiva">
        {visualRows.map((entry, index) => {
          const width = Math.max(6, (entry.value / maxValue) * 100);
          const shareChangeTone =
            entry.shareChange === null
              ? ""
              : entry.shareChange >= 0
                ? "is-positive"
                : "is-negative";

          return (
            <div
              key={`presentation-smart-${entry.id}`}
              className={`presentation-smart-row ${entry.isFocusBrand ? "is-focus" : ""}`}
              style={{ "--row-color": entry.isFocusBrand ? "#E4032C" : entry.color, "--bar-width": `${width}%` }}
            >
              <span className="presentation-smart-rank">#{index + 1}</span>
              <span className="presentation-smart-name">
                <CompanyMark
                  companyId={entry.id}
                  label={entry.name}
                  color={entry.color}
                  className="company-mark-legend"
                />
                <strong>{entry.name}</strong>
              </span>
              <span className="presentation-smart-track" aria-hidden="true">
                <i />
              </span>
              <span className="presentation-smart-value">
                <strong>{formatMetric(entry.value, snapshot.primaryMetric)}</strong>
                <small>{entry.share !== null ? formatMetric(entry.share, snapshot.shareMetric) : "Sin cuota"}</small>
              </span>
              <span className={`presentation-smart-change ${shareChangeTone}`}>
                {entry.shareChange !== null
                  ? formatPercentagePoints(entry.shareChange, { compact: true })
                  : "N/A"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PresentationMode({ snapshot, periodRows = [], chartRows = [] }) {
  const presentationVisualCopy = getPresentationSmartVisualCopy(snapshot);
  const isHistoricalPresentation = isHistoricalPeriodLabel(snapshot?.periodLabel);
  const historicalChartCopy = {
    title: `Evolución histórica de ${snapshot.primaryLabel || "la métrica principal"}`,
    description: "Serie mensual observada para ver tendencia, distancia entre players y cambios de liderazgo en el tiempo.",
  };
  const rankingRows = useMemo(
    () =>
      periodRows
        .filter(isRealCompanyRow)
        .filter((row) => safeNumber(row?.[snapshot.primaryMetric]) !== null)
        .slice()
        .sort((a, b) => safeNumber(b?.[snapshot.primaryMetric]) - safeNumber(a?.[snapshot.primaryMetric]))
        .slice(0, 5),
    [periodRows, snapshot.primaryMetric],
  );
  const kpis = [
    {
      label: snapshot.primaryMetric === "revenue" ? "Facturación mercado medido" : "Visitas mercado medido",
      value: snapshot.totalMarketValue !== null ? formatMetric(snapshot.totalMarketValue, snapshot.primaryMetric) : "N/A",
    },
    {
      label: snapshot.shareMetric === "market_share_visits"
        ? "Cuota visitas Focus Brand"
        : "Cuota facturación Focus Brand",
      value: formatMetric(snapshot.focusShare, snapshot.shareMetric),
    },
    {
      label: getFocusBrandGrowthKpiLabel(snapshot.periodLabel),
      value: snapshot.focusGrowth !== null ? formatSignedPercent(snapshot.focusGrowth) : "N/A",
    },
  ];
  return (
    <section className="presentation-mode" aria-label="Modo presentación">
      <div className="presentation-headline">
        <p className="analysis-label text-accent-500">Insight principal</p>
        <h2>{snapshot.headline}</h2>
      </div>
      <div className="presentation-kpis">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="presentation-kpi">
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </div>
        ))}
      </div>
      <div className="presentation-grid">
        <div>
          <div className="presentation-visual-heading">
            <p className="analysis-label">Visual principal</p>
            <h3>{isHistoricalPresentation ? historicalChartCopy.title : presentationVisualCopy.title}</h3>
            <span>{isHistoricalPresentation ? historicalChartCopy.description : presentationVisualCopy.description}</span>
          </div>
          {isHistoricalPresentation ? (
            <>
              <PresentationChart rows={chartRows} snapshot={snapshot} metricKey={snapshot.primaryMetric} />
              <PresentationChartLegend rows={chartRows} metricKey={snapshot.primaryMetric} />
            </>
          ) : (
            <PresentationSmartVisual rows={periodRows} snapshot={snapshot} />
          )}
        </div>
        <div className="presentation-ranking">
          <p className="analysis-label">Ranking compacto</p>
          {rankingRows.length ? (
            <div className="mt-3 space-y-2">
              {rankingRows.map((row, index) => (
                <div key={`presentation-${row.company_id}`} className="presentation-ranking-row">
                  <span>#{index + 1}</span>
                  <CompanyMark
                    companyId={row.company_id}
                    label={getCompanyLabel(row)}
                    color={row.company_color}
                    className="company-mark-legend"
                  />
                  <strong>{getCompanyLabel(row)}</strong>
                  <small>{formatMetric(row?.[snapshot.primaryMetric], snapshot.primaryMetric)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Sin ranking para este período.</p>
          )}
        </div>
      </div>
      <div className="presentation-conclusion">
        <span>Conclusión estratégica</span>
        <strong>{getStrategicConclusion(snapshot)}</strong>
      </div>
    </section>
  );
}

function HomeView({
  realRows,
  comparableRows,
  rankingSort,
  onRankingSortChange,
  globalScope,
  chartRangeMode,
  selectedChartYear,
  chartYearOptions,
  onOpenBattleArena,
  onOpenForecast: _onOpenForecast,
  onOpenProfile,
}) {
  const dashboardScope = globalScope ?? {};
  const globalContext = dashboardScope.globalContext ?? {};
  const [executiveSort, setExecutiveSort] = useState("revenue");
  const [presentationMetric, setPresentationMetric] = useState("visits");
  const periodAvailability = dashboardScope.metricAvailability ?? {};
  const executiveSortOptions = useMemo(
    () => withAvailability(EXECUTIVE_METRIC_OPTIONS, periodAvailability),
    [periodAvailability],
  );
  const localRankingSortOptions = useMemo(
    () =>
      withRankingAvailability(
        LOCAL_RANKING_SORTS,
        periodAvailability,
        globalContext.timeMode || dashboardScope.selectedTimeMode,
      ),
    [dashboardScope.selectedTimeMode, globalContext.timeMode, periodAvailability],
  );
  const effectiveRankingSort = getRankingMetricKey(
    rankingSort,
    globalContext.timeMode || dashboardScope.selectedTimeMode,
  );

  useEffect(() => {
    const selectedOption = executiveSortOptions.find((sort) => sort.key === executiveSort);
    const fallbackOption = getPreferredAvailableOption(executiveSortOptions, ["revenue", "visits"]);

    if (!fallbackOption) {
      setExecutiveSort("");
      return;
    }

    if (!executiveSort || selectedOption?.disabled) {
      setExecutiveSort(fallbackOption.key);
    }
  }, [executiveSort, executiveSortOptions]);

  useEffect(() => {
    const selectedOption = localRankingSortOptions.find((sort) => sort.key === rankingSort);
    const fallbackOption = getPreferredAvailableOption(localRankingSortOptions, [
      "revenue",
      "visits",
      "market_share_revenue",
      "market_share_visits",
      "growth_revenue",
      "growth_visits",
      "revenue_per_visit",
    ]);

    if (!fallbackOption) return;
    if (!rankingSort || selectedOption?.disabled) {
      onRankingSortChange(fallbackOption.key);
    }
  }, [localRankingSortOptions, onRankingSortChange, rankingSort]);

  const chartSelectableRows = useMemo(
    () => filterRowsWithMetrics(comparableRows, DASHBOARD_CHART_METRICS, false),
    [comparableRows],
  );
  const _chartRows = useMemo(
    () =>
      filterRowsForTimeSeries(chartSelectableRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: DASHBOARD_CHART_METRICS,
        includeBenchmark: true,
      }),
    [chartSelectableRows, dashboardScope.market, dashboardScope.timeSelection],
  );
  const executivePeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(realRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: [executiveSort],
        selectedMetric: executiveSort,
      }),
    [dashboardScope.market, dashboardScope.timeSelection, executiveSort, realRows],
  );
  const executiveComparisonPeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(comparableRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: [executiveSort],
        selectedMetric: executiveSort,
        includeBenchmark: true,
      }),
    [comparableRows, dashboardScope.market, dashboardScope.timeSelection, executiveSort],
  );
  const monetizationPeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(realRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: ["market_share_revenue", "market_share_visits"],
        requireAll: true,
        selectedMetric: "monetization_gap",
        metricRequirement: "comparable_revenue_visits",
      }),
    [dashboardScope.market, dashboardScope.timeSelection, realRows],
  );
  const shareRevenuePeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(realRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: ["market_share_revenue"],
        requireAll: true,
        selectedMetric: "market_share_revenue",
        metricRequirement: "revenue_share",
      }),
    [dashboardScope.market, dashboardScope.timeSelection, realRows],
  );
  const shareVisitsPeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(realRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: ["market_share_visits"],
        requireAll: true,
        selectedMetric: "market_share_visits",
        metricRequirement: "visits_share",
      }),
    [dashboardScope.market, dashboardScope.timeSelection, realRows],
  );
  const sharePeriodRowsByMode = useMemo(
    () => ({
      revenue: shareRevenuePeriodRows,
      visits: shareVisitsPeriodRows,
    }),
    [shareRevenuePeriodRows, shareVisitsPeriodRows],
  );
  const mapPeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(realRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: ["visits", "revenue", "market_share_revenue", "market_share_visits", "revenue_per_visit", "revenue_yoy_growth"],
        requireAll: false,
        selectedMetric: "visits",
        metricRequirement: "comparable_revenue_visits",
      }),
    [dashboardScope.market, dashboardScope.timeSelection, realRows],
  );
  const battlePeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(comparableRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: BATTLE_METRICS.map((metric) => metric.key),
        requireAll: false,
        includeBenchmark: true,
      }),
    [comparableRows, dashboardScope.market, dashboardScope.timeSelection],
  );
  const presentationPeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(realRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: ["revenue", "visits"],
        requireAll: false,
      }),
    [dashboardScope.market, dashboardScope.timeSelection, realRows],
  );
  const presentationComparisonPeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(comparableRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: ["revenue", "visits"],
        requireAll: false,
        includeBenchmark: true,
      }),
    [comparableRows, dashboardScope.market, dashboardScope.timeSelection],
  );
  const presentationMetricOptions = useMemo(
    () =>
      [
        { key: "visits", label: "Visitas" },
        { key: "revenue", label: "Facturación" },
      ].filter((option) => hasAnyMetric(presentationPeriodRows, option.key)),
    [presentationPeriodRows],
  );
  useEffect(() => {
    if (!presentationMetricOptions.length) {
      setPresentationMetric("");
      return;
    }

    if (!presentationMetricOptions.some((option) => option.key === presentationMetric)) {
      setPresentationMetric(presentationMetricOptions[0].key);
    }
  }, [presentationMetric, presentationMetricOptions]);
  const presentationChartRows = useMemo(
    () =>
      preferObservedRows(
        filterRowsWithMetrics(
          filterInterfaceRows(comparableRows, {
            periodType: "monthly",
            market: dashboardScope.market,
          }),
          DASHBOARD_CHART_METRICS,
          false,
        ),
      ),
    [comparableRows, dashboardScope.market],
  );
  const homeRankingPeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(realRows, dashboardScope.timeSelection, {
        market: dashboardScope.market,
        metricKeys: effectiveRankingSort ? [effectiveRankingSort] : [],
        selectedMetric: effectiveRankingSort,
      }),
    [dashboardScope.market, dashboardScope.timeSelection, effectiveRankingSort, realRows],
  );
  const homeRankingRows = useMemo(
    () => getRankingRows(homeRankingPeriodRows, effectiveRankingSort),
    [effectiveRankingSort, homeRankingPeriodRows],
  );
  const executiveSnapshot = useMemo(
    () =>
      buildExecutiveSnapshot(
        executivePeriodRows,
        executiveComparisonPeriodRows,
        {
          ...dashboardScope.selectedPeriod,
          label: getPeriodLabelFromRows(executivePeriodRows, dashboardScope.selectedPeriod?.label),
        },
        executiveSort,
      ),
    [
      executiveComparisonPeriodRows,
      dashboardScope.selectedPeriod,
      executivePeriodRows,
      executiveSort,
    ],
  );
  const presentationSnapshot = useMemo(
    () =>
      buildExecutiveSnapshot(
        presentationPeriodRows,
        presentationComparisonPeriodRows,
        {
          ...dashboardScope.selectedPeriod,
          label: getPeriodLabelFromRows(presentationPeriodRows, dashboardScope.selectedPeriod?.label),
        },
        presentationMetric,
      ),
    [
      presentationComparisonPeriodRows,
      presentationPeriodRows,
      dashboardScope.selectedPeriod,
      presentationMetric,
    ],
  );
  const rankingSortLabel =
    getRankingSortLabel(rankingSort, globalContext.timeMode || dashboardScope.selectedTimeMode);
  const executiveAvailability = useMemo(
    () =>
      getMetricAvailability(executivePeriodRows, realRows, {
        market: dashboardScope.market,
        metric: executiveSort,
      }),
    [dashboardScope.market, executivePeriodRows, executiveSort, realRows],
  );
  const rankingAvailability = useMemo(
    () =>
      getMetricAvailability(homeRankingPeriodRows, realRows, {
        market: dashboardScope.market,
        metric: effectiveRankingSort,
      }),
    [dashboardScope.market, effectiveRankingSort, homeRankingPeriodRows, realRows],
  );
  const executiveAvailabilityLabel = executiveAvailability?.lastAvailablePeriod?.label || "";
  const selectedChartYearOption = getSelectedPeriodOption(chartYearOptions, selectedChartYear);
  const chartRangeLabel =
    chartRangeMode === "year"
      ? selectedChartYearOption?.label || selectedChartYear || "Año"
      : "Todo el histórico disponible";
  const selectedDashboardPeriodLabel =
    dashboardScope.selectedPeriod?.label || "Período seleccionado";
  const isMomentumHistorical =
    normalizeTimeMode(globalContext.timeMode || dashboardScope.selectedTimeMode) === "historical";
  const executivePeriodLabel = getPeriodLabelFromRows(executivePeriodRows, selectedDashboardPeriodLabel);
  const indexedPeriodLabel =
    selectedDashboardPeriodLabel === "Histórico" ? "Histórico por métrica" : selectedDashboardPeriodLabel;
  const monetizationPeriodLabel = getPeriodLabelFromRows(monetizationPeriodRows, selectedDashboardPeriodLabel);
  const shareRevenuePeriodLabel = getPeriodLabelFromRows(shareRevenuePeriodRows, selectedDashboardPeriodLabel);
  const mapPeriodLabel = getPeriodLabelFromRows(mapPeriodRows, selectedDashboardPeriodLabel);
  const battlePeriodLabel = getPeriodLabelFromRows(battlePeriodRows, selectedDashboardPeriodLabel);
  const rankingPeriodLabel = getPeriodLabelFromRows(homeRankingPeriodRows, selectedDashboardPeriodLabel);
  const presentationPeriodLabel = getPeriodLabelFromRows(presentationPeriodRows, selectedDashboardPeriodLabel);
  const goToLastAvailablePeriod = (period) => {
    if (!period?.year || !period?.month) return;

    dashboardScope.onTimeModeChange?.("month");
    dashboardScope.onSelectedYearChange?.(String(period.year));
    dashboardScope.onSelectedMonthChange?.(String(period.month));
  };
  const executiveFallbackOption = getPreferredAvailableOption(
    executiveSortOptions.filter((option) => option.key !== executiveSort),
    ["visits", "revenue"],
  );
  const executiveEmptyActions = [
    executiveFallbackOption
      ? {
          label: `Ver ${executiveFallbackOption.label}`,
          onClick: () => setExecutiveSort(executiveFallbackOption.key),
        }
      : null,
    executiveAvailability?.lastAvailablePeriod
      ? {
          label: `Ir a ${executiveAvailability.lastAvailablePeriod.label}`,
          onClick: () => goToLastAvailablePeriod(executiveAvailability.lastAvailablePeriod),
        }
      : null,
  ].filter(Boolean);
  const rankingFallbackOption = getPreferredAvailableOption(
    localRankingSortOptions.filter((option) => option.key !== rankingSort),
    ["visits", "revenue", "market_share_visits", "market_share_revenue"],
  );
  const rankingEmptyActions = [
    rankingFallbackOption
      ? {
          label: `Ver ${rankingFallbackOption.label}`,
          onClick: () => onRankingSortChange(rankingFallbackOption.key),
        }
      : null,
    rankingAvailability?.lastAvailablePeriod
      ? {
          label: `Ir a ${rankingAvailability.lastAvailablePeriod.label}`,
          onClick: () => goToLastAvailablePeriod(rankingAvailability.lastAvailablePeriod),
        }
      : null,
  ].filter(Boolean);
  const executiveAction = (
    <MetricSwitch
      options={executiveSortOptions}
      value={executiveSort}
      onChange={setExecutiveSort}
      label="Métrica"
    />
  );
  const dashboardControls = (
    <section className="global-temporal-panel">
      <div className="global-temporal-copy">
        <p className="analysis-label text-accent-500">Contexto de lectura</p>
        <h2>Dónde y cuándo miramos</h2>
        <p>
          Este panel define el periodo de lectura y muestra qué métricas están disponibles.
          {dashboardScope.selectedTimeMode === "historical" && (
            <> Aquí cada módulo usa la ventana disponible de su métrica.</>
          )}
        </p>
      </div>
      <TemporalControls
        market={dashboardScope.market}
        onMarketChange={dashboardScope.onMarketChange}
        markets={dashboardScope.markets}
        selectedTimeMode={dashboardScope.selectedTimeMode}
        onTimeModeChange={dashboardScope.onTimeModeChange}
        timeModeOptions={dashboardScope.timeModeOptions}
        selectedYear={dashboardScope.selectedYear}
        onSelectedYearChange={dashboardScope.onSelectedYearChange}
        availableYears={dashboardScope.availableYears}
        selectedMonth={dashboardScope.selectedMonth}
        onSelectedMonthChange={dashboardScope.onSelectedMonthChange}
        monthOptions={dashboardScope.monthOptions}
        rangeStartMonth={dashboardScope.rangeStartMonth}
        onRangeStartMonthChange={dashboardScope.onRangeStartMonthChange}
        rangeEndMonth={dashboardScope.rangeEndMonth}
        onRangeEndMonthChange={dashboardScope.onRangeEndMonthChange}
        rangeMonthOptions={dashboardScope.rangeMonthOptions}
        selectableRangeStartMonths={dashboardScope.selectableRangeStartMonths}
        selectableRangeEndMonths={dashboardScope.selectableRangeEndMonths}
        dataNote={dashboardScope.dataNote}
        periodLabel={dashboardScope.periodLabel}
        availabilityItems={dashboardScope.availabilityItems}
        periodStatusItems={dashboardScope.periodStatusItems}
        datasetCoverageItems={dashboardScope.datasetCoverageItems}
      />
    </section>
  );
  const rankingAction = localRankingSortOptions.length ? (
    <SelectField
      label="Ranking por"
      value={rankingSort}
      onChange={onRankingSortChange}
      className="compact-select"
    >
      {localRankingSortOptions.map((sort) => (
        <option key={sort.key} value={sort.key} disabled={sort.disabled}>
          {getSelectOptionLabel(sort)}
        </option>
      ))}
    </SelectField>
  ) : null;

  return (
    <div className="home-temporal-layout">
      <aside className="temporal-sidebar" aria-label="Controles temporales globales">
        {dashboardControls}
      </aside>

      <div className="home-content-stack">
        <ContentSection
          eyebrow="Lectura ejecutiva"
          title="Lectura del mercado y KPIs clave"
          detail={executivePeriodLabel}
          action={executiveAction}
        >
          <ExecutiveMarketHome
            snapshot={executiveSnapshot}
            rows={executivePeriodRows}
            selectedMetric={executiveSort}
            lastAvailableLabel={executiveAvailabilityLabel}
            emptyActions={executiveEmptyActions}
          />
        </ContentSection>

        <ContentSection
          eyebrow="Crecimiento"
          title="Momentum de crecimiento"
          detail={isMomentumHistorical ? "No aplica en Histórico" : indexedPeriodLabel}
        >
          {isMomentumHistorical ? (
            <EmptyState
              title="Momentum no aplica en Histórico."
              message="Momentum necesita un periodo actual y un periodo anterior comparable. En Histórico no hay una fecha base única contra la que comparar, así que se evita mostrar un ranking de crecimiento."
              actions={[
                {
                  label: "Cambiar a Mes",
                  onClick: () => dashboardScope.onTimeModeChange?.("month"),
                },
              ]}
            />
          ) : (
            <GrowthMomentum
              rows={realRows}
              context={{
                ...dashboardScope.timeSelection,
                selectedPeriod: dashboardScope.selectedPeriod,
                market: dashboardScope.market,
              }}
              rangeLabel={indexedPeriodLabel || chartRangeLabel}
              onOpenProfile={onOpenProfile}
            />
          )}
        </ContentSection>

        <ContentSection
          eyebrow="Monetización"
          title="Brecha de monetización"
          detail={monetizationPeriodLabel}
        >
          <MonetizationGap rows={monetizationPeriodRows} />
        </ContentSection>

        <ContentSection
          eyebrow="Cuota facturación/visitas"
          title="Ganadores y perdedores de cuota"
          detail={shareRevenuePeriodLabel}
        >
          <ShareGainLossCompact rowsByMode={sharePeriodRowsByMode} />
        </ContentSection>

        <ContentSection
          eyebrow="Mapa"
          title="Mapa competitivo"
          detail={mapPeriodLabel}
        >
          <CompetitiveMap rows={mapPeriodRows} />
        </ContentSection>

        <ContentSection
          eyebrow="Comparativas rápidas"
          title="Focus Brand frente a rivales clave"
          detail={battlePeriodLabel}
        >
          <BattleCards rows={battlePeriodRows} onOpenBattleArena={onOpenBattleArena} />
        </ContentSection>

        <ContentSection
          eyebrow="Ranking"
          title="Ranking competitivo"
          detail={rankingPeriodLabel || rankingSortLabel}
          action={rankingAction}
        >
          <BenchmarkRankingPanel
            rows={homeRankingRows}
            sortKey={effectiveRankingSort}
            sortLabel={rankingSortLabel}
            selectedPeriod={{ ...dashboardScope.selectedPeriod, label: rankingPeriodLabel }}
            availability={rankingAvailability}
            emptyActions={rankingEmptyActions}
            onOpenProfile={onOpenProfile}
          />
        </ContentSection>

        <ContentSection
          eyebrow="Presentación"
          title="Vista capturable"
          detail={presentationPeriodLabel}
          action={
            presentationMetricOptions.length > 1 ? (
              <MetricSwitch
                options={presentationMetricOptions}
                value={presentationMetric}
                onChange={setPresentationMetric}
                label="Métrica visual"
              />
            ) : null
          }
        >
          <PresentationMode
            snapshot={presentationSnapshot}
            periodRows={presentationPeriodRows}
            chartRows={presentationChartRows}
          />
        </ContentSection>
      </div>
    </div>
  );
}

const PROFILE_KPI_DEFINITIONS = [
  { key: "revenue", label: "Facturación", unavailable: "No hay facturación disponible para este periodo." },
  { key: "visits", label: "Visitas", unavailable: "No hay visitas disponibles para este periodo." },
  { key: "market_share_revenue", label: "Cuota facturación", unavailable: "No hay cuota de facturación disponible para este periodo." },
  { key: "market_share_visits", label: "Cuota visitas", unavailable: "No hay cuota de visitas disponible para este periodo." },
  { key: "monetization_gap", label: "Brecha monetización", unavailable: "No hay datos suficientes para calcular brecha de monetización." },
  { key: "revenue_per_visit", label: "Facturación / visita", unavailable: "Dato no disponible para este periodo." },
  { key: "rank_revenue", label: "Ranking facturación", unavailable: "No hay ranking de facturación disponible para este periodo." },
  { key: "rank_visits", label: "Ranking visitas", unavailable: "No hay ranking de visitas disponible para este periodo." },
  { key: "revenue_yoy_growth", label: "Crecimiento facturación YoY", unavailable: "No hay histórico suficiente para calcular crecimiento." },
  { key: "visits_yoy_growth", label: "Crecimiento visitas YoY", unavailable: "No hay histórico suficiente para calcular crecimiento." },
];

const PROFILE_CHART_METRIC_LABELS = {
  revenue: "Facturación",
  visits: "Visitas",
  market_share_revenue: "Cuota facturación",
  market_share_visits: "Cuota visitas",
  revenue_per_visit: "Facturación / visita",
  monetization_gap: "Brecha monetización",
  rank_revenue: "Ranking facturación",
  rank_visits: "Ranking visitas",
  rank_share_revenue: "Ranking cuota facturación",
  rank_share_visits: "Ranking cuota visitas",
};

function getProfileMetricLabel(metricKey = "") {
  return PROFILE_CHART_METRIC_LABELS[metricKey] || getMetricCopy(metricKey);
}

function getProfileChartTitle(metricKey = "") {
  if (metricKey?.startsWith("rank_")) return `${getProfileMetricLabel(metricKey)} · histórico visual`;
  return `${getProfileMetricLabel(metricKey)} · histórico visual`;
}

function getProfileChartEmptyTitle(metricKey = "") {
  if (metricKey === "revenue") return "No hay facturación disponible para este periodo.";
  if (metricKey === "visits") return "No hay visitas disponibles para este periodo.";
  if (metricKey === "monetization_gap") return "No hay datos suficientes para calcular brecha de monetización.";
  if (metricKey?.startsWith("rank_")) return "No hay ranking histórico disponible para este player.";
  if (metricKey?.includes("market_share")) return "No hay benchmark disponible para esta métrica.";
  return `No hay datos suficientes para ${getProfileMetricLabel(metricKey)}.`;
}

function getProfileSourceLabel(metricKey = "") {
  if (metricKey === "revenue" || metricKey === "market_share_revenue") return "ECDB";
  if (metricKey === "visits" || metricKey === "market_share_visits") return "Mock benchmark dataset";
  if (metricKey === "revenue_per_visit" || metricKey === "monetization_gap") {
    return "Requiere facturación y visitas del mismo periodo";
  }
  return "datos disponibles";
}

function getProfilePrimarySourceLabel(row = {}) {
  const hasRevenue = safeNumber(row?.revenue) !== null || safeNumber(row?.market_share_revenue) !== null;
  const hasVisits = safeNumber(row?.visits) !== null || safeNumber(row?.market_share_visits) !== null;
  if (hasRevenue && hasVisits) return "Mock revenue source + mock traffic source";
  if (hasRevenue) return "ECDB";
  if (hasVisits) return "Mock benchmark dataset";
  return row?.source || "Dato no disponible";
}

function getProfileTypeLabel(row = {}) {
  if (sameCompany(row?.company_id, OWN_COMPANY_ID) || normalizeCompanyId(row?.type) === "own") {
    return "Own company";
  }
  return row?.type ? String(row.type).replace(/_/g, " ") : "Competitor";
}

function getProfileLastAvailabilityLabel(rows = [], companyId = "", metricKey = "", label = "") {
  const row = getLatestCompanyMetricRow(rows, companyId, metricKey);
  return `${label} hasta ${row ? getProfileRowLabel(row) : "sin dato"}`;
}

function getProfilePeriodDetail(row = {}, fallback = "") {
  const label = getProfileRowLabel(row, fallback);
  if (row?.partial_year && !String(label).toLowerCase().includes("parcial")) {
    return `${label} parcial`;
  }
  return label;
}

function PlayerHeader({
  row,
  company,
  selectedCompanyId,
  companies = [],
  onSelectedCompanyChange,
  hasSelectedCompanyOption = true,
  observedRows = [],
  periodLabel = "",
  profileMode = "historical",
  forecastScenario = "base_case",
  forecastMetric = "visits",
  onBack,
}) {
  const companyTitle = company?.label || getCompanyLabel(row) || selectedCompanyId;
  const accentColor = row?.company_color || company?.company_color || "#E4032C";
  const metaParts = [
    row?.segment,
    getProfileTypeLabel(row),
    row?.market || row?.country,
  ].filter(Boolean);
  const availabilityParts = [
    getProfileLastAvailabilityLabel(observedRows, selectedCompanyId, "visits", "Visitas"),
    getProfileLastAvailabilityLabel(observedRows, selectedCompanyId, "revenue", "Facturación"),
  ];
  const periodDetail =
    profileMode === "forecast"
      ? `Forecast · ${getForecastScenarioLabel(forecastScenario)} · ${getProfileMetricLabel(forecastMetric)}`
      : getProfilePeriodDetail(row, periodLabel);

  return (
    <section className="profile-hero" style={{ "--profile-accent": accentColor }}>
      <div className="profile-hero-main">
        <button type="button" className="section-link profile-back-link" onClick={onBack}>
          Volver al panel
        </button>

        <div className="profile-title-block">
          <CompanyMark
            companyId={selectedCompanyId}
            label={companyTitle}
            color={accentColor}
            className="company-mark-profile"
          />
          <div>
            <p className="analysis-label">Player Profile</p>
            <h2>{companyTitle}</h2>
            <p>{metaParts.join(" · ") || "Empresa real seleccionada"}</p>
            <p className="profile-availability-line">{availabilityParts.join(" · ")}</p>
          </div>
        </div>
      </div>

      <div className="profile-header-aside">
        <div className="profile-header-source">
          <span>Fuente principal</span>
          <strong>{getProfilePrimarySourceLabel(row)}</strong>
          <small>{periodDetail}</small>
        </div>
        <SelectField
          label="Cambiar ficha"
          value={selectedCompanyId}
          onChange={onSelectedCompanyChange}
          disabled={!companies.length}
          className="profile-company-select"
        >
          {!hasSelectedCompanyOption && selectedCompanyId && (
            <option value={selectedCompanyId}>{selectedCompanyId}</option>
          )}
          {companies.map((companyOption) => (
            <option key={companyOption.id} value={companyOption.id}>
              {companyOption.label}
            </option>
          ))}
        </SelectField>
      </div>
    </section>
  );
}

function ProfileExecutiveSnapshot({ row, company, periodRows = [], periodLabel = "" }) {
  if (!row) return null;

  const companyTitle = company?.label || getCompanyLabel(row);
  const focusRow = getCompanyRow(periodRows, OWN_COMPANY_ID);
  const benchmarkRow = getBenchmarkRow(periodRows);
  const primaryMetric = safeNumber(row.revenue) !== null ? "revenue" : "visits";
  const shareMetric =
    primaryMetric === "revenue" ? "market_share_revenue" : "market_share_visits";
  const rankMetric = primaryMetric === "revenue" ? "rank_revenue" : "rank_visits";
  const focusDelta =
    focusRow && !sameCompany(row.company_id, OWN_COMPANY_ID)
      ? calculateProfileMetricDelta(row, focusRow, primaryMetric)
      : null;
  const marketDelta = benchmarkRow ? calculateProfileMetricDelta(row, benchmarkRow, primaryMetric) : null;

  const snapshotItems = [
    {
      key: "primary",
      label: "Métrica principal",
      value: `${getProfileMetricLabel(primaryMetric)} · ${formatMetric(row?.[primaryMetric], primaryMetric)}`,
      detail: getProfileSourceLabel(primaryMetric),
    },
    {
      key: "share",
      label: "Cuota",
      value: formatMetric(row?.[shareMetric], shareMetric),
      detail: getProfileSourceLabel(shareMetric),
    },
    {
      key: "rank",
      label: "Ranking",
      value: formatMetric(row?.[rankMetric], rankMetric),
      detail: rankMetric === "rank_revenue" ? "Facturación" : "Visitas",
    },
    {
      key: "focus",
      label: "Vs Focus Brand",
      value: sameCompany(row.company_id, OWN_COMPANY_ID)
        ? "Misma entidad"
        : formatProfileSignedGap(focusDelta, primaryMetric),
      detail: focusRow ? getProfileRowLabel(focusRow, periodLabel) : "Sin Focus Brand comparable",
    },
    {
      key: "market",
      label: "Vs market average",
      value: formatProfileSignedGap(marketDelta, primaryMetric),
      detail: "Benchmark visual, no empresa",
    },
  ].filter((item) => item.key !== "focus" || !sameCompany(row.company_id, OWN_COMPANY_ID));

  return (
    <section className="profile-executive-snapshot">
      <div className="profile-snapshot-copy">
        <p className="analysis-label text-accent-500">Executive Snapshot</p>
        <h3>{getProfileExecutiveInsight(row, companyTitle, periodRows)}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="scope-pill">{periodLabel}</span>
          <TrustBadges badges={getDataTrustBadges([row])} />
        </div>
      </div>
      <div className="profile-snapshot-grid">
        {snapshotItems.map((item) => (
          <div key={item.key} className="profile-snapshot-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileMomentumBlock({ row, periodRows = [] }) {
  const momentumItems = ["visits", "revenue"]
    .map((metricKey) => getProfileMomentumEntry(row, periodRows, metricKey))
    .filter(Boolean);

  return (
    <section className="profile-momentum-block">
      <div>
        <p className="analysis-label text-accent-500">Momentum del player</p>
        <h3>Antes → Ahora</h3>
      </div>
      {momentumItems.length ? (
        <div className="profile-momentum-grid">
          {momentumItems.map((momentum) => (
            <article key={momentum.metricKey} className="profile-momentum-card">
              <span>{momentum.label}</span>
              <strong>
                {formatProfileMomentumValue(momentum.previousValue, momentum.metricKey)} {" → "}
                {formatProfileMomentumValue(momentum.currentValue, momentum.metricKey)}
              </strong>
              <small>
                {formatSignedMetricDelta(momentum.absoluteDelta, momentum.metricKey)} ·{" "}
                {formatSignedPercent(momentum.growthValue)}
                {momentum.isLowBase && (
                  <span
                    className="profile-low-base-mark"
                    title={LOW_BASE_TOOLTIP}
                    aria-label={LOW_BASE_TOOLTIP}
                  >
                    *
                  </span>
                )}{" "}
                {momentum.marketDelta !== null && (
                  <>· {formatPercentagePoints(momentum.marketDelta)} vs mercado</>
                )}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <p className="profile-empty-copy">
          No hay histórico comparable suficiente para calcular momentum del player.
        </p>
      )}
    </section>
  );
}

function ProfileComparisonPanel({ row, periodRows = [] }) {
  if (!row) return null;

  const focusRow = getCompanyRow(periodRows, OWN_COMPANY_ID);
  const benchmarkRow = getBenchmarkRow(periodRows);
  const comparisonMetrics = [
    { key: "revenue", label: "Facturación" },
    { key: "visits", label: "Visitas" },
    { key: "market_share_revenue", label: "Cuota facturación" },
    { key: "market_share_visits", label: "Cuota visitas" },
    { key: "revenue_per_visit", label: "Facturación / visita" },
    { key: "monetization_gap", label: "Brecha monetización" },
  ];
  const benchmarkMetrics = comparisonMetrics.filter((metric) => metric.key !== "monetization_gap");
  const targets = [
    { key: "focus", label: "Player vs Focus Brand", row: focusRow, benchmark: false },
    { key: "market", label: sameCompany(row.company_id, OWN_COMPANY_ID) ? "Focus Brand vs Market Average" : "Player vs Market Average", row: benchmarkRow, benchmark: true },
  ].filter((target) => target.key !== "focus" || !sameCompany(row.company_id, OWN_COMPANY_ID));

  return (
    <section className="profile-comparison-grid">
      {targets.map((target) => (
        <article key={target.key} className="profile-comparison-card">
          <div className="profile-comparison-card-header">
            <p className="analysis-label">{target.label}</p>
            {target.benchmark && <span className="scope-pill">Benchmark visual</span>}
          </div>
          {target.row ? (
            <div className="profile-comparison-rows">
              {(target.benchmark ? benchmarkMetrics : comparisonMetrics).map((metric) => {
                const playerValue = safeNumber(row?.[metric.key]);
                const targetValue = safeNumber(target.row?.[metric.key]);
                const hasBoth = playerValue !== null && targetValue !== null;
                const sameEntity = sameCompany(row.company_id, target.row.company_id);
                const delta = hasBoth ? playerValue - targetValue : null;

                return (
                  <div key={`${target.key}-${metric.key}`} className="profile-comparison-row">
                    <span>{metric.label}</span>
                    {sameEntity ? (
                      <strong>Misma entidad</strong>
                    ) : hasBoth ? (
                      <>
                        <strong>{formatProfileSignedGap(delta, metric.key)}</strong>
                        <small>
                          {formatMetric(playerValue, metric.key)} vs{" "}
                          {formatMetric(targetValue, metric.key)}
                        </small>
                      </>
                    ) : (
                      <strong>Sin dato comparable</strong>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="profile-empty-copy">No hay benchmark comparable para este periodo.</p>
          )}
          {target.benchmark && (
            <p className="profile-comparison-note">Benchmark calculado sobre mercado medido.</p>
          )}
        </article>
      ))}
    </section>
  );
}

function ProfileTabs({ options = [], value, onChange, label }) {
  return (
    <div className="profile-tabs" role="tablist" aria-label={label}>
      {options.map((option) => {
        const isActive = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.key)}
            className={`profile-tab ${isActive ? "profile-tab-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function getProfileForecastScenarioOptions(rows = []) {
  const scenarioSet = new Set(
    rows
      .filter(isForecastRow)
      .map(getForecastScenario)
      .filter(Boolean),
  );

  return Array.from(scenarioSet).sort((a, b) => {
    const aIndex = PROFILE_FORECAST_SCENARIO_ORDER.indexOf(a);
    const bIndex = PROFILE_FORECAST_SCENARIO_ORDER.indexOf(b);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function getPreferredForecastScenario(options = [], selectedScenario = "") {
  if (selectedScenario && options.includes(selectedScenario)) return selectedScenario;
  if (options.includes("base_case")) return "base_case";
  return options[0] || "";
}

function getForecastShareMetric(metricKey = "") {
  return metricKey === "revenue" ? "market_share_revenue" : "market_share_visits";
}

function getForecastRankMetric(metricKey = "") {
  return metricKey === "revenue" ? "rank_revenue" : "rank_visits";
}

function getForecastPeriodKey(row = {}) {
  return getGlobalContextMonthKey(row) || row.period_label || row.date || "";
}

function sameForecastPeriod(a = {}, b = {}) {
  return getForecastPeriodKey(a) === getForecastPeriodKey(b);
}

function getFilteredForecastRowsAfterObserved(
  forecastRows = [],
  observedRows = [],
  companyId = "",
  metricKey = "",
) {
  const lastObserved = getLatestCompanyMetricRow(observedRows, companyId, metricKey);
  const lastObservedSort = lastObserved ? getProfileRowSortValue(lastObserved) : -Infinity;

  return forecastRows
    .filter((row) => sameCompany(row.company_id, companyId))
    .filter((row) => hasMetricValue(row, metricKey))
    .filter((row) => getProfileRowSortValue(row) > lastObservedSort);
}

function sumForecastMetric(rows = [], metricKey = "") {
  let total = 0;
  let hasValue = false;
  rows.forEach((row) => {
    const value = safeNumber(row?.[metricKey]);
    if (value === null) return;
    total += value;
    hasValue = true;
  });
  return hasValue ? total : null;
}

function getForecastMetricOptions(rows = [], selectedCompanyId = "") {
  return PROFILE_FORECAST_METRICS.map((metric) => {
    const hasForecast = rows.some(
      (row) => sameCompany(row.company_id, selectedCompanyId) && hasMetricValue(row, metric.key),
    );

    return {
      ...metric,
      disabled: !hasForecast,
      reason: hasForecast
        ? ""
        : `Forecast de ${metric.label.toLowerCase()} no disponible para este player/horizonte.`,
    };
  });
}

function getProjectedRankingRows(rows = [], metricKey = "", finalRow = null) {
  if (!finalRow) return [];

  return rows
    .filter((row) => sameForecastPeriod(row, finalRow))
    .filter((row) => isForecastRow(row) && isComparableRow(row, { includeForecasts: true, includeBenchmark: false }))
    .filter((row) => hasMetricValue(row, metricKey))
    .slice()
    .sort((a, b) => {
      const bValue = safeNumber(b?.[metricKey]) ?? -Infinity;
      const aValue = safeNumber(a?.[metricKey]) ?? -Infinity;
      return bValue === aValue
        ? getCompanyLabel(a).localeCompare(getCompanyLabel(b))
        : bValue - aValue;
    });
}

function getProjectedRank(rows = [], selectedCompanyId = "") {
  const index = rows.findIndex((row) => sameCompany(row.company_id, selectedCompanyId));
  return index >= 0 ? index + 1 : null;
}

function getForecastProjectedShare(finalRow = null, scenarioRows = [], metricKey = "") {
  const shareMetric = getForecastShareMetric(metricKey);
  const explicitShare = safeNumber(finalRow?.[shareMetric]);
  if (explicitShare !== null) return { value: explicitShare, detail: "Cuota forecast" };

  const playerValue = safeNumber(finalRow?.[metricKey]);
  const total = sumForecastMetric(
    scenarioRows
      .filter((row) => finalRow && sameForecastPeriod(row, finalRow))
      .filter((row) => isComparableRow(row, { includeForecasts: true, includeBenchmark: false })),
    metricKey,
  );

  if (playerValue !== null && total) {
    return { value: playerValue / total, detail: "Calculada desde forecast" };
  }

  return null;
}

function getForecastBenchmarkRow(rows = [], finalRow = null) {
  if (!finalRow) return null;
  return (
    rows.find(
      (row) => sameForecastPeriod(row, finalRow) && isBenchmarkRow(row),
    ) ?? null
  );
}

function getForecastQuality(rows = []) {
  const combined = rows
    .map((row) =>
      [
        row?.forecast_quality,
        row?.confidence,
        row?.quality,
        row?.strategic_signal,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
    .toLowerCase();

  if (combined.includes("high")) return "high";
  if (combined.includes("medium")) return "medium";
  if (combined.includes("low")) return "low";
  return "";
}

function getForecastDeltaSummary(finalValue, observedValue, metricKey = "") {
  const delta =
    finalValue !== null && observedValue !== null ? finalValue - observedValue : null;
  const percent =
    delta !== null && observedValue !== null && observedValue !== 0
      ? delta / observedValue
      : null;

  return {
    delta,
    percent,
    value:
      delta !== null
        ? `${formatSignedMetricDelta(delta, metricKey)}`
        : "No hay histórico observado suficiente",
    detail: percent !== null ? `${formatSignedPercent(percent)} vs último real` : "",
  };
}

function buildForecastChartData({
  observedRows = [],
  forecastRows = [],
  selectedCompanyId = "",
  metricKey = "visits",
}) {
  const pointMap = new Map();
  const lastObservedRow = getLatestCompanyMetricRow(observedRows, selectedCompanyId, metricKey);
  const lastObservedSort = lastObservedRow ? getProfileRowSortValue(lastObservedRow) : -Infinity;

  const addPoint = (row, dataKey, type) => {
    const value = safeNumber(row?.[metricKey]);
    if (value === null) return;
    const key = getForecastPeriodKey(row);
    if (!key) return;
    const current =
      pointMap.get(key) ??
      {
        key,
        date: row.date,
        label: getProfileRowLabel(row),
        sortValue: getProfileRowSortValue(row),
        __forecastProfilePoints: {},
      };
    current[dataKey] = value;
    current.__forecastProfilePoints[dataKey] = {
      row,
      type,
      scenario: getForecastScenario(row),
    };
    pointMap.set(key, current);
  };

  observedRows
    .filter((row) => sameCompany(row.company_id, selectedCompanyId))
    .filter((row) => isObservedRow(row, { includeBenchmark: false }))
    .forEach((row) => addPoint(row, "observed", "Observado"));

  forecastRows
    .filter((row) => sameCompany(row.company_id, selectedCompanyId))
    .filter(isForecastRow)
    .filter((row) => getProfileRowSortValue(row) > lastObservedSort)
    .forEach((row) => addPoint(row, "forecast", "Forecast"));

  return Array.from(pointMap.values()).sort((a, b) => a.sortValue - b.sortValue);
}

function ForecastProfileTooltip({ active, payload = [], label, metricKey }) {
  if (!active || !payload.length) return null;

  const rows = payload
    .map((item) => {
      const value = safeNumber(item.value);
      if (value === null) return null;
      const point = item.payload?.__forecastProfilePoints?.[item.dataKey] ?? {};
      const row = point.row ?? {};
      return {
        key: item.dataKey,
        value,
        type: point.type || "Dato",
        scenario: point.scenario,
        source: row.source || row.data_type || "",
      };
    })
    .filter(Boolean);

  if (!rows.length) return null;

  return (
    <ChartTooltipShell title={`Periodo: ${formatChartPeriodLabel(label)}`}>
      {rows.map((row) => (
        <div key={`${row.key}-${row.value}`} className="chart-tooltip-row">
          <span className="chart-tooltip-company">
            <span>{row.type}</span>
          </span>
          <span className="chart-tooltip-value">
            {formatMetric(row.value, metricKey)}
            {row.key === "forecast" && row.scenario && (
              <small>Escenario: {getForecastScenarioLabel(row.scenario)}</small>
            )}
            {row.source && <small>Fuente: {row.source}</small>}
          </span>
        </div>
      ))}
    </ChartTooltipShell>
  );
}

function ProfileForecastChart({
  chartData = [],
  metricKey = "visits",
  lastObservedRow = null,
}) {
  const hasData = chartData.some(
    (point) => safeNumber(point.observed) !== null || safeNumber(point.forecast) !== null,
  );
  const lastObservedLabel = lastObservedRow ? getProfileRowLabel(lastObservedRow) : "";

  return (
    <Panel eyebrow="Observado -> Forecast" title="Histórico observado y proyección">
      <div className="h-[360px] min-w-0 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData} margin={{ top: 12, right: 42, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
              {lastObservedLabel && (
                <ReferenceLine
                  x={lastObservedLabel}
                  stroke="#000000"
                  strokeDasharray="3 4"
                  label={{
                    value: "Último dato observado",
                    position: "insideTopRight",
                    fill: "#000000",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              )}
              <XAxis
                dataKey="label"
                minTickGap={28}
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={formatChartPeriodLabel}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={(value) => formatMetric(value, metricKey)}
                tickLine={false}
                axisLine={false}
                width={82}
              />
              <Tooltip
                cursor={{ stroke: "rgba(0,0,0,0.18)" }}
                content={<ForecastProfileTooltip metricKey={metricKey} />}
              />
              <Line
                type="monotone"
                dataKey="observed"
                name="Histórico"
                stroke="#000000"
                strokeWidth={2.8}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Forecast"
                stroke="#E4032C"
                strokeDasharray="7 5"
                strokeWidth={2.8}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No hay datos suficientes para dibujar forecast."
            message="Selecciona otra métrica o escenario con histórico y forecast disponibles."
          />
        )}
      </div>
      <div className="profile-forecast-chart-legend">
        <span><i className="profile-forecast-solid-line" />Histórico</span>
        <span><i className="profile-forecast-dashed-line" />Forecast</span>
        <ForecastCaveat />
      </div>
    </Panel>
  );
}

function getForecastStrategicRead({
  companyTitle,
  selectedCompanyId,
  scenario,
  metricKey,
  finalRow,
  projectedRank,
  rankingRows,
}) {
  if (!finalRow) {
    return "Este escenario no tiene forecast suficiente para construir una lectura ejecutiva.";
  }

  const scenarioLabel = getForecastScenarioLabel(scenario).toLowerCase();
  const metricLabel = metricKey === "revenue" ? "facturación" : "visitas";
  const topRow = rankingRows[0] ?? null;
  const focusRank = getProjectedRank(rankingRows, OWN_COMPANY_ID);

  if (sameCompany(selectedCompanyId, OWN_COMPANY_ID)) {
    if (topRow && !sameCompany(topRow.company_id, OWN_COMPANY_ID)) {
      return `En escenario ${scenarioLabel}, Focus Brand mantiene una posición fuerte en ${metricLabel}, aunque ${getCompanyLabel(topRow)} conserva ventaja proyectada al cierre.`;
    }
    return `En escenario ${scenarioLabel}, Focus Brand cerraría en posición líder de ${metricLabel} dentro del forecast disponible.`;
  }

  if (projectedRank === 1 && focusRank && focusRank > 1) {
    return `En escenario ${scenarioLabel}, ${companyTitle} ampliaría liderazgo de ${metricLabel} frente a Focus Brand.`;
  }

  if (normalizeCompanyId(selectedCompanyId) === "peer_b" && metricKey === "visits") {
    return "Velora mantiene menor escala de tráfico; revisar forecast de facturación antes de inferir eficiencia comercial.";
  }

  if (projectedRank !== null) {
    return `En escenario ${scenarioLabel}, ${companyTitle} cerraría en posición #${projectedRank} de ${metricLabel} dentro del forecast disponible.`;
  }

  return `En escenario ${scenarioLabel}, ${companyTitle} tiene forecast incompleto para comparar posición proyectada.`;
}

function ProfileForecastKpiGrid({ items = [] }) {
  return (
    <section className="profile-forecast-kpi-grid">
      {items.map((item) => (
        <article
          key={item.key}
          className={`profile-forecast-kpi ${item.empty ? "profile-forecast-kpi-empty" : ""}`}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail && <small>{item.detail}</small>}
          {item.badge && <em>{item.badge}</em>}
        </article>
      ))}
    </section>
  );
}

function ProfileScenarioComparison({ summaries = [], metricKey = "visits" }) {
  if (summaries.length < 2) return null;

  return (
    <section className="profile-forecast-subsection">
      <div>
        <p className="analysis-label text-accent-500">Escenarios al cierre</p>
        <h3>Conservador / Base / Agresivo</h3>
      </div>
      <div className="profile-forecast-scenario-table">
        <div className="profile-forecast-scenario-head">
          <span>Escenario</span>
          <span>Cierre forecast</span>
          <span>Delta vs último real</span>
          <span>Ranking proyectado</span>
        </div>
        {summaries.map((summary) => (
          <div key={summary.scenario} className="profile-forecast-scenario-row">
            <span>{getForecastScenarioLabel(summary.scenario)}</span>
            <strong>{formatMetric(summary.finalValue, metricKey)}</strong>
            <span>{summary.deltaLabel}</span>
            <span>{formatMetric(summary.projectedRank, getForecastRankMetric(metricKey))}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileProjectedRanking({
  rankingRows = [],
  selectedCompanyId = "",
  metricKey = "visits",
  scenario = "",
  onOpenProfile,
}) {
  const projectedRank = getProjectedRank(rankingRows, selectedCompanyId);
  const selectedRow = rankingRows[projectedRank - 1] ?? null;
  const topRows = rankingRows.slice(0, 5);
  const metricLabel = metricKey === "revenue" ? "facturación" : "visitas";
  const scenarioLabel = getForecastScenarioLabel(scenario).toLowerCase();

  return (
    <section className="profile-forecast-subsection">
      <div>
        <p className="analysis-label text-accent-500">Ranking proyectado al cierre</p>
        <h3>
          {projectedRank
            ? `En escenario ${scenarioLabel}, ${getCompanyLabel(selectedRow)} cerraría #${projectedRank} en ${metricLabel}.`
            : "No hay suficientes empresas con forecast para calcular ranking proyectado."}
        </h3>
      </div>
      {topRows.length ? (
        <div className="profile-forecast-ranking-list">
          {topRows.map((row, index) => (
            <button
              key={`${row.company_id}-${index}`}
              type="button"
              className={`profile-forecast-ranking-row ${
                sameCompany(row.company_id, selectedCompanyId)
                  ? "profile-forecast-ranking-row-active"
                  : ""
              }`}
              onClick={() => onOpenProfile?.(row.company_id)}
            >
              <span>#{index + 1}</span>
              <CompanyMark
                companyId={row.company_id}
                label={getCompanyLabel(row)}
                color={row.company_color}
                className="company-mark-row"
              />
              <strong>{getCompanyLabel(row)}</strong>
              <small>{formatMetric(row?.[metricKey], metricKey)}</small>
            </button>
          ))}
          {projectedRank && projectedRank > 5 && selectedRow && (
            <p className="profile-empty-copy">
              {getCompanyLabel(selectedRow)} aparece en posición #{projectedRank}.
            </p>
          )}
        </div>
      ) : (
        <EmptyState
          title="No hay suficientes empresas con forecast para calcular ranking proyectado."
          message="El ranking proyectado exige empresas reales con forecast en el mismo escenario y periodo."
        />
      )}
    </section>
  );
}

function ProfileForecastPanel({
  allForecastRows = [],
  observedRows = [],
  selectedCompanyId = "",
  selectedCompany,
  selectedPeriodRow,
  forecastScenario = "base_case",
  onForecastScenarioChange,
  forecastMetric = "visits",
  onForecastMetricChange,
  onOpenProfile,
}) {
  const companyTitle = selectedCompany?.label || selectedCompanyId || "Player";
  const accentColor =
    selectedPeriodRow?.company_color || selectedCompany?.company_color || "#E4032C";
  const handleForecastScenarioChange = onForecastScenarioChange || (() => {});
  const handleForecastMetricChange = onForecastMetricChange || (() => {});
  const forecastRows = useMemo(
    () => mergeForecastMetricRows(allForecastRows.filter(isForecastRow)),
    [allForecastRows],
  );
  const market = selectedPeriodRow?.market || selectedPeriodRow?.country || "";
  const scopedForecastRows = useMemo(
    () => forecastRows.filter((row) => !market || row.market === market),
    [forecastRows, market],
  );
  const playerForecastRows = useMemo(
    () => scopedForecastRows.filter((row) => sameCompany(row.company_id, selectedCompanyId)),
    [scopedForecastRows, selectedCompanyId],
  );
  const scenarioOptions = useMemo(
    () => getProfileForecastScenarioOptions(playerForecastRows),
    [playerForecastRows],
  );
  const selectedScenario = getPreferredForecastScenario(scenarioOptions, forecastScenario);

  useEffect(() => {
    const nextScenario = getPreferredForecastScenario(scenarioOptions, forecastScenario);
    if (nextScenario && nextScenario !== forecastScenario) {
      handleForecastScenarioChange(nextScenario);
    }
  }, [forecastScenario, handleForecastScenarioChange, scenarioOptions]);

  const scenarioRows = useMemo(
    () =>
      scopedForecastRows.filter((row) => getForecastScenario(row) === selectedScenario),
    [scopedForecastRows, selectedScenario],
  );
  const playerScenarioRows = useMemo(
    () => scenarioRows.filter((row) => sameCompany(row.company_id, selectedCompanyId)),
    [scenarioRows, selectedCompanyId],
  );
  const metricOptions = useMemo(
    () => getForecastMetricOptions(playerScenarioRows, selectedCompanyId),
    [playerScenarioRows, selectedCompanyId],
  );

  useEffect(() => {
    const currentOption = metricOptions.find((option) => option.key === forecastMetric);
    if (currentOption && !currentOption.disabled) return;
    const nextMetric =
      metricOptions.find((option) => !option.disabled)?.key || PROFILE_FORECAST_METRICS[0].key;
    if (nextMetric !== forecastMetric) handleForecastMetricChange(nextMetric);
  }, [forecastMetric, handleForecastMetricChange, metricOptions]);

  if (!playerForecastRows.length) {
    return (
      <EmptyState
        title="No hay forecast disponible para este player."
        message="La ficha histórica sigue disponible; forecast solo aparece cuando hay proyección separada."
      />
    );
  }

  if (!selectedScenario || !playerScenarioRows.length) {
    return (
      <EmptyState
        title="Este escenario no está disponible para el player seleccionado."
        message="Selecciona otro escenario forecast disponible."
      />
    );
  }

  const lastObservedRow = getLatestCompanyMetricRow(observedRows, selectedCompanyId, forecastMetric);
  const visiblePlayerForecastRows = getFilteredForecastRowsAfterObserved(
    playerScenarioRows,
    observedRows,
    selectedCompanyId,
    forecastMetric,
  );
  const metricRows = getSortedCompanyMetricRows(
    visiblePlayerForecastRows,
    selectedCompanyId,
    forecastMetric,
  );
  const firstForecastRow = metricRows[0] ?? null;
  const finalForecastRow = metricRows.at(-1) ?? null;
  const finalValue = safeNumber(finalForecastRow?.[forecastMetric]);
  const observedValue = safeNumber(lastObservedRow?.[forecastMetric]);
  const deltaSummary = getForecastDeltaSummary(finalValue, observedValue, forecastMetric);
  const projectedRanking = getProjectedRankingRows(scenarioRows, forecastMetric, finalForecastRow);
  const projectedRank = getProjectedRank(projectedRanking, selectedCompanyId);
  const projectedShare = getForecastProjectedShare(finalForecastRow, scenarioRows, forecastMetric);
  const focusFinalRow = finalForecastRow
    ? scenarioRows.find(
        (row) => sameCompany(row.company_id, OWN_COMPANY_ID) && sameForecastPeriod(row, finalForecastRow),
      )
    : null;
  const benchmarkFinalRow = getForecastBenchmarkRow(scenarioRows, finalForecastRow);
  const focusGap =
    !sameCompany(selectedCompanyId, OWN_COMPANY_ID) && focusFinalRow
      ? calculateProfileMetricDelta(finalForecastRow, focusFinalRow, forecastMetric)
      : null;
  const benchmarkGap = benchmarkFinalRow
    ? calculateProfileMetricDelta(finalForecastRow, benchmarkFinalRow, forecastMetric)
    : null;
  const horizonLabel =
    firstForecastRow && finalForecastRow
      ? `${getProfileRowLabel(firstForecastRow)} - ${getProfileRowLabel(finalForecastRow)}`
      : "Sin horizonte disponible";
  const quality = getForecastQuality(playerScenarioRows);
  const strategicRead = getForecastStrategicRead({
    companyTitle,
    selectedCompanyId,
    scenario: selectedScenario,
    metricKey: forecastMetric,
    finalRow: finalForecastRow,
    projectedRank,
    rankingRows: projectedRanking,
  });
  const chartData = buildForecastChartData({
    observedRows,
    forecastRows: playerScenarioRows,
    selectedCompanyId,
    metricKey: forecastMetric,
  });
  const scenarioSummaries = scenarioOptions
    .map((scenario) => {
      const rowsForScenario = scopedForecastRows.filter(
        (row) => getForecastScenario(row) === scenario,
      );
      const visibleRowsForScenario = getFilteredForecastRowsAfterObserved(
        rowsForScenario,
        observedRows,
        selectedCompanyId,
        forecastMetric,
      );
      const finalRow = getSortedCompanyMetricRows(
        visibleRowsForScenario,
        selectedCompanyId,
        forecastMetric,
      ).at(-1);
      if (!finalRow) return null;
      const finalScenarioValue = safeNumber(finalRow?.[forecastMetric]);
      const ranking = getProjectedRankingRows(rowsForScenario, forecastMetric, finalRow);
      const delta = getForecastDeltaSummary(finalScenarioValue, observedValue, forecastMetric);
      return {
        scenario,
        finalValue: finalScenarioValue,
        deltaLabel: delta.delta !== null ? delta.value : "Sin histórico comparable",
        projectedRank: getProjectedRank(ranking, selectedCompanyId),
      };
    })
    .filter(Boolean);
  const kpis = [
    {
      key: "last-observed",
      label: "Último dato observado",
      value: lastObservedRow ? formatMetric(observedValue, forecastMetric) : "Sin dato observado",
      detail: lastObservedRow
        ? getProfileRowLabel(lastObservedRow)
        : "No hay histórico observado suficiente para calcular variación vs último dato real.",
      empty: !lastObservedRow,
      badge: "Observado",
    },
    {
      key: "forecast-final",
      label: "Cierre forecast",
      value: finalForecastRow ? formatMetric(finalValue, forecastMetric) : "Sin forecast",
      detail: finalForecastRow
        ? getProfileRowLabel(finalForecastRow)
        : `No hay forecast de ${getProfileMetricLabel(forecastMetric).toLowerCase()} para este escenario.`,
      empty: !finalForecastRow,
      badge: "Forecast",
    },
    {
      key: "forecast-delta",
      label: "Variación vs último observado",
      value: deltaSummary.delta !== null ? deltaSummary.value : "Sin calculo",
      detail: deltaSummary.detail || "No hay histórico observado suficiente para calcular variación vs último dato real.",
      empty: deltaSummary.delta === null,
      badge: "Forecast",
    },
    {
      key: "forecast-share",
      label: "Cuota proyectada",
      value: projectedShare ? formatMetric(projectedShare.value, getForecastShareMetric(forecastMetric)) : "Sin cuota forecast",
      detail: projectedShare?.detail || "No hay benchmark disponible para esta métrica.",
      empty: !projectedShare,
      badge: "Forecast",
    },
    {
      key: "forecast-rank",
      label: "Ranking proyectado",
      value: projectedRank ? formatMetric(projectedRank, getForecastRankMetric(forecastMetric)) : "Sin ranking",
      detail: projectedRank
        ? `${projectedRanking.length} empresas reales con forecast`
        : "No hay suficientes empresas con forecast para calcular ranking proyectado.",
      empty: !projectedRank,
      badge: "Forecast",
    },
    !sameCompany(selectedCompanyId, OWN_COMPANY_ID) && {
      key: "gap-focus",
      label: "Gap vs Focus Brand",
      value: focusGap !== null
        ? formatProfileSignedGap(focusGap, forecastMetric)
        : "Sin Focus Brand comparable",
      detail: focusFinalRow ? getProfileRowLabel(focusFinalRow) : "Forecast Focus Brand no disponible",
      empty: focusGap === null,
      badge: "Forecast",
    },
    benchmarkGap !== null && {
      key: "gap-market",
      label: "Gap vs Market Average",
      value: formatProfileSignedGap(benchmarkGap, forecastMetric),
      detail: "Benchmark calculado sobre mercado medido",
      empty: false,
      badge: "Forecast",
    },
  ].filter(Boolean);

  return (
    <section className="profile-forecast-module" style={{ "--profile-accent": accentColor }}>
      <div className="profile-forecast-hero">
        <div className="profile-forecast-hero-copy">
          <p className="analysis-label text-accent-500">Proyección</p>
          <h3>Proyección de {companyTitle}</h3>
          <p>
            Forecast calculado a partir del histórico disponible. Proyección, no dato observado.
          </p>
          <div className="profile-forecast-context-row">
            <span className="forecast-chip">
              Escenario {getForecastScenarioLabel(selectedScenario).toLowerCase()} · {horizonLabel}
            </span>
            {quality && <span className="forecast-chip">Calidad forecast: {quality}</span>}
            <span className="forecast-caveat">Forecast = proyección. No debe leerse como dato observado.</span>
          </div>
        </div>
        <div className="profile-forecast-controls">
          <MetricSwitch
            options={scenarioOptions.map((scenario) => ({
              key: scenario,
              label: getForecastScenarioLabel(scenario),
            }))}
            value={selectedScenario}
            onChange={handleForecastScenarioChange}
            label="Escenario forecast"
          />
          <MetricSwitch
            options={metricOptions}
            value={forecastMetric}
            onChange={handleForecastMetricChange}
            label="Métrica"
          />
        </div>
      </div>

      <div className="profile-forecast-read">
        <strong>{strategicRead}</strong>
      </div>

      <ProfileForecastKpiGrid items={kpis} />

      <ProfileForecastChart
        chartData={chartData}
        metricKey={forecastMetric}
        lastObservedRow={lastObservedRow}
      />

      <ProfileScenarioComparison summaries={scenarioSummaries} metricKey={forecastMetric} />

      <ProfileProjectedRanking
        rankingRows={projectedRanking}
        selectedCompanyId={selectedCompanyId}
        metricKey={forecastMetric}
        scenario={selectedScenario}
        onOpenProfile={onOpenProfile}
      />
    </section>
  );
}

function formatProfileKpiValue(value, metricKey = "") {
  if (metricKey === "revenue_yoy_growth" || metricKey === "visits_yoy_growth") {
    return formatSignedPercent(value);
  }
  if (metricKey === "revenue") return formatBattleCurrency(value);
  if (metricKey === "monetization_gap") return formatPercentagePoints(value, { compact: true });
  return formatMetric(value, metricKey);
}

function getProfileKpiComparison(row = {}, periodRows = [], metricKey = "") {
  const focusRow = getCompanyRow(periodRows, OWN_COMPANY_ID);
  const benchmarkRow = getBenchmarkRow(periodRows);

  if (metricKey === "revenue_yoy_growth" || metricKey === "visits_yoy_growth") {
    const growthBreakdown = getGrowthBreakdown(row, metricKey);
    const previousValue =
      growthBreakdown?.previousValue !== undefined
        ? formatProfileKpiValue(growthBreakdown.previousValue, growthBreakdown.baseMetricKey)
        : "";
    if (focusRow && !sameCompany(row.company_id, OWN_COMPANY_ID)) {
      const delta = calculateProfileMetricDelta(row, focusRow, metricKey);
      if (delta !== null) {
        return {
          detail: `${formatPercentagePoints(delta, { compact: true })} vs Focus Brand`,
          reference: previousValue ? `Anterior: ${previousValue}` : "",
        };
      }
    }
    return {
      detail: "vs año anterior",
      reference: previousValue ? `Anterior: ${previousValue}` : "",
    };
  }

  const targetRow =
    focusRow && !sameCompany(row.company_id, OWN_COMPANY_ID) ? focusRow : benchmarkRow;
  if (!targetRow) return { detail: getProfileSourceLabel(metricKey), reference: "" };

  const delta = calculateProfileMetricDelta(row, targetRow, metricKey);
  if (delta === null) return { detail: getProfileSourceLabel(metricKey), reference: "" };

  const targetLabel = sameCompany(targetRow.company_id, OWN_COMPANY_ID)
    ? "Focus Brand"
    : "market average";
  const referenceLabel = sameCompany(targetRow.company_id, OWN_COMPANY_ID) ? "Focus Brand" : "Promedio";
  const referenceValue = safeNumber(targetRow?.[metricKey]);
  return {
    detail: `${formatProfileSignedGap(delta, metricKey)} vs ${targetLabel}`,
    reference:
      referenceValue !== null
        ? `${referenceLabel}: ${formatProfileKpiValue(referenceValue, metricKey)}`
        : "",
  };
}

function ProfileKpis({ row, company, periodRows = [], periodLabel: _periodLabel = "" }) {
  const accentColor = row?.company_color || company?.company_color || "#E4032C";
  const kpis = PROFILE_KPI_DEFINITIONS.map((definition) => {
    const value = safeNumber(row?.[definition.key]);
    const available = value !== null;
    const comparison = available
      ? getProfileKpiComparison(row, periodRows, definition.key)
      : { detail: definition.unavailable, reference: "" };
    return {
      ...definition,
      available,
      value: available ? formatProfileKpiValue(value, definition.key) : definition.unavailable,
      detail: comparison.detail,
      reference: comparison.reference,
    };
  });
  const rankChangeEntries = [
    safeNumber(row?.rank_change_revenue) !== null
      ? { label: "Facturación", shortLabel: "Fact.", value: safeNumber(row.rank_change_revenue) }
      : null,
    safeNumber(row?.rank_change_visits) !== null
      ? { label: "Visitas", shortLabel: "Visitas", value: safeNumber(row.rank_change_visits) }
      : null,
  ].filter(Boolean);

  if (rankChangeEntries.length) {
    const allStable = rankChangeEntries.every((entry) => entry.value === 0);
    kpis.push({
      key: "rank_change",
      label: "Rank change",
      value: allStable
        ? "Sin cambio"
        : rankChangeEntries
            .map((entry) => `${entry.shortLabel} ${formatProfileRankChange(entry.value)}`)
            .join(" · "),
      detail: allStable
        ? `${rankChangeEntries.map((entry) => entry.label).join(" y ")}`
        : "Cambio de posición",
    });
  }

  return (
    <section className="profile-kpi-strip">
      {kpis.map((kpi) => (
        <article
          key={kpi.key}
          className={`profile-kpi-item ${kpi.available === false ? "profile-kpi-item-empty" : ""}`}
          style={{ "--profile-accent": accentColor }}
        >
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          {kpi.detail && <small>{kpi.detail}</small>}
          {kpi.reference && <small className="profile-kpi-reference">{kpi.reference}</small>}
        </article>
      ))}
    </section>
  );
}

function buildProfileForecastSidebarContext({
  allForecastRows = [],
  observedRows = [],
  selectedCompanyId = "",
  selectedPeriodRow = null,
  forecastScenario = "base_case",
  forecastMetric = "visits",
} = {}) {
  const forecastRows = mergeForecastMetricRows(allForecastRows.filter(isForecastRow));
  const market = selectedPeriodRow?.market || selectedPeriodRow?.country || "";
  const scopedForecastRows = forecastRows.filter((row) => !market || row.market === market);
  const playerForecastRows = scopedForecastRows.filter((row) =>
    sameCompany(row.company_id, selectedCompanyId),
  );
  const scenarioOptions = getProfileForecastScenarioOptions(playerForecastRows);
  const activeScenario = getPreferredForecastScenario(scenarioOptions, forecastScenario);
  const scenarioRows = scopedForecastRows.filter((row) => getForecastScenario(row) === activeScenario);
  const playerScenarioRows = scenarioRows.filter((row) => sameCompany(row.company_id, selectedCompanyId));
  const metricOptions = getForecastMetricOptions(playerScenarioRows, selectedCompanyId);
  const activeMetric =
    metricOptions.find((option) => option.key === forecastMetric && !option.disabled)?.key ||
    metricOptions.find((option) => !option.disabled)?.key ||
    forecastMetric ||
    "visits";
  const lastObservedVisits = getLatestCompanyMetricRow(observedRows, selectedCompanyId, "visits");
  const lastObservedRevenue = getLatestCompanyMetricRow(observedRows, selectedCompanyId, "revenue");
  const visibleForecastRows = getFilteredForecastRowsAfterObserved(
    playerScenarioRows,
    observedRows,
    selectedCompanyId,
    activeMetric,
  );
  const metricRows = getSortedCompanyMetricRows(
    visibleForecastRows,
    selectedCompanyId,
    activeMetric,
  );
  const firstForecastRow = metricRows[0] ?? null;
  const finalForecastRow = metricRows.at(-1) ?? null;

  return {
    activeScenario,
    activeMetric,
    scenarioOptions,
    metricOptions,
    lastObservedVisitsLabel: lastObservedVisits ? getProfileRowLabel(lastObservedVisits) : "Sin dato observado",
    lastObservedRevenueLabel: lastObservedRevenue ? getProfileRowLabel(lastObservedRevenue) : "Sin dato observado",
    horizonLabel:
      firstForecastRow && finalForecastRow
        ? `${getProfileRowLabel(firstForecastRow)} – ${getProfileRowLabel(finalForecastRow)}`
        : "Sin horizonte forecast disponible",
  };
}

function ProfileForecastSidebar({ context = {} }) {
  return (
    <section className="global-temporal-panel profile-temporal-panel">
      <div className="global-temporal-copy">
        <p className="analysis-label text-accent-500">Contexto forecast</p>
        <h2>Proyección desde el último observado</h2>
        <p>
          En Forecast, la fecha no se selecciona manualmente: la proyección parte del último dato
          observado disponible.
        </p>
      </div>
      <div className="period-control-stack temporal-control-stack">
        <div className="period-summary-card">
          <span>Último observado</span>
          <strong>Visitas · {context.lastObservedVisitsLabel || "Sin dato observado"}</strong>
          <small>Facturación · {context.lastObservedRevenueLabel || "Sin dato observado"}</small>
        </div>
        <div className="period-summary-card">
          <span>Horizonte forecast</span>
          <strong>{context.horizonLabel || "Sin horizonte forecast disponible"}</strong>
        </div>
        <div className="period-summary-card">
          <span>Controles activos</span>
          <strong>Escenario: {getForecastScenarioLabel(context.activeScenario)}</strong>
          <small>Métrica: {getProfileMetricLabel(context.activeMetric)}</small>
        </div>
      </div>
    </section>
  );
}

function ProfileView({
  rows,
  observedRows = [],
  profilePeriodRows = [],
  allForecastRows = [],
  companies,
  rankingMarket,
  onRankingMarketChange,
  rankingMarkets,
  rankingSelectedTimeMode,
  onRankingTimeModeChange,
  rankingTimeModeOptions,
  rankingSelectedYear,
  onRankingSelectedYearChange,
  rankingAvailableYears,
  rankingSelectedMonth,
  onRankingSelectedMonthChange,
  rankingMonthOptions,
  rankingRangeStartMonth,
  onRankingRangeStartMonthChange,
  rankingRangeEndMonth,
  onRankingRangeEndMonthChange,
  rankingRangeMonthOptions,
  rankingSelectableRangeStartMonths,
  rankingSelectableRangeEndMonths,
  rankingDataNote,
  rankingAvailabilityItems = [],
  rankingPeriodStatusItems = [],
  rankingDatasetCoverageItems = rankingAvailabilityItems,
  rankingPeriodType,
  onRankingPeriodTypeChange,
  rankingPeriodTypes,
  selectedRankingPeriodKey,
  onSelectedRankingPeriodChange,
  rankingPeriodOptions,
  chartRangeMode,
  onChartRangeModeChange,
  chartMarket,
  onChartMarketChange,
  chartMarkets,
  chartPeriodType,
  onChartPeriodTypeChange,
  chartPeriodTypes,
  selectedChartYear,
  onSelectedChartYearChange,
  chartYears,
  chartYearOptions,
  selectedCompanyId,
  onSelectedCompanyChange,
  selectedCompany,
  selectedPeriod,
  selectedPeriodRow,
  onBack,
}) {
  const chartRows = useMemo(
    () => filterRowsByChartRange(rows, chartRangeMode, selectedChartYear),
    [chartRangeMode, selectedChartYear, rows],
  );
  const [profileChartTab, setProfileChartTab] = useState(PROFILE_CHART_TABS[0].key);
  const [profileChartMetric, setProfileChartMetric] = useState(
    PROFILE_CHART_TABS[0].metrics[0],
  );
  const [profileMode, setProfileMode] = useState("historical");
  const [profileForecastScenario, setProfileForecastScenario] = useState("base_case");
  const [profileForecastMetric, setProfileForecastMetric] = useState("visits");
  const hasSelectedCompanyOption = companies.some((company) =>
    sameCompany(company.id, selectedCompanyId),
  );
  const activeProfileChartTab = useMemo(
    () =>
      PROFILE_CHART_TABS.find((tab) => tab.key === profileChartTab) ??
      PROFILE_CHART_TABS[0],
    [profileChartTab],
  );
  useEffect(() => {
    if (!activeProfileChartTab.metrics.includes(profileChartMetric)) {
      setProfileChartMetric(activeProfileChartTab.metrics[0]);
    }
  }, [activeProfileChartTab, profileChartMetric]);
  const profileChartCompanyIds = useMemo(() => {
    const companyIds = new Map();
    const addCompanyId = (companyId) => {
      const id = normalizeCompanyId(companyId);
      if (!id) return;
      companyIds.set(id, companyId);
    };

    addCompanyId(selectedCompanyId);
    companies.forEach((company) => addCompanyId(company.id));
    chartRows.forEach((row) => {
      if (isRealCompanyRow(row) || isBenchmarkRow(row)) addCompanyId(row.company_id);
    });
    addCompanyId(MARKET_BENCHMARK_ID);

    return Array.from(companyIds.values());
  }, [chartRows, companies, selectedCompanyId]);
  const profileChartMetricOptions = useMemo(
    () =>
      activeProfileChartTab.metrics.map((metricKey) => {
        const metricRows = chartRows.filter(
          (row) =>
            profileChartCompanyIds.some((companyId) =>
              sameCompany(row?.company_id, companyId),
            ) && hasMetricValue(row, metricKey),
        );

        return {
          key: metricKey,
          label: getProfileMetricLabel(metricKey),
          disabled: metricRows.length === 0,
          reason: metricRows.length === 0 ? getProfileChartEmptyTitle(metricKey) : "",
        };
      }),
    [activeProfileChartTab, chartRows, profileChartCompanyIds],
  );
  const profileChartItems = useMemo(
    () => {
      const series = groupSeriesByCompetitor(
        chartRows,
        profileChartMetric,
        profileChartCompanyIds,
      );

      return [
        {
          metricKey: profileChartMetric,
          title: getProfileChartTitle(profileChartMetric),
          series,
          chartData: toMultiLineChartData(series),
        },
      ];
    },
    [chartRows, profileChartCompanyIds, profileChartMetric],
  );
  const profileLegendSeries = useMemo(
    () => mergeSeriesForLegend(profileChartItems.map((chart) => chart.series)),
    [profileChartItems],
  );
  const selectedCompanyDefault = useMemo(
    () => {
      const defaults = [selectedCompanyId];
      if (!sameCompany(selectedCompanyId, OWN_COMPANY_ID)) defaults.push(OWN_COMPANY_ID);
      defaults.push(MARKET_BENCHMARK_ID);
      return defaults;
    },
    [selectedCompanyId],
  );
  const profileVisibility = useCompanyVisibility(profileLegendSeries, selectedCompanyDefault);
  const selectedChartYearOption = getSelectedPeriodOption(chartYearOptions, selectedChartYear);
  const chartRangeLabel =
    chartRangeMode === "year"
      ? selectedChartYearOption?.label || selectedChartYear || "Año"
      : "Todo el histórico disponible";
  const profilePeriodLabel = getPeriodLabelFromRows(
    profilePeriodRows,
    selectedPeriod?.label || "Periodo seleccionado",
  );
  const profileForecastSidebarContext = useMemo(
    () =>
      buildProfileForecastSidebarContext({
        allForecastRows,
        observedRows,
        selectedCompanyId,
        selectedPeriodRow,
        forecastScenario: profileForecastScenario,
        forecastMetric: profileForecastMetric,
      }),
    [
      allForecastRows,
      observedRows,
      profileForecastMetric,
      profileForecastScenario,
      selectedCompanyId,
      selectedPeriodRow,
    ],
  );
  useEffect(() => {
    if (
      profileForecastSidebarContext.activeScenario &&
      profileForecastSidebarContext.activeScenario !== profileForecastScenario
    ) {
      setProfileForecastScenario(profileForecastSidebarContext.activeScenario);
    }
  }, [profileForecastScenario, profileForecastSidebarContext.activeScenario]);
  useEffect(() => {
    if (
      profileForecastSidebarContext.activeMetric &&
      profileForecastSidebarContext.activeMetric !== profileForecastMetric
    ) {
      setProfileForecastMetric(profileForecastSidebarContext.activeMetric);
    }
  }, [profileForecastMetric, profileForecastSidebarContext.activeMetric]);
  const profilePeriodControls = (
    <PeriodContextControls
      market={rankingMarket}
      onMarketChange={onRankingMarketChange}
      markets={rankingMarkets}
      selectedTimeMode={rankingSelectedTimeMode}
      onTimeModeChange={onRankingTimeModeChange}
      timeModeOptions={rankingTimeModeOptions}
      selectedYear={rankingSelectedYear}
      onSelectedYearChange={onRankingSelectedYearChange}
      availableYears={rankingAvailableYears}
      selectedMonth={rankingSelectedMonth}
      onSelectedMonthChange={onRankingSelectedMonthChange}
      monthOptions={rankingMonthOptions}
      rangeStartMonth={rankingRangeStartMonth}
      onRangeStartMonthChange={onRankingRangeStartMonthChange}
      rangeEndMonth={rankingRangeEndMonth}
      onRangeEndMonthChange={onRankingRangeEndMonthChange}
      rangeMonthOptions={rankingRangeMonthOptions}
      selectableRangeStartMonths={rankingSelectableRangeStartMonths}
      selectableRangeEndMonths={rankingSelectableRangeEndMonths}
      dataNote={rankingDataNote}
      availabilityItems={rankingAvailabilityItems}
      periodStatusItems={rankingPeriodStatusItems}
      datasetCoverageItems={rankingDatasetCoverageItems}
      periodType={rankingPeriodType}
      onPeriodTypeChange={onRankingPeriodTypeChange}
      periodTypes={rankingPeriodTypes}
      selectedPeriodKey={selectedRankingPeriodKey}
      onSelectedPeriodChange={onSelectedRankingPeriodChange}
      periodOptions={rankingPeriodOptions}
    />
  );

  return (
    <div className="profile-temporal-layout">
      <aside className="temporal-sidebar" aria-label="Controles temporales de la ficha">
        {profileMode === "forecast" ? (
          <ProfileForecastSidebar context={profileForecastSidebarContext} />
        ) : (
          <section className="global-temporal-panel profile-temporal-panel">
            <div className="global-temporal-copy">
              <p className="analysis-label text-accent-500">Contexto de ficha</p>
              <h2>Dónde y cuándo miramos</h2>
              <p>
                Este selector controla KPIs, snapshot y comparativas ejecutivas de la ficha. Las
                gráficas mantienen su propio rango visual para explorar evolución.
              </p>
            </div>
            {profilePeriodControls}
          </section>
        )}
      </aside>

      <div className="profile-content-stack">
        <PlayerHeader
          row={selectedPeriodRow}
          company={selectedCompany}
          selectedCompanyId={selectedCompanyId}
          companies={companies}
          onSelectedCompanyChange={onSelectedCompanyChange}
          hasSelectedCompanyOption={hasSelectedCompanyOption}
          observedRows={observedRows}
          periodLabel={profilePeriodLabel}
          profileMode={profileMode}
          forecastScenario={profileForecastSidebarContext.activeScenario}
          forecastMetric={profileForecastSidebarContext.activeMetric}
          onBack={onBack}
        />

        <ProfileTabs
          options={PROFILE_MAIN_TABS}
          value={profileMode}
          onChange={setProfileMode}
          label="Histórico o forecast"
        />

        {profileMode === "forecast" ? (
          <ContentSection
            eyebrow="Forecast"
            title="Proyección del player"
            detail="Separado del histórico real"
          >
            <ProfileForecastPanel
              allForecastRows={allForecastRows}
              observedRows={observedRows}
              selectedCompanyId={selectedCompanyId}
              selectedCompany={selectedCompany}
              selectedPeriodRow={selectedPeriodRow}
              forecastScenario={profileForecastSidebarContext.activeScenario}
              onForecastScenarioChange={setProfileForecastScenario}
              forecastMetric={profileForecastSidebarContext.activeMetric}
              onForecastMetricChange={setProfileForecastMetric}
              onOpenProfile={onSelectedCompanyChange}
            />
          </ContentSection>
        ) : selectedPeriodRow ? (
          <>
            <ProfileExecutiveSnapshot
              row={selectedPeriodRow}
              company={selectedCompany}
              periodRows={profilePeriodRows}
              periodLabel={profilePeriodLabel}
            />
            <ProfileKpis
              row={selectedPeriodRow}
              company={selectedCompany}
              periodRows={profilePeriodRows}
              periodLabel={profilePeriodLabel}
            />
            <ProfileMomentumBlock row={selectedPeriodRow} periodRows={profilePeriodRows} />

            <ContentSection
              eyebrow="Comparativa"
              title={
                sameCompany(selectedCompanyId, OWN_COMPANY_ID)
                  ? "Focus Brand vs Market Average"
                  : "Player vs Focus Brand y market average"
              }
              detail={profilePeriodLabel}
            >
              <ProfileComparisonPanel row={selectedPeriodRow} periodRows={profilePeriodRows} />
            </ContentSection>
          </>
        ) : (
          <EmptyState
            title="No hay datos para el competidor seleccionado."
            message="Cambia el periodo global o selecciona otra empresa disponible."
          />
        )}

        {profileMode === "historical" && (
        <ContentSection
          eyebrow="Gráficas"
          title="Gráficas de ficha"
          detail={chartRangeLabel}
          action={
            <ChartRangeControls
              market={chartMarket}
              onMarketChange={onChartMarketChange}
              markets={chartMarkets}
              periodType={chartPeriodType}
              onPeriodTypeChange={onChartPeriodTypeChange}
              periodTypes={chartPeriodTypes}
              chartRangeMode={chartRangeMode}
              onChartRangeModeChange={onChartRangeModeChange}
              selectedChartYear={selectedChartYear}
              onSelectedChartYearChange={onSelectedChartYearChange}
              chartYears={chartYears}
              chartYearOptions={chartYearOptions}
            />
          }
        >
          <ProfileTabs
            options={PROFILE_CHART_TABS}
            value={profileChartTab}
            onChange={setProfileChartTab}
            label="Gráficas de ficha"
          />

          <MetricSwitch
            options={profileChartMetricOptions}
            value={profileChartMetric}
            onChange={setProfileChartMetric}
            label="Métrica"
          />

          <CompanyLegend
            series={profileLegendSeries}
            hiddenCompanyIds={profileVisibility.hiddenCompanyIds}
            onToggleCompany={profileVisibility.handleToggleCompany}
            onShowAll={profileVisibility.handleShowAll}
            onHideAll={profileVisibility.handleHideAll}
          />

          <section className="grid gap-6">
            {profileChartItems.map((chart) => (
              <MetricChart
                key={chart.metricKey}
                title={chart.title}
                metricKey={chart.metricKey}
                series={chart.series}
                chartData={chart.chartData}
                emptyTitle={getProfileChartEmptyTitle(chart.metricKey)}
                hiddenCompanyIds={profileVisibility.hiddenCompanyIds}
                yAxisReversed={chart.metricKey.startsWith("rank_")}
              />
            ))}
          </section>
        </ContentSection>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [route, setRoute] = useState(getCurrentRoute);
  const [forecastPeriodType, setForecastPeriodType] = useState("monthly");
  const [forecastMarketPreference, setForecastMarket] = useState("");
  const [chartPeriodType, setChartPeriodType] = useState("monthly");
  const [chartMarket, setChartMarket] = useState("");
  const [chartRangeMode, setChartRangeMode] = useState("all");
  const [selectedChartYear, setSelectedChartYear] = useState("");
  const [rankingSort, setRankingSort] = useState("revenue");
  const [forecastScenario, setForecastScenario] = useState("base_case");
  const [selectedCompanyIdPreference, setSelectedCompanyId] = useState(OWN_COMPANY_ID);

  useEffect(() => {
    let isMounted = true;

    loadBenchmarkData()
      .then((json) => {
        if (!isMounted) return;
        setPayload(json);
        setStatus("ready");
      })
      .catch((apiError) => {
        if (!isMounted) return;
        setError(apiError.message || "Unable to load benchmark data.");
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleHashChange = () => {
      setRoute(getCurrentRoute());
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const rawInterfaceRows = payload?.data?.interface ?? [];
  const rows = useMemo(() => normalizeInterfaceRows(rawInterfaceRows), [rawInterfaceRows]);
  const realRows = useMemo(() => rows.filter(isRealCompanyRow), [rows]);
  const comparableRows = useMemo(() => rows.filter(isComparableRow), [rows]);
  const forecastScenarios = useMemo(
    () => getAvailableForecastScenarios(rows, FORECAST_SCENARIO_ORDER),
    [rows],
  );
  const dataSourceStatus = getDataSourceStatus(payload?.meta?.data_source);

  useEffect(() => {
    if (!rows.length) return;

    if (!forecastScenarios.length) {
      setForecastScenario("");
      return;
    }

    if (!forecastScenario || !forecastScenarios.includes(forecastScenario)) {
      setForecastScenario(
        forecastScenarios.includes("base_case") ? "base_case" : forecastScenarios[0],
      );
    }
  }, [forecastScenario, forecastScenarios, rows.length]);

  const forecastScenarioRows = useMemo(
    () => filterRowsByForecastScenario(rows, forecastScenario),
    [forecastScenario, rows],
  );
  const forecastSourceRows = useMemo(
    () => mergeForecastMetricRows(getForecastRows(forecastScenarioRows)),
    [forecastScenarioRows],
  );
  const allForecastSourceRows = useMemo(() => mergeForecastMetricRows(getForecastRows(rows)), [rows]);
  const globalScope = useScopedPeriodSelection({
    rows: realRows,
    periodRowsValidator: (rowsForPeriod) => rowsForPeriod.length >= 1,
  });
  const rankingSortOptions = LOCAL_RANKING_SORTS;

  useEffect(() => {
    if (!rankingSortOptions.length) return;
    if (!rankingSortOptions.some((sort) => sort.key === rankingSort)) {
      const defaultSort =
        rankingSortOptions.find((sort) => sort.key === "revenue") ?? rankingSortOptions[0];
      setRankingSort(defaultSort.key);
    }
  }, [rankingSort, rankingSortOptions]);

  const rankingPeriodOptions = globalScope.periodOptions;
  const selectedRankingPeriod = globalScope.selectedPeriod;
  const rankingPeriodRows = useMemo(
    () => globalScope.periodRows,
    [globalScope.periodRows],
  );
  const chartSelectableRows = useMemo(
    () => filterRowsWithMetrics(comparableRows, DASHBOARD_CHART_METRICS, false),
    [comparableRows],
  );
  const chartSourcePeriodTypes = useMemo(
    () => getPeriodTypes(chartSelectableRows),
    [chartSelectableRows],
  );
  const chartPeriodTypes = chartSourcePeriodTypes;

  useEffect(() => {
    if (!chartPeriodTypes.length) return;
    if (!chartPeriodTypes.includes(chartPeriodType)) {
      setChartPeriodType(chartPeriodTypes.includes("monthly") ? "monthly" : chartPeriodTypes[0]);
    }
  }, [chartPeriodType, chartPeriodTypes]);

  const chartSourcePeriodType = useMemo(
    () => getSourcePeriodType(chartPeriodType, chartSourcePeriodTypes),
    [chartPeriodType, chartSourcePeriodTypes],
  );
  const chartMarkets = useMemo(
    () => getMarkets(chartSelectableRows, chartSourcePeriodType),
    [chartSelectableRows, chartSourcePeriodType],
  );

  useEffect(() => {
    if (!chartMarkets.length) {
      setChartMarket("");
      return;
    }

    if (!chartMarket || !chartMarkets.includes(chartMarket)) {
      setChartMarket(chartMarkets[0]);
    }
  }, [chartMarket, chartMarkets]);

  const chartTrendRows = useMemo(
    () =>
      preferObservedRows(
        filterRowsWithMetrics(
          filterInterfaceRows(comparableRows, {
            periodType: chartSourcePeriodType,
            market: chartMarket,
          }),
          DASHBOARD_CHART_METRICS,
          false,
        ),
      ),
    [chartMarket, chartSourcePeriodType, comparableRows],
  );
  const chartYearOptions = useMemo(
    () => getAvailableChartYearOptions(chartTrendRows, DASHBOARD_CHART_METRICS),
    [chartTrendRows],
  );
  const chartYears = useMemo(
    () => chartYearOptions.map((period) => period.key),
    [chartYearOptions],
  );

  useEffect(() => {
    if (!chartYears.length) {
      setSelectedChartYear("");
      setChartRangeMode("all");
      return;
    }

    if (!selectedChartYear || !chartYears.includes(selectedChartYear)) {
      setSelectedChartYear(chartYears[0]);
    }
  }, [chartYears, selectedChartYear]);

  const forecastSelectableRows = useMemo(
    () => filterRowsWithMetrics(forecastSourceRows, FORECAST_DETAIL_METRICS, false),
    [forecastSourceRows],
  );
  const forecastSourcePeriodTypes = useMemo(
    () => getPeriodTypes(forecastSelectableRows, { includeForecasts: true, realOnly: true }),
    [forecastSelectableRows],
  );
  const forecastPeriodTypes = forecastSourcePeriodTypes;

  useEffect(() => {
    if (!forecastPeriodTypes.length) return;
    if (!forecastPeriodTypes.includes(forecastPeriodType)) {
      setForecastPeriodType(
        forecastPeriodTypes.includes("monthly") ? "monthly" : forecastPeriodTypes[0],
      );
    }
  }, [forecastPeriodType, forecastPeriodTypes]);

  const forecastSourcePeriodType = useMemo(
    () => getSourcePeriodType(forecastPeriodType, forecastSourcePeriodTypes),
    [forecastPeriodType, forecastSourcePeriodTypes],
  );
  const forecastMarkets = useMemo(
    () =>
      getMarkets(forecastSelectableRows, forecastSourcePeriodType, {
        includeForecasts: true,
        realOnly: true,
      }),
    [forecastSelectableRows, forecastSourcePeriodType],
  );

  const forecastMarket = useMemo(() => {
    if (!forecastMarkets.length) return "";
    if (forecastMarketPreference && forecastMarkets.includes(forecastMarketPreference)) {
      return forecastMarketPreference;
    }
    return forecastMarkets[0];
  }, [forecastMarketPreference, forecastMarkets]);

  const forecastRows = useMemo(
    () =>
      filterRowsWithMetrics(
        filterInterfaceRows(
          forecastSourceRows,
          {
            periodType: forecastSourcePeriodType,
            market: forecastMarket,
          },
          { includeForecasts: true, realOnly: true },
        ),
        FORECAST_DETAIL_METRICS,
        false,
      ),
    [forecastMarket, forecastSourcePeriodType, forecastSourceRows],
  );
  const profileObservedRows = useMemo(
    () =>
      filterInterfaceRows(
        comparableRows,
        {
          periodType: "monthly",
          market: globalScope.market,
        },
        { includeBenchmark: true, includeForecasts: false },
      ),
    [comparableRows, globalScope.market],
  );
  const companies = useMemo(() => getUniqueCompanies(realRows), [realRows]);

  const selectedCompanyId = useMemo(() => {
    if (!companies.length) {
      return route.companyId || selectedCompanyIdPreference || OWN_COMPANY_ID;
    }

    if (route.view === "profile" && route.companyId) {
      const routedCompany = companies.find((company) => sameCompany(company.id, route.companyId));
      const focus = companies.find((company) => sameCompany(company.id, OWN_COMPANY_ID));
      return routedCompany?.id ?? focus?.id ?? companies[0].id;
    }

    if (companies.some((company) => sameCompany(company.id, selectedCompanyIdPreference))) {
      return selectedCompanyIdPreference;
    }

    const focus = companies.find((company) => sameCompany(company.id, OWN_COMPANY_ID));
    return focus?.id ?? companies[0].id;
  }, [companies, route.companyId, route.view, selectedCompanyIdPreference]);

  const selectedCompany = useMemo(
    () => companies.find((company) => sameCompany(company.id, selectedCompanyId)) ?? null,
    [companies, selectedCompanyId],
  );
  const selectedPeriodRow = useMemo(
    () => rankingPeriodRows.find((row) => sameCompany(row.company_id, selectedCompanyId)) ?? null,
    [rankingPeriodRows, selectedCompanyId],
  );
  const profilePeriodRows = useMemo(
    () =>
      buildRowsForTimeSelection(comparableRows, globalScope.timeSelection, {
        market: globalScope.market,
        metricKeys: BATTLE_METRICS.map((metric) => metric.key),
        requireAll: false,
        includeBenchmark: true,
      }),
    [comparableRows, globalScope.market, globalScope.timeSelection],
  );

  const handleOpenProfile = (companyId) => {
    if (!companyId) return;
    if (!companies.some((company) => sameCompany(company.id, companyId))) return;

    setSelectedCompanyId(companyId);
    navigateToHash(getProfileHash(companyId));
  };

  const handleGoBenchmark = () => {
    navigateToHash(HOME_HASH);
  };

  const handleOpenPlayers = () => {
    const focus = companies.find((company) => sameCompany(company.id, OWN_COMPANY_ID));
    const targetCompanyId =
      selectedCompany?.id ||
      focus?.id ||
      companies[0]?.id ||
      selectedCompanyId ||
      OWN_COMPANY_ID;

    if (targetCompanyId) {
      setSelectedCompanyId(targetCompanyId);
      navigateToHash(getProfileHash(targetCompanyId));
    }
  };

  const handleOpenBattleArena = () => {
    navigateToHash(BATTLE_ARENA_HASH);
  };

  const handleOpenForecast = () => {
    navigateToHash(FORECAST_HASH);
  };

  if (status === "loading") return <LoadingShell />;

  if (status === "error") {
    return <StatusShell title="No se pudieron cargar los datos." message={error} />;
  }

  if (!rawInterfaceRows.length) {
    return (
      <StatusShell
        title="No hay datos disponibles para el dashboard."
        message="Revisa que la fuente publicada incluya filas comparables antes de abrir la lectura ejecutiva."
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="mx-auto max-w-7xl space-y-6">
        <AppHeader
          view={route.view}
          onGoBenchmark={handleGoBenchmark}
          onOpenPlayers={handleOpenPlayers}
          onOpenBattleArena={handleOpenBattleArena}
          onOpenForecast={handleOpenForecast}
          generatedAt={formatGeneratedAt(payload?.meta?.generated_at)}
          rowCount={rawInterfaceRows.length}
          dataSourceStatus={dataSourceStatus}
        />

        {route.view === "home" ? (
          <HomeView
            realRows={realRows}
            comparableRows={comparableRows}
            rankingSort={rankingSort}
            onRankingSortChange={setRankingSort}
            globalScope={globalScope}
            chartRangeMode={chartRangeMode}
            selectedChartYear={selectedChartYear}
            chartYearOptions={chartYearOptions}
            onOpenBattleArena={handleOpenBattleArena}
            onOpenProfile={handleOpenProfile}
          />
        ) : route.view === "forecast" ? (
          <ForecastDetailView
            rows={forecastRows}
            forecastScenarios={forecastScenarios}
            forecastScenario={forecastScenario}
            onForecastScenarioChange={setForecastScenario}
            forecastScenarioLabel={getForecastScenarioLabel(forecastScenario)}
            forecastMarket={forecastMarket}
            onForecastMarketChange={setForecastMarket}
            forecastMarkets={forecastMarkets}
            forecastPeriodType={forecastPeriodType}
            onForecastPeriodTypeChange={setForecastPeriodType}
            forecastPeriodTypes={forecastPeriodTypes}
            onBack={handleGoBenchmark}
            onOpenProfile={handleOpenProfile}
          />
        ) : route.view === "battle" ? (
          <BattleArenaView
            realRows={realRows}
            comparableRows={comparableRows}
            forecastSourceRows={allForecastSourceRows}
            companies={companies}
            globalScope={globalScope}
            forecastScenarios={forecastScenarios}
            onOpenProfile={handleOpenProfile}
          />
        ) : (
          <ProfileView
            rows={chartTrendRows}
            observedRows={profileObservedRows}
            profilePeriodRows={profilePeriodRows}
            allForecastRows={allForecastSourceRows}
            companies={companies}
            rankingMarket={globalScope.market}
            onRankingMarketChange={globalScope.onMarketChange}
            rankingMarkets={globalScope.markets}
            rankingSelectedTimeMode={globalScope.selectedTimeMode}
            onRankingTimeModeChange={globalScope.onTimeModeChange}
            rankingTimeModeOptions={globalScope.timeModeOptions}
            rankingSelectedYear={globalScope.selectedYear}
            onRankingSelectedYearChange={globalScope.onSelectedYearChange}
            rankingAvailableYears={globalScope.availableYears}
            rankingSelectedMonth={globalScope.selectedMonth}
            onRankingSelectedMonthChange={globalScope.onSelectedMonthChange}
            rankingMonthOptions={globalScope.monthOptions}
            rankingRangeStartMonth={globalScope.rangeStartMonth}
            onRankingRangeStartMonthChange={globalScope.onRangeStartMonthChange}
            rankingRangeEndMonth={globalScope.rangeEndMonth}
            onRankingRangeEndMonthChange={globalScope.onRangeEndMonthChange}
            rankingRangeMonthOptions={globalScope.rangeMonthOptions}
            rankingSelectableRangeStartMonths={globalScope.selectableRangeStartMonths}
            rankingSelectableRangeEndMonths={globalScope.selectableRangeEndMonths}
            rankingDataNote={globalScope.dataNote}
            rankingAvailabilityItems={globalScope.availabilityItems}
            rankingPeriodStatusItems={globalScope.periodStatusItems}
            rankingDatasetCoverageItems={globalScope.datasetCoverageItems}
            rankingPeriodType={globalScope.periodType}
            onRankingPeriodTypeChange={globalScope.onPeriodTypeChange}
            rankingPeriodTypes={globalScope.periodTypes}
            selectedRankingPeriodKey={globalScope.selectedPeriodKey}
            onSelectedRankingPeriodChange={globalScope.onSelectedPeriodChange}
            rankingPeriodOptions={rankingPeriodOptions}
            chartRangeMode={chartRangeMode}
            onChartRangeModeChange={setChartRangeMode}
            chartMarket={chartMarket}
            onChartMarketChange={setChartMarket}
            chartMarkets={chartMarkets}
            chartPeriodType={chartPeriodType}
            onChartPeriodTypeChange={setChartPeriodType}
            chartPeriodTypes={chartPeriodTypes}
            selectedChartYear={selectedChartYear}
            onSelectedChartYearChange={setSelectedChartYear}
            chartYears={chartYears}
            chartYearOptions={chartYearOptions}
            selectedCompanyId={selectedCompanyId}
            onSelectedCompanyChange={handleOpenProfile}
            selectedCompany={selectedCompany}
            selectedPeriod={selectedRankingPeriod}
            selectedPeriodRow={selectedPeriodRow}
            onBack={handleGoBenchmark}
          />
        )}
      </div>
    </main>
  );
}
