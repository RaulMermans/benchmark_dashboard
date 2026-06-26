import { validateSourceMonthlyRows } from "../schema/validateSourceMonthlyRows.js";
import { normalizeRows } from "./normalizeRows.js";
import { generateSyntheticBenchmarkRows } from "./generateSyntheticBenchmarkRows.js";
import { calculateMarketShares } from "./calculateMarketShares.js";
import { calculateEfficiencyMetrics } from "./calculateEfficiencyMetrics.js";
import { calculateGrowthRates } from "./calculateGrowthRates.js";
import { calculateIndexedMetrics } from "./calculateIndexedMetrics.js";
import { calculateRanks } from "./calculateRanks.js";

export function buildBenchmarkPayloadFromSourceMonthlyRows(sourceRows = [], options = {}) {
  const validation = validateSourceMonthlyRows(sourceRows);
  if (!validation.ok) {
    throw new Error(`Source monthly validation failed: ${validation.errors[0]}`);
  }

  const focusId =
    options.focusCompanyId ||
    options.identity?.focusEntityId ||
    "focus";
  const defaultMarket = options.defaultMarket || "Demo Market";

  // Map raw rows to interface shape
  const mapped = sourceRows.map((row) => ({
    date: row.date,
    period_type: "monthly",
    company_id: row.company_id,
    display_name: row.display_name ?? row.company_id,
    type: row.type ?? (row.company_id === focusId ? "own" : "competitor"),
    market: row.market ?? defaultMarket,
    revenue: row.revenue,
    visits: row.visits,
    data_type: "actual",
    active: row.active ?? true,
  }));

  // Normalize (date canonicalization, type coercion, etc.)
  const normalized = normalizeRows(mapped, options);

  // Generate synthetic benchmark rows from real rows only
  const synthetic = generateSyntheticBenchmarkRows(normalized, options);
  const allRows = [...normalized, ...synthetic];

  // Market shares (denominators exclude benchmark rows)
  let enriched = calculateMarketShares(allRows, "revenue", options);
  enriched = calculateMarketShares(enriched, "visits", options);

  // Efficiency: revenue_per_visit, monetization_gap
  enriched = calculateEfficiencyMetrics(enriched);

  // Growth: MoM + YoY, grouped by company_id so synthetic rows don't pollute real-company growth
  enriched = calculateGrowthRates(enriched, options);

  // Indexed metrics (100 = first valid positive value)
  enriched = calculateIndexedMetrics(enriched, options);

  // Ranks (benchmark rows excluded by default)
  enriched = calculateRanks(enriched, "revenue", options);
  enriched = calculateRanks(enriched, "visits", options);
  enriched = calculateRanks(enriched, "market_share_revenue", options);
  enriched = calculateRanks(enriched, "market_share_visits", options);

  return {
    ok: true,
    meta: {
      source_type: "raw_monthly_observations",
      generated_interface: true,
    },
    data: {
      interface: enriched,
      events: [],
      dictionary: [],
      forecasts: [],
      insights: [],
    },
  };
}
