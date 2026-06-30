import {
  buildMonthDate,
  formatMonthLabelFromKey,
  hasDataForMetric,
  isBenchmarkRow,
  isForecastRow,
  isRealCompanyRow,
} from "../../lib/data.js";
import {
  formatNumber,
  formatPercentagePoints,
  safeNumber,
} from "../../lib/formatters.js";
import {
  formatBattleCurrency,
  formatPositionDelta,
} from "../battle/battleLogic.js";

function normalizeCompanyId(companyId) {
  return String(companyId ?? "")
    .trim()
    .toLowerCase();
}

function sameCompany(a, b) {
  return normalizeCompanyId(a) === normalizeCompanyId(b);
}

function getGlobalContextMonthKey(row = {}) {
  if (row?.year && row?.month) {
    return `${row.year}-${String(row.month).padStart(2, "0")}`;
  }

  const date = String(row?.date || "");
  const match = date.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function formatDisplayPeriodLabel(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "N/A";

  const monthMatch = raw.match(/^(\d{4})-(\d{2})/);
  if (monthMatch) return formatMonthLabelFromKey(`${monthMatch[1]}-${monthMatch[2]}`);

  return raw;
}

function hasMetricValue(row, metricKey) {
  return hasDataForMetric(row, metricKey);
}

function getBenchmarkRow(rows = []) {
  return rows.find(isBenchmarkRow) ?? null;
}

function getGrowthBreakdown(row, growthMetricKey) {
  const growthValue = safeNumber(row?.[growthMetricKey]);
  const currentMetric = growthMetricKey.includes("revenue") ? "revenue" : "visits";
  const currentValue = safeNumber(row?.[currentMetric]);
  if (growthValue === null || currentValue === null || growthValue <= -0.999999) return null;

  const previousValue = currentValue / (1 + growthValue);
  if (!Number.isFinite(previousValue)) return null;

  return {
    currentValue,
    previousValue,
    growthValue,
  };
}

function isLowBaseMomentum(previousValue, averagePreviousValue) {
  const previous = safeNumber(previousValue);
  const average = safeNumber(averagePreviousValue);
  if (previous === null || average === null || average <= 0) return false;
  return previous < average * 0.25;
}

export function getProfileRowSortValue(row = {}) {
  const monthKey = getGlobalContextMonthKey(row);
  if (monthKey) {
    const [year, month] = monthKey.split("-");
    return Date.parse(buildMonthDate(year, month)) || 0;
  }

  const parsed = Date.parse(row?.date || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getProfileRowLabel(row = {}, fallback = "") {
  const formattedMonth = formatMonthLabelFromKey(getGlobalContextMonthKey(row));
  const rawLabel = row?.period_display_label || row?.period_label || "";
  const rawLooksIsoDate = /^\d{4}-\d{2}-\d{2}/.test(String(rawLabel));

  return (
    (rawLabel && !rawLooksIsoDate ? rawLabel : "") ||
    formattedMonth ||
    (row?.date ? formatDisplayPeriodLabel(row.date) : "") ||
    fallback
  );
}

export function getSortedCompanyMetricRows(rows = [], companyId = "", metricKey = "") {
  return rows
    .filter((row) => sameCompany(row?.company_id, companyId))
    .filter((row) => hasMetricValue(row, metricKey))
    .sort((a, b) => getProfileRowSortValue(a) - getProfileRowSortValue(b));
}

export function getLatestCompanyMetricRow(rows = [], companyId = "", metricKey = "") {
  return getSortedCompanyMetricRows(rows, companyId, metricKey).at(-1) ?? null;
}

export function formatProfileRankChange(value) {
  const number = safeNumber(value);
  if (number === null) return "";
  if (number === 0) return "No change";
  const direction = number > 0 ? "+" : "-";
  return `${direction}${formatNumber(Math.abs(number), { maximumFractionDigits: 0 })} positions`;
}

export function formatProfileSignedGap(delta, metricKey = "", formatSignedMetricDelta) {
  const value = safeNumber(delta);
  if (value === null) return "No comparable data";
  if (Math.abs(value) < 0.000001) return "In line";

  if (metricKey.startsWith("rank_")) {
    const rankDelta = -value;
    const prefix = rankDelta > 0 ? "Advantage" : "Disadvantage";
    return `${prefix}: ${formatPositionDelta(Math.abs(rankDelta))}`;
  }

  const prefix = value > 0 ? "Advantage" : "Disadvantage";
  if (metricKey.includes("market_share") || metricKey === "monetization_gap") {
    return `${prefix}: ${formatPercentagePoints(value, { compact: true })}`;
  }
  if (metricKey === "revenue") {
    const sign = value > 0 ? "+" : "-";
    return `${prefix}: ${sign}${formatBattleCurrency(Math.abs(value))}`;
  }

  return `${prefix}: ${formatSignedMetricDelta(value, metricKey)}`;
}

export function calculateProfileMetricDelta(baseRow = {}, targetRow = {}, metricKey = "") {
  const baseValue = safeNumber(baseRow?.[metricKey]);
  const targetValue = safeNumber(targetRow?.[metricKey]);
  return baseValue !== null && targetValue !== null ? baseValue - targetValue : null;
}

export function getProfileMomentumTone(row = {}) {
  const revenueGrowth = safeNumber(row?.revenue_yoy_growth);
  const visitsGrowth = safeNumber(row?.visits_yoy_growth);
  const revenueShareChange = safeNumber(row?.share_revenue_change_yoy ?? row?.share_revenue_change_range);
  const visitsShareChange = safeNumber(row?.share_visits_change_yoy ?? row?.share_visits_change_range);
  const positiveSignals = [revenueGrowth, visitsGrowth, revenueShareChange, visitsShareChange].filter(
    (value) => value !== null && value > 0.005,
  ).length;
  const negativeSignals = [revenueGrowth, visitsGrowth, revenueShareChange, visitsShareChange].filter(
    (value) => value !== null && value < -0.005,
  ).length;

  if (positiveSignals > negativeSignals) return "is gaining momentum";
  if (negativeSignals > positiveSignals) return "is losing relative momentum";
  return "";
}

export function getProfileExecutiveInsight(
  row = {},
  companyTitle = "Player",
  periodRows = [],
  focusCompanyId = "focus",
) {
  const rankRevenue = safeNumber(row?.rank_revenue);
  const rankVisits = safeNumber(row?.rank_visits);
  const visitsShare = safeNumber(row?.market_share_visits);
  const revenueShare = safeNumber(row?.market_share_revenue);
  const monetizationGap = safeNumber(row?.monetization_gap);
  const revenuePerVisit = safeNumber(row?.revenue_per_visit);
  const benchmarkRow = getBenchmarkRow(periodRows);
  const benchmarkRpv = safeNumber(benchmarkRow?.revenue_per_visit);
  const momentumTone = getProfileMomentumTone(row);
  const hasRevenue = safeNumber(row?.revenue) !== null;
  const hasVisits = safeNumber(row?.visits) !== null;

  if (!hasRevenue && !hasVisits) {
    return `${companyTitle} does not have enough observed data for an executive read in this period.`;
  }

  if (
    sameCompany(row.company_id, focusCompanyId) &&
    (rankVisits === 1 || (visitsShare !== null && visitsShare >= 0.25)) &&
    monetizationGap !== null &&
    monetizationGap < -0.03
  ) {
    return `${companyTitle} holds a leading traffic position, with strong visit volume, but monetizes below its audience weight.`;
  }

  if (sameCompany(row.company_id, "peer_a") && rankRevenue === 1) {
    return `${companyTitle} leads revenue and keeps direct competitive pressure on Focus Brand.`;
  }

  if (
    sameCompany(row.company_id, "peer_b") &&
    revenuePerVisit !== null &&
    ((benchmarkRpv !== null && revenuePerVisit > benchmarkRpv * 1.25) ||
      (monetizationGap !== null && monetizationGap > 0.03))
  ) {
    return `${companyTitle} has lower traffic scale, but shows high commercial efficiency against the market.`;
  }

  let position = "";
  if (rankRevenue === 1) {
    position = `${companyTitle} leads revenue`;
  } else if (rankVisits === 1) {
    position = `${companyTitle} leads traffic`;
  } else if (rankRevenue !== null && rankVisits !== null) {
    position = `${companyTitle} ranks #${rankRevenue} in revenue and #${rankVisits} in visits`;
  } else if (rankVisits !== null) {
    position = `${companyTitle} ranks #${rankVisits} in traffic`;
  } else if (rankRevenue !== null) {
    position = `${companyTitle} ranks #${rankRevenue} in revenue`;
  } else {
    position = `${companyTitle} has measurable market presence`;
  }

  let strength = "";
  if (rankRevenue === 1 && !sameCompany(row.company_id, focusCompanyId)) {
    strength = "keeps direct competitive pressure on Focus Brand";
  } else if (rankVisits === 1 || (visitsShare !== null && visitsShare >= 0.25)) {
    strength = "with strong visit volume";
  } else if (
    (revenuePerVisit !== null && benchmarkRpv !== null && revenuePerVisit > benchmarkRpv * 1.25) ||
    (monetizationGap !== null && monetizationGap > 0.03)
  ) {
    strength = "with high commercial efficiency against the market";
  } else if (revenueShare !== null && visitsShare !== null && revenueShare > visitsShare) {
    strength = "with more revenue weight than audience weight";
  }

  let tension = "";
  if (monetizationGap !== null && monetizationGap < -0.03) {
    tension = "but monetizes below its audience weight";
  } else if (monetizationGap !== null && monetizationGap > 0.03) {
    tension = "and turns smaller traffic scale into stronger revenue weight";
  } else if (hasVisits && !hasRevenue) {
    tension = "with a traffic-only read because revenue is unavailable";
  }

  const parts = [position, strength, tension, momentumTone].filter(Boolean);
  return `${parts.join(", ")}.`;
}

export function getMarketGrowthForMetric(periodRows = [], metricKey = "visits") {
  const growthKey = metricKey === "revenue" ? "revenue_yoy_growth" : "visits_yoy_growth";
  let currentTotal = 0;
  let previousTotal = 0;
  let hasRows = false;

  periodRows
    .filter(isRealCompanyRow)
    .filter((row) => !isBenchmarkRow(row) && !isForecastRow(row))
    .forEach((row) => {
      const breakdown = getGrowthBreakdown(row, growthKey);
      if (!breakdown) return;
      currentTotal += breakdown.currentValue;
      previousTotal += breakdown.previousValue;
      hasRows = true;
    });

  return hasRows && previousTotal > 0 ? currentTotal / previousTotal - 1 : null;
}

export function getAveragePreviousValueForMetric(periodRows = [], metricKey = "visits") {
  const growthKey = metricKey === "revenue" ? "revenue_yoy_growth" : "visits_yoy_growth";
  const previousValues = periodRows
    .filter(isRealCompanyRow)
    .filter((periodRow) => !isBenchmarkRow(periodRow) && !isForecastRow(periodRow))
    .map((periodRow) => getGrowthBreakdown(periodRow, growthKey)?.previousValue)
    .filter((value) => safeNumber(value) !== null);

  return previousValues.length
    ? previousValues.reduce((total, value) => total + value, 0) / previousValues.length
    : null;
}

export function getProfileMomentumEntry(row = {}, periodRows = [], metricKey = "visits") {
  const growthKey = metricKey === "revenue" ? "revenue_yoy_growth" : "visits_yoy_growth";
  const breakdown = getGrowthBreakdown(row, growthKey);
  if (!breakdown) return null;
  const marketGrowth = getMarketGrowthForMetric(periodRows, metricKey);
  const averagePreviousValue = getAveragePreviousValueForMetric(periodRows, metricKey);

  return {
    metricKey,
    label: metricKey === "revenue" ? "Revenue" : "Visits",
    ...breakdown,
    absoluteDelta: breakdown.currentValue - breakdown.previousValue,
    marketDelta:
      marketGrowth !== null && breakdown.growthValue !== null
        ? breakdown.growthValue - marketGrowth
        : null,
    isLowBase: isLowBaseMomentum(breakdown.previousValue, averagePreviousValue),
  };
}
