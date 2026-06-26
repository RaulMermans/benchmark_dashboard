import { isBenchmarkRow, isForecastRow } from "../core/helpers.js";

function getMonthKey(date) {
  return String(date || "").slice(0, 7);
}

export function prepareTimeseries(rows = [], { metrics = ["revenue", "visits"], includeSynthetic = false } = {}) {
  const actualRows = rows.filter((r) => {
    if (!r.company_id) return false;
    if (isForecastRow(r)) return false;
    if (isBenchmarkRow(r) && !includeSynthetic) return false;
    return true;
  });

  const seriesMap = new Map();

  for (const metric of metrics) {
    for (const row of actualRows) {
      const key = `${row.company_id}::${row.market || ""}::${metric}`;
      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          company_id: row.company_id,
          display_name: row.display_name || row.company_id,
          market: row.market || "",
          type: row.type || "own",
          metric,
          _byDate: new Map(),
        });
      }
      const series = seriesMap.get(key);
      const dateKey = getMonthKey(row.date);
      if (!dateKey) continue;
      const raw = row[metric];
      if (raw == null) continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      series._byDate.set(dateKey, value);
    }
  }

  const result = [];
  for (const [, series] of seriesMap) {
    const sorted = [...series._byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (!sorted.length) continue;
    result.push({
      company_id: series.company_id,
      display_name: series.display_name,
      market: series.market,
      type: series.type,
      metric: series.metric,
      dates: sorted.map(([d]) => `${d}-01`),
      values: sorted.map(([, v]) => v),
    });
  }

  return result;
}
