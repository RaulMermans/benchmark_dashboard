import { groupBy, isBenchmarkRow, safeNumber } from "./helpers.js";

export function generateSyntheticBenchmarkRows(rows = [], options = {}) {
  const groups = groupBy(rows, (row) =>
    [row.date, row.market, row.data_type, row.forecast_scenario || ""].join("|"),
  );
  const synthetic = [];

  groups.forEach((group, key) => {
    const [date, market, data_type, forecast_scenario] = key.split("|");
    const realRows = group.filter((row) => !isBenchmarkRow(row, options));
    if (!realRows.length) return;

    const totalRevenue = realRows.reduce((sum, r) => sum + (safeNumber(r.revenue) || 0), 0);
    const totalVisits = realRows.reduce((sum, r) => sum + (safeNumber(r.visits) || 0), 0);
    const avgRevenue = totalRevenue / realRows.length;
    const avgVisits = totalVisits / realRows.length;

    const base = {
      date,
      period_type: realRows[0]?.period_type || "monthly",
      market,
      data_type,
      ...(forecast_scenario ? { forecast_scenario } : {}),
      active: true,
      is_synthetic: true,
      type: "benchmark",
    };

    synthetic.push({
      ...base,
      company_id: "market_total",
      display_name: "Market Total",
      benchmark_type: "market_total",
      revenue: totalRevenue,
      visits: totalVisits,
    });

    synthetic.push({
      ...base,
      company_id: "market_average",
      display_name: "Market Average",
      benchmark_type: "market_average",
      revenue: avgRevenue,
      visits: avgVisits,
    });
  });

  return synthetic;
}
