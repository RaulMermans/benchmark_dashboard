import { isBenchmarkRow, safeNumber } from "../core/helpers.js";

export function buildGrowthViewModel(rows = [], config = {}) {
  const metric = config.growthMetric || (config.defaultMetric === "visits" ? "visits_yoy_growth" : "revenue_yoy_growth");
  return rows
    .filter((row) => !isBenchmarkRow(row, config))
    .map((row) => ({
      companyId: row.company_id,
      label: row.display_name,
      date: row.date,
      value: safeNumber(row[metric]),
      color: row.color,
      row,
    }))
    .filter((entry) => entry.value !== null);
}
