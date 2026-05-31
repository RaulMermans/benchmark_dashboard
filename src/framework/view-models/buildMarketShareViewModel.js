import { isBenchmarkRow, safeNumber } from "../core/helpers.js";

export function buildMarketShareViewModel(rows = [], config = {}) {
  const shareMetric = config.shareMetric || (config.defaultMetric === "visits" ? "market_share_visits" : "market_share_revenue");
  return rows
    .filter((row) => !isBenchmarkRow(row, config) && safeNumber(row[shareMetric]) !== null)
    .sort((a, b) => safeNumber(b[shareMetric]) - safeNumber(a[shareMetric]))
    .map((row) => ({
      companyId: row.company_id,
      label: row.display_name,
      share: safeNumber(row[shareMetric]),
      color: row.color,
      row,
    }));
}
