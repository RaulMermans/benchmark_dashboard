export const DEFAULT_FORECAST_CONFIG = {
  enabled: true,
  provider: "timesfm",
  fallbackProvider: "local_fallback",
  horizonMonths: 6,
  scenarios: ["base_case", "conservative", "aggressive"],
  metrics: ["revenue", "visits"],
  minHistoryMonths: 6,
};
