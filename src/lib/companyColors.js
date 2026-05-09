import { formatMetric } from "./formatters.js";
export const COMPANY_COLORS={focus:"#111827",peer_a:"#2563EB",peer_b:"#7C3AED",peer_c:"#DB2777",peer_d:"#0F766E",peer_e:"#F97316",peer_f:"#64748B",peer_g:"#92400E",market_average:"#94A3B8"};
const FALLBACK_COLOR="#6B7280";
const METRIC_LABELS={visits:"Visitas",revenue:"Facturación",market_share_visits:"Cuota visitas",market_share_revenue:"Cuota facturación",indexed_visits:"Índice visitas",indexed_revenue:"Índice facturación",indexed_market_share_revenue:"Índice cuota facturación"};
function normalizeCompanyId(companyId){return String(companyId??"").trim().toLowerCase();}
export function getCompanyColor(companyId){return COMPANY_COLORS[normalizeCompanyId(companyId)]??FALLBACK_COLOR;}
export function getMetricLabel(metric){return METRIC_LABELS[metric]??metric;}
export function formatMetricValue(metric,value){return formatMetric(value,metric);}
