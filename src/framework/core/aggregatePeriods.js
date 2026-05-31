import { isBenchmarkRow, isForecastRow, safeNumber } from "./helpers.js";

export function aggregatePeriods(rows = [], periodMode = "monthly", options = {}) {
  if (periodMode === "monthly") return rows.map((row) => ({ ...row }));
  const includeForecasts = options.includeForecasts === true;
  const sourceRows = rows.filter((row) => includeForecasts || !isForecastRow(row));
  const groups = new Map();
  sourceRows.forEach((row) => {
    const year = String(row.year || row.date?.slice(0, 4) || "");
    const key = [year, row.company_id, row.market, row.type].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].map((group) => {
    const first = group[0];
    const revenue = group.reduce((sum, row) => sum + (safeNumber(row.revenue) || 0), 0);
    const visits = group.reduce((sum, row) => sum + (safeNumber(row.visits) || 0), 0);
    return {
      ...first,
      date: `${String(first.year || first.date.slice(0, 4))}-01-01`,
      period_type: "annual",
      period_label: `Año ${String(first.year || first.date.slice(0, 4))}`,
      revenue,
      visits,
      revenue_per_visit: visits ? revenue / visits : null,
      aggregate_source: "framework_annual_aggregation",
      is_benchmark: isBenchmarkRow(first, options),
    };
  });
}
