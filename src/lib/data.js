import { getCompanyColor } from "./companyColors.js";
import { safeNumber } from "./formatters.js";

const MARKET_AVERAGE_ID = "market_average";
const FORECAST_TYPES = new Set(["forecast", "forecasted", "forecasting", "forecast_line"]);
const BENCHMARK_TYPES = new Set(["benchmark", "market_average", "benchmark_line"]);
const TOTAL_ENTITY_TYPES = new Set(["total", "aggregate", "market_total", "market"]);
const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const NUMERIC_FIELDS = [
  "year",
  "month",
  "revenue",
  "visits",
  "market_share_revenue",
  "market_share_visits",
  "revenue_mom_growth",
  "revenue_yoy_growth",
  "visits_mom_growth",
  "visits_yoy_growth",
  "share_revenue_change_mom",
  "share_revenue_change_yoy",
  "share_revenue_change_range",
  "share_visits_change_mom",
  "share_visits_change_yoy",
  "share_visits_change_range",
  "revenue_per_visit",
  "revenue_share_vs_visit_share",
  "monetization_gap",
  "rank_revenue",
  "rank_visits",
  "rank_share_revenue",
  "rank_share_visits",
  "rank_change_revenue",
  "rank_change_visits",
  "indexed_revenue",
  "indexed_visits",
  "indexed_market_share_revenue",
];

const BOOLEAN_FIELDS = [
  "active",
  "has_revenue",
  "has_visits",
  "has_growth",
  "has_share_change",
  "has_efficiency",
  "has_event",
  "is_forecast",
  "partial_year",
];

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  const text = normalizeText(value);
  if (["true", "yes", "si", "sí"].includes(text)) return true;
  if (["false", "no"].includes(text)) return false;
  return Boolean(value);
}

export function buildMonthDate(year, month) {
  const numericMonth = Number(month);
  if (!year || !numericMonth) return "";
  return `${String(year)}-${String(numericMonth).padStart(2, "0")}-01`;
}

export function normalizeDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return buildMonthDate(value.getFullYear(), value.getMonth() + 1);
  }
  const text = String(value).trim();
  const monthMatch = text.match(/^(\d{4})-(\d{1,2})/);
  if (monthMatch) return buildMonthDate(monthMatch[1], monthMatch[2]);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return buildMonthDate(parsed.getFullYear(), parsed.getMonth() + 1);
  }
  return "";
}

function getMonthKeyFromDate(value) {
  return normalizeDate(value).slice(0, 7);
}

function getMonthParts(monthKey = "") {
  const match = String(monthKey).match(/^(\d{4})-(\d{2})$/);
  return match ? { year: match[1], month: Number(match[2]) } : { year: "", month: null };
}

function getRowMonthKey(row = {}) {
  const fromDate = getMonthKeyFromDate(row.date);
  if (fromDate) return fromDate;
  if (row.year && row.month) return `${row.year}-${String(row.month).padStart(2, "0")}`;
  return "";
}

function getRowYear(row = {}) {
  return String(row.year || getRowMonthKey(row).slice(0, 4) || "");
}

function getRowMonth(row = {}) {
  const month = safeNumber(row.month);
  if (month !== null) return month;
  const monthKey = getRowMonthKey(row);
  return monthKey ? Number(monthKey.slice(5, 7)) : null;
}

function compareMonthKeys(a = "", b = "") {
  return String(a).localeCompare(String(b));
}

function getSortValue(row = {}) {
  const date = normalizeDate(row.date);
  const parsed = Date.parse(date);
  if (!Number.isNaN(parsed)) return parsed;
  return Number(row.year || 0) * 100 + Number(row.month || 0);
}

function getPeriodType(row = {}) {
  const type = normalizeText(row.period_type || row.periodType);
  if (type === "yearly") return "annual";
  return type || "monthly";
}

export function formatMonthLabelFromKey(monthKey = "") {
  const { year, month } = getMonthParts(monthKey);
  if (!year || !month) return "";
  return `${MONTH_LABELS[month - 1] || month} ${year}`;
}

export function getDemoMonthLabel(month) {
  const numericMonth = Number(month);
  return MONTH_LABELS[numericMonth - 1] || "";
}

export function getPeriodLabel(row = {}) {
  return (
    row.period_display_label ||
    row.period_label ||
    (getPeriodType(row) === "annual" ? `Año ${getRowYear(row)}` : formatMonthLabelFromKey(getRowMonthKey(row))) ||
    row.date ||
    ""
  );
}

function getDisplayName(row = {}) {
  return row.display_name || row.company_name || row.company_id || "Empresa";
}

export function isForecastRow(row = {}) {
  const dataType = normalizeText(row.data_type);
  const type = normalizeText(row.type);
  const valueType = normalizeText(row.value_type);
  const visualRole = normalizeText(row.visual_role);
  return (
    normalizeBoolean(row.is_forecast) ||
    FORECAST_TYPES.has(dataType) ||
    FORECAST_TYPES.has(type) ||
    FORECAST_TYPES.has(valueType) ||
    visualRole.includes("forecast") ||
    normalizeText(row.forecast_scenario || row.scenario || row.forecastScenario || row.forecast_case).length > 0
  );
}

