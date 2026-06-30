import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  validateBenchmarkPayload,
  validateSourceMonthlyRows,
  buildBenchmarkDataset,
  buildBenchmarkPayloadFromSourceMonthlyRows,
  buildCanonicalBenchmarkPayload,
  calculateMarketShares,
  calculateRanks,
  calculateIndexedMetrics,
  generateSyntheticBenchmarkRows,
  aggregatePeriods,
  getAvailableYears,
  getAvailableDateRange,
  getLatestCompleteMonth,
  buildCoverageMetadata,
  adaptSimpleMonthlyRows,
  adaptSourceMonthlyRowsToInterface,
  buildRankingViewModel,
  buildMarketShareViewModel,
  buildExecutiveSummaryViewModel,
  demoBenchmarkConfig,
  generateForecastRows,
  prepareTimeseries,
  mapForecastsToRows,
  enrichForecastRows,
  localFallbackProvider,
  localEngineProvider,
  timesfmProvider,
  extractForecastFeatures,
  scoreConfidence,
  backtestForecast,
  DEFAULT_FORECAST_CONFIG,
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

test("current mock JSON validates (source_monthly format)", () => {
  // The demo file now uses source_monthly format; validate using source_monthly validator
  const isSourceMonthly = Array.isArray(payload?.data?.source_monthly);
  assert.ok(isSourceMonthly, "benchmark-data.json must use source_monthly format");
  const result = validateSourceMonthlyRows(payload.data.source_monthly);
  assert.equal(result.ok, true, result.errors.slice(0, 5).join("\n"));
  assert.ok(result.summary.rowCount >= 100, "must have at least 100 source rows");
  assert.ok(result.summary.companyCount >= 8, "must have at least 8 companies");
});

