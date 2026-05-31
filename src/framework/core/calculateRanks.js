import { groupBy, isBenchmarkRow, safeNumber } from "./helpers.js";

export function calculateRanks(rows = [], metric = "revenue", options = {}) {
  const rankField = metric === "visits" ? "rank_visits" : "rank_revenue";
  const includeBenchmark = options.includeBenchmarkInRanks === true;
  const groups = groupBy(rows, (row) => [row.date, row.market, row.data_type, row.forecast_scenario || ""].join("|"));
  const rankMap = new Map();

  groups.forEach((group) => {
    const ranked = group
      .filter((row) => (includeBenchmark || !isBenchmarkRow(row, options)) && safeNumber(row[metric]) !== null)
      .sort((a, b) => safeNumber(b[metric]) - safeNumber(a[metric]));
    ranked.forEach((row, index) => rankMap.set(row, index + 1));
  });

  return rows.map((row) => ({ ...row, [rankField]: rankMap.get(row) ?? row[rankField] ?? null }));
}
