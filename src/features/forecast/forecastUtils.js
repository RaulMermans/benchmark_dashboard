import { safeNumber } from "../../lib/formatters.js";
import { isForecastRow, getForecastScenario } from "../../lib/data.js";

function normalizeCompanyId(companyId) {
  return String(companyId ?? "")
    .trim()
    .toLowerCase();
}

function getRowSortValue(row) {
  return Date.parse(String(row?.date || "")) || 0;
}

export const FORECAST_MERGE_FIELDS = [
  "revenue",
  "visits",
  "market_share_revenue",
  "market_share_visits",
  "revenue_per_visit",
  "monetization_gap",
  "rank_revenue",
  "rank_visits",
  "rank_share_revenue",
  "rank_share_visits",
];

export function getComparableRowKey(row) {
  return [
    row.period_type,
    row.market,
    row.company_id,
    row.date || row.period_label || `${row.year || ""}-${row.month || ""}`,
  ].join("||");
}

export function preferObservedRows(rows = []) {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const key = getComparableRowKey(row);
    const current = groupedRows.get(key) ?? [];
    current.push(row);
    groupedRows.set(key, current);
  });

  return Array.from(groupedRows.values()).flatMap((group) => {
    const observedRows = group.filter((row) => !isForecastRow(row));
    return observedRows.length ? observedRows : group;
  });
}

export function getForecastWindow(chartData = []) {
  const forecastPoints = chartData.filter((point) => point.has_forecast);
  if (!forecastPoints.length) return null;

  return {
    start: forecastPoints[0],
    end: forecastPoints[forecastPoints.length - 1],
  };
}

export function getForecastMergeKey(row = {}) {
  return [
    row.period_type,
    row.market,
    normalizeCompanyId(row.company_id),
    row.date || `${row.year || ""}-${row.month || ""}`,
    getForecastScenario(row),
  ].join("||");
}

export function mergeForecastMetricRows(rows = []) {
  const rowMap = new Map();

  rows.forEach((row) => {
    const key = getForecastMergeKey(row);
    const current = rowMap.get(key);
    if (!current) {
      rowMap.set(key, { ...row, forecast_scenario: getForecastScenario(row) });
      return;
    }

    const merged = { ...current };
    FORECAST_MERGE_FIELDS.forEach((field) => {
      if (safeNumber(merged?.[field]) === null && safeNumber(row?.[field]) !== null) {
        merged[field] = row[field];
      }
    });
    rowMap.set(key, merged);
  });

  return Array.from(rowMap.values()).sort((a, b) => getRowSortValue(a) - getRowSortValue(b));
}
