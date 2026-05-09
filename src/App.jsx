import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  LabelList,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import KpiCard from "./components/KpiCard";
import Panel from "./components/Panel";
import { loadBenchmarkData } from "./lib/api.js";
import { getCompanyLogoSrc } from "./lib/companyLogos.js";
import {
  filterInterfaceRows,
  getAvailablePeriods,
  getForecastRows,
  getInsightItems,
  getMarkets,
  getPeriodTypes,
  getRankingRows,
  getRowsForPeriod,
  getUniqueCompanies,
  groupSeriesByCompetitor,
  isBenchmarkRow,
  isComparableRow,
  isForecastRow,
  isRealCompanyRow,
  normalizeInterfaceRows,
  toMultiLineChartData,
} from "./lib/data.js";
import {
  formatCompact,
  formatCurrency,
  formatCurrencyDecimal,
  formatMetric,
  formatPercent,
  formatPp,
  safeNumber,
} from "./lib/formatters.js";

const OWN_COMPANY_ID = "focus";
const MARKET_BENCHMARK_ID = "market_average";
const CORE_RACE_COMPANY_IDS = [OWN_COMPANY_ID, "peer_a", "peer_b", MARKET_BENCHMARK_ID];
const BATTLE_TARGET_IDS = ["peer_a", "peer_b", MARKET_BENCHMARK_ID];

const PERIOD_TYPE_LABELS = {
  monthly: "Mes",
  annual: "Año",
  yearly: "Año",
  quarterly: "Trimestre",
};

const DASHBOARD_PERIOD_TYPE_ORDER = ["monthly", "quarterly", "annual"];
const FORECAST_SCENARIO_ORDER = ["base_case", "aggressive", "conservative"];

const RANKING_SORTS = [
  { key: "revenue", label: "Facturación" },
  { key: "visits", label: "Visitas" },
  { key: "market_share_revenue", label: "Cuota facturación" },
  { key: "market_share_visits", label: "Cuota visitas" },
  { key: "revenue_per_visit", label: "Revenue por visita" },
  { key: "revenue_mom_growth", label: "Crecimiento facturación MoM" },
  { key: "visits_mom_growth", label: "Crecimiento visitas MoM" },
  { key: "revenue_yoy_growth", label: "Crecimiento facturación YoY" },
  { key: "visits_yoy_growth", label: "Crecimiento visitas YoY" },
];

const HOME_HASH = "#/benchmark";
const FORECAST_HASH = "#/forecast";
const PROFILE_HASH_PREFIX = "#/empresa/";
const APP_LOGO_SRC = "/assets/logo-focus.svg";
const EMPTY_HIDDEN_COMPANY_IDS = new Set();

const PROFILE_CHARTS = [
  { metricKey: "visits", title: "Evolución de visitas" },
  { metricKey: "revenue", title: "Evolución de facturación" },
  { metricKey: "market_share_visits", title: "Evolución cuota de visitas" },
  { metricKey: "revenue_per_visit", title: "Evolución revenue por visita" },
];
const DASHBOARD_CHART_METRICS = [
  "visits",
  "revenue",
  "market_share_visits",
  "market_share_revenue",
  "indexed_revenue",
  "indexed_visits",
  "indexed_market_share_revenue",
];
const FORECAST_DETAIL_METRICS = ["visits", "revenue"];
const DISTRIBUTION_METRICS = new Set([
  "revenue",
  "visits",
  "market_share_revenue",
  "market_share_visits",
]);
const INDEXED_METRIC_OPTIONS = [
  { key: "indexed_revenue", label: "Facturacion" },
  { key: "indexed_visits", label: "Visitas" },
  { key: "indexed_market_share_revenue", label: "Cuota facturacion" },
];
const EXECUTIVE_METRIC_LABELS = {
  revenue: "facturacion",
  visits: "visitas",
  market_share_revenue: "cuota de facturacion",
  market_share_visits: "cuota de visitas",
  revenue_yoy_growth: "crecimiento facturacion YoY",
  visits_yoy_growth: "crecimiento visitas YoY",
  share_revenue_change_yoy: "cuota facturacion YoY",
  share_revenue_change_mom: "cuota facturacion MoM",
  share_visits_change_yoy: "cuota visitas YoY",
  share_visits_change_mom: "cuota visitas MoM",
  revenue_per_visit: "revenue por visita",
  indexed_revenue: "indice facturacion",
  indexed_visits: "indice visitas",
  indexed_market_share_revenue: "indice cuota facturacion",
};
const BATTLE_METRICS = [
  { key: "revenue", label: "Facturacion", formatter: (value) => formatCurrency(value) },
  { key: "visits", label: "Visitas", formatter: (value) => formatCompact(value) },
  { key: "market_share_revenue", label: "Cuota facturacion", formatter: (value) => formatPercent(value), deltaType: "pp" },
  { key: "market_share_visits", label: "Cuota visitas", formatter: (value) => formatPercent(value), deltaType: "pp" },
  { key: "revenue_yoy_growth", label: "Revenue YoY", formatter: (value) => formatSignedPercent(value), deltaType: "pp" },
  { key: "visits_yoy_growth", label: "Visitas YoY", formatter: (value) => formatSignedPercent(value), deltaType: "pp" },
  { key: "revenue_per_visit", label: "Revenue / visita", formatter: (value) => formatCurrencyDecimal(value) },
];

function normalizeCompanyId(companyId) {
  return String(companyId ?? "")
    .trim()
    .toLowerCase();
}

function sameCompany(a, b) {
  return normalizeCompanyId(a) === normalizeCompanyId(b);
}

function getCompanyLabel(rowOrCompany) {
  return (
    rowOrCompany?.label ||
    rowOrCompany?.display_name ||
    rowOrCompany?.company_name ||
    rowOrCompany?.company_id ||
    "N/A"
  );
}

function formatGeneratedAt(value) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("es-ES");
}

function parseRouteFromHash(hash = "") {
  const normalizedHash = String(hash || "").trim();

  if (
    !normalizedHash ||
    normalizedHash === "#" ||
    normalizedHash === "#/" ||
    normalizedHash === HOME_HASH
  ) {
    return { view: "home", companyId: "" };
  }

  if (normalizedHash === FORECAST_HASH) {
    return { view: "forecast", companyId: "" };
  }

  if (normalizedHash.startsWith(PROFILE_HASH_PREFIX)) {
    const rawCompanyId = normalizedHash
      .slice(PROFILE_HASH_PREFIX.length)
      .split("?")[0];

    try {
      return { view: "profile", companyId: decodeURIComponent(rawCompanyId) };
    } catch {
      return { view: "profile", companyId: rawCompanyId };
    }
  }

  return { view: "home", companyId: "" };
}

function getCurrentRoute() {
  if (typeof window === "undefined") return { view: "home", companyId: "" };

  return parseRouteFromHash(window.location.hash);
}

function getProfileHash(companyId) {
  return `${PROFILE_HASH_PREFIX}${encodeURIComponent(companyId)}`;
}

function navigateToHash(hash) {
  if (typeof window === "undefined") return;

  if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

function getSeriesVisibilityKey(series = []) {
  return series.map((companySeries) => normalizeCompanyId(companySeries.company_id)).join("|");
}

function getCompanyIdSet(companyIds = []) {
  return new Set(companyIds.map(normalizeCompanyId).filter(Boolean));
}

function mergeSeriesForLegend(seriesGroups = []) {
  const seriesMap = new Map();

  seriesGroups.flat().forEach((companySeries) => {
    const companyKey = normalizeCompanyId(companySeries?.company_id);
    if (!companyKey || seriesMap.has(companyKey)) return;

    seriesMap.set(companyKey, companySeries);
  });

  return Array.from(seriesMap.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
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

function getAvailableForecastScenarios(rows = []) {
  const scenarios = new Set(
    rows
      .filter(isForecastRow)
      .map((row) => normalizeCompanyId(row.forecast_scenario))
      .filter(Boolean),
  );

  return Array.from(scenarios).sort((a, b) => {
    const aIndex = FORECAST_SCENARIO_ORDER.indexOf(a);
    const bIndex = FORECAST_SCENARIO_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }
    return a.localeCompare(b);
  });
}

function filterRowsByForecastScenario(rows = [], forecastScenario = "") {
  if (!forecastScenario) return rows;

  return rows.filter(
    (row) => !isForecastRow(row) || normalizeCompanyId(row.forecast_scenario) === forecastScenario,
  );
}

function getComparableRowKey(row) {
  return [
    row.period_type,
    row.market,
    row.company_id,
    row.date || row.period_label || `${row.year || ""}-${row.month || ""}`,
  ].join("||");
}

function preferObservedRows(rows = []) {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const key = getComparableRowKey(row);
    const current = groupedRows.get(key) ?? [];
    current.push(row);
    groupedRows.set(key, current);
  });

  return Array.from(groupedRows.values()).flatMap((group) => {
    const observedRows = group.filter((row) => !isForecastRow(row));
    return observedRows.length ? observedRows : group;
  });
}

function getForecastWindow(chartData = []) {
  const forecastPoints = chartData.filter((point) => point.has_forecast);
  if (!forecastPoints.length) return null;

  return {
    start: forecastPoints[0],
    end: forecastPoints[forecastPoints.length - 1],
  };
}

function DataTypeBadge({ row }) {
  if (!isForecastRow(row)) return null;

  return <span className="data-type-badge data-type-badge-forecast">Forecast</span>;
}

function getRowYear(row) {
  const explicitYear = Number(row?.year);
  if (Number.isFinite(explicitYear) && explicitYear > 0) return String(explicitYear);

  const dateMatch = String(row?.date || "").match(/^(\d{4})/);
  return dateMatch ? dateMatch[1] : "";
}

function getRowPeriodSortValue(row) {
  const dateValue = String(row?.date || "");
  const parsedDate = Date.parse(dateValue);
  if (!Number.isNaN(parsedDate)) return parsedDate;

  const year = Number(row?.year);
  const month = Number(row?.month);
  return new Date(
    Number.isFinite(year) ? year : 0,
    Number.isFinite(month) ? Math.max(0, month - 1) : 0,
    1,
  ).getTime();
}

function hasMetricValue(row, metricKey) {
  return safeNumber(row?.[metricKey]) !== null;
}

function filterRowsWithMetrics(rows = [], metricKeys = [], requireAll = true) {
  const keys = Array.isArray(metricKeys) ? metricKeys.filter(Boolean) : [];
  if (!keys.length) return rows;

  return rows.filter((row) => {
    const checks = keys.map((metricKey) => hasMetricValue(row, metricKey));
    return requireAll ? checks.every(Boolean) : checks.some(Boolean);
  });
}

function getAvailableRankingSorts(rows = []) {
  return RANKING_SORTS.filter((sort) => rows.some((row) => hasMetricValue(row, sort.key)));
}

function getDashboardPeriodTypes(rows = [], sourcePeriodTypes = []) {
  const periodTypeSet = new Set(sourcePeriodTypes);
  const hasDatedRows = rows.some((row) => getRowYear(row));

  if ((periodTypeSet.has("monthly") || hasDatedRows) && !periodTypeSet.has("annual")) {
    periodTypeSet.add("annual");
  }

  return Array.from(periodTypeSet).sort((a, b) => {
    const aIndex = DASHBOARD_PERIOD_TYPE_ORDER.indexOf(a);
    const bIndex = DASHBOARD_PERIOD_TYPE_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }
    return a.localeCompare(b);
  });
}

function getRankingPeriodTypes(rows = [], sourcePeriodTypes = [], sortKey = "") {
  const periodTypes = getDashboardPeriodTypes(rows, sourcePeriodTypes);

  if (!isMoMGrowthMetric(sortKey)) return periodTypes;

  const monthlyTypes = periodTypes.filter((type) => type === "monthly");
  return monthlyTypes.length ? monthlyTypes : periodTypes;
}

function getSourcePeriodType(periodType, sourcePeriodTypes = []) {
  if (periodType !== "annual") return periodType;
  if (sourcePeriodTypes.includes("annual")) return "annual";
  if (sourcePeriodTypes.includes("monthly")) return "monthly";
  return sourcePeriodTypes[0] || "";
}

function getAvailableAnnualPeriods(rows = []) {
  const periodMap = new Map();

  rows.forEach((row) => {
    const year = getRowYear(row);
    if (!year) return;

    const sortValue = getRowPeriodSortValue(row);
    const current =
      periodMap.get(year) ??
      {
        key: year,
        date: row.date,
        label: year,
        sortValue,
        has_forecast: false,
      };

    current.sortValue = Math.max(current.sortValue, sortValue);
    current.has_forecast = current.has_forecast || Boolean(row.is_forecast);
    periodMap.set(year, current);
  });

  return Array.from(periodMap.values()).sort((a, b) => a.sortValue - b.sortValue);
}

function getRowsForAnnualPeriod(rows = [], year = "") {
  if (!year) return [];

  const yearRows = rows.filter((row) => getRowYear(row) === String(year));
  if (!yearRows.length) return [];

  const latestSortValue = Math.max(...yearRows.map(getRowPeriodSortValue));
  return yearRows.filter((row) => getRowPeriodSortValue(row) === latestSortValue);
}

function getAvailableChartYears(rows = [], metricKeys = []) {
  const rowsWithData = filterRowsWithMetrics(rows, metricKeys, false);

  return Array.from(new Set(rowsWithData.map(getRowYear).filter(Boolean))).sort((a, b) =>
    b.localeCompare(a),
  );
}

function filterRowsByChartRange(rows = [], chartRangeMode, selectedChartYear) {
  if (chartRangeMode !== "year" || !selectedChartYear) return rows;

  return rows.filter((row) => getRowYear(row) === selectedChartYear);
}

function EmptyState({ title, message }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-black/15 bg-[#fbf8f5] p-8 text-center">
      <div>
        <p className="text-sm font-semibold text-black">{title}</p>
        {message && <p className="mt-2 text-sm leading-6 text-neutral-500">{message}</p>}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, children, disabled = false, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="analysis-label">{label}</span>
      <select
        className="control w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </label>
  );
}

function StatusShell({ title, message }) {
  return (
    <main className="app-shell">
      <div className="mx-auto max-w-3xl">
        <Panel eyebrow="Benchmark Intelligence" title="Benchmark Dashboard">
          <EmptyState title={title} message={message} />
        </Panel>
      </div>
    </main>
  );
}

function BrandLogo() {
  return <img className="brand-logo" src={APP_LOGO_SRC} alt="Focus Brand" />;
}

function getCompanyFallbackLabel(label, companyId) {
  const displayLabel = label || companyId || "Empresa";

  return String(displayLabel).trim().slice(0, 1).toUpperCase() || "?";
}

function CompanyMark({ companyId, label, color = "#6F6864", className = "" }) {
  const [hasLogoError, setHasLogoError] = useState(false);
  const logoSrc = getCompanyLogoSrc(companyId);
  const fallbackLabel = getCompanyFallbackLabel(label, companyId);

  return (
    <span className={`company-mark ${className}`} aria-hidden="true">
      {logoSrc && !hasLogoError ? (
        <img
          src={logoSrc}
          alt=""
          loading="lazy"
          className="company-mark-logo"
          onError={() => setHasLogoError(true)}
        />
      ) : (
        <span className="company-mark-fallback" style={{ backgroundColor: color }}>
          {fallbackLabel}
        </span>
      )}
    </span>
  );
}

function SvgCompanyLogoBadge({
  companyId,
  label,
  color = "#6F6864",
  x = 0,
  y = 0,
  width = 34,
  height = 24,
}) {
  const logoSrc = getCompanyLogoSrc(companyId);
  const fallbackLabel = getCompanyFallbackLabel(label, companyId);
  const centerX = width / 2;
  const centerY = height / 2;

  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect
        width={width}
        height={height}
        rx="4"
        fill="#ffffff"
        stroke="rgba(0,0,0,0.16)"
        strokeWidth="1"
      />
      {logoSrc ? (
        <image
          href={logoSrc}
          x="4"
          y="4"
          width={width - 8}
          height={height - 8}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <>
          <circle cx={centerX} cy={centerY} r={Math.min(width, height) / 3} fill={color} />
          <text
            x={centerX}
            y={centerY}
            fill="#ffffff"
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {fallbackLabel}
          </text>
        </>
      )}
    </g>
  );
}

