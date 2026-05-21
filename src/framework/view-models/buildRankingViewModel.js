import { calculateRanks } from "../core/calculateRanks.js";
import { isBenchmarkRow, isForecastRow, safeNumber } from "../core/benchmarkUtils.js";

function getLabel(row) {
  return row?.display_name || row?.company_name || row?.company_id || "Unknown";
}

export function buildRankingViewModel(rows = [], config = {}, options = {}) {
  const metric = options.metric || config.defaultMetric || "revenue";
  const includeBenchmark = options.includeBenchmark ?? false;
  const includeForecasts = options.includeForecasts ?? false;

  const filteredRows = rows
    .filter((row) => includeForecasts || !isForecastRow(row))
    .filter((row) => includeBenchmark || !isBenchmarkRow(row))
    .filter((row) => safeNumber(row?.[metric]) !== null);

  const rankedRows = calculateRanks(filteredRows, metric, {
    includeBenchmark,
    preserveExisting: false,
  })
    .slice()
    .sort((a, b) => {
      const diff = (safeNumber(b?.[metric]) ?? 0) - (safeNumber(a?.[metric]) ?? 0);
      return diff || getLabel(a).localeCompare(getLabel(b));
    });

  return {
    metric,
    rows: rankedRows,
    leaders: rankedRows.slice(0, options.limit ?? rankedRows.length),
    total: rankedRows.reduce((sum, row) => sum + (safeNumber(row?.[metric]) ?? 0), 0),
  };
}
