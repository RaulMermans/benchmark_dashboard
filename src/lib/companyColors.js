import { formatMetric } from "./formatters.js";
export const COMPANY_COLORS={focus:"#111827",peer_a:"#2563EB",peer_b:"#7C3AED",peer_c:"#DB2777",peer_d:"#0F766E",peer_e:"#F97316",peer_f:"#64748B",peer_g:"#92400E",market_average:"#94A3B8"};
const FALLBACK_COLOR="#6B7280";
const METRIC_LABELS={visits:"Visits",revenue:"Revenue",market_share_visits:"Visit share",market_share_revenue:"Revenue share",indexed_visits:"Indexed visits",indexed_revenue:"Indexed revenue",indexed_market_share_revenue:"Indexed revenue share"};
function normalizeCompanyId(companyId){return String(companyId??"").trim().toLowerCase();}
export function getCompanyColor(companyId){return COMPANY_COLORS[normalizeCompanyId(companyId)]??FALLBACK_COLOR;}
export function getMetricLabel(metric){return METRIC_LABELS[metric]??metric;}
export function formatMetricValue(metric,value){return formatMetric(value,metric);}
