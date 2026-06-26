function nextMonth(dateStr) {
  const [year, month] = dateStr.slice(0, 7).split("-").map(Number);
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  return `${nextY}-${String(nextM).padStart(2, "0")}-01`;
}

function getForecastDates(lastActualDate, horizonMonths) {
  const dates = [];
  let current = lastActualDate;
  for (let i = 0; i < horizonMonths; i++) {
    current = nextMonth(current);
    dates.push(current);
  }
  return dates;
}

const SCENARIO_QUANTILE = {
  base_case: { quantileKey: "0.5", confidence: "medium" },
  conservative: { quantileKey: "0.1", confidence: "low" },
  aggressive: { quantileKey: "0.9", confidence: "high" },
};

export function mapForecastsToRows(
  providerResult,
  timeseriesInput,
  { horizonMonths, scenarios = ["base_case", "conservative", "aggressive"], generatedAt } = {},
) {
  if (!providerResult?.ok || !Array.isArray(providerResult.forecasts)) return [];

  const generatedAtStr = generatedAt || new Date().toISOString();
  const provider = providerResult.provider || "unknown";
  const model = providerResult.model || "unknown";

  // id → timeseries metadata
  const metaMap = new Map(timeseriesInput.map((s) => [s.id, s]));
  // id → forecast output
  const forecastMap = new Map(providerResult.forecasts.map((f) => [f.id, f]));

  // Group by company + market; collect per-metric data
  const companyGroups = new Map();
  for (const [id, series] of metaMap) {
    const groupKey = `${series.company_id}::${series.market}`;
    if (!companyGroups.has(groupKey)) {
      companyGroups.set(groupKey, {
        company_id: series.company_id,
        display_name: series.display_name,
        market: series.market,
        type: series.type,
        metrics: {},
      });
    }
    const forecast = forecastMap.get(id);
    if (forecast) {
      companyGroups.get(groupKey).metrics[series.metric] = {
        forecast,
        lastDate: series.dates.at(-1) ?? null,
      };
    }
  }

  const rows = [];
  for (const [, group] of companyGroups) {
    const lastDate =
      group.metrics.revenue?.lastDate || group.metrics.visits?.lastDate;
    if (!lastDate) continue;

    const forecastDates = getForecastDates(lastDate, horizonMonths);

    for (const scenario of scenarios) {
      const { quantileKey, confidence } = SCENARIO_QUANTILE[scenario] || SCENARIO_QUANTILE.base_case;

      for (let i = 0; i < horizonMonths; i++) {
        const date = forecastDates[i];
        if (!date) continue;

        const getVal = (metric) => {
          const entry = group.metrics[metric];
          if (!entry) return null;
          const vals = entry.forecast.quantiles?.[quantileKey] ?? entry.forecast.point;
          if (!Array.isArray(vals) || vals[i] == null) return null;
          return Math.max(0, Math.round(vals[i]));
        };

        rows.push({
          date,
          period_type: "monthly",
          company_id: group.company_id,
          display_name: group.display_name,
          market: group.market,
          type: group.type || "own",
          revenue: getVal("revenue"),
          visits: getVal("visits"),
          data_type: "forecast",
          forecast_provider: provider,
          forecast_method: model,
          forecast_scenario: scenario,
          forecast_confidence: confidence,
          forecast_horizon_month: i + 1,
          forecast_generated_at: generatedAtStr,
          is_forecast: true,
        });
      }
    }
  }

  return rows;
}
