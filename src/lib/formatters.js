const EMPTY_VALUE = "N/A";

export function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const compact = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/€/g, "");

  if (!compact) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma > -1 && lastDot > -1) {
    normalized =
      lastComma > lastDot
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
  } else if (lastComma > -1) {
    normalized = compact.replace(",", ".");
  } else if ((compact.match(/\./g) || []).length > 1) {
    normalized = compact.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasNumber(value) {
  return safeNumber(value) !== null;
}

export function formatCurrency(value) {
  const number = safeNumber(value);
  if (number === null) return EMPTY_VALUE;

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(number);
}

export function formatCurrencyDecimal(value) {
  const number = safeNumber(value);
  if (number === null) return EMPTY_VALUE;

  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

export function formatNumber(value, options = {}) {
  const number = safeNumber(value);
  if (number === null) return EMPTY_VALUE;

  return new Intl.NumberFormat("es-ES", options).format(number);
}

export function formatCompact(value) {
  const number = safeNumber(value);
  if (number === null) return EMPTY_VALUE;

  return new Intl.NumberFormat("es-ES", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

export function formatPercent(value) {
  const number = safeNumber(value);
  if (number === null) return EMPTY_VALUE;

  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(normalized)}%`;
}

export function formatPp(value) {
  const number = safeNumber(value);
  if (number === null) return EMPTY_VALUE;

  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  const sign = normalized > 0 ? "+" : "";

  return `${sign}${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized)} pp`;
}

export function formatMetric(value, metricKey) {
  if (metricKey === "revenue") {
    return formatCurrency(value);
  }

  if (metricKey === "revenue_per_visit") {
    return formatCurrencyDecimal(value);
  }

  if (metricKey === "visits") {
    return formatCompact(value);
  }

  if (metricKey?.startsWith("rank_")) {
    const number = safeNumber(value);
    return number === null ? EMPTY_VALUE : `#${formatNumber(number, { maximumFractionDigits: 0 })}`;
  }

  if (metricKey?.includes("share_change")) {
    return formatPp(value);
  }

  if (metricKey?.includes("market_share") || metricKey?.includes("growth")) {
    return formatPercent(value);
  }

  const number = safeNumber(value);
  if (number === null) return EMPTY_VALUE;

  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2,
  }).format(number);
}
