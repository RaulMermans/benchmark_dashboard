import { getCompanyColor } from "./companyColors.js";
import { safeNumber } from "./formatters.js";

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
  "share_visits_change_mom",
  "share_visits_change_yoy",
  "revenue_per_visit",
  "revenue_share_vs_visit_share",
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

const PERIOD_TYPE_ORDER = ["monthly", "quarterly", "annual"];
const FORECAST_DATA_TYPES = new Set([
  "forecast",
  "forecasted",
  "forecasting",
  "forecast_line",
  "projection",
  "projected",
  "prediction",
  "predicted",
  "proyeccion",
  "proyectado",
  "estimacion futura",
]);
const BENCHMARK_COMPANY_IDS = new Set(["market_average"]);
const BENCHMARK_TYPES = new Set(["benchmark"]);
const FORECAST_SCENARIOS = new Set(["base_case", "aggressive", "conservative"]);
const SPANISH_SHORT_MONTHS = [
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

function hasText(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeId(value) {
  return String(value ?? "").trim();
}

function normalizeActive(value) {
  if (value === false || value === 0) return false;
  if (value === true || value === 1 || value === null || value === undefined) return true;

  const text = normalizeText(value);
  if (!text) return true;

  return !["false", "0", "no", "inactive", "inactivo"].includes(text);
}

function normalizeBooleanFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;

  const text = normalizeText(value);
  return [
    "true",
    "1",
    "yes",
    "si",
    "forecast",
    "forecasted",
    "forecasting",
    "projection",
    "projected",
  ].includes(text);
}

function normalizeDataType(value) {
  const text = normalizeText(value);
  if (!text) return "estimated";

  if (FORECAST_DATA_TYPES.has(text)) return "forecast";
  if (["real", "actual", "historical", "historico", "observed"].includes(text)) return "actual";
  if (["estimate", "estimated", "estimado", "estimation"].includes(text)) return "estimated";

  return text;
}

function getDataTypeLabel(dataType) {
  if (dataType === "forecast") return "Forecast";
  if (dataType === "actual") return "Actual";
  if (dataType === "estimated") return "Estimado";
  return dataType || "Estimado";
}

function normalizeForecastScenarioValue(value) {
  const text = normalizeText(value)
    .replace(/^forecast\s+/, "")
    .replace(/\s*·.*$/, "")
    .replace(/\s*[|].*$/, "")
    .replace(/\s*·.*$/, "")
    .replace(/[\s-]+/g, "_");

  if (!text) return "";
  if (text.includes("base_case") || text === "base") return "base_case";
  if (text.includes("aggressive") || text.includes("agresivo")) return "aggressive";
  if (text.includes("conservative") || text.includes("conservador")) return "conservative";

  return text;
}

function hasExplicitForecastScenario(source) {
  const forecastFields = [
    source?.forecast_scenario,
    source?.forecast_case,
    source?.forecast_scenario_label,
  ];

  if (forecastFields.some(hasText)) return true;

  const scenario = normalizeForecastScenarioValue(source?.scenario ?? source?.case);
  return FORECAST_SCENARIOS.has(scenario);
}

function hasForecastSignal(source) {
  const visualRole = normalizeText(source?.visual_role);
  const strategicSignal = normalizeText(source?.strategic_signal);

  return visualRole.includes("forecast") || strategicSignal.includes("forecast");
}

function detectForecastRow(source, normalizedDataType) {
  const dataType = normalizedDataType || normalizeDataType(source?.data_type ?? source?.data_status);
  const valueType = normalizeDataType(source?.value_type);

  if (dataType === "actual") return false;

  return (
    dataType === "forecast" ||
    valueType === "forecast" ||
    normalizeBooleanFlag(source?.is_forecast) ||
    normalizeBooleanFlag(source?.forecast) ||
    hasExplicitForecastScenario(source) ||
    hasForecastSignal(source)
  );
}

function getForecastScenario(source, isForecast) {
  if (!isForecast) return "";

  return (
    normalizeForecastScenarioValue(
      source?.forecast_scenario ?? source?.scenario ?? source?.forecast_case ?? source?.case,
    ) ||
    normalizeForecastScenarioValue(source?.strategic_signal) ||
    "base_case"
  );
}

function getForecastScenarioLabel(scenario) {
  if (scenario === "base_case") return "Base";
  if (scenario === "aggressive") return "Agresivo";
  if (scenario === "conservative") return "Conservador";

  return String(scenario || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeHexColor(value, companyId) {
  const raw = String(value ?? "").trim();
  const withHash = raw && raw.startsWith("#") ? raw : raw ? `#${raw}` : "";

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) {
    return withHash.toUpperCase();
  }

  return getCompanyColor(companyId);
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

function getPeriodKey(row) {
  const date = normalizeDate(row?.date);
  if (date) return date;

  const year = hasText(row?.year) ? String(row.year).trim() : "";
  const month = hasText(row?.month) ? String(row.month).trim().padStart(2, "0") : "";
  const label = hasText(row?.period_label) ? String(row.period_label).trim() : "";

  return [year, month, label].filter(Boolean).join("-");
}

function getSortValue(row) {
  const date = normalizeDate(row?.date);
  if (date) {
    const parsed = new Date(date).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }

  const year = safeNumber(row?.year) ?? 0;
  const month = safeNumber(row?.month) ?? 1;
  return new Date(year, Math.max(0, month - 1), 1).getTime();
}

function getDisplayName(row) {
  return row?.display_name || row?.company_name || row?.company_id || "Unknown";
}

function isDateLikeLabel(value) {
  return /^\d{4}-\d{1,2}(?:-\d{1,2})?$/.test(String(value ?? "").trim());
}

function formatSpanishShortPeriodLabel(value) {
  const normalizedDate = normalizeDate(value);
  const match = normalizedDate.match(/^(\d{4})-(\d{2})/);
  if (!match) return "";

  const [, year, month] = match;
  const monthIndex = Number(month) - 1;
  const monthLabel = SPANISH_SHORT_MONTHS[monthIndex];

  return monthLabel ? `${monthLabel} ${year}` : "";
}

export function getPeriodLabel(row) {
  const explicitLabel = hasText(row?.period_label) ? String(row.period_label).trim() : "";

  if (explicitLabel && !isDateLikeLabel(explicitLabel)) {
    return explicitLabel;
  }

  return formatSpanishShortPeriodLabel(row?.date || explicitLabel) || "Período sin etiqueta";
}

export function isAggregateRow(row) {
  const values = [
    row?.company_id,
    row?.company_name,
    row?.display_name,
    row?.type,
    row?.segment,
    row?.market,
  ]
    .filter(hasText)
    .map(normalizeText);

  return values.some(
    (value) =>
      value.includes("market_total") ||
      value.includes("mercado_total") ||
      value.includes("total_market") ||
      value.includes("total mercado") ||
      value.includes("mercado total") ||
      value.includes("totales") ||
      value === "total" ||
      value.startsWith("total ") ||
      value.endsWith(" total"),
  );
}

function isActiveRow(row) {
  return row?.active === true;
}

function isCompanyEntityRow(row) {
  return isActiveRow(row) && hasText(row?.company_id) && !isAggregateRow(row);
}

export function isBenchmarkRow(row) {
  const companyId = normalizeText(row?.company_id);
  const type = normalizeText(row?.type);
  const valueType = normalizeText(row?.value_type);
  const visualRole = normalizeText(row?.visual_role);

  return (
    BENCHMARK_COMPANY_IDS.has(companyId) ||
    BENCHMARK_TYPES.has(type) ||
    BENCHMARK_TYPES.has(valueType) ||
    visualRole === "benchmark_line" ||
    visualRole.includes("benchmark")
  );
}

export function isForecastRow(row) {
  return detectForecastRow(row, normalizeDataType(row?.data_type ?? row?.data_status));
}

function isRealCompanyEntityRow(row, { includeForecasts = false } = {}) {
  if (!isCompanyEntityRow(row)) return false;
  if (isBenchmarkRow(row)) return false;
  if (!includeForecasts && isForecastRow(row)) return false;
  return true;
}

export function isRealCompanyRow(row) {
  return isRealCompanyEntityRow(row);
}

export function isComparableRow(
  row,
  { includeForecasts = false, includeBenchmark = true } = {},
) {
  if (!isCompanyEntityRow(row)) return false;
  if (!includeForecasts && isForecastRow(row)) return false;
  if (isBenchmarkRow(row)) {
    return includeBenchmark && !isForecastRow(row);
  }

  return true;
}

export function isValidCompanyRow(row) {
  return isComparableRow(row);
}

function getRowFilter({
  includeForecasts = false,
  includeBenchmark = true,
  realOnly = false,
} = {}) {
  if (realOnly) {
    return (row) => isRealCompanyEntityRow(row, { includeForecasts });
  }

  return (row) => isComparableRow(row, { includeForecasts, includeBenchmark });
}

export function normalizeInterfaceRows(rows = []) {
  if (!Array.isArray(rows)) return [];

  const normalizedRows = rows.map((row) => {
    const source = row ?? {};
    const companyId = normalizeId(source?.company_id);
    const baseDataType = normalizeDataType(source?.data_type ?? source?.data_status);
    const isForecast = detectForecastRow(source, baseDataType);
    const dataType = isForecast ? "forecast" : baseDataType;
    const forecastScenario = getForecastScenario(source, isForecast);
    const normalized = {
      ...source,
      company_id: companyId,
      company_name: hasText(source?.company_name) ? String(source.company_name).trim() : "",
      display_name: hasText(source?.display_name)
        ? String(source.display_name).trim()
        : getDisplayName({ ...source, company_id: companyId }),
      market: hasText(source?.market) ? String(source.market).trim() : "",
      segment: hasText(source?.segment) ? String(source.segment).trim() : "",
      period_type: hasText(source?.period_type) ? normalizeText(source.period_type) : "",
      period_label: hasText(source?.period_label) ? String(source.period_label).trim() : "",
      period_display_label: getPeriodLabel(source),
      date: normalizeDate(source?.date),
      active: normalizeActive(source?.active),
      company_color: normalizeHexColor(source?.company_color, companyId),
      data_type: dataType,
      data_type_label: getDataTypeLabel(dataType),
      is_forecast: isForecast,
      forecast_scenario: forecastScenario,
      forecast_scenario_label: getForecastScenarioLabel(forecastScenario),
    };

    NUMERIC_FIELDS.forEach((field) => {
      if (field in source) normalized[field] = safeNumber(source?.[field]);
    });

    return normalized;
  });

  return consolidateInterfaceRows(normalizedRows);
}

function getConsolidationKey(row) {
  return [
    row.period_type,
    row.market,
    row.company_id,
    row.date || row.period_label || `${row.year || ""}-${row.month || ""}`,
    row.data_type,
    row.is_forecast ? row.forecast_scenario : "",
  ].join("||");
}

function mergeInterfaceRows(current, row) {
  const merged = { ...current };

  Object.entries(row).forEach(([key, value]) => {
    if (NUMERIC_FIELDS.includes(key)) {
      if (merged[key] === null || merged[key] === undefined) {
        merged[key] = value;
      }
      return;
    }

    if (key.startsWith("has_") || key === "active" || key === "is_forecast") {
      merged[key] = Boolean(merged[key]) || Boolean(value);
      return;
    }

    if (!hasText(merged[key]) && hasText(value)) {
      merged[key] = value;
    }
  });

  return merged;
}

function consolidateInterfaceRows(rows = []) {
  const rowMap = new Map();

  rows.forEach((row) => {
    const key = getConsolidationKey(row);
    const current = rowMap.get(key);
    rowMap.set(key, current ? mergeInterfaceRows(current, row) : row);
  });

  return Array.from(rowMap.values());
}

export function getPeriodTypes(rows = [], options = {}) {
  const rowFilter = getRowFilter(options);
  const available = new Set(
    rows
      .filter(rowFilter)
      .map((row) => row.period_type)
      .filter(Boolean),
  );

  return Array.from(available).sort((a, b) => {
    const aIndex = PERIOD_TYPE_ORDER.indexOf(a);
    const bIndex = PERIOD_TYPE_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }
    return a.localeCompare(b);
  });
}

export function getMarkets(rows = [], periodType = "", options = {}) {
  const rowFilter = getRowFilter(options);
  const markets = new Set(
    rows
      .filter(rowFilter)
      .filter((row) => !periodType || row.period_type === periodType)
      .map((row) => row.market)
      .filter(Boolean),
  );

  return Array.from(markets).sort((a, b) => a.localeCompare(b));
}

export function filterInterfaceRows(
  rows = [],
  { periodType = "", market = "", startDate = "", endDate = "", companyIds = [] } = {},
  options = {},
) {
  const rowFilter = getRowFilter(options);
  const companySet = new Set(
    (Array.isArray(companyIds) ? companyIds : [])
      .map((companyId) => normalizeText(companyId))
      .filter(Boolean),
  );
  const startValue = startDate ? getSortValue({ date: startDate }) : null;
  const endValue = endDate ? getSortValue({ date: endDate }) : null;

  return rows
    .filter(rowFilter)
    .filter((row) => !periodType || row.period_type === periodType)
    .filter((row) => !market || row.market === market)
    .filter((row) => !companySet.size || companySet.has(normalizeText(row.company_id)))
    .filter((row) => {
      const sortValue = getSortValue(row);
      if (startValue !== null && sortValue < startValue) return false;
      if (endValue !== null && sortValue > endValue) return false;
      return true;
    });
}

export function getUniqueCompanies(rows = [], options = {}) {
  const rowFilter = getRowFilter({ includeBenchmark: false, ...options, realOnly: true });
  const companyMap = new Map();

  rows.filter(rowFilter).forEach((row) => {
    const key = normalizeText(row.company_id);
    if (!key || companyMap.has(key)) return;

    companyMap.set(key, {
      id: row.company_id,
      label: getDisplayName(row),
      company_color: row.company_color,
      market: row.market,
      segment: row.segment,
    });
  });

  return Array.from(companyMap.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function getAvailablePeriods(rows = [], options = {}) {
  const rowFilter = getRowFilter(options);
  const periodMap = new Map();

  rows.filter(rowFilter).forEach((row) => {
    const key = getPeriodKey(row);
    if (!key) return;

    const current =
      periodMap.get(key) ??
      {
        key,
        date: normalizeDate(row.date),
        label: getPeriodLabel(row),
        sortValue: getSortValue(row),
        has_forecast: false,
      };

    current.has_forecast = current.has_forecast || Boolean(row.is_forecast);
    periodMap.set(key, current);
  });


  return Array.from(periodMap.values()).sort((a, b) => a.sortValue - b.sortValue);
}

export function getForecastRows(rows = []) {
  return rows.filter(
    (row) => isRealCompanyEntityRow(row, { includeForecasts: true }) && isForecastRow(row),
  );
}

export function getLatestPeriod(rows = []) {
  const periods = getAvailablePeriods(rows);
  return periods[periods.length - 1] ?? null;
}

export function getLatestPeriodRows(rows = []) {
  const latestPeriod = getLatestPeriod(rows);
  if (!latestPeriod) return [];

  return getRowsForPeriod(rows, latestPeriod.key);
}

export function getRowsForPeriod(rows = [], periodKey = "") {
  if (!periodKey) return [];

  return rows.filter((row) => getPeriodKey(row) === periodKey);
}

export function getLatestCompanyRow(rows = [], companyId = "") {
  const normalizedCompanyId = normalizeText(companyId);

  return (
    rows
      .filter(isRealCompanyRow)
      .filter((row) => normalizeText(row.company_id) === normalizedCompanyId)
      .sort((a, b) => getSortValue(b) - getSortValue(a))[0] ?? null
  );
}

export function getRankingRows(rows = [], sortKey = "revenue", options = {}) {
  const rowFilter = getRowFilter({ includeBenchmark: false, ...options, realOnly: true });
  return rows
    .filter(rowFilter)
    .slice()
    .sort((a, b) => {
      const aValue = safeNumber(a?.[sortKey]);
      const bValue = safeNumber(b?.[sortKey]);

      if (aValue === null && bValue === null) {
        return getDisplayName(a).localeCompare(getDisplayName(b));
      }
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      return bValue - aValue;
    });
}

export function groupSeriesByCompetitor(rows = [], metricKey, companyIds = [], options = {}) {
  const rowFilter = getRowFilter(options);
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

      const companyKey = normalizeText(row.company_id);
      if (!companyKey) return;

      const current =
        seriesMap.get(companyKey) ??
        {
          company_id: row.company_id,
          display_name: getDisplayName(row),
          company_color: row.company_color,
          points: [],
        };

      current.points.push({
        date: normalizeDate(row.date),
        label: getPeriodLabel(row),
        value,
        period_key: getPeriodKey(row),
        sortValue: getSortValue(row),
        data_type: row.data_type,
        is_forecast: row.is_forecast,
      });
      seriesMap.set(companyKey, current);
    });

  return Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: series.points.sort((a, b) => a.sortValue - b.sortValue),
    }))
    .filter((series) => series.points.length > 0)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

