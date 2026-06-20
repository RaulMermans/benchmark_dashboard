import {
  formatCompact,
  formatCurrency,
  formatCurrencyDecimal,
  formatPercent,
  formatPercentagePoints,
  formatSignedPercent,
} from "../lib/formatters.js";

export const METRIC_REGISTRY = [
  {
    key: "revenue",
    label: "Facturación",
    shortLabel: "Facturación",
    formatter: "currency",
    category: "scale",
    type: "absolute",
    higherIsBetter: true,
    availableIn: ["dashboard", "ranking", "profile", "battle", "forecast"],
  },
  {
    key: "visits",
    label: "Visitas",
    shortLabel: "Visitas",
    formatter: "compact",
    category: "scale",
    type: "absolute",
    higherIsBetter: true,
    availableIn: ["dashboard", "ranking", "profile", "battle", "forecast"],
  },
  {
    key: "market_share_revenue",
    label: "Cuota de facturación",
    shortLabel: "Cuota facturación",
    formatter: "percent",
    category: "share",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["dashboard", "ranking", "profile", "battle"],
  },
  {
    key: "market_share_visits",
    label: "Cuota de visitas",
    shortLabel: "Cuota visitas",
    formatter: "percent",
    category: "share",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["dashboard", "ranking", "profile", "battle"],
  },
  {
    key: "revenue_mom_growth",
    label: "Crecimiento mensual facturación",
    shortLabel: "Crecimiento MoM",
    formatter: "signedPercent",
    category: "growth",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["ranking"],
  },
  {
    key: "visits_mom_growth",
    label: "Crecimiento mensual visitas",
    shortLabel: "Crecimiento MoM visitas",
    formatter: "signedPercent",
    category: "growth",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["ranking"],
  },
  {
    key: "revenue_yoy_growth",
    label: "Crecimiento interanual facturación",
    shortLabel: "Crecimiento YoY",
    formatter: "signedPercent",
    category: "growth",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["ranking", "battle"],
  },
  {
    key: "visits_yoy_growth",
    label: "Crecimiento interanual visitas",
    shortLabel: "Crecimiento YoY visitas",
    formatter: "signedPercent",
    category: "growth",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["ranking", "battle"],
  },
  {
    key: "share_revenue_change_yoy",
    label: "Variación interanual cuota facturación",
    shortLabel: "Δ Cuota YoY",
    formatter: "percentagePoints",
    category: "shareDelta",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["profile"],
  },
  {
    key: "share_revenue_change_mom",
    label: "Variación mensual cuota facturación",
    shortLabel: "Δ Cuota MoM",
    formatter: "percentagePoints",
    category: "shareDelta",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["profile"],
  },
  {
    key: "share_revenue_change_range",
    label: "Cambio de cuota de facturación",
    shortLabel: "Δ Cuota rango",
    formatter: "percentagePoints",
    category: "shareDelta",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["profile"],
  },
  {
    key: "share_visits_change_yoy",
    label: "Variación interanual cuota visitas",
    shortLabel: "Δ Cuota visitas YoY",
    formatter: "percentagePoints",
    category: "shareDelta",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["profile"],
  },
  {
    key: "share_visits_change_mom",
    label: "Variación mensual cuota visitas",
    shortLabel: "Δ Cuota visitas MoM",
    formatter: "percentagePoints",
    category: "shareDelta",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["profile"],
  },
  {
    key: "share_visits_change_range",
    label: "Cambio de cuota de visitas",
    shortLabel: "Δ Cuota visitas rango",
    formatter: "percentagePoints",
    category: "shareDelta",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["profile"],
  },
  {
    key: "revenue_per_visit",
    label: "Facturación por visita",
    shortLabel: "Rev/visita",
    formatter: "currencyDecimal",
    category: "efficiency",
    type: "absolute",
    higherIsBetter: true,
    availableIn: ["ranking", "profile", "battle"],
  },
  {
    key: "monetization_gap",
    label: "Brecha de monetización",
    shortLabel: "Brecha",
    formatter: "percentagePoints",
    category: "efficiency",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["profile", "battle"],
  },
  {
    key: "indexed_revenue",
    label: "Índice de facturación",
    shortLabel: "Índice facturación",
    formatter: "number",
    category: "indexed",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["dashboard"],
  },
  {
    key: "indexed_visits",
    label: "Índice de visitas",
    shortLabel: "Índice visitas",
    formatter: "number",
    category: "indexed",
    type: "relative",
    higherIsBetter: true,
    availableIn: ["dashboard"],
  },
  {
    key: "rank_revenue",
    label: "Ranking facturación",
    shortLabel: "Rank facturación",
    formatter: "rank",
    category: "rank",
    type: "ordinal",
    higherIsBetter: false,
    availableIn: ["profile"],
  },
  {
    key: "rank_visits",
    label: "Ranking visitas",
    shortLabel: "Rank visitas",
    formatter: "rank",
    category: "rank",
    type: "ordinal",
    higherIsBetter: false,
    availableIn: ["profile"],
  },
  {
    key: "rank_share_revenue",
    label: "Ranking cuota facturación",
    shortLabel: "Rank cuota facturación",
    formatter: "rank",
    category: "rank",
    type: "ordinal",
    higherIsBetter: false,
    availableIn: ["profile"],
  },
  {
    key: "rank_share_visits",
    label: "Ranking cuota visitas",
    shortLabel: "Rank cuota visitas",
    formatter: "rank",
    category: "rank",
    type: "ordinal",
    higherIsBetter: false,
    availableIn: ["profile"],
  },
];

