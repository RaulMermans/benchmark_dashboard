import { isForecastRow, safeNumber } from "../core/helpers.js";

export function buildForecastViewModel(rows = [], config = {}) {
  const metric = config.metric || config.defaultMetric || "revenue";
  return rows
    .filter((row) => isForecastRow(row))
    .map((row) => ({
      companyId: row.company_id,
      label: row.display_name,
      date: row.date,
      scenario: row.forecast_scenario || "base_case",
      value: safeNumber(row[metric]),
      color: row.color,
      row,
    }))
    .filter((entry) => entry.value !== null);
}
