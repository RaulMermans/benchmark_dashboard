import { groupBy, safeNumber } from "./helpers.js";

function monthIndex(date = "") {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}

export function calculateGrowthRates(rows = [], options = {}) {
  const metrics = options.metrics || ["revenue", "visits"];
  const grouped = groupBy(rows, (row) => [row.company_id, row.market, row.data_type, row.forecast_scenario || ""].join("|"));
  const updates = new Map();

  grouped.forEach((group) => {
    const byMonth = new Map(group.map((row) => [monthIndex(row.date), row]));
    group.forEach((row) => {
      const idx = monthIndex(row.date);
      const next = { ...row };
      metrics.forEach((metric) => {
        const current = safeNumber(row[metric]);
        const priorMonth = safeNumber(byMonth.get(idx - 1)?.[metric]);
        const priorYear = safeNumber(byMonth.get(idx - 12)?.[metric]);
        const prefix = metric === "visits" ? "visits" : "revenue";
        if (current !== null && priorMonth) next[`${prefix}_mom_growth`] = (current - priorMonth) / priorMonth;
        if (current !== null && priorYear) next[`${prefix}_yoy_growth`] = (current - priorYear) / priorYear;
      });
      updates.set(row, next);
    });
  });

  return rows.map((row) => updates.get(row) || row);
}