function getInsightCompanyId(insight) {
  return normalizeId(
    insight?.company_id ??
      insight?.companyId ??
      insight?.company ??
      insight?.entity_id ??
      insight?.entityId,
  );
}

function normalizeInsightItem(insight, index) {
  const source = insight ?? {};
  const companyId = getInsightCompanyId(source);
  const rowLike = {
    ...source,
    company_id: companyId,
    active: source?.active ?? true,
  };

  if (companyId && (isBenchmarkRow(rowLike) || isForecastRow(rowLike))) {
    return null;
  }

  const title =
    source?.title ||
    source?.headline ||
    source?.insight_title ||
    source?.summary ||
    "Insight competitivo";
  const body =
    source?.body ||
    source?.message ||
    source?.description ||
    source?.insight ||
    source?.strategic_signal ||
    "";

  if (!hasText(title) && !hasText(body)) return null;
  const insightText = normalizeText(`${title} ${body}`);
  if (insightText.includes("market_average") || insightText.includes("promedio mercado")) {
    return null;
  }

  return {
    id: source?.id || source?.insight_id || `${companyId || "market"}-${index}`,
    title: String(title).trim(),
    body: hasText(body) ? String(body).trim() : "",
    company_id: companyId,
    company_name: source?.display_name || source?.company_name || source?.company || "",
    company_color: normalizeHexColor(source?.company_color, companyId),
    period_label: source?.period_label || source?.period || source?.date || "",
    priority: source?.priority || source?.strategic_priority || source?.severity || "",
    metric: source?.metric || source?.metric_key || "",
  };
}

