export const benchmarkConfig = {
  identity: {
    focusEntityId: "focus",
    benchmarkEntityId: "market_average",
  },
  comparisonSets: {
    coreRaceEntityIds: ["focus", "peer_a", "peer_b", "market_average"],
    battleTargetEntityIds: ["peer_a", "peer_b", "market_average"],
  },
  routes: {
    home: "#/benchmark",
    forecast: "#/forecast",
    battleArena: "#/battle-arena",
    profilePrefix: "#/empresa/",
  },
  periods: {
    labels: {
      monthly: "Mes",
      annual: "Año",
      yearly: "Año",
      quarterly: "Trimestre",
      historical: "Histórico",
    },
    dashboardOrder: ["monthly", "quarterly", "annual"],
    timeModes: [
      { key: "month", label: "Mes" },
      { key: "annual", label: "Año" },
      { key: "range", label: "Rango" },
      { key: "historical", label: "Histórico" },
    ],
    forecastTimeModes: [
      { key: "month", label: "Mes" },
      { key: "annual", label: "Año" },
      { key: "range", label: "Rango" },
      { key: "horizon", label: "Horizonte" },
    ],
  },
  forecast: {
    scenarioOrder: ["base_case", "conservative", "aggressive", "unknown"],
  },
  thresholds: {
    battleTechnicalDraw: 0.02,
  },
};
