import { safeNumber } from "./helpers.js";

export function calculateEfficiencyMetrics(rows = []) {
  return rows.map((row) => {
    const revenue = safeNumber(row.revenue);
    const visits = safeNumber(row.visits);
    const revenuePerVisit = revenue !== null && visits ? revenue / visits : row.revenue_per_visit;
    const revenueShare = safeNumber(row.market_share_revenue);
    const visitShare = safeNumber(row.market_share_visits);
    const gap = revenueShare !== null && visitShare !== null ? revenueShare - visitShare : row.revenue_share_vs_visit_share;
    return {
      ...row,
      revenue_per_visit: revenuePerVisit === undefined ? null : revenuePerVisit,
      revenue_share_vs_visit_share: gap === undefined ? null : gap,
      monetization_gap: gap === undefined ? null : gap,
      has_efficiency: revenuePerVisit !== null && revenuePerVisit !== undefined,
    };
  });
}