test("dataset builds from mock JSON via source_monthly pipeline", () => {
  // Build interface from source_monthly, then verify dataset builds
  const built = buildBenchmarkPayloadFromSourceMonthlyRows(payload.data.source_monthly);
  assert.equal(built.ok, true);
  const dataset = buildBenchmarkDataset(built, demoBenchmarkConfig);
  assert.ok(dataset.rows.length > 0, "must produce interface rows");
  // Events come from the original payload
  const events = Array.isArray(payload.data?.events) ? payload.data.events : [];
  assert.ok(events.length > 0, "demo payload must include at least one event");
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
  // Build interface from source_monthly since the demo file now uses raw format
  const built = buildBenchmarkPayloadFromSourceMonthlyRows(payload.data.source_monthly);
  const dataset = buildBenchmarkDataset(built, demoBenchmarkConfig);
  // Use the last actual month from the source rows
  const latestDate = payload.data.source_monthly
    .map(r => r.date)
    .sort()
    .at(-1);
  const rows = dataset.rows.filter((row) => row.date === latestDate && row.data_type !== "forecast");
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
  assert.equal(routes.profilePrefix, "#/company/");
  assert.ok(routes.legacyProfilePrefixes.includes("#/empresa/"));
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
  assert.equal(getProfileHash("#/company/", "peer a/b"), "#/company/peer%20a%2Fb");
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

test("presentation share mover treats a missing mover as no variation", () => {
  const missingMover = null;
  assert.equal(missingMover?.shareChange != null, false);

  const appSource = fs.readFileSync("src/App.jsx", "utf8");
  assert.ok(
    appSource.includes("mover?.shareChange != null"),
    "presentation summary must guard both null and undefined movers",
  );
  assert.ok(
    !appSource.includes("mover?.shareChange !== null"),
    "undefined share changes must not enter the formatting branch",
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

// --- Sprint 01: raw monthly data contract ---

const RAW_MONTHLY_ROWS = [
  { date: "2025-01-01", company_id: "focus", display_name: "Focus Brand", market: "Demo Market", type: "own", revenue: 120000, visits: 80000 },
  { date: "2025-01-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo Market", type: "competitor", revenue: 200000, visits: 140000 },
  { date: "2025-01-01", company_id: "peer_b", display_name: "Peer Beta", market: "Demo Market", type: "competitor", revenue: 160000, visits: 110000 },
  { date: "2025-02-01", company_id: "focus", display_name: "Focus Brand", market: "Demo Market", type: "own", revenue: 125000, visits: 82000 },
  { date: "2025-02-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo Market", type: "competitor", revenue: 210000, visits: 145000 },
  { date: "2025-02-01", company_id: "peer_b", display_name: "Peer Beta", market: "Demo Market", type: "competitor", revenue: 155000, visits: 108000 },
];

test("validateSourceMonthlyRows accepts valid rows", () => {
  const result = validateSourceMonthlyRows(RAW_MONTHLY_ROWS);
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.summary.companyCount, 3);
  assert.equal(result.summary.rowCount, 6);
  assert.ok(result.summary.dateRange);
});

test("validateSourceMonthlyRows rejects non-array input", () => {
  const result = validateSourceMonthlyRows(null);
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].includes("array"));
});

test("validateSourceMonthlyRows rejects missing required fields", () => {
  const bad = [
    { company_id: "focus", revenue: 100, visits: 50 },
    { date: "2025-01-01", revenue: 100, visits: 50 },
    { date: "2025-01-01", company_id: "focus", visits: 50 },
    { date: "2025-01-01", company_id: "focus", revenue: 100 },
    { date: "2025-01-01", company_id: "focus", revenue: -1, visits: 50 },
    { date: "not-a-date", company_id: "focus", revenue: 100, visits: 50 },
  ];
  const result = validateSourceMonthlyRows(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 5);
});

test("validateSourceMonthlyRows warns about missing optional fields", () => {
  const minimal = [{ date: "2025-01-01", company_id: "focus", revenue: 100, visits: 50 }];
  const result = validateSourceMonthlyRows(minimal);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.length > 0);
});

test("adaptSourceMonthlyRowsToInterface converts raw rows to interface shape", () => {
  const iface = adaptSourceMonthlyRowsToInterface(RAW_MONTHLY_ROWS, demoBenchmarkConfig);
  assert.equal(iface.length, RAW_MONTHLY_ROWS.length);
  iface.forEach((row) => {
    assert.ok(row.date);
    assert.equal(row.period_type, "monthly");
    assert.ok(row.company_id);
    assert.ok(row.display_name);
    assert.ok(row.type);
    assert.ok(row.market);
    assert.ok(typeof row.revenue === "number");
    assert.ok(typeof row.visits === "number");
    assert.equal(row.data_type, "actual");
  });
  assert.equal(iface.find((r) => r.company_id === "focus").type, "own");
  assert.equal(iface.find((r) => r.company_id === "peer_a").type, "competitor");
});

test("adaptSourceMonthlyRowsToInterface applies display_name fallback to company_id", () => {
  const rows = [{ date: "2025-01-01", company_id: "anon", revenue: 0, visits: 0 }];
  const iface = adaptSourceMonthlyRowsToInterface(rows);
  assert.equal(iface[0].display_name, "anon");
});

test("source_monthly payload is adapted into data.interface via loadBenchmarkData", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      meta: { source_type: "raw_monthly_observations" },
      data: { source_monthly: RAW_MONTHLY_ROWS },
    }),
  });
  try {
    const { loadBenchmarkData } = await import("../src/lib/api.js");
    const result = await loadBenchmarkData();
    assert.ok(Array.isArray(result.data.interface));
    // Pipeline adds synthetic rows (market_total, market_average) so length > RAW_MONTHLY_ROWS.length
    assert.ok(result.data.interface.length >= RAW_MONTHLY_ROWS.length);
    const realRows = result.data.interface.filter((r) => !r.is_synthetic);
    assert.equal(realRows.length, RAW_MONTHLY_ROWS.length);
    assert.equal(result.data.interface[0].period_type, "monthly");
    assert.equal(result.meta.generated_interface, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bare array payload is treated as source_monthly by loadBenchmarkData", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => RAW_MONTHLY_ROWS,
  });
  try {
    const { loadBenchmarkData } = await import("../src/lib/api.js");
    const result = await loadBenchmarkData();
    assert.ok(Array.isArray(result.data.interface));
    const realRows = result.data.interface.filter((r) => !r.is_synthetic);
    assert.equal(realRows.length, RAW_MONTHLY_ROWS.length);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy data.interface payload still loads without modification", async () => {
  const legacyRows = [
    { date: "2025-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", type: "own", market: "Demo", revenue: 100, visits: 50, data_type: "actual" },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, data: { interface: legacyRows } }),
  });
  try {
    const { loadBenchmarkData } = await import("../src/lib/api.js");
    const result = await loadBenchmarkData();
    assert.ok(Array.isArray(result.data.interface));
    assert.equal(result.data.interface.length, 1);
    assert.equal(result.data.interface[0].company_id, "focus");
    assert.equal(result.meta?.generated_interface, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- Sprint 02: derived metrics engine ---

const SPRINT02_ROWS = [
  { date: "2025-01-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 100, visits: 200 },
  { date: "2025-01-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 300, visits: 400 },
  { date: "2025-02-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 110, visits: 220 },
  { date: "2025-02-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 330, visits: 440 },
];

test("generateSyntheticBenchmarkRows produces market_total and market_average", () => {
  const rows = [
    { date: "2025-01-01", period_type: "monthly", market: "Demo", data_type: "actual", company_id: "focus", type: "own", revenue: 100, visits: 200 },
    { date: "2025-01-01", period_type: "monthly", market: "Demo", data_type: "actual", company_id: "peer_a", type: "competitor", revenue: 300, visits: 400 },
  ];
  const synthetic = generateSyntheticBenchmarkRows(rows);
  const total = synthetic.find((r) => r.company_id === "market_total");
  const avg = synthetic.find((r) => r.company_id === "market_average");
  assert.ok(total, "market_total should be generated");
  assert.ok(avg, "market_average should be generated");
  assert.equal(total.revenue, 400);
  assert.equal(total.visits, 600);
  assert.equal(avg.revenue, 200);
  assert.equal(avg.visits, 300);
  assert.equal(total.type, "benchmark");
  assert.equal(total.is_synthetic, true);
});

test("generateSyntheticBenchmarkRows excludes existing benchmark rows from denominators", () => {
  const rows = [
    { date: "2025-01-01", period_type: "monthly", market: "Demo", data_type: "actual", company_id: "focus", type: "own", revenue: 100, visits: 100 },
    { date: "2025-01-01", period_type: "monthly", market: "Demo", data_type: "actual", company_id: "market_average", type: "benchmark", revenue: 9999, visits: 9999 },
  ];
  const synthetic = generateSyntheticBenchmarkRows(rows);
  const total = synthetic.find((r) => r.company_id === "market_total");
  assert.equal(total.revenue, 100, "benchmark row must not count in total");
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes market shares", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  assert.equal(result.ok, true);
  const jan = result.data.interface.filter((r) => r.date === "2025-01-01" && !r.is_synthetic);
  const focus = jan.find((r) => r.company_id === "focus");
  const peer = jan.find((r) => r.company_id === "peer_a");
  assert.ok(focus.market_share_revenue !== null);
  assert.ok(peer.market_share_revenue !== null);
  assert.ok(Math.abs(focus.market_share_revenue + peer.market_share_revenue - 1) < 0.0001, "shares must sum to 1");
  assert.ok(Math.abs(focus.market_share_revenue - 0.25) < 0.0001);
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes revenue_per_visit", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const focus = result.data.interface.find((r) => r.company_id === "focus" && r.date === "2025-01-01");
  assert.ok(focus.revenue_per_visit !== null);
  assert.ok(Math.abs(focus.revenue_per_visit - 0.5) < 0.0001);
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes monetization_gap", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const focus = result.data.interface.find((r) => r.company_id === "focus" && r.date === "2025-01-01");
  assert.ok(focus.monetization_gap !== null);
  const expectedRevShare = 100 / 400;
  const expectedVisitShare = 200 / 600;
  assert.ok(Math.abs(focus.monetization_gap - (expectedRevShare - expectedVisitShare)) < 0.0001);
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes MoM growth", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const feb = result.data.interface.find((r) => r.company_id === "focus" && r.date === "2025-02-01" && !r.is_synthetic);
  assert.ok(feb.revenue_mom_growth !== null);
  assert.ok(Math.abs(feb.revenue_mom_growth - 0.1) < 0.0001);
  assert.ok(feb.visits_mom_growth !== null);
  assert.ok(Math.abs(feb.visits_mom_growth - 0.1) < 0.0001);
});

test("buildBenchmarkPayloadFromSourceMonthlyRows returns null MoM growth for first month", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const jan = result.data.interface.find((r) => r.company_id === "focus" && r.date === "2025-01-01" && !r.is_synthetic);
  assert.equal(jan.revenue_mom_growth ?? null, null);
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes indexed metrics", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const jan = result.data.interface.find((r) => r.company_id === "focus" && r.date === "2025-01-01" && !r.is_synthetic);
  const feb = result.data.interface.find((r) => r.company_id === "focus" && r.date === "2025-02-01" && !r.is_synthetic);
  assert.ok(Math.abs(jan.indexed_revenue - 100) < 0.0001, "first month should be 100");
  assert.ok(Math.abs(feb.indexed_revenue - 110) < 0.0001, "110% of base = 110");
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes revenue ranks", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const jan = result.data.interface.filter((r) => r.date === "2025-01-01" && !r.is_synthetic);
  const peer = jan.find((r) => r.company_id === "peer_a");
  const focus = jan.find((r) => r.company_id === "focus");
  assert.equal(peer.rank_revenue, 1);
  assert.equal(focus.rank_revenue, 2);
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes visits ranks", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const jan = result.data.interface.filter((r) => r.date === "2025-01-01" && !r.is_synthetic);
  const peer = jan.find((r) => r.company_id === "peer_a");
  assert.equal(peer.rank_visits, 1);
});

test("buildBenchmarkPayloadFromSourceMonthlyRows computes share ranks", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const jan = result.data.interface.filter((r) => r.date === "2025-01-01" && !r.is_synthetic);
  const peer = jan.find((r) => r.company_id === "peer_a");
  const focus = jan.find((r) => r.company_id === "focus");
  assert.equal(peer.rank_share_revenue, 1);
  assert.equal(focus.rank_share_revenue, 2);
});

test("synthetic rows are excluded from ranks", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const synthRows = result.data.interface.filter((r) => r.is_synthetic && r.date === "2025-01-01");
  assert.ok(synthRows.length > 0);
  synthRows.forEach((row) => {
    assert.equal(row.rank_revenue, null, `${row.company_id} should not have rank_revenue`);
    assert.equal(row.rank_visits, null, `${row.company_id} should not have rank_visits`);
  });
});

test("synthetic rows are excluded from share denominators", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  const jan = result.data.interface.filter((r) => r.date === "2025-01-01" && !r.is_synthetic);
  const shares = jan.map((r) => r.market_share_revenue).filter((v) => v !== null);
  const total = shares.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(total - 1) < 0.0001, "real company shares must sum to 1 (synthetic excluded)");
});

test("buildBenchmarkPayloadFromSourceMonthlyRows sets meta.generated_interface", () => {
  const result = buildBenchmarkPayloadFromSourceMonthlyRows(SPRINT02_ROWS);
  assert.equal(result.meta.generated_interface, true);
  assert.equal(result.meta.source_type, "raw_monthly_observations");
});

test("calculateIndexedMetrics sets first valid month to 100", () => {
  const rows = [
    { company_id: "a", market: "M", data_type: "actual", date: "2025-01-01", revenue: 50 },
    { company_id: "a", market: "M", data_type: "actual", date: "2025-02-01", revenue: 75 },
    { company_id: "a", market: "M", data_type: "actual", date: "2025-03-01", revenue: 100 },
  ];
  const result = calculateIndexedMetrics(rows, { indexedMetrics: ["revenue"] });
  assert.ok(Math.abs(result[0].indexed_revenue - 100) < 0.0001);
  assert.ok(Math.abs(result[1].indexed_revenue - 150) < 0.0001);
  assert.ok(Math.abs(result[2].indexed_revenue - 200) < 0.0001);
});

test("calculateRanks supports share rank fields", () => {
  const rows = [
    { date: "2025-01-01", market: "D", data_type: "actual", company_id: "focus", type: "own", market_share_revenue: 0.25 },
    { date: "2025-01-01", market: "D", data_type: "actual", company_id: "peer_a", type: "competitor", market_share_revenue: 0.75 },
  ];
  const result = calculateRanks(rows, "market_share_revenue", demoBenchmarkConfig);
  assert.equal(result.find((r) => r.company_id === "peer_a").rank_share_revenue, 1);
  assert.equal(result.find((r) => r.company_id === "focus").rank_share_revenue, 2);
});

test("source_monthly pipeline via loadBenchmarkData produces derived fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      data: { source_monthly: SPRINT02_ROWS },
    }),
  });
  try {
    const { loadBenchmarkData } = await import("../src/lib/api.js");
    const result = await loadBenchmarkData();
    const iface = result.data.interface;
    assert.ok(Array.isArray(iface) && iface.length > 0);
    const focus = iface.find((r) => r.company_id === "focus" && r.date === "2025-01-01" && !r.is_synthetic);
    assert.ok(focus.market_share_revenue !== null, "market_share_revenue should be computed");
    assert.ok(focus.revenue_per_visit !== null, "revenue_per_visit should be computed");
    assert.ok(focus.rank_revenue !== null, "rank_revenue should be computed");
    // Synthetic rows should be present
    const synth = iface.find((r) => r.company_id === "market_total");
    assert.ok(synth, "market_total synthetic row should exist");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validateBenchmarkPayload still validates legacy data.interface payloads", () => {
  const legacy = {
    ok: true,
    data: {
      interface: [
        { date: "2025-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", type: "own", market: "Demo", revenue: 100, visits: 50, data_type: "actual" },
      ],
    },
  };
  const result = validateBenchmarkPayload(legacy);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

// --- Sprint 03: aggregation & period intelligence ---

const SPRINT03_ROWS = [
  { date: "2025-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 100, visits: 200 },
  { date: "2025-01-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 300, visits: 600 },
  { date: "2025-02-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 110, visits: 220 },
  { date: "2025-02-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 330, visits: 660 },
  { date: "2026-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 150, visits: 300 },
  { date: "2026-01-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 450, visits: 900 },
  { date: "2026-02-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 160, visits: 320 },
  { date: "2026-02-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 480, visits: 960 },
];

test("aggregatePeriods annual sums revenue correctly", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, { periodType: "annual" });
  const real2025 = result.filter((r) => !r.is_synthetic && r.year === "2025");
  const focus2025 = real2025.find((r) => r.company_id === "focus");
  const peer2025 = real2025.find((r) => r.company_id === "peer_a");
  assert.ok(focus2025, "focus 2025 annual row must exist");
  assert.equal(focus2025.revenue, 210, "focus 2025 revenue: 100+110=210");
  assert.equal(peer2025.revenue, 630, "peer_a 2025 revenue: 300+330=630");
});

test("aggregatePeriods annual sums visits correctly", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, { periodType: "annual" });
  const real2025 = result.filter((r) => !r.is_synthetic && r.year === "2025");
  const focus2025 = real2025.find((r) => r.company_id === "focus");
  assert.equal(focus2025.visits, 420, "focus 2025 visits: 200+220=420");
});

test("aggregatePeriods annual market shares recalculated from sums", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, { periodType: "annual" });
  const real2025 = result.filter((r) => !r.is_synthetic && r.year === "2025");
  const focus = real2025.find((r) => r.company_id === "focus");
  const peer = real2025.find((r) => r.company_id === "peer_a");
  // focus: 210/(210+630)=0.25; peer: 630/840=0.75
  assert.ok(Math.abs(focus.market_share_revenue - 0.25) < 0.0001, "focus share must be 0.25");
  assert.ok(Math.abs(peer.market_share_revenue - 0.75) < 0.0001, "peer share must be 0.75");
  assert.ok(Math.abs(focus.market_share_revenue + peer.market_share_revenue - 1) < 0.0001, "shares must sum to 1");
});

test("aggregatePeriods annual ranks recalculated from aggregated values", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, { periodType: "annual" });
  const real2025 = result.filter((r) => !r.is_synthetic && r.year === "2025");
  const focus = real2025.find((r) => r.company_id === "focus");
  const peer = real2025.find((r) => r.company_id === "peer_a");
  assert.equal(peer.rank_revenue, 1, "peer_a should rank 1 (higher revenue)");
  assert.equal(focus.rank_revenue, 2, "focus should rank 2");
});

test("aggregatePeriods annual produces market_total and market_average synthetic rows", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, { periodType: "annual" });
  // Synthetic rows carry date but not year — filter by date prefix
  const synth2025 = result.filter((r) => r.is_synthetic && String(r.date || "").startsWith("2025"));
  const total = synth2025.find((r) => r.company_id === "market_total");
  const avg = synth2025.find((r) => r.company_id === "market_average");
  assert.ok(total, "market_total must be generated for aggregated period");
  assert.ok(avg, "market_average must be generated for aggregated period");
  assert.equal(total.revenue, 840, "market_total: 210+630=840");
  assert.equal(avg.revenue, 420, "market_average: 840/2=420");
});

