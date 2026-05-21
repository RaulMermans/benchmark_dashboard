import { mergeBenchmarkConfig } from "../config/defaultBenchmarkConfig.js";
import { validateBenchmarkPayload } from "../schema/validateBenchmarkPayload.js";
import { aggregatePeriods } from "./aggregatePeriods.js";
import { calculateEfficiencyMetrics } from "./calculateEfficiencyMetrics.js";
import { calculateGrowthRates } from "./calculateGrowthRates.js";
import { calculateMarketShares } from "./calculateMarketShares.js";
import { calculateRanks } from "./calculateRanks.js";
import { normalizeRows } from "./normalizeRows.js";

export function buildBenchmarkDataset(payload, config = {}) {
  const mergedConfig = mergeBenchmarkConfig(config);
  const validation = validateBenchmarkPayload(payload);
  const preserveExisting =
    mergedConfig.recalculateDerivedMetrics === true ? false : mergedConfig.preserveDerivedMetrics !== false;

  let rows = normalizeRows(payload?.data?.interface ?? [], mergedConfig);

  rows = calculateMarketShares(rows, "revenue", { preserveExisting });
  rows = calculateMarketShares(rows, "visits", { preserveExisting });
  rows = calculateGrowthRates(rows, { preserveExisting });
  rows = calculateRanks(rows, "revenue", { preserveExisting });
  rows = calculateRanks(rows, "visits", { preserveExisting });
  rows = calculateEfficiencyMetrics(rows, { preserveExisting });

  const periodMode = mergedConfig.periodMode || "monthly";
  if (periodMode !== "monthly") {
    rows = aggregatePeriods(rows, periodMode, {
      includeForecasts: mergedConfig.includeForecastsInAggregates,
    });
  }

  return {
    ok: validation.valid,
    meta: {
      ...(payload?.meta ?? {}),
      framework: "Benchmark Intelligence Framework",
      validation: validation.summary,
    },
    data: {
      ...(payload?.data ?? {}),
      interface: rows,
      events: Array.isArray(payload?.data?.events) ? payload.data.events.slice() : [],
      dictionary: Array.isArray(payload?.data?.dictionary) ? payload.data.dictionary.slice() : [],
    },
    validation,
    config: mergedConfig,
  };
}
