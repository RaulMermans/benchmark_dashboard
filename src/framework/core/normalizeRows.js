import { normalizeDate, safeNumber } from "./helpers.js";

const NUMERIC_FIELDS = [
  "year", "month", "revenue", "visits", "market_share_revenue", "market_share_visits",
  "revenue_mom_growth", "revenue_yoy_growth", "visits_mom_growth", "visits_yoy_growth",
  "rank_revenue", "rank_visits", "rank_share_revenue", "rank_share_visits", "revenue_per_visit",
  "revenue_share_vs_visit_share", "indexed_revenue", "indexed_visits", "indexed_market_share_revenue",
];

export function normalizeRows(rows = [], config = {}) {
  const colorResolver = config.colorResolver || (() => undefined);
  return rows.map((row) => {
    const next = { ...row };
    next.date = normalizeDate(row.date) || row.date;
    next.period_type = row.period_type || "monthly";
    next.company_id = String(row.company_id || "").trim().toLowerCase();
    next.display_name = row.display_name || row.company_name || next.company_id;
    next.market = row.market || config.defaultMarket || "Demo Market";
    next.data_type = row.data_type || "actual";
    NUMERIC_FIELDS.forEach((field) => {
      if (field in next) next[field] = safeNumber(next[field]);
    });
    if (!next.color) next.color = colorResolver(next.company_id);
    return next;
  });
}
