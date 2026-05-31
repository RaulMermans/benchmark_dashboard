// Data contract types for the benchmark framework.
// These mirror the fields documented in docs/data-contract.md.

export interface BenchmarkRow {
  // Required fields (validated by validateBenchmarkPayload)
  date: string;
  period_type: string;
  company_id: string;
  display_name: string;
  type: string;
  market: string;
  revenue: number | null;
  visits: number | null;
  data_type: string;

  // Enriched by the framework core
  market_share_revenue?: number | null;
  market_share_visits?: number | null;
  revenue_mom_growth?: number | null;
  revenue_yoy_growth?: number | null;
  visits_mom_growth?: number | null;
  visits_yoy_growth?: number | null;
  rank_revenue?: number | null;
  rank_visits?: number | null;
  revenue_per_visit?: number | null;
  revenue_share_vs_visit_share?: number | null;
  monetization_gap?: number | null;
  indexed_revenue?: number | null;
  indexed_visits?: number | null;
  forecast_scenario?: string;
  active?: boolean;
  color?: string;
  company_color?: string;
  is_forecast?: boolean;
  has_event?: boolean;
  event_names?: string[];

  [key: string]: unknown;
}

export interface BenchmarkEvent {
  date: string;
  company_id?: string;
  title: string;
  description?: string;
  type?: string;
  [key: string]: unknown;
}

export interface MetricDefinition {
  key: string;
  label: string;
  unit?: string;
  description?: string;
  [key: string]: unknown;
}

export interface BenchmarkPayload {
  ok: boolean;
  meta?: Record<string, unknown>;
  data: {
    interface: BenchmarkRow[];
    events: BenchmarkEvent[];
    dictionary: MetricDefinition[];
    [key: string]: unknown;
  };
}

export interface BenchmarkConfig {
  title?: string;
  subtitle?: string;
  sourceLabel?: string;
  defaultMarket?: string;
  marketLabel?: string;
  focusCompanyId?: string;
  benchmarkCompanyId?: string;
  coreComparisonIds?: string[];
  battleTargetIds?: string[];
  defaultMetric?: string;
  defaultPeriodMode?: string;
  currency?: string;
  locale?: string;
  showLogos?: boolean;
  includeBenchmarkInRanks?: boolean;
  includeBenchmarkInShareTotal?: boolean;
  recalculateMarketShares?: boolean;
  recalculateRanks?: boolean;
  views?: string[];
  colorResolver?: (companyId: string) => string | undefined;
  metric?: string;
  shareMetric?: string;
  growthMetric?: string;
  metrics?: string[];
  [key: string]: unknown;
}

export interface BenchmarkDataset {
  meta: Record<string, unknown>;
  rows: BenchmarkRow[];
  events: BenchmarkEvent[];
  dictionary: MetricDefinition[];
  config: BenchmarkConfig;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    rowCount: number;
    eventCount: number;
    dictionaryCount: number;
    companyCount: number;
    companies: string[];
    markets: string[];
    dateRange: { start: string; end: string } | null;
    hasForecasts: boolean;
    hasEvents: boolean;
  };
}

export interface RankingEntry {
  rank: number;
  companyId: string;
  label: string;
  value: number | null;
  share: number | null;
  color?: string;
  row: BenchmarkRow;
}

export interface MarketShareEntry {
  companyId: string;
  label: string;
  share: number | null;
  color?: string;
  row: BenchmarkRow;
}

export interface ExecutiveSummary {
  totalRevenue: number;
  totalVisits: number;
  companyCount: number;
  focus: BenchmarkRow | undefined;
  leader: BenchmarkRow | null;
}
