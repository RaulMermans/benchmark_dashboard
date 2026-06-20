import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateBenchmarkPayload,
  buildBenchmarkDataset,
  calculateMarketShares,
  calculateRanks,
  adaptSimpleMonthlyRows,
  buildRankingViewModel,
  buildMarketShareViewModel,
  buildExecutiveSummaryViewModel,
  demoBenchmarkConfig,
} from "../src/framework/index.js";
import { benchmarkConfig } from "../src/config/benchmarkConfig.js";
import {
  METRIC_REGISTRY,
  RANKING_SORTS,
  LOCAL_RANKING_SORTS,
  BATTLE_METRICS,
  PROFILE_CHART_TABS,
  GLOBAL_CONTEXT_METRICS,
  DISTRIBUTION_METRICS,
  DASHBOARD_CHART_METRICS,
  FORECAST_DETAIL_METRICS,
} from "../src/config/metricRegistry.js";
import { formatMetricValue, getFormatterForMetric } from "../src/lib/metricFormatters.js";
import {
  DATA_SOURCE_TYPES,
  createDataSourceMetadata,
  loadBenchmarkData,
} from "../src/lib/api.js";
import {
  getDashboardPeriodTypes,
  getDataSourceStatus,
  getSourcePeriodType,
} from "../src/viewModels/dashboardViewModel.js";
import {
  filterRowsByForecastScenario,
  getAvailableForecastScenarios,
  getForecastScenarioLabel,
} from "../src/viewModels/forecastViewModel.js";
import { getProfileHash } from "../src/viewModels/profileViewModel.js";

const payload = JSON.parse(fs.readFileSync("public/data/benchmark-data.json", "utf8"));

test("current mock JSON validates", () => {
  const result = validateBenchmarkPayload(payload);
  assert.equal(result.valid, true, result.errors.slice(0, 5).join("\n"));
  assert.ok(result.summary.rowCount > 0);
  assert.ok(result.summary.companyCount >= 8);
});

test("dataset builds from mock JSON", () => {
  const dataset = buildBenchmarkDataset(payload, demoBenchmarkConfig);
  assert.ok(dataset.rows.length > 0);
  assert.ok(dataset.events.length > 0);
});

test("market share excludes market_average by default", () => {
  const rows = [
    { date: "2026-01-01", market: "Demo", data_type: "actual", company_id: "focus", type: "own", revenue: 100 },
    { date: "2026-01-01", market: "Demo", data_type: "actual", company_id: "peer_a", type: "competitor", revenue: 300 },
    { date: "2026-01-01", market: "Demo", data_type: "actual", company_id: "market_average", type: "benchmark", revenue: 200 },
  ];
  const result = calculateMarketShares(rows, "revenue", demoBenchmarkConfig);
  assert.equal(result.find((row) => row.company_id === "focus").market_share_revenue, 0.25);
  assert.equal(result.find((row) => row.company_id === "peer_a").market_share_revenue, 0.75);
});

test("ranks exclude market_average by default", () => {
  const rows = [
    { date: "2026-01-01", market: "Demo", data_type: "actual", company_id: "focus", type: "own", revenue: 100 },
    { date: "2026-01-01", market: "Demo", data_type: "actual", company_id: "peer_a", type: "competitor", revenue: 300 },
    { date: "2026-01-01", market: "Demo", data_type: "actual", company_id: "market_average", type: "benchmark", revenue: 999 },
  ];
  const result = calculateRanks(rows, "revenue", demoBenchmarkConfig);
  assert.equal(result.find((row) => row.company_id === "peer_a").rank_revenue, 1);
  assert.equal(result.find((row) => row.company_id === "focus").rank_revenue, 2);
});

