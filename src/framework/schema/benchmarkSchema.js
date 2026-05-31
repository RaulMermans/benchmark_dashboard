export const benchmarkPayloadContract = {
  ok: "boolean",
  meta: "object",
  data: {
    interface: "BenchmarkRow[]",
    events: "BenchmarkEvent[]",
    dictionary: "MetricDefinition[]",
  },
};

export const requiredBenchmarkRowFields = [
  "date",
  "period_type",
  "company_id",
  "display_name",
  "type",
  "market",
  "revenue",
  "visits",
  "data_type",
];

export const enrichedBenchmarkRowFields = [
  "market_share_revenue",
  "market_share_visits",
  "revenue_mom_growth",
  "revenue_yoy_growth",
  "visits_mom_growth",
  "visits_yoy_growth",
  "rank_revenue",
  "rank_visits",
  "revenue_per_visit",
  "revenue_share_vs_visit_share",
  "indexed_revenue",
  "indexed_visits",
  "forecast_scenario",
  "active",
];