function ChartTooltipShell({ title, children }) {
  return (
    <div className="chart-tooltip">
      {title && <p className="chart-tooltip-title">{title}</p>}
      <div className="chart-tooltip-list">{children}</div>
    </div>
  );
}

function MultiSeriesTooltip({ active, payload = [], label, metricKey, seriesById }) {
  if (!active || !payload.length) return null;

  const rows = payload
    .map((item) => {
      const value = safeNumber(item.value);
      if (value === null) return null;

      const companyInfo = seriesById.get(normalizeCompanyId(item.dataKey)) ?? {};

      return {
        id: companyInfo.company_id || item.dataKey,
        name: companyInfo.display_name || item.name,
        color: companyInfo.company_color || item.color || "#6F6864",
        value,
      };
    })
    .filter(Boolean);

  if (!rows.length) return null;

  return (
    <ChartTooltipShell title={`Periodo: ${label}`}>
      {rows.map((row) => (
        <div key={`${row.id}-${row.value}`} className="chart-tooltip-row">
          <span className="chart-tooltip-company">
            <CompanyMark
              companyId={row.id}
              label={row.name}
              color={row.color}
              className="company-mark-tooltip"
            />
            <span>{row.name}</span>
          </span>
          <span className="chart-tooltip-value">{formatMetric(row.value, metricKey)}</span>
        </div>
      ))}
    </ChartTooltipShell>
  );
}

function SingleMetricTooltip({ active, payload = [], metricKey, totalValue = null }) {
  if (!active || !payload.length) return null;

  const item = payload[0];
  const entry = item.payload ?? {};
  const value = safeNumber(item.value ?? entry.value);
  if (value === null) return null;

  const share = totalValue ? value / totalValue : null;
  const hasGrowthBreakdown =
    entry.previousValue !== undefined &&
    entry.currentValue !== undefined &&
    entry.baseMetricKey;

  return (
    <ChartTooltipShell title={entry.name || item.name}>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-company">
          <CompanyMark
            companyId={entry.id}
            label={entry.name}
            color={entry.color || item.color}
            className="company-mark-tooltip"
          />
          <span>{entry.name || item.name}</span>
        </span>
        <span className="chart-tooltip-value">
          {isGrowthMetric(metricKey) ? formatSignedPercent(value) : formatMetric(value, metricKey)}
          {share !== null ? ` · ${formatPercent(share)}` : ""}
        </span>
      </div>
      {hasGrowthBreakdown && (
        <div className="chart-tooltip-yoy">
          <span>
            <small>Pre</small>
            {formatMetric(entry.previousValue, entry.baseMetricKey)}
          </span>
          <span>
            <small>Crec.</small>
            {formatSignedPercent(entry.growthValue)}
          </span>
          <span>
            <small>Post</small>
            {formatMetric(entry.currentValue, entry.baseMetricKey)}
          </span>
        </div>
      )}
    </ChartTooltipShell>
  );
}

function getLastValueIndexes(chartData = [], series = []) {
  const indexes = new Map();

  series.forEach((companySeries) => {
    for (let index = chartData.length - 1; index >= 0; index -= 1) {
      if (safeNumber(chartData[index]?.[companySeries.company_id]) !== null) {
        indexes.set(normalizeCompanyId(companySeries.company_id), index);
        break;
      }
    }
  });

  return indexes;
}

function LineLogoLabel({ x, y, index, companySeries, lastPointIndex }) {
  const pointX = Number(x);
  const pointY = Number(y);

  if (index !== lastPointIndex || !Number.isFinite(pointX) || !Number.isFinite(pointY)) {
    return null;
  }

  if (isBenchmarkRow(companySeries)) {
    const label = companySeries.display_name || "Promedio mercado";
    const width = Math.max(118, Math.min(156, label.length * 7 + 18));

    return (
      <g transform={`translate(${pointX + 8}, ${pointY - 12})`} pointerEvents="none">
        <rect
          width={width}
          height="24"
          rx="4"
          fill="#ffffff"
          stroke={companySeries.company_color}
          strokeWidth="1"
        />
        <text
          x="9"
          y="12"
          fill={companySeries.company_color}
          fontSize="11"
          fontWeight="700"
          dominantBaseline="central"
        >
          {label}
        </text>
      </g>
    );
  }

  return (
    <SvgCompanyLogoBadge
      companyId={companySeries.company_id}
      label={companySeries.display_name}
      color={companySeries.company_color}
      x={pointX + 8}
      y={pointY - 12}
    />
  );
}

function PieLogoLabel({ cx, cy, midAngle, outerRadius, payload, percent }) {
  if (!payload || percent < 0.04) return null;

  const radius = Number(outerRadius) + 14;
  const angle = (-midAngle * Math.PI) / 180;
  const x = Number(cx) + radius * Math.cos(angle) - 17;
  const y = Number(cy) + radius * Math.sin(angle) - 12;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return (
    <SvgCompanyLogoBadge
      companyId={payload.id}
      label={payload.name}
      color={payload.color}
      x={x}
      y={y}
    />
  );
}

function RankingBarLogoTick({ x, y, payload, entriesById }) {
  const entry = entriesById.get(normalizeCompanyId(payload?.value));
  const pointX = Number(x);
  const pointY = Number(y);

  if (!entry || !Number.isFinite(pointX) || !Number.isFinite(pointY)) return null;

  return (
    <SvgCompanyLogoBadge
      companyId={entry.id}
      label={entry.name}
      color={entry.color}
      x={pointX - 48}
      y={pointY - 12}
    />
  );
}

function LoadingShell() {
  return (
    <main className="app-shell">
      <div className="mx-auto max-w-7xl">
        <section className="surface-card border-t-4 border-t-focus-500 p-6 md:p-8">
          <div className="brand-lockup">
            <BrandLogo />
            <span className="metric-pill">Competitive Intelligence</span>
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-black md:text-5xl">
            Benchmark competitivo
          </h1>
          <p className="mt-4 text-sm text-neutral-600">Cargando datos de benchmark.</p>
        </section>
      </div>
    </main>
  );
}

function AppHeader({
  view,
  onGoBenchmark,
  generatedAt,
  rowCount,
}) {
  const isProfile = view === "profile";
  const isForecast = view === "forecast";
  const title = isProfile
    ? "Ficha individual"
    : isForecast
      ? "Forecast de mercado"
      : "Benchmark competitivo";

  return (
    <header className="surface-card border-t-4 border-t-focus-500 p-5 md:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="brand-lockup">
            <BrandLogo />
            <span className="metric-pill">Competitive Intelligence</span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold text-black md:text-5xl">
            {title}
          </h1>
        </div>
        <div className="grid gap-1 text-sm text-neutral-500 sm:grid-cols-[auto_auto] lg:text-right">
          <span>Actualizado</span>
          <span className="font-medium text-black">{generatedAt}</span>
          <span>Filas interface</span>
          <span className="font-medium text-black">{rowCount}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/10 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onGoBenchmark}
            className={isProfile ? "section-link" : "primary-action"}
          >
            Benchmark
          </button>
          {isProfile && (
            <span className="metric-pill bg-white text-black">Ficha por empresa</span>
          )}
          {isForecast && (
            <span className="metric-pill bg-white text-black">Forecast</span>
          )}
        </div>
      </div>
    </header>
  );
}

function CompanyLegend({
  series,
  hiddenCompanyIds = EMPTY_HIDDEN_COMPANY_IDS,
  onToggleCompany,
  onShowAll,
  onHideAll,
}) {
  if (!series.length) return null;

  const activeCount = series.filter(
    (companySeries) => !hiddenCompanyIds.has(normalizeCompanyId(companySeries.company_id)),
  ).length;

  return (
    <details className="legend-disclosure">
      <summary className="legend-summary">
        <span>Series visibles {activeCount}/{series.length}</span>
        <span className="legend-summary-hint">Editar selección</span>
      </summary>

      <div className="legend-panel">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="legend-action" onClick={onShowAll}>
            Todos
          </button>
          <button type="button" className="legend-action" onClick={onHideAll}>
            Ninguno
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
        {series.map((companySeries) => {
          const companyKey = normalizeCompanyId(companySeries.company_id);
          const isActive = !hiddenCompanyIds.has(companyKey);

          return (
            <button
              key={companySeries.company_id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggleCompany(companySeries.company_id)}
              className={`legend-toggle ${isActive ? "legend-toggle-active" : "legend-toggle-muted"}`}
            >
              <CompanyMark
                companyId={companySeries.company_id}
                label={companySeries.display_name}
                color={companySeries.company_color}
                className="company-mark-legend"
              />
              <span className="truncate">{companySeries.display_name}</span>
            </button>
          );
        })}
        </div>
      </div>
    </details>
  );
}

function useCompanyVisibility(series, defaultVisibleCompanyIds = []) {
  const [hiddenCompanyIds, setHiddenCompanyIds] = useState(new Set());
  const seriesVisibilityKey = useMemo(() => getSeriesVisibilityKey(series), [series]);
  const defaultVisibilityKey = useMemo(
    () => defaultVisibleCompanyIds.map(normalizeCompanyId).filter(Boolean).join("|"),
    [defaultVisibleCompanyIds],
  );

  useEffect(() => {
    const availableCompanyIds = getCompanyIdSet(series.map((companySeries) => companySeries.company_id));
    const normalizedDefaults = new Set(
      [...getCompanyIdSet(defaultVisibleCompanyIds)].filter((companyId) =>
        availableCompanyIds.has(companyId),
      ),
    );

    setHiddenCompanyIds((currentHiddenCompanyIds) => {
      if (normalizedDefaults.size) {
        return new Set(
          [...availableCompanyIds].filter((companyId) => !normalizedDefaults.has(companyId)),
        );
      }

      return new Set(
        [...currentHiddenCompanyIds].filter((companyId) => availableCompanyIds.has(companyId)),
      );
    });
  }, [defaultVisibilityKey, seriesVisibilityKey]);

  const handleToggleCompany = (companyId) => {
    const companyKey = normalizeCompanyId(companyId);
    if (!companyKey) return;

    setHiddenCompanyIds((currentHiddenCompanyIds) => {
      const nextHiddenCompanyIds = new Set(currentHiddenCompanyIds);

      if (nextHiddenCompanyIds.has(companyKey)) {
        nextHiddenCompanyIds.delete(companyKey);
      } else {
        nextHiddenCompanyIds.add(companyKey);
      }

      return nextHiddenCompanyIds;
    });
  };

  const handleShowAll = () => {
    setHiddenCompanyIds(new Set());
  };

  const handleHideAll = () => {
    setHiddenCompanyIds(getCompanyIdSet(series.map((companySeries) => companySeries.company_id)));
  };

  return {
    hiddenCompanyIds,
    handleToggleCompany,
    handleShowAll,
    handleHideAll,
  };
}