test("aggregatePeriods annual synthetic rows excluded from ranks", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, { periodType: "annual" });
  const synth = result.filter((r) => r.is_synthetic && String(r.date || "").startsWith("2025"));
  assert.ok(synth.length > 0, "must have synthetic rows");
  synth.forEach((row) => {
    assert.equal(row.rank_revenue, null, `${row.company_id} must not have rank_revenue`);
  });
});

test("aggregatePeriods range filters dates and aggregates correctly", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, {
    periodType: "range",
    startDate: "2025-01-01",
    endDate: "2025-02-01",
  });
  const real = result.filter((r) => !r.is_synthetic);
  const focus = real.find((r) => r.company_id === "focus");
  const peer = real.find((r) => r.company_id === "peer_a");
  assert.ok(focus, "focus range row must exist");
  // Only 2025 months included: focus 100+110=210, peer 300+330=630
  assert.equal(focus.revenue, 210);
  assert.equal(peer.revenue, 630);
  // 2026 data must be excluded
  assert.equal(real.filter((r) => r.year === "2026").length, 0, "2026 rows excluded from range");
});

test("aggregatePeriods range market shares computed from summed values", () => {
  const result = aggregatePeriods(SPRINT03_ROWS, {
    periodType: "range",
    startDate: "2025-01-01",
    endDate: "2025-02-01",
  });
  const real = result.filter((r) => !r.is_synthetic);
  const focus = real.find((r) => r.company_id === "focus");
  assert.ok(Math.abs(focus.market_share_revenue - 0.25) < 0.0001, "focus range share must be 0.25");
});

test("aggregatePeriods monthly returns rows unchanged", () => {
  const result = aggregatePeriods(SPRINT03_ROWS.slice(0, 2), { periodType: "monthly" });
  assert.equal(result.length, 2);
  assert.equal(result[0].period_type, "monthly");
});

test("aggregatePeriods excludes existing synthetic rows from aggregation input", () => {
  const withSynthetic = [
    ...SPRINT03_ROWS.slice(0, 4),
    { date: "2025-01-01", period_type: "monthly", company_id: "market_total", type: "benchmark", market: "Demo", data_type: "actual", revenue: 9999, visits: 9999, is_synthetic: true },
  ];
  const result = aggregatePeriods(withSynthetic, { periodType: "annual" });
  // market_total is synthetic — filter by company_id + date prefix (no year field on synthetic rows)
  const total2025 = result.find((r) => r.company_id === "market_total" && String(r.date || "").startsWith("2025"));
  // market_total should be regenerated from real companies only (210+630=840), not from pre-existing 9999
  assert.ok(total2025, "market_total must exist");
  assert.equal(total2025.revenue, 840, "synthetic input rows must not pollute aggregation");
});

