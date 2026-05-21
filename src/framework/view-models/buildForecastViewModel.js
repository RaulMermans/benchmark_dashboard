import { getSortValue, isForecastRow, normalizeText, safeNumber } from "../core/benchmarkUtils.js";

export function buildForecastViewModel(rows = [], config = {}, options = {}) {
  const scenario = normalizeText(options.scenario || "");
  const forecastRows = rows
    .filter(isForecastRow)
    .filter((row) => !scenario || normalizeText(row.forecast_scenario) === scenario)
    .sort((a, b) => getSortValue(a) - getSortValue(b));

  const scenarios = Array.from(
    new Set(forecastRows.map((row) => normalizeText(row.forecast_scenario)).filter(Boolean)),
  ).sort();

  return {
    scenarios,
    rows: forecastRows,
    latestRows: forecastRows
      .slice()
      .reverse()
      .filter((row, index, source) => source.findIndex((candidate) => candidate.company_id === row.company_id) === index),
    metrics: ["visits", "revenue"].map((metric) => ({
      metric,
      total: forecastRows.reduce((sum, row) => sum + (safeNumber(row?.[metric]) ?? 0), 0),
    })),
  };
}
