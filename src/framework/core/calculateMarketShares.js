import { groupBy, isBenchmarkRow, safeNumber } from "./helpers.js";

export function calculateMarketShares(rows = [], metric = "revenue", options = {}) {
  const shareField = metric === "visits" ? "market_share_visits" : "market_share_revenue";
  const includeBenchmark = options.includeBenchmarkInShareTotal === true;
  const groups = groupBy(rows, (row) => [row.date, row.market, row.data_type, row.forecast_scenario || ""].join("|"));
  const totals = new Map();

  groups.forEach((group, key) => {
    const denominatorRows = group.filter((row) => includeBenchmark || !isBenchmarkRow(row, options));
    const total = denominatorRows.reduce((sum, row) => sum + (safeNumber(row[metric]) || 0), 0);
    totals.set(key, total);
  });

  return rows.map((row) => {
    const key = [row.date, row.market, row.data_type, row.forecast_scenario || ""].join("|");
    const total = totals.get(key) || 0;
    const value = safeNumber(row[metric]);
    const isBenchmark = isBenchmarkRow(row, options);
    return {
      ...row,
      [shareField]: total && value !== null && (includeBenchmark || !isBenchmark) ? value / total : row[shareField] ?? null,
    };
  });
}
