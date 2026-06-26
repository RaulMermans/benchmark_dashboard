export const DEFAULT_FORECAST_CONFIG = {
  enabled: true,
  provider: "local_engine",
  fallbackProvider: "local_engine",
  horizonMonths: 6,
  scenarios: ["base_case", "conservative", "aggressive"],
  metrics: ["revenue", "visits"],
  minHistoryMonths: 3,
};
