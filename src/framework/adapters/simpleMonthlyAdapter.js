import { normalizeRows } from "../core/normalizeRows.js";
import { calculateMarketShares } from "../core/calculateMarketShares.js";
import { calculateGrowthRates } from "../core/calculateGrowthRates.js";
import { calculateRanks } from "../core/calculateRanks.js";
import { calculateEfficiencyMetrics } from "../core/calculateEfficiencyMetrics.js";

export function adaptSourceMonthlyRowsToInterface(rows = [], config = {}) {
  const focusId = config.focusCompanyId || "focus";
  return rows.map((row) => ({
    date: row.date,
    period_type: "monthly",
    company_id: row.company_id,
    display_name: row.display_name ?? row.company_id,
    type: row.type ?? (row.company_id === focusId ? "own" : "competitor"),
    market: row.market ?? config.defaultMarket ?? "default",
    revenue: row.revenue,
    visits: row.visits,
    data_type: "actual",
    active: row.active ?? true,
  }));
}

export function adaptSimpleMonthlyRows(inputRows = [], config = {}) {
  const rows = inputRows.map((row) => ({
    date: row.date,
    period_type: "monthly",
    company_id: row.company_id,
    display_name: row.display_name || row.company_id,
    type: row.type || (row.company_id === (config.focusCompanyId || "focus") ? "own" : "competitor"),
    market: row.market || config.defaultMarket || "Demo Market",
    revenue: row.revenue,
    visits: row.visits,
    data_type: row.data_type || "actual",
    active: row.active ?? true,
  }));
  let enriched = normalizeRows(rows, config);
  enriched = calculateMarketShares(enriched, "revenue", config);
  enriched = calculateMarketShares(enriched, "visits", config);
  enriched = calculateGrowthRates(enriched, config);
  enriched = calculateRanks(enriched, "revenue", config);
  enriched = calculateRanks(enriched, "visits", config);
  enriched = calculateEfficiencyMetrics(enriched);
  return {
    ok: true,
    meta: { dataset_name: "Simple Monthly Mock Benchmark", data_policy: "Generated from simple monthly rows." },
    data: { interface: enriched, events: [], dictionary: [] },
  };
}
