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
