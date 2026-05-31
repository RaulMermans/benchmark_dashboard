import { defaultBenchmarkConfig } from "./defaultBenchmarkConfig.js";

export const demoBenchmarkConfig = {
  ...defaultBenchmarkConfig,
  title: "Benchmark Intelligence Dashboard",
  subtitle: "Mock competitive intelligence cockpit for market, traffic, revenue, growth, and forecast benchmarking.",
  sourceLabel: "Mock benchmark dataset",
  marketLabel: "Demo Market",
  focusCompanyId: "focus",
  benchmarkCompanyId: "market_average",
  coreComparisonIds: ["focus", "peer_a", "peer_b", "market_average"],
  battleTargetIds: ["peer_a", "peer_b", "market_average"],
  defaultMetric: "revenue",
  defaultPeriodMode: "monthly",
  currency: "EUR",
  locale: "en-US",
  showLogos: false,
};
