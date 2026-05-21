export const defaultBenchmarkConfig = {
  title: "Benchmark Intelligence Framework",
  subtitle: "Reusable dashboard template for market, growth, ranking, and forecast intelligence.",
  currency: "USD",
  locale: "en-US",
  defaultMarket: "Demo Market",
  defaultMetric: "revenue",
  ownCompanyId: "focus",
  benchmarkCompanyId: "market_average",
  metrics: [
    { key: "revenue", label: "Revenue", format: "currency" },
    { key: "visits", label: "Visits", format: "compact" },
    { key: "market_share_revenue", label: "Revenue share", format: "percent" },
    { key: "market_share_visits", label: "Visit share", format: "percent" },
    { key: "revenue_per_visit", label: "Revenue per visit", format: "currency-decimal" },
    { key: "revenue_yoy_growth", label: "Revenue growth YoY", format: "percent" },
    { key: "visits_yoy_growth", label: "Visit growth YoY", format: "percent" },
  ],
  views: {
    ranking: true,
    marketShare: true,
    growth: true,
    forecast: true,
    profile: true,
  },
  theme: {
    primaryColor: "#111827",
    accentColor: "#2563EB",
    surfaceColor: "#FFFFFF",
    backgroundColor: "#F7F4F1",
  },
  formatters: {},
  preserveDerivedMetrics: true,
  recalculateDerivedMetrics: false,
  includeForecastsInAggregates: false,
};

export function mergeBenchmarkConfig(config = {}) {
  return {
    ...defaultBenchmarkConfig,
    ...config,
    metrics: config.metrics ?? defaultBenchmarkConfig.metrics,
    views: { ...defaultBenchmarkConfig.views, ...(config.views ?? {}) },
    theme: { ...defaultBenchmarkConfig.theme, ...(config.theme ?? {}) },
    formatters: { ...defaultBenchmarkConfig.formatters, ...(config.formatters ?? {}) },
  };
}
