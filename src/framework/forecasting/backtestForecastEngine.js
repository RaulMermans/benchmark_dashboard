import { localEngineProvider } from "./providers/localEngineProvider.js";
import { prepareTimeseries } from "./prepareTimeseries.js";

export async function backtestForecast(actualRows = [], config = {}) {
  const {
    horizonMonths = 3,
    minHistoryMonths = 6,
    metric = "revenue",
  } = config;

  const realRows = actualRows.filter(
    (r) =>
      !r.is_synthetic &&
      String(r.type || "").toLowerCase() !== "benchmark" &&
      String(r.data_type || "").toLowerCase() !== "forecast",
  );

  const groups = new Map();
  realRows.forEach((row) => {
    const key = `${row.company_id}||${row.market || ""}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  });

  const results = [];

  for (const [key, groupRows] of groups) {
    const [company_id, market] = key.split("||");
    const sorted = [...groupRows].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );

    if (sorted.length < minHistoryMonths + horizonMonths) continue;

    const historyRows = sorted.slice(0, sorted.length - horizonMonths);
    const testRows = sorted.slice(sorted.length - horizonMonths);

    if (historyRows.length < minHistoryMonths) continue;

    const ts = prepareTimeseries(historyRows, { metrics: [metric] });
    if (!ts.length) continue;

    const tsWithIds = ts.map((s) => ({
      ...s,
      id: `${s.company_id}::${s.market}::${s.metric}`,
    }));

    let providerResult;
    try {
      providerResult = await localEngineProvider({ series: tsWithIds, horizonMonths });
    } catch {
      continue;
    }

    if (!providerResult?.ok) continue;

    const forecastEntry = providerResult.forecasts.find((f) => f.metric === metric);
    if (!forecastEntry) continue;

    const baseForecastValues = forecastEntry.point;

    let sumAE = 0;
    let sumAPE = 0;
    let sumSE = 0;
    let sumError = 0;
    let sumActual = 0;
    let count = 0;

    testRows.forEach((actual, idx) => {
      const actualValue = Number(actual[metric]) || 0;
      const forecastValue = baseForecastValues[idx] ?? 0;
      const error = forecastValue - actualValue;

      sumAE += Math.abs(error);
      sumAPE += actualValue !== 0 ? Math.abs(error / actualValue) : 0;
      sumSE += error ** 2;
      sumError += error;
      sumActual += actualValue;
      count++;
    });

    if (!count) continue;

    const mae = sumAE / count;
    const mape = sumAPE / count;
    const rmse = Math.sqrt(sumSE / count);
    const meanActual = sumActual / count;
    const bias = meanActual !== 0 ? sumError / count / meanActual : 0;

    const quality =
      mape < 0.05
        ? "excellent"
        : mape < 0.15
          ? "good"
          : mape < 0.30
            ? "usable"
            : "weak";

    results.push({
      company_id,
      market,
      metric,
      horizon_months: horizonMonths,
      mae: Math.round(mae * 100) / 100,
      mape: Math.round(mape * 10000) / 10000,
      rmse: Math.round(rmse * 100) / 100,
      bias: Math.round(bias * 10000) / 10000,
      quality,
    });
  }

  return results;
}
