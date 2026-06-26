import { generateSyntheticBenchmarkRows } from "../core/generateSyntheticBenchmarkRows.js";
import { calculateMarketShares } from "../core/calculateMarketShares.js";
import { calculateEfficiencyMetrics } from "../core/calculateEfficiencyMetrics.js";
import { calculateRanks } from "../core/calculateRanks.js";

export function enrichForecastRows(forecastRows = [], options = {}) {
  if (!forecastRows.length) return [];

  const synthetic = generateSyntheticBenchmarkRows(forecastRows, options);
  let all = [...forecastRows, ...synthetic];

  all = calculateMarketShares(all, "revenue", options);
  all = calculateMarketShares(all, "visits", options);
  all = calculateEfficiencyMetrics(all);
  all = calculateRanks(all, "revenue", options);
  all = calculateRanks(all, "visits", options);
  all = calculateRanks(all, "market_share_revenue", options);
  all = calculateRanks(all, "market_share_visits", options);

  return all;
}
