import { getSortValue, isForecastRow, safeNumber } from "../core/benchmarkUtils.js";

export function buildGrowthViewModel(rows = [], config = {}, options = {}) {
  const metric = options.metric || "revenue_yoy_growth";
  const includeForecasts = options.includeForecasts ?? false;
  const points = rows
    .filter((row) => includeForecasts || !isForecastRow(row))
    .map((row) => ({
      company_id: row.company_id,
      display_name: row.display_name || row.company_name || row.company_id,
      date: row.date,
      label: row.period_label || row.date,
      value: safeNumber(row?.[metric]),
      sortValue: getSortValue(row),
    }))
    .filter((point) => point.value !== null)
    .sort((a, b) => a.sortValue - b.sortValue);

  return { metric, points };
}
