import { isBenchmarkRow, safeNumber } from "../core/helpers.js";

export function buildRankingViewModel(rows = [], config = {}) {
  const metric = config.metric || config.defaultMetric || "revenue";
  return rows
    .filter((row) => !isBenchmarkRow(row, config) && safeNumber(row[metric]) !== null)
    .sort((a, b) => safeNumber(b[metric]) - safeNumber(a[metric]))
    .map((row, index) => ({
      rank: index + 1,
      companyId: row.company_id,
      label: row.display_name,
      value: safeNumber(row[metric]),
      share: safeNumber(metric === "visits" ? row.market_share_visits : row.market_share_revenue),
      color: row.color,
      row,
    }));
}
