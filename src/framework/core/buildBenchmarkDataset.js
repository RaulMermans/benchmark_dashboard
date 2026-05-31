import { normalizeRows } from "./normalizeRows.js";
import { calculateMarketShares } from "./calculateMarketShares.js";
import { calculateRanks } from "./calculateRanks.js";
import { calculateEfficiencyMetrics } from "./calculateEfficiencyMetrics.js";

export function buildBenchmarkDataset(payload = {}, config = {}) {
  const rawRows = Array.isArray(payload?.data?.interface) ? payload.data.interface : [];
  let rows = normalizeRows(rawRows, config);
  if (config.recalculateMarketShares === true) {
    rows = calculateMarketShares(rows, "revenue", config);
    rows = calculateMarketShares(rows, "visits", config);
  }
  if (config.recalculateRanks === true) {
    rows = calculateRanks(rows, "revenue", config);
    rows = calculateRanks(rows, "visits", config);
  }
  rows = calculateEfficiencyMetrics(rows);
  return {
    meta: payload.meta || {},
    rows,
    events: Array.isArray(payload?.data?.events) ? payload.data.events : [],
    dictionary: Array.isArray(payload?.data?.dictionary) ? payload.data.dictionary : [],
    config,
  };
}
