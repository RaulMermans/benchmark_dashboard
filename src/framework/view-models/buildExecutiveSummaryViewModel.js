import { isBenchmarkRow, safeNumber } from "../core/helpers.js";

export function buildExecutiveSummaryViewModel(rows = [], config = {}) {
  const competitors = rows.filter((row) => !isBenchmarkRow(row, config));
  const totalRevenue = competitors.reduce((sum, row) => sum + (safeNumber(row.revenue) || 0), 0);
  const totalVisits = competitors.reduce((sum, row) => sum + (safeNumber(row.visits) || 0), 0);
  const focus = rows.find((row) => row.company_id === config.focusCompanyId);
  const leader = [...competitors].sort((a, b) => (safeNumber(b.revenue) || 0) - (safeNumber(a.revenue) || 0))[0] || null;
  return {
    totalRevenue,
    totalVisits,
    companyCount: new Set(competitors.map((row) => row.company_id)).size,
    focus,
    leader,
  };
}