export function getForecastScenario(row = {}) {
  const scenario = normalizeText(
    row.forecast_scenario ||
      row.scenario ||
      row.forecastScenario ||
      row.forecast_case ||
      row.case ||
      row.strategic_signal,
  )
    .replace(/^forecast\s+/, "")
    .replace(/\s*[-|].*$/, "")
    .replace(/[\s-]+/g, "_");

  if (!scenario) return "unknown";
  if (scenario === "base" || scenario.includes("base_case")) return "base_case";
  if (scenario.includes("aggressive") || scenario.includes("agresivo")) return "aggressive";
  if (scenario.includes("conservative") || scenario.includes("conservador")) return "conservative";

  return "unknown";
}

export function isBenchmarkRow(row = {}) {
  const id = normalizeText(row.company_id);
  const type = normalizeText(row.type);
  const valueType = normalizeText(row.value_type);
  const visualRole = normalizeText(row.visual_role);
  return (
    id === MARKET_AVERAGE_ID ||
    BENCHMARK_TYPES.has(type) ||
    BENCHMARK_TYPES.has(valueType) ||
    BENCHMARK_TYPES.has(visualRole)
  );
}

export function isAggregateRow(row = {}) {
  return Boolean(row.aggregate_source || row.annual_source);
}

function isRealCompanyEntityRow(row = {}, { includeForecasts = false } = {}) {
  if (!row?.company_id) return false;
  if ("active" in row && normalizeBoolean(row.active) === false) return false;
  if (isBenchmarkRow(row)) return false;
  if (!includeForecasts && isForecastRow(row)) return false;
  if (isTotalOrAggregateEntityRow(row)) return false;
  return true;
}

function isTotalOrAggregateEntityRow(row = {}) {
  const entityValues = [
    row.company_id,
    row.type,
    row.value_type,
    row.visual_role,
  ].map(normalizeText);

  return entityValues.some(
    (value) =>
      TOTAL_ENTITY_TYPES.has(value) ||
      value.endsWith("_total") ||
      value.includes("aggregate")
  );
}

export function isRealCompanyRow(row = {}) {
  return isRealCompanyEntityRow(row);
}

export function isComparableRow(row = {}, options = {}) {
  const { includeForecasts = false, includeBenchmark = true } = options;
  if (!includeForecasts && isForecastRow(row)) return false;
  if (isBenchmarkRow(row)) return includeBenchmark;
  return isRealCompanyEntityRow(row, { includeForecasts });
}

export function isObservedRow(row = {}, options = {}) {
  if (isForecastRow(row)) return false;
  return isComparableRow(row, options);
}

function getRowFilter(options = {}) {
  const {
    includeForecasts = false,
    includeBenchmark = true,
    realOnly = false,
  } = options;

  return (row) => {
    if (realOnly) return isRealCompanyEntityRow(row, { includeForecasts });
    return isComparableRow(row, { includeForecasts, includeBenchmark });
  };
}

function normalizeRow(row = {}) {
  const normalized = { ...row };
  const date = normalizeDate(row.date || buildMonthDate(row.year, row.month));
  const month = safeNumber(row.month) ?? (date ? Number(date.slice(5, 7)) : null);
  const year = safeNumber(row.year) ?? (date ? Number(date.slice(0, 4)) : null);

  NUMERIC_FIELDS.forEach((field) => {
    if (field in normalized) normalized[field] = safeNumber(normalized[field]);
  });
  BOOLEAN_FIELDS.forEach((field) => {
    if (field in normalized) normalized[field] = normalizeBoolean(normalized[field]);
  });

  normalized.date = date || row.date || "";
  normalized.year = year;
  normalized.month = month;
  normalized.period_type = getPeriodType(normalized);
  normalized.company_id = row.company_id ? String(row.company_id).trim() : "";
  normalized.company_name = row.company_name || row.display_name || row.company_id || "";
  normalized.display_name = row.display_name || row.company_name || row.company_id || "";
  normalized.company_color =
    row.company_color || getCompanyColor(normalized.company_id, normalized.display_name);
  normalized.is_forecast = isForecastRow(normalized);
  normalized.data_type = row.data_type || (normalized.is_forecast ? "forecast" : "estimated");
  normalized.data_type_label = normalized.is_forecast ? "Proyección" : row.data_type_label || "";
  normalized.market = row.market || row.country || "";

  if (normalized.revenue_per_visit === null && normalized.revenue !== null && normalized.visits) {
    normalized.revenue_per_visit = normalized.revenue / normalized.visits;
  }
  if (normalized.monetization_gap === null) {
    const revenueShare = normalized.market_share_revenue;
    const visitsShare = normalized.market_share_visits;
    normalized.monetization_gap =
      revenueShare !== null && visitsShare !== null ? revenueShare - visitsShare : null;
  }

  return normalized;
}

