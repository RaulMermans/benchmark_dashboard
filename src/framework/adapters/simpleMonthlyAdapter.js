import { mergeBenchmarkConfig } from "../config/defaultBenchmarkConfig.js";
import { calculateEfficiencyMetrics } from "../core/calculateEfficiencyMetrics.js";
import { calculateGrowthRates } from "../core/calculateGrowthRates.js";
import { calculateMarketShares } from "../core/calculateMarketShares.js";
import { calculateRanks } from "../core/calculateRanks.js";
import { normalizeRows } from "../core/normalizeRows.js";

function buildSimpleMonthlyPayload(rows = [], config = {}) {
  const mergedConfig = mergeBenchmarkConfig(config);

  return {
    ok: true,
    meta: {
      source: "Simple monthly adapter",
      generated_at: new Date().toISOString(),
      data_policy: "Adapter output generated from caller-provided simple monthly rows.",
    },
    data: {
      interface: rows.map((row) => ({
        ...row,
        period_type: row.period_type || "monthly",
        type: row.type || "competitor",
        market: row.market || mergedConfig.defaultMarket,
        data_type: row.data_type || "estimated",
        active: row.active ?? true,
      })),
      events: [],
      dictionary: [
        { field: "date", label: "Date", description: "Monthly period start date." },
        { field: "company_id", label: "Company ID", description: "Stable entity identifier." },
        { field: "revenue", label: "Revenue", description: "Monthly revenue metric." },
        { field: "visits", label: "Visits", description: "Monthly visit metric." },
      ],
    },
  };
}

export function adaptSimpleMonthlyRows(rows = [], config = {}) {
  const payload = buildSimpleMonthlyPayload(rows, config);
  const calculationOptions = { preserveExisting: false };

  let interfaceRows = normalizeRows(payload.data.interface, config);
  interfaceRows = calculateMarketShares(interfaceRows, "revenue", calculationOptions);
  interfaceRows = calculateMarketShares(interfaceRows, "visits", calculationOptions);
  interfaceRows = calculateGrowthRates(interfaceRows, calculationOptions);
  interfaceRows = calculateRanks(interfaceRows, "revenue", calculationOptions);
  interfaceRows = calculateRanks(interfaceRows, "visits", calculationOptions);
  interfaceRows = calculateEfficiencyMetrics(interfaceRows, calculationOptions);

  return {
    ...payload,
    data: {
      ...payload.data,
      interface: interfaceRows,
    },
  };
}
