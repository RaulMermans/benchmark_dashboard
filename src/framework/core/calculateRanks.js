import { groupBy, isBenchmarkRow, safeNumber } from "./helpers.js";

const RANK_FIELD_MAP = {
  revenue: "rank_revenue",
  visits: "rank_visits",
  market_share_revenue: "rank_share_revenue",
  market_share_visits: "rank_share_visits",
};

export function calculateRanks(rows = [], metric = "revenue", options = {}) {
  const rankField = RANK_FIELD_MAP[metric] || `rank_${metric}`;
  const includeBenchmark = options.includeBenchmarkInRanks === true;
  const groups = groupBy(rows, (row) => [row.date, row.market, row.data_type, row.forecast_scenario || ""].join("|"));
  const rankMap = new Map();

  groups.forEach((group) => {
    const ranked = group
      .filter((row) => (includeBenchmark || !isBenchmarkRow(row, options)) && safeNumber(row[metric]) !== null)
      .sort((a, b) => {
        const diff = safeNumber(b[metric]) - safeNumber(a[metric]);
        return diff !== 0 ? diff : String(a.company_id).localeCompare(String(b.company_id));
      });
    ranked.forEach((row, index) => rankMap.set(row, index + 1));
  });

  return rows.map((row) => ({ ...row, [rankField]: rankMap.get(row) ?? row[rankField] ?? null }));
}
