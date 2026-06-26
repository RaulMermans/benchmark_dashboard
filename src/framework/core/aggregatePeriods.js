import { groupBy, isBenchmarkRow, isForecastRow, safeNumber } from "./helpers.js";
import { generateSyntheticBenchmarkRows } from "./generateSyntheticBenchmarkRows.js";
import { calculateMarketShares } from "./calculateMarketShares.js";
import { calculateEfficiencyMetrics } from "./calculateEfficiencyMetrics.js";
import { calculateRanks } from "./calculateRanks.js";
import { calculateIndexedMetrics } from "./calculateIndexedMetrics.js";

function getMonthKey(row) {
  return String(row.date || "").slice(0, 7);
}

function getPeriodGroupKey(row, periodType) {
  const year = String(row.date || "").slice(0, 4);
  const period = periodType === "annual" ? year : "range";
  return [period, row.company_id, row.market || "", row.data_type || "actual", row.forecast_scenario || ""].join("|");
}

export function aggregatePeriods(rows = [], options = {}) {
  const {
    periodType = "monthly",
    startDate = "",
    endDate = "",
    includeForecasts = false,
  } = options;

  if (periodType === "monthly") {
    return rows.map((row) => ({ ...row }));
  }

  // Filter to monthly actual rows; exclude already-synthetic benchmark rows
  const sourceRows = rows.filter((row) => {
    if ((row.period_type || "monthly") !== "monthly") return false;
    if (!includeForecasts && isForecastRow(row)) return false;
    if (isBenchmarkRow(row)) return false;
    if (periodType === "range" && (startDate || endDate)) {
      const mk = getMonthKey(row);
      const sk = String(startDate).slice(0, 7);
      const ek = String(endDate).slice(0, 7);
      if (sk && mk < sk) return false;
      if (ek && mk > ek) return false;
    }
    return true;
  });

  const groups = groupBy(sourceRows, (row) => getPeriodGroupKey(row, periodType));

  const aggregatedRows = [];
  groups.forEach((group, key) => {
    const [period, company_id, market, data_type, forecast_scenario] = key.split("|");
    const sortedDates = group.map((r) => r.date || "").filter(Boolean).sort();
    const periodStart = sortedDates[0] || startDate;
    const periodEnd = sortedDates.at(-1) || endDate;
    const year = period !== "range" ? period : String(periodStart).slice(0, 4);

    const revenue = group.reduce((sum, r) => sum + (safeNumber(r.revenue) || 0), 0);
    const visits = group.reduce((sum, r) => sum + (safeNumber(r.visits) || 0), 0);

    const latestRow = group.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

    aggregatedRows.push({
      ...latestRow,
      company_id,
      market,
      data_type,
      ...(forecast_scenario ? { forecast_scenario } : {}),
      revenue,
      visits,
      date: periodType === "annual" ? `${year}-01-01` : (endDate || periodEnd),
      period_type: periodType === "annual" ? "annual" : "range",
      period_start: periodStart,
      period_end: periodEnd,
      year,
      month: null,
      // Clear derived fields — recalculated below from aggregated sums
      market_share_revenue: null,
      market_share_visits: null,
      revenue_per_visit: null,
      monetization_gap: null,
      revenue_share_vs_visit_share: null,
      rank_revenue: null,
      rank_visits: null,
      rank_share_revenue: null,
      rank_share_visits: null,
      indexed_revenue: null,
      indexed_visits: null,
      revenue_mom_growth: null,
      visits_mom_growth: null,
      revenue_yoy_growth: null,
      visits_yoy_growth: null,
      aggregate_source: "framework_period_aggregation",
      is_synthetic: false,
    });
  });

  // Generate synthetic benchmark rows from aggregated real rows
  const synthetic = generateSyntheticBenchmarkRows(aggregatedRows, options);
  const allRows = [...aggregatedRows, ...synthetic];

  // Re-run the full benchmark pipeline on aggregated sums
  let enriched = calculateMarketShares(allRows, "revenue", options);
  enriched = calculateMarketShares(enriched, "visits", options);
  enriched = calculateEfficiencyMetrics(enriched);
  enriched = calculateRanks(enriched, "revenue", options);
  enriched = calculateRanks(enriched, "visits", options);
  enriched = calculateRanks(enriched, "market_share_revenue", options);
  enriched = calculateRanks(enriched, "market_share_visits", options);
  enriched = calculateIndexedMetrics(enriched, options);

  return enriched;
}

// --- Period helpers ---

function getActualRows(rows = []) {
  return rows.filter((r) => !isForecastRow(r) && !isBenchmarkRow(r));
}

export function getAvailableYears(rows = []) {
  const years = new Set(
    getActualRows(rows)
      .map((r) => String(r.date || "").slice(0, 4))
      .filter(Boolean),
  );
  return [...years].sort((a, b) => a.localeCompare(b));
}

export function getAvailableDateRange(rows = []) {
  const dates = getActualRows(rows)
    .map((r) => String(r.date || "").slice(0, 7))
    .filter(Boolean)
    .sort();
  if (!dates.length) return { min_date: null, max_date: null };
  return {
    min_date: `${dates[0]}-01`,
    max_date: `${dates.at(-1)}-01`,
  };
}

export function getLatestCompleteMonth(rows = []) {
  const actualRows = getActualRows(rows);
  const monthKeys = [...new Set(actualRows.map((r) => getMonthKey(r)).filter(Boolean))].sort();
  if (!monthKeys.length) return null;

  const allCompanies = [...new Set(actualRows.map((r) => r.company_id).filter(Boolean))];
  if (!allCompanies.length) return null;

  for (let i = monthKeys.length - 1; i >= 0; i--) {
    const mk = monthKeys[i];
    const companiesInMonth = new Set(
      actualRows.filter((r) => getMonthKey(r) === mk).map((r) => r.company_id),
    );
    if (allCompanies.every((id) => companiesInMonth.has(id))) {
      return `${mk}-01`;
    }
  }

  return `${monthKeys.at(-1)}-01`;
}