export const RANKING_SORTS = [
  { key: "revenue", label: "Facturación" },
  { key: "visits", label: "Visitas" },
  { key: "market_share_revenue", label: "Cuota facturación" },
  { key: "market_share_visits", label: "Cuota visitas" },
  { key: "revenue_per_visit", label: "Facturación por visita" },
  { key: "revenue_mom_growth", label: "Crecimiento mensual facturación" },
  { key: "visits_mom_growth", label: "Crecimiento mensual visitas" },
  { key: "revenue_yoy_growth", label: "Crecimiento interanual facturación" },
  { key: "visits_yoy_growth", label: "Crecimiento interanual visitas" },
];

export const LOCAL_RANKING_SORTS = [
  { key: "revenue", label: "Facturación" },
  { key: "visits", label: "Visitas" },
  { key: "market_share_revenue", label: "Cuota facturación" },
  { key: "market_share_visits", label: "Cuota visitas" },
  { key: "growth_revenue", label: "Crecimiento facturación" },
  { key: "growth_visits", label: "Crecimiento visitas" },
  { key: "revenue_per_visit", label: "Eficiencia" },
];

export const EXECUTIVE_METRIC_OPTIONS = [
  { key: "revenue", label: "Facturación" },
  { key: "visits", label: "Visitas" },
];

export const GLOBAL_CONTEXT_METRICS = [
  "revenue",
  "visits",
  "market_share_revenue",
  "market_share_visits",
  "revenue_per_visit",
  "monetization_gap",
];

export const PROFILE_CHART_TABS = [
  {
    key: "revenue",
    label: "Facturación",
    metrics: ["revenue"],
  },
  {
    key: "visits",
    label: "Visitas",
    metrics: ["visits"],
  },
  {
    key: "share",
    label: "Cuota",
    metrics: ["market_share_revenue", "market_share_visits"],
  },
  {
    key: "efficiency",
    label: "Eficiencia",
    metrics: ["revenue_per_visit", "monetization_gap"],
  },
  {
    key: "ranking",
    label: "Ranking",
    metrics: ["rank_revenue", "rank_visits", "rank_share_revenue", "rank_share_visits"],
  },
];

export const PROFILE_FORECAST_METRICS = [
  { key: "visits", label: "Visitas" },
  { key: "revenue", label: "Facturación" },
];

export const DASHBOARD_CHART_METRICS = [
  "visits",
  "revenue",
  "market_share_visits",
  "market_share_revenue",
];

export const FORECAST_DETAIL_METRICS = ["visits", "revenue"];

export const DISTRIBUTION_METRICS = new Set([
  "revenue",
  "visits",
  "market_share_revenue",
  "market_share_visits",
]);

export const INDEXED_METRIC_OPTIONS = [
  { key: "indexed_revenue", label: "Facturación" },
  { key: "indexed_visits", label: "Visitas" },
];

export const MOMENTUM_METRIC_OPTIONS = [
  { key: "visits", label: "Visitas" },
  { key: "revenue", label: "Facturación" },
];

export const BATTLE_METRICS = [
  { key: "revenue", label: "Facturación", formatter: (value) => formatCurrency(value) },
  { key: "visits", label: "Visitas", formatter: (value) => formatCompact(value) },
  { key: "market_share_revenue", label: "Cuota facturación", formatter: (value) => formatPercent(value), deltaType: "sharePoints" },
  { key: "market_share_visits", label: "Cuota visitas", formatter: (value) => formatPercent(value), deltaType: "sharePoints" },
  { key: "revenue_yoy_growth", label: "Crecimiento facturación YoY", formatter: (value) => formatSignedPercent(value), deltaType: "percentagePoints" },
  { key: "visits_yoy_growth", label: "Crecimiento visitas YoY", formatter: (value) => formatSignedPercent(value), deltaType: "percentagePoints" },
  { key: "revenue_per_visit", label: "Revenue / visita", formatter: (value) => formatCurrencyDecimal(value) },
  { key: "monetization_gap", label: "Brecha monetización", formatter: (value) => formatPercentagePoints(value, { compact: true }), deltaType: "points" },
];

export const BATTLE_FORECAST_METRIC_OPTIONS = [
  { key: "visits", label: "Visitas" },
  { key: "revenue", label: "Facturación" },
];
