import {
  formatCompact,
  formatCurrency,
  formatCurrencyDecimal,
  formatMetric,
  formatNumber,
  formatPercent,
  formatPercentagePoints,
  formatSignedPercent,
  safeNumber,
} from "./formatters.js";

const EMPTY_VALUE = "N/A";

export function formatMetricValue(value, formatterKey, options = {}) {
  switch (formatterKey) {
    case "currency":
      return formatCurrency(value);
    case "currencyDecimal":
      return formatCurrencyDecimal(value);
    case "compact":
      return formatCompact(value);
    case "percent":
      return formatPercent(value);
    case "signedPercent":
      return formatSignedPercent(value);
    case "percentagePoints":
      return formatPercentagePoints(value, options);
    case "rank": {
      const number = safeNumber(value);
      return number === null ? EMPTY_VALUE : `#${formatNumber(number, { maximumFractionDigits: 0 })}`;
    }
    case "number":
      return formatNumber(value, options);
    default:
      return formatMetric(value);
  }
}

export function getFormatterForMetric(metricKey) {
  if (metricKey === "revenue") return "currency";
  if (metricKey === "revenue_per_visit") return "currencyDecimal";
  if (metricKey === "visits") return "compact";
  if (metricKey?.startsWith("rank_")) return "rank";
  if (metricKey?.includes("share_change") || metricKey?.includes("_gap")) return "percentagePoints";
  if (metricKey?.startsWith("indexed_")) return "number";
  if (metricKey?.includes("market_share") || metricKey?.includes("growth")) return "percent";
  return "number";
}