test("simple monthly adapter enriches basic rows", () => {
  const adapted = adaptSimpleMonthlyRows([
    { date: "2026-01-01", company_id: "focus", display_name: "Focus Brand", market: "Demo Market", revenue: 100, visits: 50 },
    { date: "2026-01-01", company_id: "peer_a", display_name: "Northline", market: "Demo Market", revenue: 300, visits: 150 },
  ], demoBenchmarkConfig);
  const rows = adapted.data.interface;
  assert.equal(adapted.ok, true);
  assert.equal(rows.find((row) => row.company_id === "focus").market_share_revenue, 0.25);
  assert.equal(rows.find((row) => row.company_id === "peer_a").rank_revenue, 1);
});

test("view models return usable data", () => {
  const dataset = buildBenchmarkDataset(payload, demoBenchmarkConfig);
  const rows = dataset.rows.filter((row) => row.date === "2025-12-01" && row.data_type !== "forecast");
  assert.ok(buildRankingViewModel(rows, demoBenchmarkConfig).length > 0);
  assert.ok(buildMarketShareViewModel(rows, demoBenchmarkConfig).length > 0);
  assert.ok(buildExecutiveSummaryViewModel(rows, demoBenchmarkConfig).companyCount > 0);
});

test("benchmarkConfig has required identity fields", () => {
  assert.equal(benchmarkConfig.identity.focusEntityId, "focus");
  assert.equal(benchmarkConfig.identity.benchmarkEntityId, "market_average");
});

test("benchmarkConfig comparisonSets include focus and peers", () => {
  const { coreRaceEntityIds, battleTargetEntityIds } = benchmarkConfig.comparisonSets;
  assert.ok(coreRaceEntityIds.includes("focus"));
  assert.ok(coreRaceEntityIds.includes("market_average"));
  assert.ok(coreRaceEntityIds.includes("peer_a"));
  assert.ok(battleTargetEntityIds.includes("peer_a"));
  assert.ok(battleTargetEntityIds.includes("peer_b"));
  assert.ok(!battleTargetEntityIds.includes("focus"), "focus should not be a battle target");
});

test("benchmarkConfig routes are well-formed hash strings", () => {
  const { routes } = benchmarkConfig;
  assert.ok(routes.home.startsWith("#/"));
  assert.ok(routes.forecast.startsWith("#/"));
  assert.ok(routes.battleArena.startsWith("#/"));
  assert.ok(routes.profilePrefix.startsWith("#/"));
});

test("benchmarkConfig periods have all required keys", () => {
  const { periods } = benchmarkConfig;
  assert.ok(Array.isArray(periods.timeModes));
  assert.ok(Array.isArray(periods.forecastTimeModes));
  assert.ok(Array.isArray(periods.dashboardOrder));
  assert.ok(typeof periods.labels === "object");
  assert.ok(periods.timeModes.every((m) => m.key && m.label));
});

test("benchmarkConfig forecast scenarioOrder includes base_case", () => {
  assert.ok(benchmarkConfig.forecast.scenarioOrder.includes("base_case"));
  assert.ok(benchmarkConfig.forecast.scenarioOrder.includes("conservative"));
  assert.ok(benchmarkConfig.forecast.scenarioOrder.includes("aggressive"));
});

test("benchmarkConfig thresholds.battleTechnicalDraw is a positive number", () => {
  const threshold = benchmarkConfig.thresholds.battleTechnicalDraw;
  assert.ok(typeof threshold === "number" && threshold > 0 && threshold < 1);
});

test("benchmarkConfig centralizes view option definitions", () => {
  const { views } = benchmarkConfig;
  assert.ok(views.competitiveMapOptions.length >= 3);
  assert.deepEqual(views.profileMainTabs.map((tab) => tab.key), ["historical", "forecast"]);
  assert.equal(views.indexedSourceMetrics.indexed_revenue, "revenue");
  assert.ok(views.momentumReadingOptions.every((option) => option.key && option.label));
  assert.ok(views.battleModeOptions.every((option) => option.key && option.label));
});

