import { roundMetric, safeNumber, shouldWriteDerived } from "./benchmarkUtils.js";

export function calculateEfficiencyMetrics(rows = [], options = {}) {
  const preserveExisting = options.preserveExisting ?? true;

  return rows.map((row) => {
    const nextRow = { ...row };
    const revenue = safeNumber(nextRow.revenue);
    const visits = safeNumber(nextRow.visits);
    const revenueShare = safeNumber(nextRow.market_share_revenue);
    const visitsShare = safeNumber(nextRow.market_share_visits);

    if (shouldWriteDerived(nextRow, "revenue_per_visit", preserveExisting)) {
      nextRow.revenue_per_visit = visits && revenue !== null ? roundMetric(revenue / visits, 4) : null;
    }

    if (shouldWriteDerived(nextRow, "revenue_share_vs_visit_share", preserveExisting)) {
      nextRow.revenue_share_vs_visit_share =
        revenueShare !== null && visitsShare !== null ? roundMetric(revenueShare - visitsShare) : null;
    }

    return nextRow;
  });
}