function MetricChart({
  title,
  metricKey,
  series,
  chartData,
  emptyTitle,
  hiddenCompanyIds = EMPTY_HIDDEN_COMPANY_IDS,
}) {
  const activeSeries = useMemo(
    () =>
      series.filter(
        (companySeries) => !hiddenCompanyIds.has(normalizeCompanyId(companySeries.company_id)),
      ),
    [hiddenCompanyIds, series],
  );
  const hasSourceData = series.length > 0 && chartData.length > 0;
  const hasData = activeSeries.length > 0 && chartData.length > 0;
  const forecastWindow = useMemo(() => getForecastWindow(chartData), [chartData]);
  const seriesById = useMemo(() => {
    const seriesMap = new Map();
    activeSeries.forEach((companySeries) => {
      seriesMap.set(normalizeCompanyId(companySeries.company_id), companySeries);
    });
    return seriesMap;
  }, [activeSeries]);
  const lastValueIndexes = useMemo(
    () => getLastValueIndexes(chartData, activeSeries),
    [activeSeries, chartData],
  );

  return (
    <Panel eyebrow="Timeline" title={title}>
      <div className="h-[340px] min-w-0 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData} margin={{ top: 10, right: 62, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
              {forecastWindow && forecastWindow.start.label !== forecastWindow.end.label && (
                <ReferenceArea
                  x1={forecastWindow.start.label}
                  x2={forecastWindow.end.label}
                  fill="#E4032C"
                  fillOpacity={0.06}
                  strokeOpacity={0}
                />
              )}
              {forecastWindow && (
                <ReferenceLine
                  x={forecastWindow.start.label}
                  stroke="#E4032C"
                  strokeDasharray="4 4"
                  label={{
                    value: "Forecast",
                    position: "insideTopRight",
                    fill: "#E4032C",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              )}
              <XAxis
                dataKey="label"
                minTickGap={28}
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={(value) => formatMetric(value, metricKey)}
                tickLine={false}
                axisLine={false}
                width={82}
              />
              <Tooltip
                cursor={{ stroke: "rgba(0,0,0,0.18)" }}
                content={
                  <MultiSeriesTooltip metricKey={metricKey} seriesById={seriesById} />
                }
              />
              {activeSeries.map((companySeries) => (
                <Line
                  key={`${metricKey}-${companySeries.company_id}`}
                  type="monotone"
                  dataKey={companySeries.company_id}
                  name={companySeries.display_name}
                  stroke={companySeries.company_color}
                  strokeDasharray={isBenchmarkRow(companySeries) ? "6 5" : undefined}
                  strokeWidth={sameCompany(companySeries.company_id, OWN_COMPANY_ID) ? 3.2 : 2.2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls={false}
                >
                  <LabelList
                    content={(props) => (
                      <LineLogoLabel
                        {...props}
                        companySeries={companySeries}
                        lastPointIndex={lastValueIndexes.get(
                          normalizeCompanyId(companySeries.company_id),
                        )}
                      />
                    )}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : hasSourceData ? (
          <EmptyState
            title="No hay competidores activos."
            message="Activa al menos un competidor desde el selector de gráficas."
          />
        ) : (
          <EmptyState
            title={emptyTitle}
            message="Los valores null, vacíos o no numéricos se omiten del gráfico."
          />
        )}
      </div>
      {forecastWindow && (
        <div className="mt-3">
          <span className="forecast-chip">Forecast desde {forecastWindow.start.label}</span>
        </div>
      )}
    </Panel>
  );
}

function PeriodTypeSegment({ label = "Vista", value, onChange, periodTypes = [] }) {
  if (periodTypes.length <= 1) return null;

  return (
    <div className="compact-segment-group">
      <p className="analysis-label mb-2">{label}</p>
      <div className="segmented-control">
        {periodTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`segmented-button ${value === type ? "segmented-button-active" : ""}`}
          >
            {PERIOD_TYPE_LABELS[type] || type}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarketSelect({ market, onMarketChange, markets, className = "" }) {
  if (markets.length <= 1) return null;

  return (
    <SelectField
      label="Mercado"
      value={market}
      onChange={onMarketChange}
      className={`compact-select ${className}`}
    >
      {markets.map((marketOption) => (
        <option key={marketOption} value={marketOption}>
          {marketOption}
        </option>
      ))}
    </SelectField>
  );
}

function RankingControls({
  market,
  onMarketChange,
  markets,
  periodType,
  onPeriodTypeChange,
  periodTypes,
  selectedPeriodKey,
  onSelectedPeriodChange,
  periodOptions,
  rankingSort,
  onRankingSortChange,
  rankingSortOptions = RANKING_SORTS,
}) {
  return (
    <div className="block-controls">
      <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

      <PeriodTypeSegment
        value={periodType}
        onChange={onPeriodTypeChange}
        periodTypes={periodTypes}
      />

      <SelectField
        label={PERIOD_TYPE_LABELS[periodType] || "Periodo"}
        value={selectedPeriodKey}
        onChange={onSelectedPeriodChange}
        disabled={!periodOptions.length}
        className="compact-select"
      >
        {periodOptions.map((period) => (
          <option key={period.key} value={period.key}>
            {period.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Orden"
        value={rankingSort}
        onChange={onRankingSortChange}
        className="compact-select"
      >
        {rankingSortOptions.map((sort) => (
          <option key={sort.key} value={sort.key}>
            {sort.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function ForecastControls({
  forecastScenarios,
  forecastScenario,
  onForecastScenarioChange,
  market,
  onMarketChange,
  markets,
  periodType,
  onPeriodTypeChange,
  periodTypes,
}) {
  return (
    <div className="block-controls">
      {forecastScenarios.length > 1 && (
        <SelectField
          label="Escenario"
          value={forecastScenario}
          onChange={onForecastScenarioChange}
          className="compact-select"
        >
          {forecastScenarios.map((scenario) => (
            <option key={scenario} value={scenario}>
              {getForecastScenarioLabel(scenario)}
            </option>
          ))}
        </SelectField>
      )}

      <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

      <PeriodTypeSegment
        label="Vista"
        value={periodType}
        onChange={onPeriodTypeChange}
        periodTypes={periodTypes}
      />
    </div>
  );
}

function ChartRangeControls({
  market,
  onMarketChange,
  markets,
  periodType,
  onPeriodTypeChange,
  periodTypes,
  chartRangeMode,
  onChartRangeModeChange,
  selectedChartYear,
  onSelectedChartYearChange,
  chartYears,
}) {
  const hasYears = chartYears.length > 0;

  return (
    <div className="block-controls">
      <MarketSelect market={market} onMarketChange={onMarketChange} markets={markets} />

      <PeriodTypeSegment
        label="Serie"
        value={periodType}
        onChange={onPeriodTypeChange}
        periodTypes={periodTypes}
      />

      <div className="compact-segment-group">
        <p className="analysis-label mb-2">Rango</p>
        <div className="segmented-control">
          {[
            { key: "all", label: "All time" },
            { key: "year", label: "Año" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onChartRangeModeChange(option.key)}
              disabled={option.key === "year" && !hasYears}
              className={`segmented-button ${
                chartRangeMode === option.key ? "segmented-button-active" : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {chartRangeMode === "year" && (
        <SelectField
          label="Año"
          value={selectedChartYear}
          onChange={(year) => {
            onSelectedChartYearChange(year);
            onChartRangeModeChange("year");
          }}
          disabled={!hasYears}
          className="compact-select compact-year-select"
        >
          {chartYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </SelectField>
      )}
    </div>
  );
}

function isDistributionMetric(metricKey) {
  return DISTRIBUTION_METRICS.has(metricKey);
}

function isMoMGrowthMetric(metricKey) {
  return metricKey === "revenue_mom_growth" || metricKey === "visits_mom_growth";
}

function isGrowthMetric(metricKey) {
  return (
    metricKey === "revenue_yoy_growth" ||
    metricKey === "visits_yoy_growth" ||
    isMoMGrowthMetric(metricKey)
  );
}

function getGrowthBaseMetricKey(metricKey) {
  if (metricKey === "revenue_yoy_growth" || metricKey === "revenue_mom_growth") {
    return "revenue";
  }

  if (metricKey === "visits_yoy_growth" || metricKey === "visits_mom_growth") {
    return "visits";
  }

  return "";
}

function normalizeGrowthRate(value) {
  const number = safeNumber(value);
  if (number === null) return null;

  return Math.abs(number) > 1 ? number / 100 : number;
}

function getGrowthBreakdown(row, growthMetricKey) {
  if (!isGrowthMetric(growthMetricKey)) return null;

  const baseMetricKey = getGrowthBaseMetricKey(growthMetricKey);
  const currentValue = safeNumber(row?.[baseMetricKey]);
  const growthValue = safeNumber(row?.[growthMetricKey]);
  const growthRate = normalizeGrowthRate(growthValue);

  if (currentValue === null || growthValue === null || growthRate === null) return null;

  const denominator = 1 + growthRate;
  const previousValue = denominator === 0 ? null : currentValue / denominator;

  if (previousValue === null || !Number.isFinite(previousValue)) return null;

  return {
    baseMetricKey,
    previousValue,
    growthValue,
    currentValue,
  };
}

function formatSignedPercent(value) {
  const number = safeNumber(value);
  if (number === null) return formatPercent(value);

  return `${number > 0 ? "+" : ""}${formatPercent(number)}`;
}

function hasAnyMetric(rows = [], metricKey) {
  return rows.some((row) => safeNumber(row?.[metricKey]) !== null);
}

function getCompanyRow(rows = [], companyId = "") {
  return rows.find((row) => sameCompany(row?.company_id, companyId)) ?? null;
}

function getBenchmarkRow(rows = []) {
  return rows.find(isBenchmarkRow) ?? getCompanyRow(rows, MARKET_BENCHMARK_ID);
}

function getMetricCopy(metricKey) {
  return EXECUTIVE_METRIC_LABELS[metricKey] || metricKey;
}

function sumMetric(rows = [], metricKey) {
  return rows.reduce((total, row) => {
    const value = safeNumber(row?.[metricKey]);
    return value === null ? total : total + value;
  }, 0);
}

function getPrimaryMetricContext(rows = []) {
  const hasRevenue = hasAnyMetric(rows, "revenue");
  const primaryMetric = hasRevenue ? "revenue" : "visits";
  const shareMetric =
    primaryMetric === "revenue" && hasAnyMetric(rows, "market_share_revenue")
      ? "market_share_revenue"
      : "market_share_visits";
  const growthMetric =
    primaryMetric === "revenue" && hasAnyMetric(rows, "revenue_yoy_growth")
      ? "revenue_yoy_growth"
      : "visits_yoy_growth";

  return {
    primaryMetric,
    primaryLabel: primaryMetric === "revenue" ? "facturacion" : "visitas",
    shareMetric,
    growthMetric,
  };
}

function getShareChangeMetric(rows = [], preferredMetric = "revenue") {
  const revenueCandidates = ["share_revenue_change_yoy", "share_revenue_change_mom"];
  const visitsCandidates = ["share_visits_change_yoy", "share_visits_change_mom"];
  const orderedCandidates =
    preferredMetric === "revenue"
      ? [...revenueCandidates, ...visitsCandidates]
      : [...visitsCandidates, ...revenueCandidates];

  return orderedCandidates.find((metricKey) => hasAnyMetric(rows, metricKey)) || "";
}

function getShareChangeMode(metricKey = "") {
  return metricKey.includes("revenue") ? "revenue" : "visits";
}

function getShareChangeRows(rows = [], metricKey = "") {
  if (!metricKey) return [];

  return rows
    .filter(isRealCompanyRow)
    .map((row) => ({
      id: row.company_id,
      name: getCompanyLabel(row),
      color: row.company_color || "#6F6864",
      value: safeNumber(row?.[metricKey]),
      row,
    }))
    .filter((entry) => entry.value !== null)
    .sort((a, b) => b.value - a.value);
}

function getShareWinnersLosers(rows = [], metricKey = "") {
  const rankedRows = getShareChangeRows(rows, metricKey);
  const gainers = rankedRows.filter((entry) => entry.value > 0).slice(0, 5);
  const losers = rankedRows
    .filter((entry) => entry.value < 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 5);

  return {
    gainers,
    losers,
    topGainer: gainers[0] ?? null,
    topLoser: losers[0] ?? null,
  };
}

function formatMetricDelta(metricKey, value) {
  if (
    metricKey?.includes("market_share") ||
    metricKey?.includes("share_") ||
    metricKey?.includes("growth")
  ) {
    return formatPp(value);
  }

  return formatMetric(value, metricKey);
}

function formatVsBenchmark(focusValue, benchmarkValue, metricKey) {
  const focusNumber = safeNumber(focusValue);
  const benchmarkNumber = safeNumber(benchmarkValue);

  if (focusNumber === null || benchmarkNumber === null) return "Sin benchmark comparable";

  const delta = focusNumber - benchmarkNumber;
  if (Math.abs(delta) < 0.000001) return "En linea con Promedio mercado";

  const direction = delta > 0 ? "sobre" : "por debajo de";
  const formattedDelta =
    metricKey?.includes("market_share") || metricKey?.includes("growth")
      ? formatPp(delta)
      : benchmarkNumber !== 0
        ? formatSignedPercent(delta / Math.abs(benchmarkNumber))
        : formatMetricDelta(metricKey, delta);

  return `${formattedDelta} ${direction} Promedio mercado`;
}

function getBenchmarkComparisonItems(focusRow, benchmarkRow, preferredMetric) {
  if (!focusRow || !benchmarkRow) return [];

  const metricKeys = [
    preferredMetric,
    preferredMetric === "revenue" ? "market_share_revenue" : "market_share_visits",
    preferredMetric === "revenue" ? "revenue_per_visit" : "visits_yoy_growth",
  ];

  return metricKeys
    .filter((metricKey, index, list) => metricKey && list.indexOf(metricKey) === index)
    .map((metricKey) => {
      const focusValue = safeNumber(focusRow?.[metricKey]);
      const benchmarkValue = safeNumber(benchmarkRow?.[metricKey]);
      if (focusValue === null || benchmarkValue === null) return null;

      return {
        key: metricKey,
        label: getMetricCopy(metricKey),
        focusValue,
        benchmarkValue,
        deltaLabel: formatVsBenchmark(focusValue, benchmarkValue, metricKey),
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function getCompetitiveRisks(rows = [], context = {}) {
  const focusRow = getCompanyRow(rows, OWN_COMPANY_ID);
  if (!focusRow) return [];

  const risks = [];
  const rivals = rows.filter((row) => isRealCompanyRow(row) && !sameCompany(row.company_id, OWN_COMPANY_ID));
  const shareChangeMetric = context.shareChangeMetric || "";
  const focusShareChange = safeNumber(focusRow?.[shareChangeMetric]);
  const focusGrowth = safeNumber(focusRow?.[context.growthMetric]);
  const focusRpv = safeNumber(focusRow?.revenue_per_visit);

  if (shareChangeMetric) {
    const shareThreat = rivals
      .map((row) => ({
        row,
        value: safeNumber(row?.[shareChangeMetric]),
      }))
      .filter((entry) => entry.value !== null && entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .find((entry) => focusShareChange === null || entry.value > focusShareChange);

    if (shareThreat) {
      risks.push({
        id: `share-${shareThreat.row.company_id}`,
        title: "Presion de cuota",
        body: `${getCompanyLabel(shareThreat.row)} gana ${formatPp(shareThreat.value)} en ${getMetricCopy(shareChangeMetric)}.`,
        row: shareThreat.row,
      });
    }
  }

  if (context.growthMetric) {
    const growthThreat = rivals
      .map((row) => ({
        row,
        value: safeNumber(row?.[context.growthMetric]),
      }))
      .filter((entry) => entry.value !== null)
      .sort((a, b) => b.value - a.value)
      .find((entry) => focusGrowth === null || entry.value > focusGrowth);

    if (growthThreat) {
      risks.push({
        id: `growth-${growthThreat.row.company_id}`,
        title: "Momentum superior",
        body: `${getCompanyLabel(growthThreat.row)} crece ${formatSignedPercent(growthThreat.value)} en ${getMetricCopy(context.growthMetric)}.`,
        row: growthThreat.row,
      });
    }
  }

  if (focusRpv !== null) {
    const efficiencyThreat = rivals
      .map((row) => ({
        row,
        value: safeNumber(row?.revenue_per_visit),
      }))
      .filter((entry) => entry.value !== null && entry.value > focusRpv)
      .sort((a, b) => b.value - a.value)[0];

    if (efficiencyThreat) {
      risks.push({
        id: `efficiency-${efficiencyThreat.row.company_id}`,
        title: "Mejor monetizacion",
        body: `${getCompanyLabel(efficiencyThreat.row)} logra ${formatCurrencyDecimal(efficiencyThreat.value)} por visita frente a ${formatCurrencyDecimal(focusRpv)} de Focus Brand.`,
        row: efficiencyThreat.row,
      });
    }
  }

  return risks.slice(0, 3);
}

function getDataTrustBadges(rows = []) {
  const badges = new Map();

  rows.forEach((row) => {
    const dataType = normalizeCompanyId(row?.data_type);
    const source = String(row?.source || "");

    if (dataType === "actual") badges.set("actual", "actual");
    if (dataType === "estimated") badges.set("estimated", "estimated");
    if (dataType === "forecast") badges.set("forecast", "forecast");
    if (dataType === "calculated") badges.set("calculated", "calculated");
    if (/calculated|calculado/i.test(source)) badges.set("calculated", "calculated");
    if (/demo|sample|synthetic/i.test(source)) badges.set("demo", "demo");
    if (/api|connector|endpoint/i.test(source)) badges.set("connector", "connector");
  });

  return Array.from(badges.entries())
    .map(([key, label]) => ({ key, label }))
    .slice(0, 4);
}

function buildExecutiveSnapshot(realRows = [], comparisonRows = [], selectedPeriod = null) {
  const context = getPrimaryMetricContext(realRows);
  const shareChangeMetric = getShareChangeMetric(realRows, context.primaryMetric);
  const shareWinners = getShareWinnersLosers(realRows, shareChangeMetric);
  const focusRow = getCompanyRow(realRows, OWN_COMPANY_ID);
  const benchmarkRow = getBenchmarkRow(comparisonRows);
  const leader = realRows
    .filter((row) => safeNumber(row?.[context.primaryMetric]) !== null)
    .slice()
    .sort((a, b) => safeNumber(b?.[context.primaryMetric]) - safeNumber(a?.[context.primaryMetric]))[0] ?? null;
  const totalMarketValue = hasAnyMetric(realRows, context.primaryMetric)
    ? sumMetric(realRows, context.primaryMetric)
    : null;
  const focusShare = safeNumber(focusRow?.[context.shareMetric]);
  const focusGrowth = safeNumber(focusRow?.[context.growthMetric]);
  const benchmarkComparisons = getBenchmarkComparisonItems(
    focusRow,
    benchmarkRow,
    context.primaryMetric,
  );
  const risks = getCompetitiveRisks(realRows, { ...context, shareChangeMetric });
  const headlineParts = [];

  if (leader) {
    headlineParts.push(
      `${getCompanyLabel(leader)} lidera por ${context.primaryLabel} en ${selectedPeriod?.label || "el periodo seleccionado"}`,
    );
  }

  if (shareWinners.topGainer) {
    headlineParts.push(
      `${shareWinners.topGainer.name} gana ${formatPp(shareWinners.topGainer.value)} de cuota`,
    );
  } else if (focusShare !== null) {
    headlineParts.push(`Focus Brand alcanza ${formatMetric(focusShare, context.shareMetric)} de ${getMetricCopy(context.shareMetric)}`);
  }

  if (benchmarkComparisons[0]) {
    headlineParts.push(benchmarkComparisons[0].deltaLabel);
  }

  const headline = headlineParts.length
    ? `${headlineParts.join(". ")}.`
    : "Selecciona un periodo con datos comparables para leer el mercado.";

  return {
    ...context,
    shareChangeMetric,
    shareChangeMode: getShareChangeMode(shareChangeMetric),
    periodLabel: selectedPeriod?.label || "",
    totalMarketValue,
    focusRow,
    benchmarkRow,
    focusShare,
    focusGrowth,
    leader,
    shareWinners,
    benchmarkComparisons,
    risks,
    headline,
    badges: getDataTrustBadges([...realRows, ...comparisonRows]),
  };
}

function getEfficiencyBadge(gap) {
  const value = safeNumber(gap);
  if (value === null) return "Sin dato";
  if (value > 0.005) return "High efficiency";
  if (value < -0.005) return "Traffic under-monetized";
  return "Balanced";
}

function getMonetizationRows(rows = []) {
  return rows
    .filter(isRealCompanyRow)
    .map((row) => {
      const revenueShare = safeNumber(row?.market_share_revenue);
      const visitShare = safeNumber(row?.market_share_visits);
      if (revenueShare === null || visitShare === null) return null;

      return {
        id: row.company_id,
        name: getCompanyLabel(row),
        color: row.company_color || "#6F6864",
        revenueShare,
        visitShare,
        value: revenueShare - visitShare,
        badge: getEfficiencyBadge(revenueShare - visitShare),
        row,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);
}

function getMedian(values = []) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;

  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2
    ? numbers[middle]
    : (numbers[middle - 1] + numbers[middle]) / 2;
}

function getBattleDeltaLabel(metric, focusValue, targetValue) {
  const focusNumber = safeNumber(focusValue);
  const targetNumber = safeNumber(targetValue);
  if (focusNumber === null || targetNumber === null) return "Sin dato comparable";

  const delta = focusNumber - targetNumber;
  if (Math.abs(delta) < 0.000001) return "Empate";

  if (metric.deltaType === "pp") {
    return `${formatPp(delta)} Foco vs objetivo`;
  }

  if (targetNumber !== 0) {
    return `${formatSignedPercent(delta / Math.abs(targetNumber))} Foco vs objetivo`;
  }

  return `Dif. ${formatMetric(delta, metric.key)}`;
}

function getBattleWinner(metric, focusRow, targetRow) {
  const focusValue = safeNumber(focusRow?.[metric.key]);
  const targetValue = safeNumber(targetRow?.[metric.key]);
  if (focusValue === null || targetValue === null) return "N/A";
  if (Math.abs(focusValue - targetValue) < 0.000001) return "Empate";
  return focusValue > targetValue ? "Foco" : getCompanyLabel(targetRow);
}

function getStrategicConclusion(snapshot) {
  if (!snapshot) return "Selecciona un periodo con datos comparables para cerrar la lectura.";

  const risk = snapshot.risks[0];
  if (risk) {
    return `${risk.title}: ${risk.body}`;
  }

  if (snapshot.shareWinners?.topGainer) {
    return `${snapshot.shareWinners.topGainer.name} marca el movimiento competitivo mas relevante; conviene contrastarlo con Focus Brand y Promedio mercado.`;
  }

  if (snapshot.leader) {
    return `${getCompanyLabel(snapshot.leader)} concentra la lectura principal del periodo por ${snapshot.primaryLabel}.`;
  }

  return "No hay senales suficientes para una conclusion estrategica sin forzar la lectura.";
}

function getPieData(rows = [], metricKey, maxSlices = 5) {
  const rankedRows = rows
    .map((row) => ({
      id: row.company_id,
      name: getCompanyLabel(row),
      value: safeNumber(row?.[metricKey]),
      color: row.company_color || "#6F6864",
    }))
    .filter((row) => row.value !== null && row.value > 0)
    .sort((a, b) => b.value - a.value);

  const topRows = rankedRows.slice(0, maxSlices);
  const restRows = rankedRows.slice(maxSlices);
  const restValue = restRows.reduce((total, row) => total + row.value, 0);

  return restValue > 0
    ? [...topRows, { id: "rest", name: "Resto", value: restValue, color: "#D8D2CD" }]
    : topRows;
}

function RankingPieChart({ rows, metricKey, title }) {
  const pieData = useMemo(() => getPieData(rows, metricKey), [metricKey, rows]);
  const totalValue = useMemo(
    () => pieData.reduce((total, row) => total + row.value, 0),
    [pieData],
  );

  return (
    <aside className="ranking-side-card" aria-label={title}>
      <div>
        <p className="analysis-label text-focus-500">Distribución</p>
        <h3 className="mt-2 text-lg font-semibold text-black">{title}</h3>
      </div>

      {pieData.length ? (
        <>
          <div className="ranking-pie-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart margin={{ top: 22, right: 28, bottom: 22, left: 28 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="54%"
                  outerRadius="82%"
                  paddingAngle={2}
                  label={PieLogoLabel}
                  labelLine={false}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <SingleMetricTooltip metricKey={metricKey} totalValue={totalValue} />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="ranking-pie-legend">
            {pieData.map((entry) => (
              <div key={`${entry.id}-legend`} className="ranking-pie-legend-row">
                <span className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={entry.id}
                    label={entry.name}
                    color={entry.color}
                    className="company-mark-legend"
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span>{formatPercent(totalValue ? entry.value / totalValue : null)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Sin datos positivos para el pie."
          message="El ranking actual no tiene valores suficientes para calcular una distribución."
        />
      )}
    </aside>
  );
}

function getBarData(rows = [], metricKey, maxItems = 8) {
  return rows
    .map((row) => {
      const growthBreakdown = getGrowthBreakdown(row, metricKey);

      return {
        id: row.company_id,
        name: getCompanyLabel(row),
        value: safeNumber(row?.[metricKey]),
        color: row.company_color || "#6F6864",
        ...(growthBreakdown || {}),
      };
    })
    .filter((row) => row.value !== null)
    .slice(0, maxItems);
}

function RankingBarChart({ rows, metricKey, title }) {
  const barData = useMemo(() => getBarData(rows, metricKey), [metricKey, rows]);
  const showGrowthBreakdown = isGrowthMetric(metricKey);
  const domain = useMemo(() => {
    const values = barData.map((row) => row.value);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);

    return min === max ? [-1, 1] : [min, max];
  }, [barData]);
  const entriesById = useMemo(() => {
    const entriesMap = new Map();
    barData.forEach((entry) => {
      entriesMap.set(normalizeCompanyId(entry.id), entry);
    });
    return entriesMap;
  }, [barData]);

  return (
    <aside className="ranking-side-card" aria-label={title}>
      <div>
        <p className="analysis-label text-focus-500">Comparativa</p>
        <h3 className="mt-2 text-lg font-semibold text-black">{title}</h3>
      </div>

      {barData.length ? (
        <div className="ranking-bar-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 8, right: 10, bottom: 8, left: 0 }}
            >
              <CartesianGrid stroke="rgba(0,0,0,0.08)" horizontal={false} />
              <ReferenceLine x={0} stroke="rgba(0,0,0,0.36)" />
              <XAxis
                type="number"
                domain={domain}
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={(value) =>
                  showGrowthBreakdown ? formatSignedPercent(value) : formatMetric(value, metricKey)
                }
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="id"
                width={56}
                interval={0}
                tickLine={false}
                axisLine={false}
                tick={(props) => <RankingBarLogoTick {...props} entriesById={entriesById} />}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                content={<SingleMetricTooltip metricKey={metricKey} />}
              />
              <Bar dataKey="value" radius={[3, 3, 3, 3]} barSize={18}>
                {barData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="Sin datos para la comparativa."
          message="El ranking actual no tiene valores suficientes para representar esta métrica."
        />
      )}

      {barData.length > 0 && (
        <div className={showGrowthBreakdown ? "ranking-yoy-list" : "ranking-bar-legend"}>
          {barData.map((entry) => (
            showGrowthBreakdown ? (
              <div key={`${entry.id}-yoy-legend`} className="ranking-yoy-row">
                <span className="ranking-yoy-company">
                  <CompanyMark
                    companyId={entry.id}
                    label={entry.name}
                    color={entry.color}
                    className="company-mark-legend"
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="ranking-yoy-metrics">
                  <span>
                    <small>Pre</small>
                    {formatMetric(entry.previousValue, entry.baseMetricKey)}
                  </span>
                  <span>
                    <small>Crec.</small>
                    {formatSignedPercent(entry.growthValue ?? entry.value)}
                  </span>
                  <span>
                    <small>Post</small>
                    {formatMetric(entry.currentValue, entry.baseMetricKey)}
                  </span>
                </span>
              </div>
            ) : (
              <div key={`${entry.id}-bar-legend`} className="ranking-pie-legend-row">
                <span className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={entry.id}
                    label={entry.name}
                    color={entry.color}
                    className="company-mark-legend"
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span>{formatMetric(entry.value, metricKey)}</span>
              </div>
            )
          ))}
        </div>
      )}
    </aside>
  );
}

function RankingSideVisual({ rows, sortKey, sortLabel }) {
  if (isDistributionMetric(sortKey)) {
    return <RankingPieChart rows={rows} metricKey={sortKey} title={sortLabel} />;
  }

  return <RankingBarChart rows={rows} metricKey={sortKey} title={sortLabel} />;
}

function BenchmarkRankingPanel({
  rows,
  sortKey,
  selectedPeriod,
  onOpenProfile,
}) {
  const sortLabel = RANKING_SORTS.find((sort) => sort.key === sortKey)?.label || sortKey;
  const topRows = rows.slice(0, 8);

  return (
    <Panel
      eyebrow="Ranking"
      title="Ranking del período"
    >
      {selectedPeriod && (
        <p className="mb-4 text-sm text-neutral-500">
          {selectedPeriod.label}. Top empresas por {sortLabel}.
        </p>
      )}

      {topRows.length ? (
        <div className="ranking-with-pie">
          <div className="divide-y divide-black/10 overflow-hidden rounded-sm border border-black/10">
            {topRows.map((row, index) => {
              const growthBreakdown = getGrowthBreakdown(row, sortKey);

              return (
                <button
                  key={`${row.company_id}-${row.date}-ranking-card`}
                  type="button"
                  onClick={() => onOpenProfile(row.company_id)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 bg-white px-4 py-3 text-left transition hover:bg-[#fbf8f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus-500 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4"
                  aria-label={`Abrir ficha de ${getCompanyLabel(row)}`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-sm text-sm font-semibold ${
                      index === 0 ? "bg-focus-500 text-white" : "bg-[#fbf8f5] text-black"
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <CompanyMark
                        companyId={row.company_id}
                        label={getCompanyLabel(row)}
                        color={row.company_color}
                        className="company-mark-row"
                      />
                      <span className="truncate font-semibold text-black">{getCompanyLabel(row)}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs uppercase text-neutral-500">
                      {row.segment || row.market || "Competidor"}
                    </span>
                    <DataTypeBadge row={row} />
                  </span>
                  <span className="col-span-2 text-left sm:col-span-1 sm:text-right">
                    <span className="block text-sm font-semibold text-black">
                      {isGrowthMetric(sortKey)
                        ? formatSignedPercent(row?.[sortKey])
                        : formatMetric(row?.[sortKey], sortKey)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold uppercase text-neutral-500">
                      {sortLabel}
                    </span>
                    {growthBreakdown && (
                      <span className="ranking-row-yoy">
                        <span>Pre {formatMetric(growthBreakdown.previousValue, growthBreakdown.baseMetricKey)}</span>
                        <span>Post {formatMetric(growthBreakdown.currentValue, growthBreakdown.baseMetricKey)}</span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <RankingSideVisual rows={rows} sortKey={sortKey} sortLabel={sortLabel} />
        </div>
      ) : (
        <EmptyState
          title="No hay filas para el ranking."
          message="Cambia filtros o rango temporal para recuperar el último período disponible."
        />
      )}
    </Panel>
  );
}

function RankingTable({
  rows,
  selectedPeriod,
  onOpenProfile,
  title = "Tabla completa del ranking",
  description,
}) {
  const hasForecastRows = rows.some(isForecastRow);

  return (
    <Panel
      eyebrow="Detalle"
      title={title}
    >
      {selectedPeriod && (
        <p className="mb-4 text-sm text-neutral-500">
          {description || `Período seleccionado: ${selectedPeriod.label}. Ranking detallado por empresas.`}
        </p>
      )}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-black/10 bg-[#fbf8f5] text-left text-xs uppercase text-neutral-500">
                <th className="px-3 py-3 font-semibold">Rank</th>
                <th className="px-3 py-3 font-semibold">Empresa</th>
                <th className="px-3 py-3 text-right font-semibold">Facturación</th>
                <th className="px-3 py-3 text-right font-semibold">Visitas</th>
                <th className="px-3 py-3 text-right font-semibold">Cuota facturación</th>
                <th className="px-3 py-3 text-right font-semibold">Cuota visitas</th>
                <th className="px-3 py-3 text-right font-semibold">Rev / visit</th>
                <th className="px-3 py-3 font-semibold">Prioridad</th>
                {hasForecastRows && <th className="px-3 py-3 font-semibold">Tipo</th>}
                <th className="px-3 py-3 text-right font-semibold">Ficha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {rows.map((row) => (
                <tr
                  key={`${row.company_id}-${row.date}`}
                  className="cursor-pointer bg-white transition hover:bg-[#fbf8f5]"
                  onClick={() => onOpenProfile(row.company_id)}
                >
                  <td className="px-3 py-3 font-semibold text-black">
                    {formatMetric(row.rank_revenue, "rank_revenue")}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CompanyMark
                        companyId={row.company_id}
                        label={getCompanyLabel(row)}
                        color={row.company_color}
                        className="company-mark-table"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-black">{getCompanyLabel(row)}</p>
                        <p className="truncate text-xs text-neutral-500">{row.segment || row.market}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-black">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-black">
                    {formatCompact(row.visits)}
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">
                    {formatPercent(row.market_share_revenue)}
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">
                    {formatPercent(row.market_share_visits)}
                  </td>
                  <td className="px-3 py-3 text-right text-neutral-700">
                    {formatCurrencyDecimal(row.revenue_per_visit)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-sm border border-black/10 bg-[#fbf8f5] px-3 py-1 text-xs font-medium text-neutral-700">
                      {row.strategic_priority_label || row.strategic_priority || "N/A"}
                    </span>
                  </td>
                  {hasForecastRows && (
                    <td className="px-3 py-3">
                      <DataTypeBadge row={row} />
                    </td>
                  )}
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenProfile(row.company_id);
                      }}
                      className="primary-action"
                      aria-label={`Abrir ficha de ${getCompanyLabel(row)}`}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No hay filas para el ranking."
          message="Cambia filtros o rango temporal para recuperar el último período disponible."
        />
      )}
    </Panel>
  );
}

function ForecastPreview({ forecastRows, forecastScenarioLabel, onOpenForecast }) {
  const forecastPeriods = useMemo(
    () => getAvailablePeriods(forecastRows, { includeForecasts: true, realOnly: true }),
    [forecastRows],
  );
  const firstForecastPeriod = forecastPeriods[0] ?? null;
  const lastForecastPeriod = forecastPeriods[forecastPeriods.length - 1] ?? null;
  const lastForecastRows = useMemo(
    () => getRowsForPeriod(forecastRows, lastForecastPeriod?.key),
    [lastForecastPeriod?.key, forecastRows],
  );
  const forecastCompanies = useMemo(
    () => getUniqueCompanies(forecastRows, { includeForecasts: true }),
    [forecastRows],
  );
  const focusForecastRow = useMemo(
    () => lastForecastRows.find((row) => sameCompany(row.company_id, OWN_COMPANY_ID)) ?? null,
    [lastForecastRows],
  );

  if (!forecastRows.length || !firstForecastPeriod) return null;

  const horizonLabel =
    firstForecastPeriod.key === lastForecastPeriod?.key
      ? firstForecastPeriod.label
      : `${firstForecastPeriod.label} - ${lastForecastPeriod?.label}`;

  return (
    <button
      type="button"
      className="forecast-entry"
      onClick={onOpenForecast}
      aria-label="Abrir detalle del forecast"
    >
      <span className="forecast-entry-kicker">Forecast</span>
      <span className="forecast-entry-copy">
        <span className="forecast-entry-title">Forecast de mercado</span>
        <span className="forecast-entry-detail">
          {horizonLabel} · {forecastCompanies.length} empresas · Escenario {forecastScenarioLabel}
        </span>
      </span>
      <span className="forecast-entry-metric">
        <span>{formatCompact(focusForecastRow?.visits)}</span>
        <span>Foco visitas</span>
      </span>
      <span className="forecast-entry-action">Ver detalle</span>
    </button>
  );
}

function ForecastRankingList({ rows, onOpenProfile }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No hay filas forecast para este período."
        message="Cambia el escenario o vuelve al benchmark para revisar otro contexto."
      />
    );
  }

  return (
    <div className="ranking-with-pie">
      <div className="clean-list">
        {rows.map((row, index) => (
          <button
            key={`${row.company_id}-${row.date}-forecast-detail`}
            type="button"
            onClick={() => onOpenProfile(row.company_id)}
            className="clean-list-row"
            aria-label={`Abrir ficha de ${getCompanyLabel(row)}`}
          >
            <span
              className={`rank-token ${index === 0 ? "rank-token-lead" : ""}`}
            >
              #{index + 1}
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <CompanyMark
                  companyId={row.company_id}
                  label={getCompanyLabel(row)}
                  color={row.company_color}
                  className="company-mark-row"
                />
                <span className="truncate font-semibold text-black">{getCompanyLabel(row)}</span>
              </span>
              <span className="mt-1 block truncate text-xs uppercase text-neutral-500">
                {row.segment || row.market || "Competidor"}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-semibold text-black">
                {formatCompact(row.visits)}
              </span>
              <span className="mt-1 block text-xs font-semibold uppercase text-neutral-500">
                Visitas forecast
              </span>
            </span>
          </button>
        ))}
      </div>

      <RankingPieChart rows={rows} metricKey="visits" title="Visitas forecast" />
    </div>
  );
}

function ForecastDetailView({
  rows,
  forecastScenarios,
  forecastScenario,
  onForecastScenarioChange,
  forecastScenarioLabel,
  forecastMarket,
  onForecastMarketChange,
  forecastMarkets,
  forecastPeriodType,
  onForecastPeriodTypeChange,
  forecastPeriodTypes,
  onBack,
  onOpenProfile,
}) {
  const forecastRows = useMemo(() => getForecastRows(rows), [rows]);
  const forecastPeriods = useMemo(
    () => getAvailablePeriods(forecastRows, { includeForecasts: true, realOnly: true }),
    [forecastRows],
  );
  const firstForecastPeriod = forecastPeriods[0] ?? null;
  const lastForecastPeriod = forecastPeriods[forecastPeriods.length - 1] ?? null;
  const firstForecastRows = useMemo(
    () => getRowsForPeriod(forecastRows, firstForecastPeriod?.key),
    [firstForecastPeriod?.key, forecastRows],
  );
  const lastForecastRows = useMemo(
    () => getRowsForPeriod(forecastRows, lastForecastPeriod?.key),
    [lastForecastPeriod?.key, forecastRows],
  );
  const forecastCompanies = useMemo(
    () => getUniqueCompanies(forecastRows, { includeForecasts: true }),
    [forecastRows],
  );
  const focusStartRow = useMemo(
    () => firstForecastRows.find((row) => sameCompany(row.company_id, OWN_COMPANY_ID)) ?? null,
    [firstForecastRows],
  );
  const focusEndRow = useMemo(
    () => lastForecastRows.find((row) => sameCompany(row.company_id, OWN_COMPANY_ID)) ?? null,
    [lastForecastRows],
  );
  const topForecastRows = useMemo(
    () => getRankingRows(lastForecastRows, "visits", { includeForecasts: true }).slice(0, 8),
    [lastForecastRows],
  );
  const defaultVisibleCompanyIds = useMemo(() => {
    const ids = topForecastRows.slice(0, 5).map((row) => row.company_id);

    if (!ids.some((companyId) => sameCompany(companyId, OWN_COMPANY_ID))) {
      ids.unshift(OWN_COMPANY_ID);
    }

    return ids;
  }, [topForecastRows]);
  const visitsSeries = useMemo(
    () => groupSeriesByCompetitor(rows, "visits", [], { includeForecasts: true }),
    [rows],
  );
  const revenueSeries = useMemo(
    () => groupSeriesByCompetitor(rows, "revenue", [], { includeForecasts: true }),
    [rows],
  );
  const visitsChartData = useMemo(() => toMultiLineChartData(visitsSeries), [visitsSeries]);
  const revenueChartData = useMemo(() => toMultiLineChartData(revenueSeries), [revenueSeries]);
  const forecastLegendSeries = useMemo(
    () => mergeSeriesForLegend([visitsSeries, revenueSeries]),
    [revenueSeries, visitsSeries],
  );
  const forecastVisibility = useCompanyVisibility(forecastLegendSeries, defaultVisibleCompanyIds);

  if (!forecastRows.length || !firstForecastPeriod) {
    return (
      <div className="space-y-6">
        <button type="button" className="section-link" onClick={onBack}>
          Volver al benchmark
        </button>
        <EmptyState
          title="No hay forecast disponible."
          message="El snapshot actual no incluye filas de forecast para el contexto seleccionado."
        />
      </div>
    );
  }

  const horizonLabel =
    firstForecastPeriod.key === lastForecastPeriod?.key
      ? firstForecastPeriod.label
      : `${firstForecastPeriod.label} - ${lastForecastPeriod?.label}`;

  return (
    <div className="space-y-6">
      <section className="forecast-detail-hero">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <button type="button" className="section-link" onClick={onBack}>
              Volver al benchmark
            </button>
            <p className="analysis-label mt-6 text-focus-500">Forecast</p>
            <h2 className="mt-2 text-3xl font-semibold text-black md:text-4xl">
              Forecast de mercado
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
              {horizonLabel}. Escenario {forecastScenarioLabel} con lectura de visitas y facturación.
            </p>
          </div>

          <ForecastControls
            forecastScenarios={forecastScenarios}
            forecastScenario={forecastScenario}
            onForecastScenarioChange={onForecastScenarioChange}
            market={forecastMarket}
            onMarketChange={onForecastMarketChange}
            markets={forecastMarkets}
            periodType={forecastPeriodType}
            onPeriodTypeChange={onForecastPeriodTypeChange}
            periodTypes={forecastPeriodTypes}
          />
        </div>

        <dl className="forecast-stat-strip">
          <div>
            <dt>Horizonte</dt>
            <dd>{forecastPeriods.length} períodos</dd>
          </div>
          <div>
            <dt>Empresas</dt>
            <dd>{forecastCompanies.length}</dd>
          </div>
          <div>
            <dt>Focus Brand inicio</dt>
            <dd>{formatCompact(focusStartRow?.visits)}</dd>
          </div>
          <div>
            <dt>Focus Brand cierre</dt>
            <dd>{formatCompact(focusEndRow?.visits)}</dd>
          </div>
        </dl>
      </section>

      <ContentSection
        eyebrow="Evolución"
        title="Forecast por competidor"
        detail={forecastScenarioLabel}
      >
        <CompanyLegend
          series={forecastLegendSeries}
          hiddenCompanyIds={forecastVisibility.hiddenCompanyIds}
          onToggleCompany={forecastVisibility.handleToggleCompany}
          onShowAll={forecastVisibility.handleShowAll}
          onHideAll={forecastVisibility.handleHideAll}
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <MetricChart
            title="Forecast de visitas"
            metricKey="visits"
            series={visitsSeries}
            chartData={visitsChartData}
            emptyTitle="No hay datos de visitas para este forecast."
            hiddenCompanyIds={forecastVisibility.hiddenCompanyIds}
          />
          <MetricChart
            title="Forecast de facturación"
            metricKey="revenue"
            series={revenueSeries}
            chartData={revenueChartData}
            emptyTitle="No hay datos de facturación para este forecast."
            hiddenCompanyIds={forecastVisibility.hiddenCompanyIds}
          />
        </section>
      </ContentSection>

      <ContentSection
        eyebrow="Ranking forecast"
        title="Último período forecast"
        detail={lastForecastPeriod?.label}
      >
        <ForecastRankingList rows={topForecastRows} onOpenProfile={onOpenProfile} />
      </ContentSection>

      <ContentSection
        eyebrow="Detalle"
        title="Tabla forecast"
        detail={lastForecastPeriod?.label}
      >
        <RankingTable
          rows={lastForecastRows}
          selectedPeriod={lastForecastPeriod}
          onOpenProfile={onOpenProfile}
          title="Tabla forecast por empresa"
          description={`Período forecast: ${lastForecastPeriod?.label}. Detalle completo por competidor.`}
        />
      </ContentSection>
    </div>
  );
}

function ContentSection({ eyebrow, title, detail, action, children }) {
  return (
    <section className="content-section">
      <div className="content-section-header">
        <div>
          <p className="analysis-label text-focus-500">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-black">{title}</h2>
        </div>
        <div className="content-section-actions">
          {action}
          {detail && <span className="scope-pill">{detail}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}

function InsightFeed({ items = [] }) {
  if (!items.length) {
    return (
      <EmptyState
        title="No hay insights para esta seleccion."
        message="El dashboard evita generar insights para benchmarks o forecasts sin senal competitiva real."
      />
    );
  }

  return (
    <div className="insight-grid">
      {items.map((item) => (
        <article key={item.id} className="insight-card">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyMark
              companyId={item.company_id}
              label={item.company_name || item.title}
              color={item.company_color}
              className="company-mark-row"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-black">{item.title}</p>
              {item.body && <p className="mt-2 text-sm leading-6 text-neutral-600">{item.body}</p>}
            </div>
          </div>
          <div className="insight-meta">
            {item.period_label && <span>{item.period_label}</span>}
            {item.priority && <span>{item.priority}</span>}
            {item.metric && <span>{item.metric}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

function TrustBadges({ badges = [] }) {
  if (!badges.length) return null;

  return (
    <div className="trust-badge-row" aria-label="Contexto de datos">
      {badges.map((badge) => (
        <span key={badge.key} className={`trust-badge trust-badge-${badge.key}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function ExecutiveMoverList({ title, items = [], emptyMessage }) {
  return (
    <div className="executive-list-card">
      <p className="analysis-label">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-2">
          {items.slice(0, 3).map((item) => (
            <div key={`${title}-${item.id}`} className="executive-list-row">
              <span className="flex min-w-0 items-center gap-2">
                <CompanyMark
                  companyId={item.id}
                  label={item.name}
                  color={item.color}
                  className="company-mark-legend"
                />
                <span className="truncate font-semibold text-black">{item.name}</span>
              </span>
              <span className={item.value >= 0 ? "value-positive" : "value-negative"}>
                {formatPp(item.value)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-500">{emptyMessage}</p>
      )}
    </div>
  );
}

function BenchmarkComparisonStrip({ items = [] }) {
  if (!items.length) {
    return (
      <div className="executive-benchmark-strip">
        <p className="text-sm font-semibold text-black">Promedio mercado</p>
        <p className="mt-1 text-sm text-neutral-500">
          No hay metricas comparables contra Promedio mercado para este periodo.
        </p>
      </div>
    );
  }

  return (
    <div className="executive-benchmark-strip">
      <div>
        <p className="analysis-label">Benchmark visual</p>
        <h3 className="mt-1 text-lg font-semibold text-black">Foco vs Promedio mercado</h3>
      </div>
      <div className="executive-benchmark-grid">
        {items.map((item) => (
          <div key={item.key} className="executive-benchmark-item">
            <span>{item.label}</span>
            <strong>{formatMetric(item.focusValue, item.key)}</strong>
            <small>{item.deltaLabel}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitiveRiskList({ risks = [] }) {
  return (
    <div className="executive-list-card">
      <p className="analysis-label">Riesgos competitivos</p>
      {risks.length ? (
        <div className="mt-3 space-y-3">
          {risks.map((risk) => (
            <div key={risk.id} className="risk-row">
              <CompanyMark
                companyId={risk.row?.company_id}
                label={getCompanyLabel(risk.row)}
                color={risk.row?.company_color}
                className="company-mark-legend"
              />
              <div className="min-w-0">
                <p className="font-semibold text-black">{risk.title}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{risk.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          No hay alertas con datos suficientes para este periodo.
        </p>
      )}
    </div>
  );
}

function ExecutiveMarketHome({ snapshot, rows = [] }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Selecciona un periodo con datos comparables."
        message="La home ejecutiva necesita competidores reales y observados; forecast y benchmark no entran en esta lectura."
      />
    );
  }

  const totalLabel =
    snapshot.primaryMetric === "revenue" ? "Total market revenue" : "Total market visits";
  const focusShareDetail = snapshot.benchmarkComparisons.find(
    (item) => item.key === snapshot.shareMetric,
  )?.deltaLabel;
  const shareChangeLabel = snapshot.shareChangeMetric
    ? getMetricCopy(snapshot.shareChangeMetric)
    : "cuota";

  return (
    <Panel eyebrow="Executive Home" title="Que esta pasando en el mercado">
      <div className="executive-hero">
        <div className="min-w-0">
          <p className="analysis-label text-focus-500">Lectura ejecutiva</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-black md:text-3xl">
            {snapshot.headline}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {snapshot.periodLabel && <span className="scope-pill">{snapshot.periodLabel}</span>}
            <TrustBadges badges={snapshot.badges} />
          </div>
        </div>
        <div className="executive-hero-aside">
          <span>Pregunta estrategica</span>
          <strong>Quien lidera, quien gana cuota y donde queda el foco frente al mercado.</strong>
        </div>
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={totalLabel}
          value={snapshot.totalMarketValue !== null ? formatMetric(snapshot.totalMarketValue, snapshot.primaryMetric) : "N/A"}
          detail={`${rows.length} competidores reales medidos`}
          accentColor="#000000"
        />
        <KpiCard
          label="Market share foco"
          value={formatMetric(snapshot.focusShare, snapshot.shareMetric)}
          detail={focusShareDetail || getMetricCopy(snapshot.shareMetric)}
          accentColor="#000000"
        />
        <KpiCard
          label="Crecimiento YoY foco"
          value={snapshot.focusGrowth !== null ? formatSignedPercent(snapshot.focusGrowth) : "N/A"}
          detail={
            snapshot.focusGrowth !== null
              ? getMetricCopy(snapshot.growthMetric)
              : "Sin YoY disponible para este periodo"
          }
          accentColor="#000000"
        />
        <KpiCard
          label="Mayor ganador/perdedor cuota"
          value={snapshot.shareWinners.topGainer ? formatPp(snapshot.shareWinners.topGainer.value) : "N/A"}
          detail={
            snapshot.shareWinners.topGainer
              ? `Gana ${snapshot.shareWinners.topGainer.name}${snapshot.shareWinners.topLoser ? ` / pierde ${snapshot.shareWinners.topLoser.name}` : ""}`
              : `Sin datos de ${shareChangeLabel}`
          }
          accentColor="#E4032C"
        />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <ExecutiveMoverList
            title="Top winners"
            items={snapshot.shareWinners.gainers}
            emptyMessage="No hay ganadores de cuota detectables."
          />
          <ExecutiveMoverList
            title="Top losers"
            items={snapshot.shareWinners.losers}
            emptyMessage="No hay perdedores de cuota detectables."
          />
        </div>
        <BenchmarkComparisonStrip items={snapshot.benchmarkComparisons} />
        <CompetitiveRiskList risks={snapshot.risks} />
      </section>
    </Panel>
  );
}

function MetricSwitch({ options = [], value, onChange, label = "Metrica" }) {
  if (options.length <= 1) return null;

  return (
    <div className="compact-segment-group">
      <p className="analysis-label mb-2">{label}</p>
      <div className="segmented-control">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`segmented-button ${value === option.key ? "segmented-button-active" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function IndexedGrowthRace({ rows = [], rangeLabel = "All time" }) {
  const availableMetrics = useMemo(
    () =>
      INDEXED_METRIC_OPTIONS.filter((option) => {
        const series = groupSeriesByCompetitor(rows, option.key).filter(
          (companySeries) => companySeries.points.length >= 2,
        );
        return series.length >= 2 && toMultiLineChartData(series).length >= 2;
      }),
    [rows],
  );
  const defaultMetric = availableMetrics.find((option) => option.key === "indexed_revenue")?.key
    || availableMetrics.find((option) => option.key === "indexed_visits")?.key
    || availableMetrics[0]?.key
    || "";
  const [selectedMetric, setSelectedMetric] = useState(defaultMetric);

  useEffect(() => {
    if (!availableMetrics.length) {
      setSelectedMetric("");
      return;
    }

    if (!selectedMetric || !availableMetrics.some((option) => option.key === selectedMetric)) {
      setSelectedMetric(defaultMetric);
    }
  }, [availableMetrics, defaultMetric, selectedMetric]);

  const metricKey = selectedMetric || defaultMetric;
  const series = useMemo(
    () =>
      metricKey
        ? groupSeriesByCompetitor(rows, metricKey).filter(
            (companySeries) => companySeries.points.length >= 2,
          )
        : [],
    [metricKey, rows],
  );
  const chartData = useMemo(() => toMultiLineChartData(series), [series]);
  const defaultVisibleIds = useMemo(
    () =>
      CORE_RACE_COMPANY_IDS.filter((companyId) =>
        series.some((companySeries) => sameCompany(companySeries.company_id, companyId)),
      ),
    [series],
  );
  const visibility = useCompanyVisibility(series, defaultVisibleIds);
  const activeSeries = useMemo(
    () =>
      series.filter(
        (companySeries) => !visibility.hiddenCompanyIds.has(normalizeCompanyId(companySeries.company_id)),
      ),
    [series, visibility.hiddenCompanyIds],
  );
  const seriesById = useMemo(() => {
    const seriesMap = new Map();
    activeSeries.forEach((companySeries) => {
      seriesMap.set(normalizeCompanyId(companySeries.company_id), companySeries);
    });
    return seriesMap;
  }, [activeSeries]);
  const lastValueIndexes = useMemo(
    () => getLastValueIndexes(chartData, activeSeries),
    [activeSeries, chartData],
  );
  const selectedOption = availableMetrics.find((option) => option.key === metricKey);

  return (
    <Panel
      eyebrow="Momentum relativo"
      title="Indexed Growth Race"
      action={
        <MetricSwitch
          options={availableMetrics}
          value={metricKey}
          onChange={setSelectedMetric}
        />
      }
    >
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Momentum relativo frente al foco, dos peers y el promedio de mercado.
      </p>

      <CompanyLegend
        series={series}
        hiddenCompanyIds={visibility.hiddenCompanyIds}
        onToggleCompany={visibility.handleToggleCompany}
        onShowAll={visibility.handleShowAll}
        onHideAll={visibility.handleHideAll}
      />

      <div className="mt-4 h-[340px] min-w-0 w-full">
        {metricKey && activeSeries.length >= 2 && chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData} margin={{ top: 10, right: 66, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
              <ReferenceLine y={100} stroke="rgba(0,0,0,0.28)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                minTickGap={28}
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#6F6864", fontSize: 12 }}
                tickFormatter={(value) => formatMetric(value, metricKey)}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                cursor={{ stroke: "rgba(0,0,0,0.18)" }}
                content={<MultiSeriesTooltip metricKey={metricKey} seriesById={seriesById} />}
              />
              {activeSeries.map((companySeries) => (
                <Line
                  key={`${metricKey}-${companySeries.company_id}`}
                  type="monotone"
                  dataKey={companySeries.company_id}
                  name={companySeries.display_name}
                  stroke={isBenchmarkRow(companySeries) ? "#94A3B8" : companySeries.company_color}
                  strokeDasharray={isBenchmarkRow(companySeries) ? "6 5" : undefined}
                  strokeWidth={sameCompany(companySeries.company_id, OWN_COMPANY_ID) ? 3.2 : 2.2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls={false}
                >
                  <LabelList
                    content={(props) => (
                      <LineLogoLabel
                        {...props}
                        companySeries={{
                          ...companySeries,
                          company_color: isBenchmarkRow(companySeries) ? "#94A3B8" : companySeries.company_color,
                        }}
                        lastPointIndex={lastValueIndexes.get(
                          normalizeCompanyId(companySeries.company_id),
                        )}
                      />
                    )}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No hay historico suficiente para crecimiento indexado."
            message="Se necesitan al menos dos periodos comparables con indexed_revenue o indexed_visits."
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="scope-pill">{rangeLabel}</span>
        {selectedOption && <span className="scope-pill">{selectedOption.label}</span>}
        <span className="scope-pill">Benchmark: Promedio mercado</span>
      </div>
    </Panel>
  );
}

function MonetizationTooltip({ active, payload = [] }) {
  if (!active || !payload.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <ChartTooltipShell title={entry.name}>
      <div className="chart-tooltip-row">
        <span>Gap monetizacion</span>
        <span className="chart-tooltip-value">{formatPp(entry.value)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>Cuota facturacion</span>
        <span className="chart-tooltip-value">{formatPercent(entry.revenueShare)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>Cuota visitas</span>
        <span className="chart-tooltip-value">{formatPercent(entry.visitShare)}</span>
      </div>
    </ChartTooltipShell>
  );
}

function MonetizationGap({ rows = [] }) {
  const data = useMemo(() => getMonetizationRows(rows), [rows]);
  const chartData = useMemo(() => {
    const positiveRows = data.filter((entry) => entry.value > 0).slice(0, 4);
    const negativeRows = data
      .filter((entry) => entry.value < 0)
      .sort((a, b) => a.value - b.value)
      .slice(0, 4);
    return [...positiveRows, ...negativeRows].sort((a, b) => b.value - a.value);
  }, [data]);
  const domain = useMemo(() => {
    const maxAbs = Math.max(0.01, ...chartData.map((entry) => Math.abs(entry.value)));
    return [-maxAbs, maxAbs];
  }, [chartData]);

  return (
    <Panel eyebrow="Eficiencia comercial" title="Monetization Gap">
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Diferencia frontend entre cuota de facturacion y cuota de visitas. Positivo implica mejor monetizacion que peso en trafico.
      </p>
      {chartData.length ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="h-[300px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 18, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke="rgba(0,0,0,0.08)" horizontal={false} />
                <ReferenceLine x={0} stroke="rgba(0,0,0,0.36)" />
                <XAxis
                  type="number"
                  domain={domain}
                  tick={{ fill: "#6F6864", fontSize: 12 }}
                  tickFormatter={formatPp}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={94}
                  tick={{ fill: "#393330", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<MonetizationTooltip />} />
                <Bar dataKey="value" radius={[3, 3, 3, 3]} barSize={18}>
                  {chartData.map((entry) => (
                    <Cell key={entry.id} fill={entry.value >= 0 ? entry.color : "#94A3B8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="monetization-legend">
            {chartData.map((entry) => (
              <div key={`${entry.id}-gap`} className="monetization-row">
                <span className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={entry.id}
                    label={entry.name}
                    color={entry.color}
                    className="company-mark-legend"
                  />
                  <span className="truncate font-semibold text-black">{entry.name}</span>
                </span>
                <span className="efficiency-badge">{entry.badge}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No hay datos suficientes para calcular eficiencia comercial."
          message="Se necesitan cuota de facturacion y cuota de visitas en competidores reales del periodo."
        />
      )}
    </Panel>
  );
}

function ShareGainLossCompact({ rows = [] }) {
  const [mode, setMode] = useState("revenue");
  const availableModes = useMemo(
    () =>
      [
        { key: "revenue", label: "Revenue share" },
        { key: "visits", label: "Visits share" },
      ].filter((option) => getShareChangeMetric(rows, option.key)),
    [rows],
  );

  useEffect(() => {
    if (!availableModes.length) return;
    if (!availableModes.some((option) => option.key === mode)) {
      setMode(availableModes[0].key);
    }
  }, [availableModes, mode]);

  const metricKey = getShareChangeMetric(rows, mode);
  const movers = useMemo(() => getShareWinnersLosers(rows, metricKey), [metricKey, rows]);
  const metricLabel = metricKey ? getMetricCopy(metricKey) : "";

  return (
    <Panel
      eyebrow="Cuota"
      title="Share Gain/Loss"
      action={<MetricSwitch options={availableModes} value={mode} onChange={setMode} label="Vista" />}
    >
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Movimiento compacto de cuota para detectar cambios relevantes sin listar todo el mercado.
      </p>
      {metricKey ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <ExecutiveMoverList
              title="Gainers"
              items={movers.gainers}
              emptyMessage="Sin ganadores de cuota para esta vista."
            />
            <ExecutiveMoverList
              title="Losers"
              items={movers.losers}
              emptyMessage="Sin perdedores de cuota para esta vista."
            />
          </div>
          <div className="mt-3">
            <span className="scope-pill">{metricLabel}</span>
          </div>
        </>
      ) : (
        <EmptyState
          title="No hay datos suficientes para cuota ganada/perdida."
          message="Se requiere share_revenue_change_yoy o share_visits_change_yoy; si no existen, se usa MoM."
        />
      )}
    </Panel>
  );
}

function CompetitiveMapTooltip({ active, payload = [], yMetric, sizeMetric }) {
  if (!active || !payload.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <ChartTooltipShell title={entry.name}>
      <div className="chart-tooltip-row">
        <span>Visitas</span>
        <span className="chart-tooltip-value">{formatMetric(entry.x, "visits")}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>{getMetricCopy(yMetric)}</span>
        <span className="chart-tooltip-value">{formatMetric(entry.y, yMetric)}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>{getMetricCopy(sizeMetric)}</span>
        <span className="chart-tooltip-value">{formatMetric(entry.z, sizeMetric)}</span>
      </div>
    </ChartTooltipShell>
  );
}

function CompetitiveMapLabel({ x, y, payload }) {
  if (!payload?.showLabel) return null;
  const pointX = Number(x);
  const pointY = Number(y);
  if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return null;

  return (
    <text
      x={pointX + 10}
      y={pointY - 8}
      fill="#111111"
      fontSize="11"
      fontWeight="700"
      pointerEvents="none"
    >
      {payload.name}
    </text>
  );
}

function CompetitiveMap({ rows = [] }) {
  const yMetric = hasAnyMetric(rows, "revenue_per_visit") ? "revenue_per_visit" : "revenue";
  const sizeMetric = hasAnyMetric(rows, "market_share_revenue")
    ? "market_share_revenue"
    : "market_share_visits";
  const scatterData = useMemo(() => {
    const baseData = rows
      .filter(isRealCompanyRow)
      .map((row) => {
        const x = safeNumber(row?.visits);
        const y = safeNumber(row?.[yMetric]);
        const z = safeNumber(row?.[sizeMetric]);
        if (x === null || y === null || z === null) return null;

        return {
          id: row.company_id,
          name: getCompanyLabel(row),
          x,
          y,
          z,
          color: row.company_color || "#6F6864",
        };
      })
      .filter(Boolean);
    const labelledIds = new Set(
      baseData
        .slice()
        .sort((a, b) => b.z - a.z)
        .slice(0, 4)
        .map((entry) => normalizeCompanyId(entry.id)),
    );
    labelledIds.add(OWN_COMPANY_ID);

    return baseData.map((entry) => ({
      ...entry,
      showLabel: labelledIds.has(normalizeCompanyId(entry.id)),
    }));
  }, [rows, sizeMetric, yMetric]);
  const medianX = useMemo(() => getMedian(scatterData.map((entry) => entry.x)), [scatterData]);
  const medianY = useMemo(() => getMedian(scatterData.map((entry) => entry.y)), [scatterData]);

  return (
    <Panel eyebrow="Mapa competitivo" title="Competitive Map">
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Alto trafico + alta eficiencia senala lideres fuertes; alto trafico + baja eficiencia revela trafico mal monetizado.
      </p>
      {scatterData.length >= 2 ? (
        <>
          <div className="h-[390px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ScatterChart margin={{ top: 20, right: 24, bottom: 16, left: 0 }}>
                <CartesianGrid stroke="rgba(0,0,0,0.08)" />
                {medianX !== null && (
                  <ReferenceLine x={medianX} stroke="rgba(0,0,0,0.22)" strokeDasharray="3 3" />
                )}
                {medianY !== null && (
                  <ReferenceLine y={medianY} stroke="rgba(0,0,0,0.22)" strokeDasharray="3 3" />
                )}
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Visitas"
                  tick={{ fill: "#6F6864", fontSize: 12 }}
                  tickFormatter={(value) => formatMetric(value, "visits")}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={getMetricCopy(yMetric)}
                  tick={{ fill: "#6F6864", fontSize: 12 }}
                  tickFormatter={(value) => formatMetric(value, yMetric)}
                  tickLine={false}
                  axisLine={false}
                  width={82}
                />
                <ZAxis type="number" dataKey="z" range={[70, 560]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={<CompetitiveMapTooltip yMetric={yMetric} sizeMetric={sizeMetric} />}
                />
                <Scatter data={scatterData} isAnimationActive={false}>
                  {scatterData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                  <LabelList content={<CompetitiveMapLabel />} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="quadrant-guide">
            <span>Lider fuerte: alto trafico + alta eficiencia.</span>
            <span>Trafico mal monetizado: alto trafico + baja eficiencia.</span>
            <span>Nicho eficiente: bajo trafico + alta eficiencia.</span>
            <span>Player pequeno/debil: bajo trafico + baja eficiencia.</span>
          </div>
        </>
      ) : (
        <EmptyState
          title="No hay datos suficientes para el mapa competitivo."
          message="Se necesitan visitas y revenue_per_visit o revenue en al menos dos competidores reales."
        />
      )}
    </Panel>
  );
}

function BattleCards({ rows = [] }) {
  const focusRow = getCompanyRow(rows, OWN_COMPANY_ID);
  const cards = BATTLE_TARGET_IDS.map((targetId) => ({
    targetId,
    targetRow: getCompanyRow(rows, targetId),
    isBenchmark: sameCompany(targetId, MARKET_BENCHMARK_ID),
  }));

  return (
    <Panel eyebrow="Comparativas" title="Battle Cards">
      <p className="mb-4 text-sm leading-6 text-neutral-600">
        Comparativa del foco contra dos peers y el benchmark medio del mercado.
      </p>
      {focusRow ? (
        <div className="battle-grid">
          {cards.map(({ targetId, targetRow, isBenchmark }) => (
            <article key={targetId} className="battle-card">
              <div className="battle-card-header">
                <div className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={OWN_COMPANY_ID}
                    label="Focus Brand"
                    color="#000000"
                    className="company-mark-legend"
                  />
                  <span className="font-semibold text-black">Focus Brand</span>
                </div>
                <span className="battle-versus">vs</span>
                <div className="flex min-w-0 items-center gap-2">
                  <CompanyMark
                    companyId={targetId}
                    label={targetRow ? getCompanyLabel(targetRow) : targetId}
                    color={targetRow?.company_color || (isBenchmark ? "#94A3B8" : "#6F6864")}
                    className="company-mark-legend"
                  />
                  <span className="truncate font-semibold text-black">
                    {targetRow ? getCompanyLabel(targetRow) : targetId}
                  </span>
                </div>
              </div>
              {isBenchmark && <span className="mt-3 inline-flex scope-pill">Benchmark visual</span>}
              {targetRow ? (
                <div className="battle-metrics">
                  {BATTLE_METRICS.map((metric) => {
                    const focusValue = safeNumber(focusRow?.[metric.key]);
                    const targetValue = safeNumber(targetRow?.[metric.key]);
                    const hasBoth = focusValue !== null && targetValue !== null;

                    return (
                      <div key={`${targetId}-${metric.key}`} className="battle-metric-row">
                        <span className="battle-metric-name">{metric.label}</span>
                        {hasBoth ? (
                          <>
                            <span className="battle-metric-values">
                              {metric.formatter(focusValue)} / {metric.formatter(targetValue)}
                            </span>
                            <span className="battle-metric-winner">
                              Winner: {getBattleWinner(metric, focusRow, targetRow)}
                            </span>
                            <small>{getBattleDeltaLabel(metric, focusValue, targetValue)}</small>
                          </>
                        ) : (
                          <span className="battle-empty">Sin dato comparable</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No hay datos para esta battle card."
                  message="Selecciona un periodo en el que exista la entidad comparada."
                />
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No hay datos de Focus Brand para comparar."
          message="Las battle cards necesitan una fila real de Focus Brand en el periodo seleccionado."
        />
      )}
    </Panel>
  );
}

function PresentationChart({ rows = [], snapshot }) {
  const metricKey =
    INDEXED_METRIC_OPTIONS.find((option) => hasAnyMetric(rows, option.key))?.key ||
    snapshot?.primaryMetric ||
    "visits";
  const companyIds = CORE_RACE_COMPANY_IDS.filter((companyId) =>
    rows.some((row) => sameCompany(row.company_id, companyId) && safeNumber(row?.[metricKey]) !== null),
  );
  const series = groupSeriesByCompetitor(rows, metricKey, companyIds).filter(
    (companySeries) => companySeries.points.length >= 2,
  );
  const chartData = toMultiLineChartData(series);
  const seriesById = new Map(
    series.map((companySeries) => [normalizeCompanyId(companySeries.company_id), companySeries]),
  );

  if (series.length < 2 || chartData.length < 2) {
    return (
      <EmptyState
        title="No hay grafico principal para modo presentacion."
        message="Faltan al menos dos series historicas comparables."
      />
    );
  }

  return (
    <div className="presentation-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={chartData} margin={{ top: 10, right: 22, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            minTickGap={32}
            tick={{ fill: "#6F6864", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: "#6F6864", fontSize: 12 }}
            tickFormatter={(value) => formatMetric(value, metricKey)}
            tickLine={false}
            axisLine={false}
            width={74}
          />
          <Tooltip
            cursor={{ stroke: "rgba(0,0,0,0.18)" }}
            content={<MultiSeriesTooltip metricKey={metricKey} seriesById={seriesById} />}
          />
          {series.map((companySeries) => (
            <Line
              key={`presentation-${companySeries.company_id}`}
              type="monotone"
              dataKey={companySeries.company_id}
              stroke={isBenchmarkRow(companySeries) ? "#94A3B8" : companySeries.company_color}
              strokeDasharray={isBenchmarkRow(companySeries) ? "6 5" : undefined}
              strokeWidth={sameCompany(companySeries.company_id, OWN_COMPANY_ID) ? 3 : 2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PresentationMode({ snapshot, periodRows = [], chartRows = [] }) {
  const rankingRows = useMemo(
    () =>
      periodRows
        .filter((row) => safeNumber(row?.[snapshot.primaryMetric]) !== null)
        .slice()
        .sort((a, b) => safeNumber(b?.[snapshot.primaryMetric]) - safeNumber(a?.[snapshot.primaryMetric]))
        .slice(0, 5),
    [periodRows, snapshot.primaryMetric],
  );
  const kpis = [
    {
      label: snapshot.primaryMetric === "revenue" ? "Mercado facturacion" : "Mercado visitas",
      value: snapshot.totalMarketValue !== null ? formatMetric(snapshot.totalMarketValue, snapshot.primaryMetric) : "N/A",
    },
    {
      label: "Share Focus Brand",
      value: formatMetric(snapshot.focusShare, snapshot.shareMetric),
    },
    {
      label: "Focus Brand YoY",
      value: snapshot.focusGrowth !== null ? formatSignedPercent(snapshot.focusGrowth) : "N/A",
    },
  ];

  return (
    <Panel eyebrow="Modo presentacion" title="Slide capture">
      <div className="presentation-mode">
        <div className="presentation-headline">
          <p className="analysis-label text-focus-500">Historia principal</p>
          <h2>{snapshot.headline}</h2>
          <TrustBadges badges={snapshot.badges} />
        </div>
        <div className="presentation-kpis">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="presentation-kpi">
              <span>{kpi.label}</span>
              <strong>{kpi.value}</strong>
            </div>
          ))}
        </div>
        <div className="presentation-grid">
          <PresentationChart rows={chartRows} snapshot={snapshot} />
          <div className="presentation-ranking">
            <p className="analysis-label">Ranking compacto</p>
            {rankingRows.length ? (
              <div className="mt-3 space-y-2">
                {rankingRows.map((row, index) => (
                  <div key={`presentation-${row.company_id}`} className="presentation-ranking-row">
                    <span>#{index + 1}</span>
                    <CompanyMark
                      companyId={row.company_id}
                      label={getCompanyLabel(row)}
                      color={row.company_color}
                      className="company-mark-legend"
                    />
                    <strong>{getCompanyLabel(row)}</strong>
                    <small>{formatMetric(row?.[snapshot.primaryMetric], snapshot.primaryMetric)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Sin ranking para este periodo.</p>
            )}
          </div>
        </div>
        <div className="presentation-conclusion">
          <span>Conclusion estrategica</span>
          <strong>{getStrategicConclusion(snapshot)}</strong>
        </div>
      </div>
    </Panel>
  );
}

function HomeView({
  rankingRows,
  rankingPeriodRows,
  comparisonPeriodRows,
  rankingSort,
  onRankingSortChange,
  rankingSortOptions,
  rankingMarket,
  onRankingMarketChange,
  rankingMarkets,
  rankingPeriodType,
  onRankingPeriodTypeChange,
  rankingPeriodTypes,
  selectedRankingPeriodKey,
  onSelectedRankingPeriodChange,
  rankingPeriodOptions,
  selectedRankingPeriod,
  insightItems,
  forecastRows,
  forecastScenarios,
  forecastScenario,
  onForecastScenarioChange,
  forecastScenarioLabel,
  forecastMarket,
  onForecastMarketChange,
  forecastMarkets,
  forecastPeriodType,
  onForecastPeriodTypeChange,
  forecastPeriodTypes,
  chartTrendRows,
  chartMarket,
  onChartMarketChange,
  chartMarkets,
  chartPeriodType,
  onChartPeriodTypeChange,
  chartPeriodTypes,
  chartRangeMode,
  onChartRangeModeChange,
  selectedChartYear,
  onSelectedChartYearChange,
  chartYears,
  onOpenForecast,
  onOpenProfile,
}) {
  const chartRows = useMemo(
    () => filterRowsByChartRange(chartTrendRows, chartRangeMode, selectedChartYear),
    [chartRangeMode, selectedChartYear, chartTrendRows],
  );
  const currentPeriodRows = rankingPeriodRows?.length ? rankingPeriodRows : rankingRows;
  const currentComparisonRows = comparisonPeriodRows?.length ? comparisonPeriodRows : currentPeriodRows;
  const executiveSnapshot = useMemo(
    () => buildExecutiveSnapshot(currentPeriodRows, currentComparisonRows, selectedRankingPeriod),
    [currentComparisonRows, currentPeriodRows, selectedRankingPeriod],
  );
  const rankingSortLabel =
    RANKING_SORTS.find((sort) => sort.key === rankingSort)?.label || rankingSort;
  const chartRangeLabel = chartRangeMode === "year" ? selectedChartYear || "Año" : "All time";

  return (
    <div className="home-block-stack">
      <ContentSection
        eyebrow="Executive cockpit"
        title="Lectura del mercado"
        detail={selectedRankingPeriod?.label || rankingSortLabel}
        action={
          <RankingControls
            market={rankingMarket}
            onMarketChange={onRankingMarketChange}
            markets={rankingMarkets}
            periodType={rankingPeriodType}
            onPeriodTypeChange={onRankingPeriodTypeChange}
            periodTypes={rankingPeriodTypes}
            selectedPeriodKey={selectedRankingPeriodKey}
            onSelectedPeriodChange={onSelectedRankingPeriodChange}
            periodOptions={rankingPeriodOptions}
            rankingSort={rankingSort}
            onRankingSortChange={onRankingSortChange}
            rankingSortOptions={rankingSortOptions}
          />
        }
      >
        <ExecutiveMarketHome snapshot={executiveSnapshot} rows={currentPeriodRows} />
      </ContentSection>

      <ContentSection
        eyebrow="Momentum"
        title="Crecimiento indexado"
        detail={chartRangeLabel}
        action={
          <ChartRangeControls
            market={chartMarket}
            onMarketChange={onChartMarketChange}
            markets={chartMarkets}
            periodType={chartPeriodType}
            onPeriodTypeChange={onChartPeriodTypeChange}
            periodTypes={chartPeriodTypes}
            chartRangeMode={chartRangeMode}
            onChartRangeModeChange={onChartRangeModeChange}
            selectedChartYear={selectedChartYear}
            onSelectedChartYearChange={onSelectedChartYearChange}
            chartYears={chartYears}
          />
        }
      >
        <IndexedGrowthRace rows={chartRows} rangeLabel={chartRangeLabel} />
      </ContentSection>

      <ContentSection
        eyebrow="Cuota y monetizacion"
        title="Donde se gana, se pierde y se convierte mejor"
        detail={selectedRankingPeriod?.label}
      >
        <section className="grid gap-6 xl:grid-cols-2">
          <MonetizationGap rows={currentPeriodRows} />
          <ShareGainLossCompact rows={currentPeriodRows} />
        </section>
      </ContentSection>

      <ContentSection
        eyebrow="Mapa"
        title="Competitive Map"
        detail={selectedRankingPeriod?.label}
      >
        <CompetitiveMap rows={currentPeriodRows} />
      </ContentSection>

      <ContentSection
        eyebrow="Battle cards"
        title="Focus Brand frente a rivales clave"
        detail={selectedRankingPeriod?.label}
      >
        <BattleCards rows={currentComparisonRows} />
      </ContentSection>

      <ContentSection
        eyebrow="Presentacion"
        title="Vista capturable"
        detail={selectedRankingPeriod?.label}
      >
        <PresentationMode
          snapshot={executiveSnapshot}
          periodRows={currentPeriodRows}
          chartRows={chartRows}
        />
      </ContentSection>

      <ContentSection
        eyebrow="Ranking"
        title="Ranking benchmark"
        detail={selectedRankingPeriod?.label || rankingSortLabel}
      >
        <BenchmarkRankingPanel
          rows={rankingRows}
          sortKey={rankingSort}
          selectedPeriod={selectedRankingPeriod}
          onOpenProfile={onOpenProfile}
        />
      </ContentSection>

      <ContentSection
        eyebrow="Insights"
        title="Senales adicionales"
        detail={selectedRankingPeriod?.label}
      >
        <InsightFeed items={insightItems} />
      </ContentSection>

      <ContentSection
        eyebrow="Forecast"
        title="Forecast de mercado"
        detail={forecastScenarioLabel}
        action={
          <ForecastControls
            forecastScenarios={forecastScenarios}
            forecastScenario={forecastScenario}
            onForecastScenarioChange={onForecastScenarioChange}
            market={forecastMarket}
            onMarketChange={onForecastMarketChange}
            markets={forecastMarkets}
            periodType={forecastPeriodType}
            onPeriodTypeChange={onForecastPeriodTypeChange}
            periodTypes={forecastPeriodTypes}
          />
        }
      >
        {forecastRows.length ? (
          <ForecastPreview
            forecastRows={forecastRows}
            forecastScenarioLabel={forecastScenarioLabel}
            onOpenForecast={onOpenForecast}
          />
        ) : (
          <EmptyState
            title="No hay forecast para esta selección."
            message="Cambia escenario o mercado para ver el horizonte disponible."
          />
        )}
      </ContentSection>

    </div>
  );
}

function ProfileKpis({ row, company }) {
  const accentColor = row?.company_color || company?.company_color || "#E4032C";

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <KpiCard
        label="Facturación"
        value={formatCurrency(row?.revenue)}
        detail={row?.period_display_label}
        accentColor={accentColor}
      />
      <KpiCard
        label="Visitas"
        value={formatCompact(row?.visits)}
        detail={row?.period_display_label}
        accentColor={accentColor}
      />
      <KpiCard
        label="Cuota facturación"
        value={formatPercent(row?.market_share_revenue)}
        detail="Share"
        accentColor={accentColor}
      />
      <KpiCard
        label="Cuota visitas"
        value={formatPercent(row?.market_share_visits)}
        detail="Share"
        accentColor={accentColor}
      />
      <KpiCard
        label="Ranking facturación"
        value={formatMetric(row?.rank_revenue, "rank_revenue")}
        detail="Ranking"
        accentColor={accentColor}
      />
      <KpiCard
        label="Revenue por visita"
        value={formatCurrencyDecimal(row?.revenue_per_visit)}
        detail="Eficiencia"
        accentColor={accentColor}
      />
    </section>
  );
}

function ProfileView({
  rows,
  companies,
  chartRangeMode,
  onChartRangeModeChange,
  chartMarket,
  onChartMarketChange,
  chartMarkets,
  chartPeriodType,
  onChartPeriodTypeChange,
  chartPeriodTypes,
  selectedChartYear,
  onSelectedChartYearChange,
  chartYears,
  selectedCompanyId,
  onSelectedCompanyChange,
  selectedCompany,
  selectedPeriod,
  selectedPeriodRow,
  onBack,
}) {
  const chartRows = useMemo(
    () => filterRowsByChartRange(rows, chartRangeMode, selectedChartYear),
    [chartRangeMode, selectedChartYear, rows],
  );
  const accentColor =
    selectedPeriodRow?.company_color || selectedCompany?.company_color || "#E4032C";
  const hasSelectedCompanyOption = companies.some((company) =>
    sameCompany(company.id, selectedCompanyId),
  );
  const companyTitle = selectedCompany?.label || selectedCompanyId || "Empresa";
  const profileChartItems = useMemo(
    () =>
      PROFILE_CHARTS.map((chart) => {
        const series = groupSeriesByCompetitor(chartRows, chart.metricKey);

        return {
          ...chart,
          series,
          chartData: toMultiLineChartData(series),
        };
      }),
    [chartRows],
  );
  const profileLegendSeries = useMemo(
    () => mergeSeriesForLegend(profileChartItems.map((chart) => chart.series)),
    [profileChartItems],
  );
  const selectedCompanyDefault = useMemo(
    () => [selectedCompanyId, "market_average"],
    [selectedCompanyId],
  );
  const profileVisibility = useCompanyVisibility(profileLegendSeries, selectedCompanyDefault);
  const chartRangeLabel = chartRangeMode === "year" ? selectedChartYear || "Año" : "All time";

  return (
    <div className="space-y-6">
      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button type="button" className="section-link" onClick={onBack}>
              Volver al benchmark
            </button>
            <div className="mt-5 flex items-center gap-3">
              <CompanyMark
                companyId={selectedCompanyId}
                label={companyTitle}
                color={accentColor}
                className="company-mark-profile"
              />
              <div>
                <p className="analysis-label">Ficha individual</p>
                <h2 className="mt-1 text-3xl font-semibold text-black">
                  {companyTitle}
                </h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-neutral-600">
              Lectura individual para {selectedPeriod?.label || "el período seleccionado"}.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] lg:min-w-[520px]">
            <SelectField
              label="Cambiar ficha"
              value={selectedCompanyId}
              onChange={onSelectedCompanyChange}
              disabled={!companies.length}
            >
              {!hasSelectedCompanyOption && selectedCompanyId && (
                <option value={selectedCompanyId}>{selectedCompanyId}</option>
              )}
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.label}
                </option>
              ))}
            </SelectField>

            <div className="rounded-sm border border-black/10 bg-[#fbf8f5] px-4 py-3">
              <p className="analysis-label">Período</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="font-semibold text-black">{selectedPeriod?.label || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {selectedPeriodRow ? (
        <ProfileKpis row={selectedPeriodRow} company={selectedCompany} />
      ) : (
        <EmptyState
          title="No hay datos para el competidor seleccionado."
          message="Vuelve al benchmark y cambia el período o selecciona otra empresa disponible."
        />
      )}

      <ContentSection
        eyebrow="Gráficas"
        title="Gráficas de ficha"
        detail={chartRangeLabel}
        action={
          <ChartRangeControls
            market={chartMarket}
            onMarketChange={onChartMarketChange}
            markets={chartMarkets}
            periodType={chartPeriodType}
            onPeriodTypeChange={onChartPeriodTypeChange}
            periodTypes={chartPeriodTypes}
            chartRangeMode={chartRangeMode}
            onChartRangeModeChange={onChartRangeModeChange}
            selectedChartYear={selectedChartYear}
            onSelectedChartYearChange={onSelectedChartYearChange}
            chartYears={chartYears}
          />
        }
      >
        <CompanyLegend
          series={profileLegendSeries}
          hiddenCompanyIds={profileVisibility.hiddenCompanyIds}
          onToggleCompany={profileVisibility.handleToggleCompany}
          onShowAll={profileVisibility.handleShowAll}
          onHideAll={profileVisibility.handleHideAll}
        />

        <section className="grid gap-6 xl:grid-cols-2">
          {profileChartItems.map((chart) => (
            <MetricChart
              key={chart.metricKey}
              title={chart.title}
              metricKey={chart.metricKey}
              series={chart.series}
              chartData={chart.chartData}
              emptyTitle={`No hay datos suficientes para ${chart.title}.`}
              hiddenCompanyIds={profileVisibility.hiddenCompanyIds}
            />
          ))}
        </section>
      </ContentSection>
    </div>
  );
}

export default function App() {
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [route, setRoute] = useState(getCurrentRoute);
  const [rankingPeriodType, setRankingPeriodType] = useState("monthly");
  const [rankingMarket, setRankingMarket] = useState("");
  const [selectedRankingPeriodKey, setSelectedRankingPeriodKey] = useState("");
  const [forecastPeriodType, setForecastPeriodType] = useState("monthly");
  const [forecastMarket, setForecastMarket] = useState("");
  const [chartPeriodType, setChartPeriodType] = useState("monthly");
  const [chartMarket, setChartMarket] = useState("");
  const [chartRangeMode, setChartRangeMode] = useState("all");
  const [selectedChartYear, setSelectedChartYear] = useState("");
  const [rankingSort, setRankingSort] = useState("revenue");
  const [forecastScenario, setForecastScenario] = useState("base_case");
  const [selectedCompanyId, setSelectedCompanyId] = useState(OWN_COMPANY_ID);

  useEffect(() => {
    let isMounted = true;

    loadBenchmarkData()
      .then((json) => {
        if (!isMounted) return;
        setPayload(json);
        setStatus("ready");
      })
      .catch((apiError) => {
        if (!isMounted) return;
        setError(apiError.message || "Unable to load benchmark data.");
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleHashChange = () => {
      setRoute(getCurrentRoute());
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const rawInterfaceRows = payload?.data?.interface ?? [];
  const rawInsights = payload?.data?.insights ?? [];
  const rows = useMemo(() => normalizeInterfaceRows(rawInterfaceRows), [rawInterfaceRows]);
  const realRows = useMemo(() => rows.filter(isRealCompanyRow), [rows]);
  const comparableRows = useMemo(() => rows.filter(isComparableRow), [rows]);
  const forecastScenarios = useMemo(() => getAvailableForecastScenarios(rows), [rows]);

  useEffect(() => {
    if (!rows.length) return;

    if (!forecastScenarios.length) {
      setForecastScenario("");
      return;
    }

    if (!forecastScenario || !forecastScenarios.includes(forecastScenario)) {
      setForecastScenario(
        forecastScenarios.includes("base_case") ? "base_case" : forecastScenarios[0],
      );
    }
  }, [forecastScenario, forecastScenarios, rows.length]);

  const forecastScenarioRows = useMemo(
    () => filterRowsByForecastScenario(rows, forecastScenario),
    [forecastScenario, rows],
  );
  const forecastSourceRows = useMemo(
    () => getForecastRows(forecastScenarioRows),
    [forecastScenarioRows],
  );
  const rankingSortOptions = useMemo(
    () => getAvailableRankingSorts(realRows),
    [realRows],
  );

  useEffect(() => {
    if (!rankingSortOptions.length) return;
    if (!rankingSortOptions.some((sort) => sort.key === rankingSort)) {
      const defaultSort =
        rankingSortOptions.find((sort) => sort.key === "revenue") ?? rankingSortOptions[0];
      setRankingSort(defaultSort.key);
    }
  }, [rankingSort, rankingSortOptions]);

  const rankingMetricRows = useMemo(
    () => filterRowsWithMetrics(realRows, [rankingSort]),
    [realRows, rankingSort],
  );
  const rankingSourcePeriodTypes = useMemo(
    () => getPeriodTypes(rankingMetricRows),
    [rankingMetricRows],
  );
  const rankingPeriodTypes = useMemo(
    () => getRankingPeriodTypes(rankingMetricRows, rankingSourcePeriodTypes, rankingSort),
    [rankingMetricRows, rankingSort, rankingSourcePeriodTypes],
  );

  useEffect(() => {
    if (!rankingPeriodTypes.length) return;
    if (!rankingPeriodTypes.includes(rankingPeriodType)) {
      setRankingPeriodType(
        rankingPeriodTypes.includes("monthly") ? "monthly" : rankingPeriodTypes[0],
      );
    }
  }, [rankingPeriodType, rankingPeriodTypes]);

  const rankingSourcePeriodType = useMemo(
    () => getSourcePeriodType(rankingPeriodType, rankingSourcePeriodTypes),
    [rankingPeriodType, rankingSourcePeriodTypes],
  );
  const rankingMarkets = useMemo(
    () => getMarkets(rankingMetricRows, rankingSourcePeriodType),
    [rankingMetricRows, rankingSourcePeriodType],
  );

  useEffect(() => {
    if (!rankingMarkets.length) {
      setRankingMarket("");
      return;
    }

    if (!rankingMarket || !rankingMarkets.includes(rankingMarket)) {
      setRankingMarket(rankingMarkets[0]);
    }
  }, [rankingMarket, rankingMarkets]);

  const rankingBenchmarkRows = useMemo(
    () =>
      preferObservedRows(
        filterRowsWithMetrics(
          filterInterfaceRows(
            realRows,
            {
              periodType: rankingSourcePeriodType,
              market: rankingMarket,
            },
            { realOnly: true },
          ),
          [rankingSort],
        ),
      ),
    [realRows, rankingMarket, rankingSort, rankingSourcePeriodType],
  );
  const rankingPeriodOptions = useMemo(
    () =>
      rankingPeriodType === "annual"
        ? getAvailableAnnualPeriods(rankingBenchmarkRows)
        : getAvailablePeriods(rankingBenchmarkRows),
    [rankingBenchmarkRows, rankingPeriodType],
  );

  useEffect(() => {
    const periodKeys = new Set(rankingPeriodOptions.map((period) => period.key));

    if (!rankingPeriodOptions.length) {
      setSelectedRankingPeriodKey("");
      return;
    }

    if (!selectedRankingPeriodKey || !periodKeys.has(selectedRankingPeriodKey)) {
      const latestActualPeriod =
        rankingPeriodOptions
          .slice()
          .reverse()
          .find((period) => !period.has_forecast) ??
        rankingPeriodOptions[rankingPeriodOptions.length - 1];
      setSelectedRankingPeriodKey(latestActualPeriod.key);
    }
  }, [rankingPeriodOptions, selectedRankingPeriodKey]);

  const selectedRankingPeriod = useMemo(
    () =>
      rankingPeriodOptions.find((period) => period.key === selectedRankingPeriodKey) ??
      null,
    [rankingPeriodOptions, selectedRankingPeriodKey],
  );
  const rankingPeriodRows = useMemo(
    () =>
      rankingPeriodType === "annual"
        ? getRowsForAnnualPeriod(rankingBenchmarkRows, selectedRankingPeriodKey)
        : getRowsForPeriod(rankingBenchmarkRows, selectedRankingPeriodKey),
    [rankingBenchmarkRows, rankingPeriodType, selectedRankingPeriodKey],
  );
  const rankingComparisonRows = useMemo(
    () =>
      preferObservedRows(
        filterInterfaceRows(comparableRows, {
          periodType: rankingSourcePeriodType,
          market: rankingMarket,
        }),
      ),
    [comparableRows, rankingMarket, rankingSourcePeriodType],
  );
  const rankingComparisonPeriodRows = useMemo(
    () =>
      rankingPeriodType === "annual"
        ? getRowsForAnnualPeriod(rankingComparisonRows, selectedRankingPeriodKey)
        : getRowsForPeriod(rankingComparisonRows, selectedRankingPeriodKey),
    [rankingComparisonRows, rankingPeriodType, selectedRankingPeriodKey],
  );
  const chartSelectableRows = useMemo(
    () => filterRowsWithMetrics(comparableRows, DASHBOARD_CHART_METRICS, false),
    [comparableRows],
  );
  const chartSourcePeriodTypes = useMemo(
    () => getPeriodTypes(chartSelectableRows),
    [chartSelectableRows],
  );
  const chartPeriodTypes = chartSourcePeriodTypes;

  useEffect(() => {
    if (!chartPeriodTypes.length) return;
    if (!chartPeriodTypes.includes(chartPeriodType)) {
      setChartPeriodType(chartPeriodTypes.includes("monthly") ? "monthly" : chartPeriodTypes[0]);
    }
  }, [chartPeriodType, chartPeriodTypes]);

  const chartSourcePeriodType = useMemo(
    () => getSourcePeriodType(chartPeriodType, chartSourcePeriodTypes),
    [chartPeriodType, chartSourcePeriodTypes],
  );
  const chartMarkets = useMemo(
    () => getMarkets(chartSelectableRows, chartSourcePeriodType),
    [chartSelectableRows, chartSourcePeriodType],
  );

  useEffect(() => {
    if (!chartMarkets.length) {
      setChartMarket("");
      return;
    }

    if (!chartMarket || !chartMarkets.includes(chartMarket)) {
      setChartMarket(chartMarkets[0]);
    }
  }, [chartMarket, chartMarkets]);

  const chartTrendRows = useMemo(
    () =>
      preferObservedRows(
        filterRowsWithMetrics(
          filterInterfaceRows(comparableRows, {
            periodType: chartSourcePeriodType,
            market: chartMarket,
          }),
          DASHBOARD_CHART_METRICS,
          false,
        ),
      ),
    [chartMarket, chartSourcePeriodType, comparableRows],
  );
  const chartYears = useMemo(
    () => getAvailableChartYears(chartTrendRows, DASHBOARD_CHART_METRICS),
    [chartTrendRows],
  );

  useEffect(() => {
    if (!chartYears.length) {
      setSelectedChartYear("");
      setChartRangeMode("all");
      return;
    }

    if (!selectedChartYear || !chartYears.includes(selectedChartYear)) {
      setSelectedChartYear(chartYears[0]);
    }
  }, [chartYears, selectedChartYear]);

  const forecastSelectableRows = useMemo(
    () => filterRowsWithMetrics(forecastSourceRows, FORECAST_DETAIL_METRICS),
    [forecastSourceRows],
  );
  const forecastSourcePeriodTypes = useMemo(
    () => getPeriodTypes(forecastSelectableRows, { includeForecasts: true, realOnly: true }),
    [forecastSelectableRows],
  );
  const forecastPeriodTypes = forecastSourcePeriodTypes;

  useEffect(() => {
    if (!forecastPeriodTypes.length) return;
    if (!forecastPeriodTypes.includes(forecastPeriodType)) {
      setForecastPeriodType(
        forecastPeriodTypes.includes("monthly") ? "monthly" : forecastPeriodTypes[0],
      );
    }
  }, [forecastPeriodType, forecastPeriodTypes]);

  const forecastSourcePeriodType = useMemo(
    () => getSourcePeriodType(forecastPeriodType, forecastSourcePeriodTypes),
    [forecastPeriodType, forecastSourcePeriodTypes],
  );
  const forecastMarkets = useMemo(
    () =>
      getMarkets(forecastSelectableRows, forecastSourcePeriodType, {
        includeForecasts: true,
        realOnly: true,
      }),
    [forecastSelectableRows, forecastSourcePeriodType],
  );

  useEffect(() => {
    if (!forecastMarkets.length) {
      setForecastMarket("");
      return;
    }

    if (!forecastMarket || !forecastMarkets.includes(forecastMarket)) {
      setForecastMarket(forecastMarkets[0]);
    }
  }, [forecastMarket, forecastMarkets]);

  const forecastRows = useMemo(
    () =>
      filterRowsWithMetrics(
        filterInterfaceRows(
          forecastSourceRows,
          {
            periodType: forecastSourcePeriodType,
            market: forecastMarket,
          },
          { includeForecasts: true, realOnly: true },
        ),
        FORECAST_DETAIL_METRICS,
      ),
    [forecastMarket, forecastSourcePeriodType, forecastSourceRows],
  );
  const companies = useMemo(() => getUniqueCompanies(rankingBenchmarkRows), [rankingBenchmarkRows]);
  const insightItems = useMemo(
    () => getInsightItems(rawInsights, rankingPeriodRows),
    [rankingPeriodRows, rawInsights],
  );

  useEffect(() => {
    if (!companies.length) {
      setSelectedCompanyId(route.companyId || OWN_COMPANY_ID);
      return;
    }

    if (route.view === "profile" && route.companyId) {
      const routedCompany = companies.find((company) => sameCompany(company.id, route.companyId));
      const focus = companies.find((company) => sameCompany(company.id, OWN_COMPANY_ID));
      setSelectedCompanyId(routedCompany?.id ?? focus?.id ?? companies[0].id);
      return;
    }

    if (!companies.some((company) => sameCompany(company.id, selectedCompanyId))) {
      const focus = companies.find((company) => sameCompany(company.id, OWN_COMPANY_ID));
      setSelectedCompanyId(focus?.id ?? companies[0].id);
    }
  }, [companies, route.companyId, route.view, selectedCompanyId]);

  const rankingRows = useMemo(
    () => getRankingRows(rankingPeriodRows, rankingSort),
    [rankingPeriodRows, rankingSort],
  );
  const selectedCompany = useMemo(
    () => companies.find((company) => sameCompany(company.id, selectedCompanyId)) ?? null,
    [companies, selectedCompanyId],
  );
  const selectedPeriodRow = useMemo(
    () => rankingPeriodRows.find((row) => sameCompany(row.company_id, selectedCompanyId)) ?? null,
    [rankingPeriodRows, selectedCompanyId],
  );

  const handleOpenProfile = (companyId) => {
    if (!companyId) return;
    if (!companies.some((company) => sameCompany(company.id, companyId))) return;

    setSelectedCompanyId(companyId);
    navigateToHash(getProfileHash(companyId));
  };

  const handleGoBenchmark = () => {
    navigateToHash(HOME_HASH);
  };

  const handleOpenForecast = () => {
    navigateToHash(FORECAST_HASH);
  };

  if (status === "loading") return <LoadingShell />;

  if (status === "error") {
    return <StatusShell title="No se pudieron cargar los datos." message={error} />;
  }

  if (!rawInterfaceRows.length) {
    return (
      <StatusShell
        title="El snapshot no incluye filas de interface."
        message="data.interface debe contener filas para alimentar el dashboard."
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="mx-auto max-w-7xl space-y-6">
        <AppHeader
          view={route.view}
          onGoBenchmark={handleGoBenchmark}
          generatedAt={formatGeneratedAt(payload?.meta?.generated_at)}
          rowCount={rawInterfaceRows.length}
        />

        {route.view === "home" ? (
          <HomeView
            rankingRows={rankingRows}
            rankingPeriodRows={rankingPeriodRows}
            comparisonPeriodRows={rankingComparisonPeriodRows}
            rankingSort={rankingSort}
            onRankingSortChange={setRankingSort}
            rankingSortOptions={rankingSortOptions}
            rankingMarket={rankingMarket}
            onRankingMarketChange={setRankingMarket}
            rankingMarkets={rankingMarkets}
            rankingPeriodType={rankingPeriodType}
            onRankingPeriodTypeChange={setRankingPeriodType}
            rankingPeriodTypes={rankingPeriodTypes}
            selectedRankingPeriodKey={selectedRankingPeriodKey}
            onSelectedRankingPeriodChange={setSelectedRankingPeriodKey}
            rankingPeriodOptions={rankingPeriodOptions}
            selectedRankingPeriod={selectedRankingPeriod}
            insightItems={insightItems}
            forecastRows={forecastRows}
            forecastScenarios={forecastScenarios}
            forecastScenario={forecastScenario}
            onForecastScenarioChange={setForecastScenario}
            forecastScenarioLabel={getForecastScenarioLabel(forecastScenario)}
            forecastMarket={forecastMarket}
            onForecastMarketChange={setForecastMarket}
            forecastMarkets={forecastMarkets}
            forecastPeriodType={forecastPeriodType}
            onForecastPeriodTypeChange={setForecastPeriodType}
            forecastPeriodTypes={forecastPeriodTypes}
            chartTrendRows={chartTrendRows}
            chartMarket={chartMarket}
            onChartMarketChange={setChartMarket}
            chartMarkets={chartMarkets}
            chartPeriodType={chartPeriodType}
            onChartPeriodTypeChange={setChartPeriodType}
            chartPeriodTypes={chartPeriodTypes}
            chartRangeMode={chartRangeMode}
            onChartRangeModeChange={setChartRangeMode}
            selectedChartYear={selectedChartYear}
            onSelectedChartYearChange={setSelectedChartYear}
            chartYears={chartYears}
            onOpenForecast={handleOpenForecast}
            onOpenProfile={handleOpenProfile}
          />
        ) : route.view === "forecast" ? (
          <ForecastDetailView
            rows={forecastRows}
            forecastScenarios={forecastScenarios}
            forecastScenario={forecastScenario}
            onForecastScenarioChange={setForecastScenario}
            forecastScenarioLabel={getForecastScenarioLabel(forecastScenario)}
            forecastMarket={forecastMarket}
            onForecastMarketChange={setForecastMarket}
            forecastMarkets={forecastMarkets}
            forecastPeriodType={forecastPeriodType}
            onForecastPeriodTypeChange={setForecastPeriodType}
            forecastPeriodTypes={forecastPeriodTypes}
            onBack={handleGoBenchmark}
            onOpenProfile={handleOpenProfile}
          />
        ) : (
          <ProfileView
            rows={chartTrendRows}
            companies={companies}
            chartRangeMode={chartRangeMode}
            onChartRangeModeChange={setChartRangeMode}
            chartMarket={chartMarket}
            onChartMarketChange={setChartMarket}
            chartMarkets={chartMarkets}
            chartPeriodType={chartPeriodType}
            onChartPeriodTypeChange={setChartPeriodType}
            chartPeriodTypes={chartPeriodTypes}
            selectedChartYear={selectedChartYear}
            onSelectedChartYearChange={setSelectedChartYear}
            chartYears={chartYears}
            selectedCompanyId={selectedCompanyId}
            onSelectedCompanyChange={handleOpenProfile}
            selectedCompany={selectedCompany}
            selectedPeriod={selectedRankingPeriod}
            selectedPeriodRow={selectedPeriodRow}
            onBack={handleGoBenchmark}
          />
        )}
      </div>
    </main>
  );
}