export function normalizeInterfaceRows(rows = []) {
  return rows.map(normalizeRow).sort((a, b) => getSortValue(a) - getSortValue(b));
}

export function filterInterfaceRows(rows = [], filters = {}, options = {}) {
  const { periodType = "", market = "" } = filters;
  const rowFilter = getRowFilter(options);
  const normalizedPeriodType = normalizeText(periodType);

  return rows.filter((row) => {
    if (normalizedPeriodType && getPeriodType(row) !== normalizedPeriodType) return false;
    if (market && row.market !== market) return false;
    return rowFilter(row);
  });
}

export function getPeriodTypes(rows = [], options = {}) {
  return Array.from(
    new Set(rows.filter(getRowFilter(options)).map(getPeriodType).filter(Boolean)),
  ).sort();
}

export function getMarkets(rows = [], periodType = "", options = {}) {
  return Array.from(
    new Set(
      filterInterfaceRows(rows, { periodType }, options)
        .map((row) => row.market)
        .filter(Boolean),
    ),
  ).sort();
}

export function getUniqueCompanies(rows = [], options = {}) {
  const companyMap = new Map();
  rows.filter(getRowFilter({ includeBenchmark: false, ...options, realOnly: true })).forEach((row) => {
    const id = normalizeText(row.company_id);
    if (!id || companyMap.has(id)) return;
    companyMap.set(id, {
      id: row.company_id,
      label: getDisplayName(row),
      company_color: row.company_color,
      segment: row.segment || "",
    });
  });

  return Array.from(companyMap.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function getForecastRows(rows = []) {
  return rows.filter(isForecastRow);
}

function getPeriodKey(row = {}) {
  if (getPeriodType(row) === "annual") return `annual:${getRowYear(row)}`;
  return normalizeDate(row.date);
}

export function getAvailablePeriods(rows = [], options = {}) {
  const periodMap = new Map();
  rows.filter(getRowFilter(options)).forEach((row) => {
    const key = getPeriodKey(row);
    if (!key) return;
    const current = periodMap.get(key);
    const sortValue = getSortValue(row);
    if (!current || sortValue > current.sortValue) {
      periodMap.set(key, {
        key,
        date: normalizeDate(row.date),
        label: getPeriodLabel(row),
        sortValue,
        period_type: getPeriodType(row),
        year: getRowYear(row),
        month: getRowMonth(row),
        partial_year: Boolean(row.partial_year),
      });
    }
  });
  return Array.from(periodMap.values()).sort((a, b) => a.sortValue - b.sortValue);
}

export function getAvailableYearPeriods(rows = []) {
  const years = new Map();
  rows.filter(getRowFilter({ includeBenchmark: true })).forEach((row) => {
    const year = getRowYear(row);
    const month = getRowMonth(row);
    if (!year || !month) return;
    const current = years.get(year) ?? new Set();
    current.add(month);
    years.set(year, current);
  });

  return Array.from(years.entries())
    .map(([year, months]) => {
      const sortedMonths = Array.from(months).sort((a, b) => a - b);
      const first = sortedMonths[0];
      const last = sortedMonths.at(-1);
      const partial = sortedMonths.length < 12;
      return {
        key: year,
        label: partial
          ? `${year} parcial · ${getDemoMonthLabel(first)}-${getDemoMonthLabel(last)}`
          : `Año ${year}`,
        year,
        partial_year: partial,
        month_count: sortedMonths.length,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function getAvailableAnnualPeriods(rows = []) {
  return getAvailableYearPeriods(rows);
}

export function getRowsForPeriod(rows = [], periodKey = "") {
  return rows.filter((row) => getPeriodKey(row) === periodKey || normalizeDate(row.date) === periodKey);
}

export function getRowsForAnnualPeriod(rows = [], year = "") {
  return rows.filter((row) => getPeriodType(row) === "annual" && getRowYear(row) === String(year));
}

export function getAvailableYears(rows = [], selectedMetric = "revenue", options = {}) {
  const years = new Set();
  getMetricAvailabilityRows(rows, selectedMetric, options).forEach((row) => {
    const year = getRowYear(row);
    if (year) years.add(year);
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

export function getAvailableMonthsForYear(
  rows = [],
  year = "",
  selectedMetric = "revenue",
  options = {},
) {
  const months = new Set();
  getMetricAvailabilityRows(rows, selectedMetric, options)
    .filter((row) => getRowYear(row) === String(year))
    .forEach((row) => {
      const month = getRowMonth(row);
      if (month) months.add(month);
    });
  return Array.from(months).sort((a, b) => a - b);
}

export function getAvailableRangeBounds(rows = [], selectedMetric = "revenue", options = {}) {
  const monthMap = new Map();
  getMetricAvailabilityRows(rows, selectedMetric, options).forEach((row) => {
    const monthKey = getRowMonthKey(row);
    if (!monthKey || monthMap.has(monthKey)) return;
    const { year, month } = getMonthParts(monthKey);
    monthMap.set(monthKey, {
      key: monthKey,
      date: buildMonthDate(year, month),
      year,
      month,
      label: formatMonthLabelFromKey(monthKey),
      sortValue: getSortValue(row),
    });
  });
  const months = Array.from(monthMap.values()).sort((a, b) => compareMonthKeys(a.key, b.key));
  return {
    months,
    first: months[0] ?? null,
    last: months.at(-1) ?? null,
  };
}

function hasMetricRawValue(row = {}, metricKey = "") {
  return safeNumber(row?.[metricKey]) !== null;
}

export function hasDataForMetric(row = {}, selectedMetric = "revenue") {
  const metricKey = selectedMetric || "revenue";
  if (metricKey === "revenue") return hasMetricRawValue(row, "revenue");
  if (metricKey === "visits") return hasMetricRawValue(row, "visits");
  if (metricKey === "market_share_revenue") {
    return hasMetricRawValue(row, "market_share_revenue") || hasMetricRawValue(row, "revenue");
  }
  if (metricKey === "market_share_visits") {
    return hasMetricRawValue(row, "market_share_visits") || hasMetricRawValue(row, "visits");
  }
  if (metricKey === "revenue_per_visit") {
    return (
      hasMetricRawValue(row, "revenue_per_visit") ||
      (hasMetricRawValue(row, "revenue") && hasMetricRawValue(row, "visits") && safeNumber(row.visits) !== 0)
    );
  }
  if (metricKey === "monetization_gap") {
    return (
      hasMetricRawValue(row, "monetization_gap") ||
      (hasMetricRawValue(row, "market_share_revenue") && hasMetricRawValue(row, "market_share_visits"))
    );
  }
  if (metricKey === "growth") {
    return ["revenue_yoy_growth", "visits_yoy_growth", "revenue_mom_growth", "visits_mom_growth"].some(
      (key) => hasMetricRawValue(row, key),
    );
  }
  return hasMetricRawValue(row, metricKey);
}

function getMetricAvailabilityRows(rows = [], selectedMetric = "revenue", options = {}) {
  const { includeForecasts = false, includeBenchmark = false, market = "" } = options;
  return rows.filter((row) => {
    if (getPeriodType(row) !== "monthly") return false;
    if (market && row.market !== market) return false;
    if (!includeForecasts && isForecastRow(row)) return false;
    if (isBenchmarkRow(row) && !includeBenchmark) return false;
    if (!isBenchmarkRow(row) && !isRealCompanyEntityRow(row, { includeForecasts })) return false;
    return hasDataForMetric(row, selectedMetric);
  });
}

function getAvailabilityEntityRows(rows = [], options = {}) {
  return rows.filter(getRowFilter({ includeBenchmark: false, ...options, realOnly: true }));
}

function hasAnyMetricValue(rows = [], metricKeys = [], options = {}) {
  const keys = Array.isArray(metricKeys) ? metricKeys : [metricKeys];
  return getAvailabilityEntityRows(rows, options).some((row) =>
    keys.some((key) => hasDataForMetric(row, key)),
  );
}

export function hasRevenueData(rows = []) {
  return hasAnyMetricValue(rows, ["revenue"]);
}

export function hasVisitsData(rows = []) {
  return hasAnyMetricValue(rows, ["visits"]);
}

export function hasRevenueShareData(rows = []) {
  return hasAnyMetricValue(rows, ["market_share_revenue"]);
}

export function hasVisitsShareData(rows = []) {
  return hasAnyMetricValue(rows, ["market_share_visits"]);
}

export function hasMonetizationGapData(rows = []) {
  return hasAnyMetricValue(rows, ["monetization_gap"]);
}

export function hasGrowthData(rows = []) {
  return hasAnyMetricValue(rows, [
    "revenue_yoy_growth",
    "visits_yoy_growth",
    "revenue_mom_growth",
    "visits_mom_growth",
  ]);
}

function getRowsWithMetricAvailability(rows = [], metricKey = "", options = {}) {
  const { includeForecasts = false, includeBenchmark = false, market = "" } = options;
  return rows.filter((row) => {
    if (getPeriodType(row) !== "monthly") return false;
    if (market && row.market !== market) return false;
    if (!includeForecasts && isForecastRow(row)) return false;
    if (isBenchmarkRow(row)) return includeBenchmark && hasDataForMetric(row, metricKey);
    return isRealCompanyEntityRow(row, { includeForecasts }) && hasDataForMetric(row, metricKey);
  });
}

export function getLastAvailablePeriodForMetric(rows = [], metricKey = "revenue", options = {}) {
  const monthMap = new Map();
  getRowsWithMetricAvailability(rows, metricKey, options).forEach((row) => {
    const monthKey = getRowMonthKey(row);
    if (!monthKey) return;
    const { year, month } = getMonthParts(monthKey);
    monthMap.set(monthKey, {
      key: monthKey,
      date: buildMonthDate(year, month),
      year,
      month,
      label: formatMonthLabelFromKey(monthKey),
      sortValue: getSortValue(row),
    });
  });
  return Array.from(monthMap.values()).sort((a, b) => compareMonthKeys(a.key, b.key)).at(-1) ?? null;
}

function getMetricSourceLabel(rows = [], metricKey = "") {
  if (metricKey === "monetization_gap" || metricKey === "revenue_per_visit") {
    const sources = getAvailabilityEntityRows(rows)
      .flatMap((row) => [row.source, row.revenue_source, row.visits_source])
      .map(normalizeText)
      .filter(Boolean);
    const hasEcdb = sources.some((source) => source.includes("ecdb"));
    const hasMockSource = sources.some((source) => source.includes("mock_source"));
    return hasEcdb && hasMockSource ? "Mock revenue source + mock traffic source" : "Requiere facturación y visitas del mismo periodo";
  }
  if (metricKey.includes("growth")) return "periodo comparable";
  const sources = getAvailabilityEntityRows(rows)
    .filter((row) => hasDataForMetric(row, metricKey))
    .flatMap((row) => [row.source, row.revenue_source, row.visits_source])
    .map(normalizeText)
    .filter(Boolean);
  if (metricKey === "revenue" || metricKey === "market_share_revenue") {
    if (sources.some((source) => source.includes("ecdb"))) return "ECDB";
    return metricKey === "market_share_revenue" ? "recalculada desde facturación" : "datos disponibles";
  }
  if (metricKey === "visits" || metricKey === "market_share_visits") {
    if (sources.some((source) => source.includes("mock_source"))) return "Mock benchmark dataset";
    return metricKey === "market_share_visits" ? "recalculada desde visitas" : "datos disponibles";
  }
  if (sources.some((source) => source.includes("mock_source"))) return "Mock benchmark dataset";
  if (sources.some((source) => source.includes("ecdb"))) return "ECDB";
  return "datos disponibles";
}

function getUnavailableReason(metricKey = "", lastAvailablePeriod = null) {
  if (metricKey === "market_share_revenue") return "Sin facturación del periodo";
  if (metricKey === "market_share_visits") return "requiere visitas";
  if (metricKey === "monetization_gap" || metricKey === "revenue_per_visit") {
    return "Requiere facturación y visitas del mismo periodo";
  }
  if (metricKey === "growth" || metricKey.includes("growth")) return "requiere periodo comparable";
  return lastAvailablePeriod
    ? `Último dato: ${lastAvailablePeriod.label}`
    : "No disponible";
}

function buildMetricAvailabilityItem(metricKey, periodRows = [], allRows = [], context = {}) {
  const market = context.market || "";
  const available = getAvailabilityEntityRows(periodRows).some((row) => hasDataForMetric(row, metricKey));
  const lastAvailablePeriod = getLastAvailablePeriodForMetric(allRows, metricKey, { market });
  return {
    key: metricKey,
    label: getMetricLabel(metricKey),
    available,
    reason: available ? getMetricSourceLabel(periodRows, metricKey) : getUnavailableReason(metricKey, lastAvailablePeriod),
    lastAvailablePeriod,
    statusLabel: available ? "Disponible" : "No disponible",
  };
}

export function getMetricAvailability(periodRows = [], allRows = [], context = {}) {
  const metricKeys = [
    "revenue",
    "visits",
    "market_share_revenue",
    "market_share_visits",
    "monetization_gap",
    "growth",
    "revenue_mom_growth",
    "visits_mom_growth",
    "revenue_yoy_growth",
    "visits_yoy_growth",
    "revenue_per_visit",
    "indexed_revenue",
    "indexed_visits",
  ];
  const availability = metricKeys.reduce((result, key) => {
    result[key] = buildMetricAvailabilityItem(key, periodRows, allRows, context);
    return result;
  }, {});
  if (context.metric) {
    return availability[context.metric] ?? buildMetricAvailabilityItem(context.metric, periodRows, allRows, context);
  }
  availability.items = [
    availability.revenue,
    availability.visits,
    availability.market_share_revenue,
    availability.market_share_visits,
    availability.monetization_gap,
    availability.growth,
  ];
  return availability;
}

function getMetricLabel(metricKey = "") {
  const labels = {
    revenue: "Facturación",
    visits: "Visitas",
    market_share_revenue: "Cuota facturación",
    market_share_visits: "Cuota visitas",
    monetization_gap: "Brecha monetización",
    growth: "Crecimiento",
    revenue_yoy_growth: "Crecimiento facturación",
    visits_yoy_growth: "Crecimiento visitas",
    revenue_mom_growth: "Crecimiento facturación",
    visits_mom_growth: "Crecimiento visitas",
    revenue_per_visit: "Eficiencia",
    indexed_revenue: "Facturación",
    indexed_visits: "Visitas",
  };
  return labels[metricKey] || metricKey;
}

function sumAvailable(rows = [], metricKey = "") {
  let total = 0;
  let hasValue = false;
  rows.forEach((row) => {
    const value = safeNumber(row?.[metricKey]);
    if (value === null) return;
    total += value;
    hasValue = true;
  });
  return hasValue ? total : null;
}

function calculateGrowth(currentValue, previousValue) {
  const current = safeNumber(currentValue);
  const previous = safeNumber(previousValue);
  if (current === null || previous === null || previous === 0) return null;
  return current / previous - 1;
}

function getDateRangeRows(rows = [], startDate = "", endDate = "") {
  const startKey = String(startDate).slice(0, 7);
  const endKey = String(endDate).slice(0, 7);
  return rows.filter((row) => {
    const monthKey = getRowMonthKey(row);
    return monthKey >= startKey && monthKey <= endKey;
  });
}

function shiftDateRangeByYear(startDate = "", endDate = "", offset = -1) {
  const startKey = String(startDate).slice(0, 7);
  const endKey = String(endDate).slice(0, 7);
  const start = getMonthParts(startKey);
  const end = getMonthParts(endKey);
  if (!start.year || !end.year) return { startDate: "", endDate: "" };
  return {
    startDate: buildMonthDate(Number(start.year) + offset, start.month),
    endDate: buildMonthDate(Number(end.year) + offset, end.month),
  };
}

function getShareForMonth(rows = [], companyId = "", monthKey = "", shareMetric = "", monthlyTotals = new Map()) {
  const row = rows.find((item) => normalizeText(item.company_id) === normalizeText(companyId) && getRowMonthKey(item) === monthKey);
  if (!row) return null;
  const explicit = safeNumber(row?.[shareMetric]);
  if (explicit !== null) return explicit;
  const metric = shareMetric === "market_share_revenue" ? "revenue" : "visits";
  const value = safeNumber(row?.[metric]);
  const total = monthlyTotals.get(monthKey)?.[metric] ?? null;
  return value !== null && total ? value / total : null;
}

function calculateRangeShareChange(rows = [], companyId = "", shareMetric = "", startKey = "", endKey = "", monthlyTotals = new Map()) {
  const startShare = getShareForMonth(rows, companyId, startKey, shareMetric, monthlyTotals);
  const endShare = getShareForMonth(rows, companyId, endKey, shareMetric, monthlyTotals);
  return startShare !== null && endShare !== null ? endShare - startShare : null;
}

function getHistoricalGrowth(groupRows = [], metricKey = "") {
  const rowsWithMetric = groupRows
    .filter((row) => safeNumber(row?.[metricKey]) !== null)
    .sort((a, b) => getSortValue(a) - getSortValue(b));
  if (rowsWithMetric.length < 2) return null;
  const first = rowsWithMetric[0];
  const last = rowsWithMetric.at(-1);
  const previousValue = safeNumber(first?.[metricKey]);
  const currentValue = safeNumber(last?.[metricKey]);
  const growth = calculateGrowth(currentValue, previousValue);
  if (growth === null) return null;
  return {
    growth,
    previousValue,
    currentValue,
    previousDate: first.date,
    currentDate: last.date,
  };
}

function buildAggregatedLabel({ aggregationType, startDate, endDate, monthCount }) {
  const startKey = String(startDate).slice(0, 7);
  const endKey = String(endDate).slice(0, 7);
  const start = getMonthParts(startKey);
  const end = getMonthParts(endKey);
  if (aggregationType === "annual") {
    return monthCount < 12
      ? `${end.year} parcial · ${getDemoMonthLabel(start.month)}-${getDemoMonthLabel(end.month)}`
      : `Año ${end.year}`;
  }
  if (aggregationType === "historical") {
    return `Histórico · ${formatMonthLabelFromKey(startKey)}-${formatMonthLabelFromKey(endKey)}`;
  }
  return `Rango · ${formatMonthLabelFromKey(startKey)}-${formatMonthLabelFromKey(endKey)}`;
}

function assignRanks(rows = [], metricKey = "", rankKey = "") {
  rows
    .filter((row) => safeNumber(row?.[metricKey]) !== null)
    .sort((a, b) => safeNumber(b?.[metricKey]) - safeNumber(a?.[metricKey]))
    .forEach((row, index) => {
      row[rankKey] = index + 1;
    });
}

export function buildAggregatedRowsFromMonthly(rows = [], context = {}) {
  const {
    startDate = "",
    endDate = "",
    aggregationType = "range",
    includeBenchmark = false,
    includeForecasts = false,
  } = context;
  const startKey = String(startDate).slice(0, 7);
  const endKey = String(endDate).slice(0, 7);
  const sourceRows = rows.filter((row) => {
    if (getPeriodType(row) !== "monthly") return false;
    if (!includeForecasts && isForecastRow(row)) return false;
    const monthKey = getRowMonthKey(row);
    return monthKey >= startKey && monthKey <= endKey;
  });
  const realRows = sourceRows.filter((row) => isRealCompanyEntityRow(row, { includeForecasts }));
  const monthKeys = Array.from(new Set(realRows.map(getRowMonthKey))).sort(compareMonthKeys);
  const monthlyTotals = new Map();
  monthKeys.forEach((monthKey) => {
    const monthRows = realRows.filter((row) => getRowMonthKey(row) === monthKey);
    monthlyTotals.set(monthKey, {
      revenue: sumAvailable(monthRows, "revenue"),
      visits: sumAvailable(monthRows, "visits"),
    });
  });

  const currentTotalRevenue = sumAvailable(realRows, "revenue");
  const currentTotalVisits = sumAvailable(realRows, "visits");
  const previousRange = shiftDateRangeByYear(startDate, endDate, -1);
  const previousRows = getDateRangeRows(rows, previousRange.startDate, previousRange.endDate)
    .filter((row) => getPeriodType(row) === "monthly")
    .filter((row) => !isForecastRow(row))
    .filter((row) => isRealCompanyEntityRow(row));
  const previousTotalRevenue = sumAvailable(previousRows, "revenue");
  const previousTotalVisits = sumAvailable(previousRows, "visits");

  const groups = new Map();
  sourceRows
    .filter((row) => includeBenchmark || !isBenchmarkRow(row))
    .forEach((row) => {
      const id = normalizeText(row.company_id);
      if (!id) return;
      const group = groups.get(id) ?? [];
      group.push(row);
      groups.set(id, group);
    });

  const monthCount = monthKeys.length;
  const label = buildAggregatedLabel({ aggregationType, startDate, endDate, monthCount });
  const aggregatedRows = Array.from(groups.entries()).map(([id, groupRows]) => {
    const latestRow = groupRows.slice().sort((a, b) => getSortValue(b) - getSortValue(a))[0] ?? {};
    const revenue = sumAvailable(groupRows, "revenue");
    const visits = sumAvailable(groupRows, "visits");
    const isBenchmark = isBenchmarkRow(latestRow);
    const revenueShare = !isBenchmark && revenue !== null && currentTotalRevenue ? revenue / currentTotalRevenue : safeNumber(latestRow.market_share_revenue);
    const visitsShare = !isBenchmark && visits !== null && currentTotalVisits ? visits / currentTotalVisits : safeNumber(latestRow.market_share_visits);
    const previousCompanyRows = previousRows.filter((row) => normalizeText(row.company_id) === id);
    const previousRevenue = sumAvailable(previousCompanyRows, "revenue");
    const previousVisits = sumAvailable(previousCompanyRows, "visits");
    const previousRevenueShare =
      !isBenchmark && previousRevenue !== null && previousTotalRevenue
        ? previousRevenue / previousTotalRevenue
        : null;
    const previousVisitsShare =
      !isBenchmark && previousVisits !== null && previousTotalVisits
        ? previousVisits / previousTotalVisits
        : null;
    const revenueShareChangeYoY =
      revenueShare !== null && previousRevenueShare !== null
        ? revenueShare - previousRevenueShare
        : null;
    const visitsShareChangeYoY =
      visitsShare !== null && previousVisitsShare !== null
        ? visitsShare - previousVisitsShare
        : null;
    const revenueShareChangeRange = calculateRangeShareChange(sourceRows, id, "market_share_revenue", startKey, endKey, monthlyTotals);
    const visitsShareChangeRange = calculateRangeShareChange(sourceRows, id, "market_share_visits", startKey, endKey, monthlyTotals);
    const row = {
      ...latestRow,
      date: endDate,
      period_label: label,
      period_display_label: label,
      period_type: aggregationType === "annual" ? "annual" : aggregationType,
      aggregation_type: aggregationType,
      aggregate_source: "computed_from_monthly",
      year: Number(String(endDate).slice(0, 4)) || latestRow.year,
      month: null,
      latest_month: Number(String(endDate).slice(5, 7)) || null,
      latest_month_label: getDemoMonthLabel(Number(String(endDate).slice(5, 7))),
      month_count: monthCount,
      months_available: monthCount,
      month_keys_available: monthKeys,
      partial_year: aggregationType === "annual" && monthCount < 12,
      revenue,
      visits,
      market_share_revenue: revenueShare,
      market_share_visits: visitsShare,
      revenue_per_visit: revenue !== null && visits ? revenue / visits : null,
      revenue_share_vs_visit_share: revenueShare !== null && visitsShare ? revenueShare / visitsShare : null,
      monetization_gap: revenueShare !== null && visitsShare !== null ? revenueShare - visitsShare : null,
      revenue_yoy_growth: calculateGrowth(revenue, previousRevenue),
      visits_yoy_growth: calculateGrowth(visits, previousVisits),
      revenue_mom_growth: null,
      visits_mom_growth: null,
      share_revenue_change_mom: null,
      share_visits_change_mom: null,
      share_revenue_change_yoy: revenueShareChangeYoY,
      share_visits_change_yoy: visitsShareChangeYoY,
      share_revenue_change_range: revenueShareChangeRange,
      share_visits_change_range: visitsShareChangeRange,
      has_revenue: revenue !== null,
      has_visits: visits !== null,
      has_efficiency: revenue !== null && visits !== null && visits !== 0,
      has_share_change:
        startKey !== endKey ||
        revenueShareChangeYoY !== null ||
        visitsShareChangeYoY !== null,
      is_forecast: includeForecasts,
      data_type: includeForecasts ? "forecast" : "calculated",
      data_type_label: includeForecasts ? "Proyección" : "Calculado",
    };

    if (aggregationType === "historical") {
      const revenueGrowth = getHistoricalGrowth(groupRows, "revenue");
      const visitsGrowth = getHistoricalGrowth(groupRows, "visits");
      row.revenue_yoy_growth = revenueGrowth?.growth ?? null;
      row.visits_yoy_growth = visitsGrowth?.growth ?? null;
      row.revenue_growth_previous_value = revenueGrowth?.previousValue ?? null;
      row.revenue_growth_current_value = revenueGrowth?.currentValue ?? null;
      row.revenue_growth_previous_date = revenueGrowth?.previousDate ?? "";
      row.revenue_growth_current_date = revenueGrowth?.currentDate ?? "";
      row.visits_growth_previous_value = visitsGrowth?.previousValue ?? null;
      row.visits_growth_current_value = visitsGrowth?.currentValue ?? null;
      row.visits_growth_previous_date = visitsGrowth?.previousDate ?? "";
      row.visits_growth_current_date = visitsGrowth?.currentDate ?? "";
    }

    row.has_growth = row.revenue_yoy_growth !== null || row.visits_yoy_growth !== null;
    return row;
  });

  const realAggregatedRows = aggregatedRows.filter((row) => !isBenchmarkRow(row));
  assignRanks(realAggregatedRows, "revenue", "rank_revenue");
  assignRanks(realAggregatedRows, "visits", "rank_visits");
  assignRanks(realAggregatedRows, "market_share_revenue", "rank_share_revenue");
  assignRanks(realAggregatedRows, "market_share_visits", "rank_share_visits");

  return aggregatedRows;
}

export function getLatestCompanyRow(rows = [], companyId = "") {
  const id = normalizeText(companyId);
  return rows
    .filter((row) => normalizeText(row.company_id) === id)
    .filter(isRealCompanyRow)
    .sort((a, b) => getSortValue(b) - getSortValue(a))[0] ?? null;
}

export function getRankingRows(rows = [], sortKey = "revenue", options = {}) {
  const rowFilter = getRowFilter({ includeBenchmark: false, ...options, realOnly: true });
  return rows
    .filter(rowFilter)
    .map((row) => ({ row, value: safeNumber(row?.[sortKey]) }))
    .filter((entry) => entry.value !== null)
    .sort((a, b) => (b.value === a.value ? getDisplayName(a.row).localeCompare(getDisplayName(b.row)) : b.value - a.value))
    .map((entry) => entry.row);
}

export function groupSeriesByCompetitor(rows = [], metricKey, companyIds = [], options = {}) {
  const rowFilter = getRowFilter({ includeBenchmark: true, ...options });
  const companySet = new Set(
    (Array.isArray(companyIds) ? companyIds : [])
      .map((companyId) => normalizeText(companyId))
      .filter(Boolean),
  );
  const seriesMap = new Map();
  rows
    .filter(rowFilter)
    .filter((row) => !companySet.size || companySet.has(normalizeText(row.company_id)))
    .forEach((row) => {
      const value = safeNumber(row?.[metricKey]);
      if (value === null) return;
      const id = normalizeText(row.company_id);
      const series = seriesMap.get(id) ?? {
        company_id: row.company_id,
        display_name: getDisplayName(row),
        company_color: row.company_color,
        points: [],
      };
      series.points.push({
        date: normalizeDate(row.date),
        label: getPeriodLabel(row),
        value,
        period_key: getPeriodKey(row),
        sortValue: getSortValue(row),
        is_forecast: isForecastRow(row),
      });
      seriesMap.set(id, series);
    });

  return Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: series.points.sort((a, b) => a.sortValue - b.sortValue),
    }))
    .filter((series) => series.points.length > 0)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export function toMultiLineChartData(series = []) {
  const pointMap = new Map();
  series.forEach((companySeries) => {
    companySeries.points.forEach((point) => {
      const key = point.period_key || point.date || point.label;
      const current = pointMap.get(key) ?? {
        key,
        date: point.date,
        label: point.label,
        sortValue: point.sortValue,
      };
      current[companySeries.company_id] = point.value;
      current.__points = current.__points ?? {};
      current.__points[companySeries.company_id] = point;
      current.__points[normalizeText(companySeries.company_id)] = point;
      pointMap.set(key, current);
    });
  });
  return Array.from(pointMap.values()).sort((a, b) => a.sortValue - b.sortValue);
}