test("dashboard period helpers preserve preferred order and select a fallback", () => {
  assert.deepEqual(
    getDashboardPeriodTypes(
      ["annual", "monthly", "quarterly"],
      benchmarkConfig.periods.dashboardOrder,
    ),
    ["monthly", "quarterly", "annual"],
  );
  assert.equal(getSourcePeriodType("annual", ["monthly", "annual"]), "annual");
  assert.equal(getSourcePeriodType("quarterly", ["monthly", "annual"]), "monthly");
});

test("profile hash helper safely encodes company IDs", () => {
  assert.equal(getProfileHash("#/empresa/", "peer a/b"), "#/empresa/peer%20a%2Fb");
});

test("forecast helpers label, order, and filter scenarios", () => {
  const rows = [
    { data_type: "actual", company_id: "focus" },
    { data_type: "forecast", forecast_scenario: "aggressive", company_id: "focus" },
    { data_type: "forecast", forecast_scenario: "base_case", company_id: "focus" },
  ];
  assert.equal(getForecastScenarioLabel("base_case"), "Base");
  assert.deepEqual(
    getAvailableForecastScenarios(rows, benchmarkConfig.forecast.scenarioOrder),
    ["base_case", "aggressive"],
  );
  assert.deepEqual(
    filterRowsByForecastScenario(rows, "base_case"),
    [rows[0], rows[2]],
  );
});

test("data-source metadata and badge status classify all loading modes", () => {
  const cases = [
    [DATA_SOURCE_TYPES.LOCAL_SNAPSHOT, "Sample data"],
    [DATA_SOURCE_TYPES.LIVE_API, "Live API"],
    [DATA_SOURCE_TYPES.SNAPSHOT_FALLBACK, "Snapshot fallback"],
  ];

  cases.forEach(([type, label]) => {
    const metadata = createDataSourceMetadata(type);
    assert.equal(metadata.type, type);
    assert.equal(metadata.label, label);
    assert.deepEqual(getDataSourceStatus(metadata), { type, label });
  });
});

