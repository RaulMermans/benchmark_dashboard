import { safeNumber } from "../core/helpers.js";

export function buildProfileViewModel(rows = [], config = {}) {
  const byCompany = new Map();
  rows.forEach((row) => {
    if (!byCompany.has(row.company_id)) {
      byCompany.set(row.company_id, {
        companyId: row.company_id,
        label: row.display_name,
        type: row.type,
        latest: row,
        revenue: 0,
        visits: 0,
        rows: [],
      });
    }
    const profile = byCompany.get(row.company_id);
    profile.rows.push(row);
    profile.revenue += safeNumber(row.revenue) || 0;
    profile.visits += safeNumber(row.visits) || 0;
    if (String(row.date || "") > String(profile.latest?.date || "")) profile.latest = row;
  });
  return [...byCompany.values()].map((profile) => ({
    ...profile,
    revenuePerVisit: profile.visits ? profile.revenue / profile.visits : null,
    isFocus: profile.companyId === config.focusCompanyId,
    isBenchmark: profile.companyId === config.benchmarkCompanyId,
  }));
}