test("getAvailableYears returns sorted distinct years from actual rows", () => {
  const years = getAvailableYears(SPRINT03_ROWS);
  assert.deepEqual(years, ["2025", "2026"]);
});

test("getAvailableYears excludes forecast rows", () => {
  const rows = [
    ...SPRINT03_ROWS.slice(0, 2),
    { date: "2024-01-01", company_id: "focus", data_type: "forecast", revenue: 50, visits: 100 },
  ];
  const years = getAvailableYears(rows);
  assert.ok(!years.includes("2024"), "forecast year must be excluded");
});

test("getAvailableDateRange returns min and max actual dates", () => {
  const range = getAvailableDateRange(SPRINT03_ROWS);
  assert.equal(range.min_date, "2025-01-01");
  assert.equal(range.max_date, "2026-02-01");
});

test("getLatestCompleteMonth returns most recent month where all companies have data", () => {
  const latest = getLatestCompleteMonth(SPRINT03_ROWS);
  assert.equal(latest, "2026-02-01");
});

test("getLatestCompleteMonth falls back when latest month is incomplete", () => {
  // Remove peer_a from 2026-02-01 so that month is incomplete
  const gapped = SPRINT03_ROWS.filter((r) => !(r.company_id === "peer_a" && r.date === "2026-02-01"));
  const latest = getLatestCompleteMonth(gapped);
  assert.equal(latest, "2026-01-01", "must fall back to last complete month");
});

test("buildCoverageMetadata returns correct month and company counts", () => {
  // Use only Jan-Feb 2025 (consecutive months, no gaps) for the no-missing-months assertion
  const rows = SPRINT03_ROWS.slice(0, 4);
  const meta = buildCoverageMetadata(rows);
  assert.equal(meta.min_date, "2025-01-01");
  assert.equal(meta.max_date, "2025-02-01");
  assert.equal(meta.month_count, 2);
  assert.equal(meta.company_count, 2);
  assert.equal(meta.market_count, 1);
  assert.equal(meta.has_missing_months, false);
  assert.equal(meta.missing_months.length, 0);
});

test("buildCoverageMetadata detects missing months", () => {
  const gapped = SPRINT03_ROWS.filter((r) => !(r.company_id === "peer_a" && r.date === "2026-02-01"));
  const meta = buildCoverageMetadata(gapped);
  assert.equal(meta.has_missing_months, true);
  const missing = meta.missing_months;
  assert.ok(missing.some((m) => m.company_id === "peer_a" && m.month === "2026-02-01"), "gap must be reported");
});

test("buildCoverageMetadata excludes benchmark and forecast rows", () => {
  const rows = [
    ...SPRINT03_ROWS,
    { date: "2024-01-01", company_id: "market_average", type: "benchmark", revenue: 500, visits: 1000 },
    { date: "2027-01-01", company_id: "focus", data_type: "forecast", revenue: 200, visits: 400 },
  ];
  const meta = buildCoverageMetadata(rows);
  assert.equal(meta.min_date, "2025-01-01", "benchmark/forecast rows must not affect min date");
  assert.equal(meta.max_date, "2026-02-01", "forecast rows must not affect max date");
});

