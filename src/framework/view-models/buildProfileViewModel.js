import { getSortValue, safeNumber } from "../core/benchmarkUtils.js";

export function buildProfileViewModel(rows = [], config = {}, options = {}) {
  const companyId = options.companyId || config.ownCompanyId || "";
  const metrics = options.metrics || ["visits", "revenue", "market_share_visits", "revenue_per_visit"];
  const companyRows = rows
    .filter((row) => String(row.company_id) === String(companyId))
    .sort((a, b) => getSortValue(a) - getSortValue(b));
  const latestRow = companyRows[companyRows.length - 1] ?? null;

  return {
    companyId,
    label: latestRow?.display_name || latestRow?.company_name || companyId,
    latestRow,
    charts: metrics.map((metric) => ({
      metric,
      points: companyRows
        .map((row) => ({
          date: row.date,
          label: row.period_label || row.date,
          value: safeNumber(row?.[metric]),
          sortValue: getSortValue(row),
        }))
        .filter((point) => point.value !== null),
    })),
  };
}
