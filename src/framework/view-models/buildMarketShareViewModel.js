import { getSortValue, isForecastRow, safeNumber } from "../core/benchmarkUtils.js";

const SHARE_FIELDS = ["market_share_revenue", "market_share_visits"];

export function buildMarketShareViewModel(rows = [], config = {}, options = {}) {
  const metric = options.metric || "market_share_revenue";
  const includeForecasts = options.includeForecasts ?? false;
  const seriesMap = new Map();

  rows
    .filter((row) => SHARE_FIELDS.includes(metric) && (includeForecasts || !isForecastRow(row)))
    .forEach((row) => {
      const value = safeNumber(row?.[metric]);
      if (value === null) return;

      const key = row.company_id;
      const current =
        seriesMap.get(key) ??
        {
          company_id: row.company_id,
          display_name: row.display_name || row.company_name || row.company_id,
          color: row.company_color || row.color,
          points: [],
        };

      current.points.push({
        date: row.date,
        label: row.period_label || row.date,
        value,
        sortValue: getSortValue(row),
      });
      seriesMap.set(key, current);
    });

  return {
    metric,
    series: Array.from(seriesMap.values()).map((series) => ({
      ...series,
      points: series.points.sort((a, b) => a.sortValue - b.sortValue),
    })),
  };
}
