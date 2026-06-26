import { DEFAULT_FORECAST_CONFIG } from "./config.js";
import { prepareTimeseries } from "./prepareTimeseries.js";
import { mapForecastsToRows } from "./mapForecastsToRows.js";
import { localFallbackProvider } from "./providers/localFallbackProvider.js";
import { timesfmProvider } from "./providers/timesfmProvider.js";

const PROVIDERS = {
  local_fallback: localFallbackProvider,
  timesfm: timesfmProvider,
};

export async function generateForecastRows(rows = [], userConfig = {}) {
  const config = { ...DEFAULT_FORECAST_CONFIG, ...userConfig };

  if (!config.enabled) return [];

  const seriesInput = prepareTimeseries(rows, { metrics: config.metrics });
  const eligible = seriesInput.filter((s) => s.values.length >= config.minHistoryMonths);

  if (!eligible.length) return [];

  const seriesWithIds = eligible.map((s) => ({
    ...s,
    id: `${s.company_id}::${s.market}::${s.metric}`,
  }));

  const payload = { series: seriesWithIds, horizonMonths: config.horizonMonths };

  let providerResult = null;
  const primaryProvider = PROVIDERS[config.provider];

  if (primaryProvider) {
    try {
      providerResult = await primaryProvider(payload);
    } catch {
      providerResult = null;
    }
  }

  // Fall back to local_fallback if primary is unconfigured or fails
  if (!providerResult?.ok) {
    const fallback = PROVIDERS[config.fallbackProvider] || localFallbackProvider;
    try {
      providerResult = await fallback(payload);
    } catch {
      return [];
    }
  }

  if (!providerResult?.ok) return [];

  return mapForecastsToRows(providerResult, seriesWithIds, {
    horizonMonths: config.horizonMonths,
    scenarios: config.scenarios,
  });
}
