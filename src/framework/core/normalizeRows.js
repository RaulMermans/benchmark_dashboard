import { getCompanyColor } from "../../lib/companyColors.js";
import { mergeBenchmarkConfig } from "../config/defaultBenchmarkConfig.js";
import {
  NUMERIC_FIELDS,
  hasText,
  isForecastRow,
  normalizeDate,
  normalizeText,
  safeNumber,
} from "./benchmarkUtils.js";

function normalizeActive(value) {
  if (value === false || value === 0) return false;
  if (value === true || value === 1 || value === null || value === undefined) return true;

  const text = normalizeText(value);
  if (!text) return true;
  return !["false", "0", "no", "inactive"].includes(text);
}

function normalizeDataType(row) {
  const raw = normalizeText(row?.data_type ?? row?.data_status ?? row?.value_type);
  if (isForecastRow(row)) return "forecast";
  if (["actual", "real", "historical", "observed"].includes(raw)) return "actual";
  if (["estimate", "estimated", "estimation"].includes(raw)) return "estimated";
  return raw || "estimated";
}

function normalizeHexColor(value, companyId) {
  const raw = String(value ?? "").trim();
  const withHash = raw && raw.startsWith("#") ? raw : raw ? `#${raw}` : "";

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) return withHash.toUpperCase();
  return getCompanyColor(companyId);
}

export function normalizeRows(rows = [], config = {}) {
  const mergedConfig = mergeBenchmarkConfig(config);
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const source = row ?? {};
    const companyId = String(source.company_id ?? source.companyId ?? "").trim();
    const displayName =
      source.display_name || source.displayName || source.company_name || source.companyName || companyId;
    const date = normalizeDate(source.date);
    const year = safeNumber(source.year) ?? safeNumber(date.slice(0, 4));
    const month = safeNumber(source.month) ?? safeNumber(date.slice(5, 7));
    const dataType = normalizeDataType(source);
    const forecastScenario =
      dataType === "forecast" ? String(source.forecast_scenario ?? source.scenario ?? "base_case").trim() : "";

    const normalized = {
      ...source,
      date,
      year,
      month,
      period_label: hasText(source.period_label) ? String(source.period_label).trim() : date,
      period_type: normalizeText(source.period_type) || "monthly",
      company_id: companyId,
      company_name: hasText(source.company_name) ? String(source.company_name).trim() : String(displayName || ""),
      display_name: String(displayName || "Unknown").trim(),
      type: normalizeText(source.type) || "competitor",
      market: hasText(source.market) ? String(source.market).trim() : mergedConfig.defaultMarket,
      revenue: safeNumber(source.revenue),
      visits: safeNumber(source.visits),
      data_type: dataType,
      is_forecast: dataType === "forecast",
      forecast_scenario: forecastScenario,
      active: normalizeActive(source.active),
      color: normalizeHexColor(source.color ?? source.company_color, companyId),
      company_color: normalizeHexColor(source.company_color ?? source.color, companyId),
    };

    NUMERIC_FIELDS.forEach((field) => {
      if (field in source) normalized[field] = safeNumber(source[field]);
    });

    return normalized;
  });
}