test("local data loading attaches sample-data source metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, data: { interface: [] } }),
  });

  try {
    const result = await loadBenchmarkData();
    assert.equal(result.meta.data_source.type, DATA_SOURCE_TYPES.LOCAL_SNAPSHOT);
    assert.equal(result.meta.data_source.label, "Sample data");
    assert.deepEqual(result.data.events, []);
    assert.deepEqual(result.data.forecasts, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("METRIC_REGISTRY contains all core metric keys", () => {
  const keys = METRIC_REGISTRY.map((m) => m.key);
  const required = [
    "revenue", "visits", "market_share_revenue", "market_share_visits",
    "revenue_per_visit", "monetization_gap", "revenue_yoy_growth", "visits_yoy_growth",
    "rank_revenue", "rank_visits",
  ];
  required.forEach((key) => {
    assert.ok(keys.includes(key), `METRIC_REGISTRY missing: ${key}`);
  });
});

test("METRIC_REGISTRY entries have required shape fields", () => {
  METRIC_REGISTRY.forEach((metric) => {
    assert.ok(metric.key, `entry missing key`);
    assert.ok(metric.label, `${metric.key} missing label`);
    assert.ok(metric.formatter, `${metric.key} missing formatter`);
    assert.ok(Array.isArray(metric.availableIn), `${metric.key} missing availableIn`);
    assert.ok(typeof metric.higherIsBetter === "boolean", `${metric.key} missing higherIsBetter`);
  });
});

test("RANKING_SORTS has revenue and visits at minimum", () => {
  const keys = RANKING_SORTS.map((s) => s.key);
  assert.ok(keys.includes("revenue"));
  assert.ok(keys.includes("visits"));
  assert.ok(RANKING_SORTS.every((s) => s.key && s.label));
});

test("LOCAL_RANKING_SORTS has required entries", () => {
  const keys = LOCAL_RANKING_SORTS.map((s) => s.key);
  assert.ok(keys.includes("revenue"));
  assert.ok(keys.includes("revenue_per_visit"));
  assert.ok(LOCAL_RANKING_SORTS.every((s) => s.key && s.label));
});

test("BATTLE_METRICS formatters are callable and return strings", () => {
  BATTLE_METRICS.forEach((metric) => {
    if (metric.formatter) {
      const result = metric.formatter(1000);
      assert.equal(typeof result, "string", `${metric.key} formatter should return string`);
      assert.ok(result.length > 0, `${metric.key} formatter returned empty string`);
    }
  });
});

test("BATTLE_METRICS has revenue, visits, and share metrics", () => {
  const keys = BATTLE_METRICS.map((m) => m.key);
  assert.ok(keys.includes("revenue"));
  assert.ok(keys.includes("visits"));
  assert.ok(keys.includes("market_share_revenue"));
  assert.ok(keys.includes("revenue_per_visit"));
});

test("PROFILE_CHART_TABS has required tab keys", () => {
  const tabKeys = PROFILE_CHART_TABS.map((t) => t.key);
  assert.ok(tabKeys.includes("revenue"));
  assert.ok(tabKeys.includes("visits"));
  assert.ok(tabKeys.includes("share"));
  assert.ok(tabKeys.includes("efficiency"));
  assert.ok(tabKeys.includes("ranking"));
  assert.ok(PROFILE_CHART_TABS.every((t) => Array.isArray(t.metrics) && t.metrics.length > 0));
});

test("GLOBAL_CONTEXT_METRICS includes core metrics", () => {
  assert.ok(GLOBAL_CONTEXT_METRICS.includes("revenue"));
  assert.ok(GLOBAL_CONTEXT_METRICS.includes("visits"));
  assert.ok(GLOBAL_CONTEXT_METRICS.includes("market_share_revenue"));
  assert.ok(GLOBAL_CONTEXT_METRICS.includes("revenue_per_visit"));
});

test("DISTRIBUTION_METRICS is a Set with expected entries", () => {
  assert.ok(DISTRIBUTION_METRICS instanceof Set);
  assert.ok(DISTRIBUTION_METRICS.has("revenue"));
  assert.ok(DISTRIBUTION_METRICS.has("visits"));
  assert.ok(DISTRIBUTION_METRICS.has("market_share_revenue"));
});

test("DASHBOARD_CHART_METRICS and FORECAST_DETAIL_METRICS are arrays", () => {
  assert.ok(Array.isArray(DASHBOARD_CHART_METRICS));
  assert.ok(Array.isArray(FORECAST_DETAIL_METRICS));
  assert.ok(DASHBOARD_CHART_METRICS.includes("revenue"));
  assert.ok(FORECAST_DETAIL_METRICS.includes("revenue"));
});

test("formatMetricValue resolves currency formatter", () => {
  const result = formatMetricValue(1000, "currency");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("formatMetricValue resolves percent formatter", () => {
  const result = formatMetricValue(0.25, "percent");
  assert.equal(typeof result, "string");
  assert.ok(result.includes("%"));
});

test("formatMetricValue resolves signedPercent formatter with sign", () => {
  const positive = formatMetricValue(0.05, "signedPercent");
  assert.ok(positive.startsWith("+"), `expected + sign, got: ${positive}`);
});

test("formatMetricValue handles unknown formatter key gracefully", () => {
  const result = formatMetricValue(42, "unknown_key");
  assert.equal(typeof result, "string");
});

test("getFormatterForMetric returns expected keys", () => {
  assert.equal(getFormatterForMetric("revenue"), "currency");
  assert.equal(getFormatterForMetric("revenue_per_visit"), "currencyDecimal");
  assert.equal(getFormatterForMetric("visits"), "compact");
  assert.equal(getFormatterForMetric("rank_revenue"), "rank");
  assert.equal(getFormatterForMetric("market_share_revenue"), "percent");
});
