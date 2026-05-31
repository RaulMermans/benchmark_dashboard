import { formatMetric } from "./formatters.js";

export const COMPANY_COLORS = {
  focus: "#000000",
  peer_a: "#EC008C",
  market_average: "#94A3B8",
  peer_b: "#4B5563",
  peer_c: "#00A3A3",
  peer_e: "#F97316",
  peer_d: "#7C3AED",
  peer_f: "#DB2777",
  peer_g: "#2563EB",
  peer_h: "#C1121F",
  peer_i: "#64748B",
  peer_j: "#92400E",
  peer_k: "#6B7280",
  peer_l: "#6B7280",
  peer_m: "#6B7280",
  peer_n: "#6B7280",
};

const FALLBACK_COLOR = "#6B7280";

const METRIC_LABELS = {
  visits: "Visitas",
  revenue: "Facturación",
  market_share_visits: "Cuota visitas",
  market_share_revenue: "Cuota facturación",
  indexed_visits: "Índice visitas",
  indexed_revenue: "Índice facturación",
};

function normalizeCompanyId(companyId) {
  return String(companyId ?? "")
    .trim()
    .toLowerCase();
}

export function getCompanyColor(companyId) {
  return COMPANY_COLORS[normalizeCompanyId(companyId)] ?? FALLBACK_COLOR;
}

export function getMetricLabel(metric) {
  return METRIC_LABELS[metric] ?? metric;
}

export function formatMetricValue(metric, value) {
  return formatMetric(value, metric);
}
