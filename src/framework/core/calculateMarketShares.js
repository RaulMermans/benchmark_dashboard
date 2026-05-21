import { getPeriodKey, groupRows, roundMetric, safeNumber, shouldWriteDerived } from "./benchmarkUtils.js";

const SHARE_FIELD_BY_METRIC = {
  revenue: "market_share_revenue",
  visits: "market_share_visits",
};

export function calculateMarketShares(rows = [], metric = "revenue", options = {}) {
  const shareField = SHARE_FIELD_BY_METRIC[metric] || `market_share_${metric}`;
  const preserveExisting = options.preserveExisting ?? true;
  const nextRows = rows.map((row) => ({ ...row }));
  const groups = groupRows(nextRows, getPeriodKey);

  groups.forEach((groupRowsForPeriod) => {
    const total = groupRowsForPeriod.reduce((sum, row) => sum + (safeNumber(row?.[metric]) ?? 0), 0);

    groupRowsForPeriod.forEach((row) => {
      if (!shouldWriteDerived(row, shareField, preserveExisting)) return;
      const value = safeNumber(row?.[metric]);
      row[shareField] = total > 0 && value !== null ? roundMetric(value / total) : null;
    });
  });

  return nextRows;
}