test("legacy data.interface payload still loads without modification (Sprint 03 compatibility)", async () => {
  const legacyRows = [
    { date: "2025-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", type: "own", market: "Demo", revenue: 100, visits: 50, data_type: "actual" },
    { date: "2025-01-01", period_type: "annual", company_id: "focus", display_name: "Focus", type: "own", market: "Demo", revenue: 1200, visits: 600, data_type: "actual" },
  ];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, data: { interface: legacyRows } }),
  });
  try {
    const { loadBenchmarkData } = await import("../src/lib/api.js");
    const result = await loadBenchmarkData();
    assert.equal(result.data.interface.length, 2, "legacy interface rows preserved as-is");
    assert.ok(result.data.interface.some((r) => r.period_type === "annual"), "annual rows preserved");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ─── Sprint 04: Forecasting Layer ───────────────────────────────────────────

const FORECAST_ROWS = [
  { date: "2025-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 100, visits: 200 },
  { date: "2025-02-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 110, visits: 220 },
  { date: "2025-03-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 121, visits: 242 },
  { date: "2025-04-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 133, visits: 266 },
  { date: "2025-05-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 146, visits: 292 },
  { date: "2025-06-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "actual", revenue: 161, visits: 322 },
  { date: "2025-01-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 300, visits: 600 },
  { date: "2025-02-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 330, visits: 660 },
  { date: "2025-03-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 363, visits: 726 },
  { date: "2025-04-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 399, visits: 798 },
  { date: "2025-05-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 439, visits: 878 },
  { date: "2025-06-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", data_type: "actual", revenue: 483, visits: 966 },
  // Existing forecast row (should be ignored by prepareTimeseries)
  { date: "2025-07-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", data_type: "forecast", revenue: 180, visits: 360 },
  // Synthetic row (should be ignored by prepareTimeseries)
  { date: "2025-01-01", period_type: "monthly", company_id: "market_average", type: "benchmark", market: "Demo", revenue: 230, visits: 460 },
];

test("prepareTimeseries groups rows by company+market+metric", () => {
  const ts = prepareTimeseries(FORECAST_ROWS, { metrics: ["revenue"] });
  assert.ok(ts.length >= 2, "must have at least 2 series (focus+peer_a revenue)");
  const focusSeries = ts.find((s) => s.company_id === "focus" && s.metric === "revenue");
  assert.ok(focusSeries, "focus revenue series must exist");
  assert.deepEqual(focusSeries.dates.length, 6, "focus must have 6 date points");
  assert.equal(focusSeries.values[0], 100, "first value must be Jan revenue");
  assert.equal(focusSeries.market, "Demo");
});

test("prepareTimeseries ignores forecast rows", () => {
  const ts = prepareTimeseries(FORECAST_ROWS, { metrics: ["revenue"] });
  const focusSeries = ts.find((s) => s.company_id === "focus" && s.metric === "revenue");
  // Jul is a forecast row — must not appear
  assert.ok(!focusSeries.dates.includes("2025-07-01"), "forecast date must not be included");
  assert.equal(focusSeries.dates.length, 6);
});

test("prepareTimeseries ignores synthetic benchmark rows by default", () => {
  const ts = prepareTimeseries(FORECAST_ROWS, { metrics: ["revenue"] });
  const marketAvgSeries = ts.find((s) => s.company_id === "market_average");
  assert.equal(marketAvgSeries, undefined, "market_average must be excluded");
});

test("prepareTimeseries returns sorted dates ascending", () => {
  const shuffled = [...FORECAST_ROWS.slice(0, 12)].sort(() => Math.random() - 0.5);
  const ts = prepareTimeseries(shuffled, { metrics: ["revenue"] });
  const focus = ts.find((s) => s.company_id === "focus" && s.metric === "revenue");
  const dates = focus.dates;
  for (let i = 1; i < dates.length; i++) {
    assert.ok(dates[i] >= dates[i - 1], "dates must be ascending");
  }
});

test("localFallbackProvider returns deterministic forecasts", async () => {
  const series = [
    { id: "focus::Demo::revenue", company_id: "focus", market: "Demo", metric: "revenue", dates: [], values: [100, 110, 121, 133, 146, 161] },
  ];
  const result1 = await localFallbackProvider({ series, horizonMonths: 3 });
  const result2 = await localFallbackProvider({ series, horizonMonths: 3 });
  assert.equal(result1.ok, true);
  assert.deepStrictEqual(result1.forecasts[0].point, result2.forecasts[0].point, "local fallback must be deterministic");
});

test("localFallbackProvider projects positive values forward", async () => {
  const series = [
    { id: "focus::Demo::revenue", company_id: "focus", market: "Demo", metric: "revenue", dates: [], values: [100, 110, 121, 133, 146, 161] },
  ];
  const result = await localFallbackProvider({ series, horizonMonths: 6 });
  assert.equal(result.ok, true);
  const forecast = result.forecasts[0];
  assert.equal(forecast.point.length, 6);
  forecast.point.forEach((v) => assert.ok(v >= 0, "all forecast values must be non-negative"));
});

test("timesfmProvider returns ok=false when endpoint not configured", async () => {
  const series = [{ id: "x", metric: "revenue", values: [100] }];
  // Pass empty apiUrl to simulate no VITE_TIMESFM_API_URL
  const result = await timesfmProvider({ series, horizonMonths: 3 }, { apiUrl: "" });
  assert.equal(result.ok, false);
  assert.ok(result.error, "must include error message");
  assert.equal(result.provider, "timesfm");
});

test("timesfmProvider returns ok=false on network error", async () => {
  const series = [{ id: "x", metric: "revenue", values: [100] }];
  const mockFetch = async () => { throw new Error("network down"); };
  const result = await timesfmProvider({ series, horizonMonths: 3 }, { apiUrl: "http://localhost:9999", fetchFn: mockFetch });
  assert.equal(result.ok, false);
  assert.ok(result.error.includes("network down") || result.error.includes("TimesFM"));
});

test("mapForecastsToRows converts provider output to canonical rows", () => {
  const providerResult = {
    ok: true,
    provider: "local_fallback",
    model: "trailing_growth_fallback",
    forecasts: [
      { id: "focus::Demo::revenue", metric: "revenue", point: [170, 187], quantiles: { "0.1": [160, 175], "0.5": [170, 187], "0.9": [180, 200] } },
      { id: "focus::Demo::visits", metric: "visits", point: [340, 374], quantiles: { "0.1": [320, 350], "0.5": [340, 374], "0.9": [360, 400] } },
    ],
  };
  const timeseriesInput = [
    { id: "focus::Demo::revenue", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", metric: "revenue", dates: ["2025-06-01"], values: [161] },
    { id: "focus::Demo::visits", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", metric: "visits", dates: ["2025-06-01"], values: [322] },
  ];
  const rows = mapForecastsToRows(providerResult, timeseriesInput, {
    horizonMonths: 2,
    scenarios: ["base_case", "conservative"],
  });
  // 2 scenarios × 2 months = 4 rows, all for focus
  assert.equal(rows.length, 4);
  const baseRow = rows.find((r) => r.forecast_scenario === "base_case" && r.forecast_horizon_month === 1);
  assert.ok(baseRow, "base_case month 1 row must exist");
  assert.equal(baseRow.company_id, "focus");
  assert.equal(baseRow.data_type, "forecast");
  assert.equal(baseRow.period_type, "monthly");
  assert.equal(baseRow.date, "2025-07-01", "first forecast month must be July 2025");
});

test("mapForecastsToRows merges revenue and visits into one row per company/month/scenario", () => {
  const providerResult = {
    ok: true,
    provider: "local_fallback",
    model: "trailing_growth_fallback",
    forecasts: [
      { id: "focus::Demo::revenue", metric: "revenue", point: [170], quantiles: { "0.5": [170] } },
      { id: "focus::Demo::visits", metric: "visits", point: [340], quantiles: { "0.5": [340] } },
    ],
  };
  const timeseriesInput = [
    { id: "focus::Demo::revenue", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", metric: "revenue", dates: ["2025-06-01"], values: [161] },
    { id: "focus::Demo::visits", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", metric: "visits", dates: ["2025-06-01"], values: [322] },
  ];
  const rows = mapForecastsToRows(providerResult, timeseriesInput, {
    horizonMonths: 1,
    scenarios: ["base_case"],
  });
  assert.equal(rows.length, 1, "revenue + visits must merge into one row");
  assert.equal(rows[0].revenue, 170);
  assert.equal(rows[0].visits, 340);
});

test("mapForecastsToRows includes required forecast metadata fields", () => {
  const providerResult = {
    ok: true,
    provider: "timesfm",
    model: "timesfm-2.5",
    forecasts: [
      { id: "focus::Demo::revenue", metric: "revenue", point: [170], quantiles: { "0.1": [160], "0.5": [170], "0.9": [180] } },
    ],
  };
  const timeseriesInput = [
    { id: "focus::Demo::revenue", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", metric: "revenue", dates: ["2025-06-01"], values: [161] },
  ];
  const rows = mapForecastsToRows(providerResult, timeseriesInput, {
    horizonMonths: 1,
    scenarios: ["base_case"],
    generatedAt: "2026-06-26T00:00:00.000Z",
  });
  const row = rows[0];
  assert.equal(row.forecast_provider, "timesfm");
  assert.equal(row.forecast_method, "timesfm-2.5");
  assert.equal(row.forecast_scenario, "base_case");
  assert.ok(row.forecast_confidence, "must have forecast_confidence");
  assert.equal(row.forecast_horizon_month, 1);
  assert.equal(row.forecast_generated_at, "2026-06-26T00:00:00.000Z");
  assert.equal(row.is_forecast, true);
});

test("mapForecastsToRows clamps negative forecast values to zero", () => {
  const providerResult = {
    ok: true,
    provider: "local_fallback",
    model: "trailing_growth_fallback",
    forecasts: [
      { id: "focus::Demo::revenue", metric: "revenue", point: [-50], quantiles: { "0.1": [-200], "0.5": [-50], "0.9": [10] } },
    ],
  };
  const timeseriesInput = [
    { id: "focus::Demo::revenue", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", metric: "revenue", dates: ["2025-06-01"], values: [161] },
  ];
  const rows = mapForecastsToRows(providerResult, timeseriesInput, { horizonMonths: 1, scenarios: ["base_case", "conservative"] });
  rows.forEach((r) => {
    assert.ok(r.revenue >= 0, `revenue must be >= 0, got ${r.revenue}`);
  });
});

test("generateForecastRows returns empty array when disabled", async () => {
  const rows = await generateForecastRows(FORECAST_ROWS, { enabled: false });
  assert.equal(rows.length, 0);
});

test("generateForecastRows uses local fallback when TimesFM not configured", async () => {
  const rows = await generateForecastRows(FORECAST_ROWS, {
    provider: "timesfm",
    fallbackProvider: "local_fallback",
    horizonMonths: 3,
    scenarios: ["base_case"],
    minHistoryMonths: 6,
  });
  // 2 companies × 3 months × 1 scenario = 6 rows (TimesFM not configured → falls back)
  assert.ok(rows.length > 0, "must produce forecast rows via local fallback");
  rows.forEach((r) => {
    assert.equal(r.data_type, "forecast");
    assert.ok(r.forecast_provider, "must have forecast_provider");
  });
});

test("generateForecastRows skips companies with insufficient history", async () => {
  const shortRows = FORECAST_ROWS.slice(0, 4); // only Jan+Feb for focus+peer_a (2 months each)
  const rows = await generateForecastRows(shortRows, {
    provider: "local_fallback",
    horizonMonths: 3,
    scenarios: ["base_case"],
    minHistoryMonths: 6, // require 6 months — short rows won't qualify
  });
  assert.equal(rows.length, 0, "short history must not produce forecasts");
});

// --- Sprint 04b: local_engine, confidence, diagnostics, derived forecast metrics ---

test("DEFAULT_FORECAST_CONFIG uses local_engine as default provider", () => {
  assert.equal(DEFAULT_FORECAST_CONFIG.provider, "local_engine");
  assert.equal(DEFAULT_FORECAST_CONFIG.enabled, true);
  assert.equal(DEFAULT_FORECAST_CONFIG.minHistoryMonths, 3);
});

test("benchmarkConfig forecast has local_engine as provider", () => {
  assert.equal(benchmarkConfig.forecast.provider, "local_engine");
  assert.equal(benchmarkConfig.forecast.enabled, true);
  assert.ok(benchmarkConfig.forecast.scenarioOrder.includes("base_case"));
});

test("localEngineProvider returns deterministic forecasts", async () => {
  const series = [
    { id: "focus::Demo::revenue", company_id: "focus", market: "Demo", metric: "revenue", type: "own",
      dates: ["2025-01-01","2025-02-01","2025-03-01","2025-04-01","2025-05-01","2025-06-01"],
      values: [100000, 102000, 104000, 106000, 108000, 110000] },
  ];
  const r1 = await localEngineProvider({ series, horizonMonths: 3 });
  const r2 = await localEngineProvider({ series, horizonMonths: 3 });
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.forecasts[0].point, r2.forecasts[0].point, "point forecast must be deterministic");
});

test("localEngineProvider clamps negative values to zero", async () => {
  const series = [
    { id: "x::Demo::revenue", company_id: "x", market: "Demo", metric: "revenue", type: "own",
      dates: ["2025-01-01","2025-02-01","2025-03-01"],
      values: [100, 50, 10] }, // sharply declining — could go negative
  ];
  const result = await localEngineProvider({ series, horizonMonths: 6 });
  assert.equal(result.ok, true);
  result.forecasts[0].point.forEach((v) => assert.ok(v >= 0, `forecast value must be >= 0, got ${v}`));
  result.forecasts[0].quantiles["0.1"].forEach((v) => assert.ok(v >= 0, `lower bound must be >= 0, got ${v}`));
});

test("localEngineProvider includes diagnostics and confidence in output", async () => {
  const series = [
    { id: "focus::Demo::revenue", company_id: "focus", market: "Demo", metric: "revenue", type: "own",
      dates: ["2025-01-01","2025-02-01","2025-03-01","2025-04-01","2025-05-01","2025-06-01"],
      values: [100000, 102000, 104000, 106000, 108000, 110000] },
  ];
  const result = await localEngineProvider({ series, horizonMonths: 3 });
  const fc = result.forecasts[0];
  assert.ok(fc.forecast_diagnostics, "diagnostics must be present");
  assert.equal(typeof fc.forecast_diagnostics.history_months, "number");
  assert.equal(typeof fc.forecast_diagnostics.volatility, "number");
  assert.equal(typeof fc.forecast_diagnostics.seasonality_used, "boolean");
  assert.equal(fc.forecast_diagnostics.model_family, "local_statistical_ensemble");
  assert.ok(typeof fc.confidence_score === "number", "confidence_score must be number");
  assert.ok(Array.isArray(fc.confidence_reasons), "confidence_reasons must be array");
});

test("localEngineProvider aggressive quantile >= base >= conservative", async () => {
  const series = [
    { id: "focus::Demo::revenue", company_id: "focus", market: "Demo", metric: "revenue", type: "own",
      dates: ["2025-01-01","2025-02-01","2025-03-01","2025-04-01","2025-05-01","2025-06-01"],
      values: [100000, 102000, 104000, 106000, 108000, 110000] },
  ];
  const result = await localEngineProvider({ series, horizonMonths: 3 });
  const fc = result.forecasts[0];
  fc.point.forEach((base, i) => {
    assert.ok(fc.quantiles["0.9"][i] >= base, `aggressive >= base at index ${i}`);
    assert.ok(base >= fc.quantiles["0.1"][i], `base >= conservative at index ${i}`);
  });
});

test("localEngineProvider uses seasonality when 14+ months available", async () => {
  const dates = Array.from({ length: 14 }, (_, i) => {
    const y = 2024 + Math.floor(i / 12);
    const m = (i % 12) + 1;
    return `${y}-${String(m).padStart(2, "0")}-01`;
  });
  const series14m = [
    { id: "focus::Demo::revenue", company_id: "focus", market: "Demo", metric: "revenue", type: "own",
      dates, values: dates.map((_, i) => 100000 + i * 1000) },
  ];
  const result = await localEngineProvider({ series: series14m, horizonMonths: 3 });
  const fc = result.forecasts[0];
  assert.equal(fc.forecast_diagnostics?.seasonality_used, true, "14+ months should enable seasonality");
  assert.ok(fc.forecast_method?.includes("seasonality"), `expected seasonality method, got ${fc.forecast_method}`);
});

test("scoreConfidence returns low for very short history and high for long stable history", () => {
  const low = scoreConfidence({ historyMonths: 3, missingMonthCount: 0, volatility: 0.05, seasonalityAvailable: false, outlierCount: 0 });
  assert.equal(low.forecast_confidence, "low");

  const high = scoreConfidence({ historyMonths: 18, missingMonthCount: 0, volatility: 0.02, seasonalityAvailable: true, outlierCount: 0 });
  assert.equal(high.forecast_confidence, "high");
  assert.ok(high.confidence_score > low.confidence_score);
});

test("extractForecastFeatures returns expected feature shape", () => {
  const values = [100, 110, 121, 133, 146, 161];
  const dates = ["2025-01-01","2025-02-01","2025-03-01","2025-04-01","2025-05-01","2025-06-01"];
  const features = extractForecastFeatures(values, dates);
  assert.equal(features.historyMonths, 6);
  assert.equal(features.latestValue, 161);
  assert.ok(typeof features.trailing3Growth === "number");
  assert.ok(typeof features.volatility === "number");
  assert.equal(features.seasonalityAvailable, false);
  assert.ok(typeof features.outlierCount === "number");
});

test("enrichForecastRows adds market_share and ranks per scenario group", () => {
  const forecastRows = [
    { date: "2025-07-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", revenue: 110000, visits: 55000, data_type: "forecast", forecast_scenario: "base_case" },
    { date: "2025-07-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", revenue: 210000, visits: 105000, data_type: "forecast", forecast_scenario: "base_case" },
  ];
  const enriched = enrichForecastRows(forecastRows);
  const real = enriched.filter((r) => !r.is_synthetic);
  const focus = real.find((r) => r.company_id === "focus");
  const peer = real.find((r) => r.company_id === "peer_a");
  assert.ok(focus.market_share_revenue !== null, "focus must have market_share_revenue");
  assert.ok(Math.abs(focus.market_share_revenue - (110000 / 320000)) < 0.001);
  assert.ok(focus.rank_revenue !== null, "focus must have rank_revenue");
  assert.equal(peer.rank_revenue, 1);
  assert.equal(focus.rank_revenue, 2);
});

test("enrichForecastRows generates synthetic market_total and market_average for forecast groups", () => {
  const forecastRows = [
    { date: "2025-07-01", period_type: "monthly", company_id: "focus", display_name: "Focus", market: "Demo", type: "own", revenue: 110000, visits: 55000, data_type: "forecast", forecast_scenario: "base_case" },
    { date: "2025-07-01", period_type: "monthly", company_id: "peer_a", display_name: "Peer A", market: "Demo", type: "competitor", revenue: 210000, visits: 105000, data_type: "forecast", forecast_scenario: "base_case" },
  ];
  const enriched = enrichForecastRows(forecastRows);
  const synth = enriched.filter((r) => r.is_synthetic);
  assert.ok(synth.length >= 2, "must have synthetic rows");
  const total = synth.find((r) => r.company_id === "market_total");
  const avg = synth.find((r) => r.company_id === "market_average");
  assert.ok(total, "market_total must exist");
  assert.ok(avg, "market_average must exist");
  assert.equal(total.revenue, 320000);
  assert.equal(avg.revenue, 160000);
});

test("generateForecastRows with local_engine produces enrichable rows", async () => {
  const rows = await generateForecastRows(FORECAST_ROWS, { provider: "local_engine", horizonMonths: 3, scenarios: ["base_case"] });
  assert.ok(rows.length > 0, "local_engine must produce forecast rows");
  rows.forEach((r) => {
    assert.equal(r.data_type, "forecast");
    assert.equal(r.forecast_provider, "local_engine");
    assert.ok(typeof r.revenue === "number");
    assert.ok(typeof r.visits === "number");
    assert.ok(r.revenue >= 0);
    assert.ok(r.visits >= 0);
  });
});

test("TimesFM is optional — local_engine works without VITE_TIMESFM_API_URL", async () => {
  const rows = await generateForecastRows(FORECAST_ROWS, { provider: "local_engine", horizonMonths: 2, scenarios: ["base_case"] });
  assert.ok(rows.length > 0, "local_engine produces rows without any API key");
  rows.forEach((r) => assert.equal(r.forecast_provider, "local_engine"));
});

test("raw demo data (example-benchmark-data.json) does not require market_average row", () => {
  const json = JSON.parse(fs.readFileSync("public/data/example-benchmark-data.json", "utf8"));
  const sourceMonthly = json?.data?.source_monthly;
  assert.ok(Array.isArray(sourceMonthly), "example data must use source_monthly format");
  const hasMarketAvg = sourceMonthly.some((r) => r.company_id === "market_average");
  assert.equal(hasMarketAvg, false, "source_monthly must not contain market_average row");
});

test("backtestForecast returns MAE, MAPE, RMSE, bias, and quality label", async () => {
  const rows9m = Array.from({ length: 9 }, (_, i) => ({
    date: `2024-${String(i + 1).padStart(2, "0")}-01`,
    company_id: "focus", display_name: "Focus", market: "Demo", type: "own",
    revenue: 100000 + i * 2000, visits: 50000 + i * 1000,
  }));
  const results = await backtestForecast(rows9m, { horizonMonths: 3, minHistoryMonths: 6, metric: "revenue" });
  assert.ok(results.length > 0, "backtest must return results");
  const r = results[0];
  assert.equal(r.company_id, "focus");
  assert.equal(r.metric, "revenue");
  assert.equal(r.horizon_months, 3);
  assert.equal(typeof r.mae, "number");
  assert.equal(typeof r.mape, "number");
  assert.equal(typeof r.rmse, "number");
  assert.equal(typeof r.bias, "number");
  assert.ok(["excellent", "good", "usable", "weak"].includes(r.quality), `unexpected quality: ${r.quality}`);
});

test("backtestForecast is deterministic", async () => {
  const rows9m = Array.from({ length: 9 }, (_, i) => ({
    date: `2024-${String(i + 1).padStart(2, "0")}-01`,
    company_id: "focus", display_name: "Focus", market: "Demo", type: "own",
    revenue: 100000 + i * 1500, visits: 50000 + i * 800,
  }));
  const [r1, r2] = await Promise.all([
    backtestForecast(rows9m, { horizonMonths: 3, minHistoryMonths: 6, metric: "revenue" }),
    backtestForecast(rows9m, { horizonMonths: 3, minHistoryMonths: 6, metric: "revenue" }),
  ]);
  assert.deepEqual(r1, r2, "backtest must be deterministic");
});

// --- Sprint 05: canonical pipeline, demo data migration, App decomposition ---

import { parseRouteFromHash } from "../src/app/routes.js";
import {
  getBattleRelativeDiff,
  getBattleStrengthShare,
  buildBattleRound,
  buildHistoricalBattleRounds,
  getBattleScore,
  getRoundWinner,
  buildHistoricalBattleInsight,
  formatBattleMetricValue,
  getBattleOptionLabel,
} from "../src/features/battle/battleLogic.js";
import {
  FORECAST_MERGE_FIELDS,
  getForecastMergeKey,
  mergeForecastMetricRows,
  preferObservedRows,
  getForecastWindow,
} from "../src/features/forecast/forecastUtils.js";

// --- Canonical builder ---

// 6 months of data — enough for the forecast engine (minHistoryMonths: 3)
const CANONICAL_SOURCE_ROWS = [
  { date: "2025-01-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 120000, visits: 80000 },
  { date: "2025-01-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 200000, visits: 140000 },
  { date: "2025-02-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 125000, visits: 82000 },
  { date: "2025-02-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 210000, visits: 145000 },
  { date: "2025-03-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 128000, visits: 84000 },
  { date: "2025-03-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 215000, visits: 148000 },
  { date: "2025-04-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 132000, visits: 86000 },
  { date: "2025-04-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 220000, visits: 152000 },
  { date: "2025-05-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 135000, visits: 88000 },
  { date: "2025-05-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 225000, visits: 155000 },
  { date: "2025-06-01", company_id: "focus", display_name: "Focus Brand", market: "Demo", type: "own", revenue: 138000, visits: 90000 },
  { date: "2025-06-01", company_id: "peer_a", display_name: "Peer Alpha", market: "Demo", type: "competitor", revenue: 230000, visits: 158000 },
];

test("buildCanonicalBenchmarkPayload accepts source_monthly and generates interface rows", async () => {
  const input = { ok: true, meta: { dataset_name: "Test" }, data: { source_monthly: CANONICAL_SOURCE_ROWS } };
  const result = await buildCanonicalBenchmarkPayload(input);
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.data.interface), "must have interface array");
  assert.ok(result.data.interface.length > 0, "must have interface rows");
  const actual = result.data.interface.filter(r => r.data_type === "actual" && r.type !== "benchmark");
  assert.ok(actual.length >= 4, "must have at least 4 actual rows");
});

test("buildCanonicalBenchmarkPayload generates actual derived metrics", async () => {
  const input = { ok: true, data: { source_monthly: CANONICAL_SOURCE_ROWS } };
  const result = await buildCanonicalBenchmarkPayload(input);
  const jan = result.data.interface.find(r => r.company_id === "focus" && r.date === "2025-01-01" && r.data_type === "actual");
  assert.ok(jan, "focus Jan row must exist");
  assert.ok(typeof jan.market_share_revenue === "number", "must have market_share_revenue");
  assert.ok(typeof jan.rank_revenue === "number", "must have rank_revenue");
});

test("buildCanonicalBenchmarkPayload generates forecast rows", async () => {
  const input = { ok: true, data: { source_monthly: CANONICAL_SOURCE_ROWS } };
  const result = await buildCanonicalBenchmarkPayload(input);
  const forecasts = result.data.interface.filter(r => r.data_type === "forecast");
  assert.ok(forecasts.length > 0, "must generate forecast rows");
  const forecastWithShare = forecasts.find(r => typeof r.market_share_revenue === "number");
  assert.ok(forecastWithShare, "forecast rows must have market_share_revenue");
});

test("buildCanonicalBenchmarkPayload forecast rows receive rank_revenue", async () => {
  const input = { ok: true, data: { source_monthly: CANONICAL_SOURCE_ROWS } };
  const result = await buildCanonicalBenchmarkPayload(input);
  const realForecasts = result.data.interface.filter(r => r.data_type === "forecast" && r.type !== "benchmark");
  assert.ok(realForecasts.length > 0, "must have real company forecast rows");
  realForecasts.forEach(r => {
    assert.ok(typeof r.rank_revenue === "number" || r.rank_revenue === null, `rank_revenue must be number or null on ${r.company_id}`);
  });
});

test("buildCanonicalBenchmarkPayload includes coverage metadata", async () => {
  const input = { ok: true, data: { source_monthly: CANONICAL_SOURCE_ROWS } };
  const result = await buildCanonicalBenchmarkPayload(input);
  assert.ok(result.meta.coverage, "must include coverage metadata");
  assert.equal(result.meta.coverage.company_count, 2);
  assert.ok(result.meta.coverage.month_count >= 6, "must have 6 months of coverage");
});

test("buildCanonicalBenchmarkPayload accepts legacy data.interface", async () => {
  const legacyRows = [
    { date: "2025-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", type: "own", market: "Demo", revenue: 100000, visits: 50000, data_type: "actual" },
  ];
  const input = { ok: true, data: { interface: legacyRows } };
  const result = await buildCanonicalBenchmarkPayload(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.interface, legacyRows, "legacy rows must be preserved");
});

test("buildCanonicalBenchmarkPayload throws for missing source", async () => {
  await assert.rejects(
    () => buildCanonicalBenchmarkPayload({ ok: true, data: {} }),
    /must include/,
  );
});

test("buildCanonicalBenchmarkPayload passthrough events from source_monthly payload", async () => {
  const events = [{ date: "2025-01-01", event_name: "test event" }];
  const input = { ok: true, data: { source_monthly: CANONICAL_SOURCE_ROWS, events } };
  const result = await buildCanonicalBenchmarkPayload(input);
  assert.deepEqual(result.data.events, events, "events must pass through");
});

test("api loader delegates to canonical builder for source_monthly", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      data: { source_monthly: CANONICAL_SOURCE_ROWS },
    }),
  });

  try {
    const result = await loadBenchmarkData();
    assert.equal(result.meta.data_source.type, DATA_SOURCE_TYPES.LOCAL_SNAPSHOT);
    assert.ok(Array.isArray(result.data.interface), "must have interface from pipeline");
    assert.ok(result.data.interface.length > 0, "must have interface rows");
    assert.equal(result.meta.source_type, "raw_monthly_observations", "meta must indicate raw source");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api loader still works with legacy data.interface", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      data: { interface: [
        { date: "2025-01-01", period_type: "monthly", company_id: "focus", display_name: "Focus", type: "own", market: "Demo", revenue: 100000, visits: 50000, data_type: "actual" },
      ]},
    }),
  });

  try {
    const result = await loadBenchmarkData();
    assert.ok(Array.isArray(result.data.interface));
    assert.ok(result.data.interface.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- Demo data format ---

test("benchmark-data.json uses source_monthly format", () => {
  assert.ok(Array.isArray(payload.data?.source_monthly), "must use data.source_monthly");
  assert.equal(payload.data?.interface, undefined, "must not have data.interface at top level");
  assert.equal(payload.data.source_monthly.length, 144, "demo data must contain 144 raw monthly rows");
});

test("benchmark-data.json has no forecast rows in source_monthly", () => {
  const rows = payload.data.source_monthly;
  const forecast = rows.filter(r => r.data_type === "forecast" || r.is_forecast);
  assert.equal(forecast.length, 0, "source_monthly must not contain forecast rows");
});

test("benchmark-data.json has no market_average rows in source_monthly", () => {
  const rows = payload.data.source_monthly;
  const synthetic = rows.filter(r => r.company_id === "market_average" || r.company_id === "market_total");
  assert.equal(synthetic.length, 0, "source_monthly must not contain synthetic benchmark rows");
});

test("benchmark-data.json has no pre-computed derived fields", () => {
  const rows = payload.data.source_monthly;
  const derivedFields = ["market_share_revenue", "market_share_visits", "rank_revenue", "indexed_revenue", "revenue_yoy_growth"];
  derivedFields.forEach(field => {
    const hasField = rows.some(r => r[field] !== undefined);
    assert.equal(hasField, false, `source_monthly must not contain derived field: ${field}`);
  });
});

test("benchmark-data.json source_monthly passes framework validation", () => {
  const result = validateSourceMonthlyRows(payload.data.source_monthly);
  assert.equal(result.ok, true, result.errors.slice(0, 5).join("\n"));
  assert.ok(result.summary.companyCount >= 8);
});

// --- Route parsing module ---

test("parseRouteFromHash returns home for empty hash", () => {
  assert.deepEqual(parseRouteFromHash(""), { view: "home", companyId: "" });
  assert.deepEqual(parseRouteFromHash("#/"), { view: "home", companyId: "" });
  assert.deepEqual(parseRouteFromHash("#/benchmark"), { view: "home", companyId: "" });
});

test("parseRouteFromHash returns forecast view", () => {
  assert.deepEqual(parseRouteFromHash("#/forecast"), { view: "forecast", companyId: "" });
});

test("parseRouteFromHash returns battle view", () => {
  assert.deepEqual(parseRouteFromHash("#/battle-arena"), { view: "battle", companyId: "" });
});

test("parseRouteFromHash returns profile view with company ID", () => {
  const result = parseRouteFromHash("#/company/peer_a");
  assert.equal(result.view, "profile");
  assert.equal(result.companyId, "peer_a");
});

test("parseRouteFromHash decodes URI-encoded company IDs", () => {
  const result = parseRouteFromHash("#/company/peer%20a");
  assert.equal(result.view, "profile");
  assert.equal(result.companyId, "peer a");
});

test("parseRouteFromHash preserves legacy empresa profile deep links", () => {
  const result = parseRouteFromHash("#/empresa/peer_a");
  assert.equal(result.view, "profile");
  assert.equal(result.companyId, "peer_a");
});

// --- Battle logic module ---

test("getBattleRelativeDiff returns relative gap", () => {
  assert.equal(getBattleRelativeDiff(100, 100), 0);
  assert.ok(Math.abs(getBattleRelativeDiff(100, 50) - 0.5) < 0.001);
  assert.equal(getBattleRelativeDiff(null, 100), null);
});

test("getBattleStrengthShare returns value between 6 and 94", () => {
  const share = getBattleStrengthShare(100, 300);
  assert.ok(share >= 6 && share <= 94);
  assert.equal(getBattleStrengthShare(null, 100), 50);
});

test("buildBattleRound returns unavailable when data missing", () => {
  const round = buildBattleRound({ key: "revenue", label: "Revenue", aValue: null, bValue: 100, aLabel: "A", bLabel: "B" });
  assert.equal(round.available, false);
  assert.ok(round.message, "unavailable round must have message");
});

test("buildBattleRound returns correct winner", () => {
  const round = buildBattleRound({ key: "revenue", label: "Revenue", aValue: 200, bValue: 100, aLabel: "A", bLabel: "B" });
  assert.equal(round.available, true);
  assert.equal(round.winner, "a");
});

test("getBattleScore counts wins, draws, losses correctly", () => {
  const rounds = [
    { available: true, winner: "a" },
    { available: true, winner: "b" },
    { available: true, winner: "draw" },
    { available: false },
  ];
  const score = getBattleScore(rounds);
  assert.equal(score.a, 1);
  assert.equal(score.b, 1);
  assert.equal(score.draw, 1);
});

test("getRoundWinner finds round by key", () => {
  const rounds = [
    { key: "revenue", available: true, winner: "a" },
    { key: "visits", available: false },
  ];
  assert.equal(getRoundWinner(rounds, "revenue")?.winner, "a");
  assert.equal(getRoundWinner(rounds, "visits"), null);
});

test("formatBattleMetricValue formats revenue values", () => {
  const result = formatBattleMetricValue(50000, "revenue");
  assert.equal(typeof result, "string");
  assert.ok(result.length > 0);
});

test("getBattleOptionLabel returns option label", () => {
  assert.equal(getBattleOptionLabel({ label: "Apex" }), "Apex");
  assert.equal(getBattleOptionLabel({ id: "peer_a" }), "peer_a");
  assert.equal(getBattleOptionLabel({}), "Empresa");
});

// --- Forecast utils module ---

test("FORECAST_MERGE_FIELDS contains expected metrics", () => {
  assert.ok(FORECAST_MERGE_FIELDS.includes("revenue"));
  assert.ok(FORECAST_MERGE_FIELDS.includes("market_share_revenue"));
  assert.ok(FORECAST_MERGE_FIELDS.includes("rank_revenue"));
});

test("preferObservedRows deduplicates in favour of observed", () => {
  const rows = [
    { date: "2025-01-01", period_type: "monthly", market: "Demo", company_id: "focus", data_type: "actual" },
    { date: "2025-01-01", period_type: "monthly", market: "Demo", company_id: "focus", data_type: "forecast" },
  ];
  const result = preferObservedRows(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].data_type, "actual");
});

test("getForecastWindow returns start and end of forecast zone", () => {
  const data = [
    { date: "2025-01-01", has_forecast: false },
    { date: "2025-07-01", has_forecast: true },
    { date: "2025-08-01", has_forecast: true },
  ];
  const window = getForecastWindow(data);
  assert.equal(window.start.date, "2025-07-01");
  assert.equal(window.end.date, "2025-08-01");
});

test("getForecastWindow returns null when no forecast points", () => {
  const data = [{ date: "2025-01-01", has_forecast: false }];
  assert.equal(getForecastWindow(data), null);
});

test("mergeForecastMetricRows merges two partial forecast rows into one", () => {
  const rows = [
    { date: "2025-07-01", period_type: "monthly", market: "Demo", company_id: "focus", data_type: "forecast", forecast_scenario: "base_case", revenue: 130000 },
    { date: "2025-07-01", period_type: "monthly", market: "Demo", company_id: "focus", data_type: "forecast", forecast_scenario: "base_case", visits: 90000 },
  ];
  const merged = mergeForecastMetricRows(rows);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].revenue, 130000);
  assert.equal(merged[0].visits, 90000);
});
