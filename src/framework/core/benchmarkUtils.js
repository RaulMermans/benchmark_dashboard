export const REQUIRED_INTERFACE_FIELDS = [
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

export const DERIVED_NUMERIC_FIELDS = [
  "market_share_revenue",
  "market_share_visits",
  "revenue_yoy_growth",
  "visits_yoy_growth",
  "revenue_mom_growth",
  "visits_mom_growth",
  "rank_revenue",
  "rank_visits",
  "revenue_per_visit",
  "revenue_share_vs_visit_share",
  "indexed_revenue",
  "indexed_visits",
  "indexed_market_share_revenue",
];

export const NUMERIC_FIELDS = [
  "year",
  "month",
  "revenue",
  "visits",
  ...DERIVED_NUMERIC_FIELDS,
  "rank_share_revenue",
  "rank_share_visits",
  "share_revenue_change_mom",
  "share_revenue_change_yoy",
  "share_visits_change_mom",
  "share_visits_change_yoy",
];

export function hasText(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const compact = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/[$€£]/g, "");

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

export function normalizeDate(value) {
  if (!hasText(value)) return "";

  if (typeof value === "number" && Number.isFinite(value) && value > 10000) {
    const serialEpoch = Date.UTC(1899, 11, 30);
    return new Date(serialEpoch + value * 86400000).toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  const dateOnly = raw.includes("T") ? raw.split("T")[0] : raw;
  const europeanDate = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (europeanDate) {
    const [, day, month, year] = europeanDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(dateOnly);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return dateOnly;
}

export function getPeriodKey(row) {
  return [
    row?.period_type || "",
    row?.market || "",
    row?.date || row?.period_label || `${row?.year || ""}-${row?.month || ""}`,
    row?.is_forecast ? row?.forecast_scenario || "" : "",
  ].join("||");
}

export function getEntityPeriodKey(row) {
  return [row?.company_id || "", getPeriodKey(row)].join("||");
}

export function getSortValue(row) {
  const date = normalizeDate(row?.date);
  if (date) {
    const parsed = new Date(date).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }

  const year = safeNumber(row?.year) ?? 0;
  const month = safeNumber(row?.month) ?? 1;
  return new Date(year, Math.max(0, month - 1), 1).getTime();
}

export function getYearMonth(row) {
  const date = normalizeDate(row?.date);
  const match = date.match(/^(\d{4})-(\d{2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) };

  return {
    year: safeNumber(row?.year),
    month: safeNumber(row?.month),
  };
}

export function isForecastRow(row) {
  if (row?.is_forecast === true) return true;
  const dataType = normalizeText(row?.data_type ?? row?.value_type);
  if (dataType.includes("forecast") || dataType.includes("project")) return true;
  return hasText(row?.forecast_scenario);
}

export function isBenchmarkRow(row) {
  return normalizeText(row?.type) === "benchmark" || normalizeText(row?.company_id) === "market_average";
}

export function roundMetric(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

export function shouldWriteDerived(row, field, preserveExisting = true) {
  return !preserveExisting || safeNumber(row?.[field]) === null;
}

export function groupRows(rows = [], keyFn) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  });
  return groups;
}
