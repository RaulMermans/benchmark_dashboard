import { calculateEfficiencyMetrics } from "./calculateEfficiencyMetrics.js";
import { calculateGrowthRates } from "./calculateGrowthRates.js";
import { calculateMarketShares } from "./calculateMarketShares.js";
import { calculateRanks } from "./calculateRanks.js";
import {
  getSortValue,
  isForecastRow,
  roundMetric,
  safeNumber,
} from "./benchmarkUtils.js";

function getAggregatePeriod(row, periodMode) {
  const date = String(row.date || "");
  const year = Number(date.slice(0, 4) || row.year);
  const month = Number(date.slice(5, 7) || row.month || 1);

  if (!year) return null;

  if (periodMode === "annual" || periodMode === "yearly") {
    return {
      date: `${year}-12-31`,
      label: String(year),
      year,
      month: 12,
      period_type: "annual",
      bucket: String(year),
    };
  }

  if (periodMode === "quarterly") {
    const quarter = Math.max(1, Math.ceil(month / 3));
    const quarterEndMonth = quarter * 3;
    return {
      date: `${year}-${String(quarterEndMonth).padStart(2, "0")}-01`,
      label: `Q${quarter} ${year}`,
      year,
      month: quarterEndMonth,
      period_type: "quarterly",
      bucket: `${year}-Q${quarter}`,
    };
  }

  return null;
}

function getAggregateKey(row, period) {
  return [
    period.bucket,
    row.company_id,
    row.market,
    row.type,
    row.is_forecast ? row.forecast_scenario || "" : "",
  ].join("||");
}

function aggregateGroup(rows, period) {
  const sortedRows = rows.slice().sort((a, b) => getSortValue(a) - getSortValue(b));
  const latest = sortedRows[sortedRows.length - 1] ?? {};
  const revenue = rows.reduce((sum, row) => sum + (safeNumber(row.revenue) ?? 0), 0);
  const visits = rows.reduce((sum, row) => sum + (safeNumber(row.visits) ?? 0), 0);
  const hasRevenue = rows.some((row) => safeNumber(row.revenue) !== null);
  const hasVisits = rows.some((row) => safeNumber(row.visits) !== null);

  return {
    ...latest,
    date: period.date,
    period_label: period.label,
    year: period.year,
    month: period.month,
    period_type: period.period_type,
    revenue: hasRevenue ? roundMetric(revenue, 2) : null,
    visits: hasVisits ? roundMetric(visits, 2) : null,
    market_share_revenue: null,
    market_share_visits: null,
    revenue_mom_growth: null,
    visits_mom_growth: null,
    revenue_yoy_growth: null,
    visits_yoy_growth: null,
    rank_revenue: null,
    rank_visits: null,
    revenue_per_visit: null,
    revenue_share_vs_visit_share: null,
  };
}

export function aggregatePeriods(rows = [], periodMode = "monthly", options = {}) {
  if (periodMode === "monthly") return rows.map((row) => ({ ...row }));

  const includeForecasts = options.includeForecasts ?? false;
  const sourceRows = rows.filter((row) => includeForecasts || !isForecastRow(row));
  const aggregateMap = new Map();

  sourceRows.forEach((row) => {
    const period = getAggregatePeriod(row, periodMode);
    if (!period) return;

    const key = getAggregateKey(row, period);
    const current = aggregateMap.get(key) ?? { period, rows: [] };
    current.rows.push(row);
    aggregateMap.set(key, current);
  });

  let aggregatedRows = Array.from(aggregateMap.values()).map(({ rows: groupedRows, period }) =>
    aggregateGroup(groupedRows, period),
  );

  const preserveExisting = false;
  aggregatedRows = calculateMarketShares(aggregatedRows, "revenue", { preserveExisting });
  aggregatedRows = calculateMarketShares(aggregatedRows, "visits", { preserveExisting });
  aggregatedRows = calculateGrowthRates(aggregatedRows, { preserveExisting });
  aggregatedRows = calculateRanks(aggregatedRows, "revenue", { preserveExisting });
  aggregatedRows = calculateRanks(aggregatedRows, "visits", { preserveExisting });
  aggregatedRows = calculateEfficiencyMetrics(aggregatedRows, { preserveExisting });

  return aggregatedRows.sort((a, b) => getSortValue(a) - getSortValue(b));
}