export function getInsightItems(insights = [], rows = [], limit = 6) {
  if (Array.isArray(insights) && insights.length) {
    return insights
      .map(normalizeInsightItem)
      .filter(Boolean)
      .slice(0, limit);
  }

  const seen = new Set();
  return rows
    .filter(isRealCompanyRow)
    .filter((row) => hasText(row?.strategic_signal))
    .map((row, index) => {
      const key = `${normalizeText(row.company_id)}||${normalizeText(row.strategic_signal)}`;
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        id: `${row.company_id}-${row.date || row.period_label || index}`,
        title: getDisplayName(row),
        body: String(row.strategic_signal).trim(),
        company_id: row.company_id,
        company_name: getDisplayName(row),
        company_color: row.company_color,
        period_label: getPeriodLabel(row),
        priority: row.strategic_priority_label || row.strategic_priority || "",
        metric: "",
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

export function toMultiLineChartData(series = []) {
  const pointMap = new Map();

  series.forEach((companySeries) => {
    companySeries.points.forEach((point) => {
      const key = point.period_key || point.date || point.label;
      if (!key) return;

      const current =
        pointMap.get(key) ??
        {
          key,
          date: point.date,
          label: point.label || point.date || key,
          sortValue: point.sortValue,
          has_forecast: false,
        };

      current[companySeries.company_id] = point.value;
      current.has_forecast = current.has_forecast || Boolean(point.is_forecast);
      pointMap.set(key, current);
    });
  });

  return Array.from(pointMap.values()).sort((a, b) => a.sortValue - b.sortValue);
}
