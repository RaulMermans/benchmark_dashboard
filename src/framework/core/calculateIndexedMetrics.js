import { groupBy, safeNumber } from "./helpers.js";

export function calculateIndexedMetrics(rows = [], options = {}) {
  const metrics = options.indexedMetrics || ["revenue", "visits"];
  const grouped = groupBy(rows, (row) =>
    [row.company_id, row.market, row.data_type, row.forecast_scenario || ""].join("|"),
  );
  const updates = new Map();

  grouped.forEach((group) => {
    const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const bases = {};
    metrics.forEach((metric) => {
      const firstValid = sorted.find((r) => {
        const v = safeNumber(r[metric]);
        return v !== null && v > 0;
      });
      bases[metric] = firstValid ? safeNumber(firstValid[metric]) : null;
    });
    sorted.forEach((row) => {
      const next = { ...row };
      metrics.forEach((metric) => {
        const base = bases[metric];
        const current = safeNumber(row[metric]);
        const indexField = `indexed_${metric}`;
        next[indexField] = base !== null && current !== null ? (current / base) * 100 : row[indexField] ?? null;
      });
      updates.set(row, next);
    });
  });

  return rows.map((row) => updates.get(row) || row);
}
