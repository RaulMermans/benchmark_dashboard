import {
  safeNumber,
  formatPercent,
  formatPp,
  formatPercentagePoints,
  formatMetric,
  formatNumber,
  formatCurrency,
  formatCurrencyDecimal,
  formatCompact,
  formatSignedPercent,
} from "../../lib/formatters.js";
import { benchmarkConfig } from "../../config/benchmarkConfig.js";
import { BATTLE_METRICS } from "../../config/metricRegistry.js";
import { isRealCompanyRow } from "../../lib/data.js";

const BATTLE_TECHNICAL_DRAW_THRESHOLD = benchmarkConfig.thresholds.battleTechnicalDraw;
const OWN_COMPANY_ID = benchmarkConfig.identity.focusEntityId;
const MARKET_BENCHMARK_ID = benchmarkConfig.identity.benchmarkEntityId;

// --- Private helpers ---

function normalizeCompanyId(companyId) {
  return String(companyId ?? "")
    .trim()
    .toLowerCase();
}

function sameCompany(a, b) {
  return normalizeCompanyId(a) === normalizeCompanyId(b);
}

export function getCompanyLabel(rowOrCompany) {
  return (
    rowOrCompany?.label ||
    rowOrCompany?.display_name ||
    rowOrCompany?.company_name ||
    rowOrCompany?.company_id ||
    "N/A"
  );
}

function normalizeTimeMode(timeMode = "") {
  return timeMode === "ytd" ? "historical" : timeMode || "month";
}

// --- Position / delta formatters ---

export function formatPositionDelta(value) {
  const number = safeNumber(value);
  if (number === null) return "N/A";
  if (Math.abs(number) < 0.000001) return "sin cambio";
  const rounded = Math.round(number);
  const sign = rounded > 0 ? "+" : "-";
  const unit = Math.abs(rounded) === 1 ? "posición" : "posiciones";
  return `${sign}${formatNumber(Math.abs(rounded), { maximumFractionDigits: 0 })} ${unit}`;
}

export function getBattleDeltaLabel(metric, focusValue, targetValue, focusLabel = "Player", targetLabel = "rival") {
  const focusNumber = safeNumber(focusValue);
  const targetNumber = safeNumber(targetValue);
  if (focusNumber === null || targetNumber === null) return "Sin dato comparable";

  const delta = focusNumber - targetNumber;
  if (Math.abs(delta) < 0.000001) return `${focusLabel} y ${targetLabel} empatan en esta métrica`;

  const baseWins = delta > 0;
  const winnerLabel = baseWins ? focusLabel : targetLabel;
  const loserLabel = baseWins ? targetLabel : focusLabel;
  const loserValue = baseWins ? targetNumber : focusNumber;
  const absoluteDelta = Math.abs(delta);

  if (metric.deltaType === "sharePoints") {
    return `${winnerLabel} aventaja a ${loserLabel} en ${formatPp(absoluteDelta, { signed: false })}`;
  }

  if (metric.deltaType === "points") {
    return `${winnerLabel} aventaja a ${loserLabel} en ${formatPercentagePoints(absoluteDelta, { signed: false })}`;
  }

  if (loserValue !== 0) {
    return `${winnerLabel} tiene un ${formatPercent(absoluteDelta / Math.abs(loserValue))} más que ${loserLabel}`;
  }

  return `${winnerLabel} supera a ${loserLabel} en ${formatMetric(absoluteDelta, metric.key)}`;
}

export function getBattleWinner(metric, focusRow, targetRow, focusLabel = "Focus Brand") {
  const focusValue = safeNumber(focusRow?.[metric.key]);
  const targetValue = safeNumber(targetRow?.[metric.key]);
  if (focusValue === null || targetValue === null) return "N/A";
  if (Math.abs(focusValue - targetValue) < 0.000001) return "Empate";
  return focusValue > targetValue ? focusLabel : getCompanyLabel(targetRow);
}

// --- Battle value formatters ---

export function formatBattleCurrency(value) {
  const number = safeNumber(value);
  if (number === null) return "N/A";
  if (Math.abs(number) >= 1000000) {
    return `${formatNumber(number / 1000000, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M€`;
  }
  return formatCurrency(number);
}

export function formatBattlePoints(value, { signed = true } = {}) {
  const number = safeNumber(value);
  if (number === null) return "N/A";
  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  const sign = signed && normalized > 0 ? "+" : "";
  const displayValue = signed ? normalized : Math.abs(normalized);
  return `${sign}${formatNumber(displayValue, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} puntos`;
}

export function formatBattleMetricValue(value, metricKey = "") {
  if (metricKey === "revenue") return formatBattleCurrency(value);
  if (metricKey === "visits") return formatCompact(value);
  if (metricKey === "revenue_per_visit") return formatCurrencyDecimal(value);
  if (metricKey === "monetization_gap") return formatBattlePoints(value);
  if (metricKey === "rank_projected" || metricKey.startsWith("rank_")) {
    const number = safeNumber(value);
    return number === null ? "N/A" : `#${formatNumber(number, { maximumFractionDigits: 0 })}`;
  }
  if (metricKey.includes("market_share")) return formatPercent(value);
  if (metricKey.includes("growth") || metricKey === "delta") return formatSignedPercent(value);
  return formatMetric(value, metricKey);
}

export function formatBattleGapValue(metric = {}, gapValue) {
  const value = Math.abs(safeNumber(gapValue) ?? 0);
  if (metric.deltaType === "sharePoints") return formatPp(value, { signed: false });
  if (metric.deltaType === "percentagePoints") return formatPercentagePoints(value, { signed: false });
  if (metric.deltaType === "points") return formatBattlePoints(value, { signed: false });
  if (metric.key === "revenue") return formatBattleCurrency(value);
  if (metric.key === "revenue_per_visit") return formatCurrencyDecimal(value);
  if (metric.key === "rank_projected") {
    return formatPositionDelta(value).replace(/^\+/, "");
  }
  return formatMetric(value, metric.key);
}

export function getBattleUnavailableMessage(metricKey = "", mode = "historical") {
  if (mode === "forecast") {
    if (metricKey === "revenue") return "No hay forecast de facturación para este escenario.";
    return "No hay forecast suficiente para este escenario.";
  }
  if (metricKey === "revenue") return "No hay facturación disponible para este periodo.";
  if (metricKey === "visits") return "No hay visitas disponibles para este periodo.";
  if (metricKey === "monetization_gap") {
    return "No hay datos suficientes para calcular brecha de monetización.";
  }
  return "No disponible para este periodo.";
}

// --- Player option helpers ---

export function getBattleOptionLabel(option = {}) {
  return option.label || option.display_name || option.company_name || option.id || "Empresa";
}

export function getBattlePlayerOptions(companies = [], rows = []) {
  const optionMap = new Map();

  companies.forEach((company) => {
    const id = normalizeCompanyId(company.id);
    if (!id || id === MARKET_BENCHMARK_ID) return;
    optionMap.set(id, {
      id: company.id,
      label: company.label,
      company_color: company.company_color,
    });
  });

  rows.filter(isRealCompanyRow).forEach((row) => {
    const id = normalizeCompanyId(row.company_id);
    if (!id || id === MARKET_BENCHMARK_ID || optionMap.has(id)) return;
    optionMap.set(id, {
      id: row.company_id,
      label: getCompanyLabel(row),
      company_color: row.company_color,
    });
  });

  return Array.from(optionMap.values()).sort((a, b) =>
    getBattleOptionLabel(a).localeCompare(getBattleOptionLabel(b)),
  );
}

export function getPreferredBattlePlayer(options = [], preferredId = "", excludedId = "") {
  const preferred = options.find(
    (option) => sameCompany(option.id, preferredId) && !sameCompany(option.id, excludedId),
  );
  if (preferred) return preferred.id;
  return options.find((option) => !sameCompany(option.id, excludedId))?.id || "";
}

export function getProfileBattleOptions(rows = [], companies = []) {
  const optionMap = new Map();

  companies.forEach((company) => {
    const id = normalizeCompanyId(company.id);
    if (!id) return;

    optionMap.set(id, {
      id: company.id,
      label: company.label,
      company_color: company.company_color,
    });
  });

  rows.filter(isRealCompanyRow).forEach((row) => {
    const id = normalizeCompanyId(row?.company_id);
    if (!id) return;

    const current = optionMap.get(id) ?? {};
    optionMap.set(id, {
      id: current.id || row.company_id,
      label: current.label || getCompanyLabel(row),
      company_color: current.company_color || row.company_color,
    });
  });

  return Array.from(optionMap.values()).sort((a, b) =>
    getBattleOptionLabel(a).localeCompare(getBattleOptionLabel(b)),
  );
}

export function getDefaultProfileBattleTarget(options = [], baseCompanyId = "") {
  const preferredTargetIds = sameCompany(baseCompanyId, OWN_COMPANY_ID)
    ? ["peer_a", "peer_b", MARKET_BENCHMARK_ID]
    : [OWN_COMPANY_ID, "peer_a", "peer_b", MARKET_BENCHMARK_ID];

  return (
    preferredTargetIds.find((targetId) =>
      options.some(
        (option) => sameCompany(option.id, targetId) && !sameCompany(option.id, baseCompanyId),
      ),
    ) ||
    options.find((option) => !sameCompany(option.id, baseCompanyId))?.id ||
    ""
  );
}

export function getBattleMetricOptions(baseRow, targetRow) {
  return BATTLE_METRICS.map((metric) => {
    const baseValue = safeNumber(baseRow?.[metric.key]);
    const targetValue = safeNumber(targetRow?.[metric.key]);
    const disabled = baseValue === null || targetValue === null;

    return {
      ...metric,
      disabled,
      reason: disabled ? "sin dato comparable" : "",
    };
  });
}

export function getBattleShare(baseValue, targetValue) {
  const baseNumber = safeNumber(baseValue);
  const targetNumber = safeNumber(targetValue);
  if (baseNumber === null || targetNumber === null) return 50;

  const total = Math.abs(baseNumber) + Math.abs(targetNumber);
  if (!total) return 50;

  return Math.max(8, Math.min(92, (Math.abs(baseNumber) / total) * 100));
}

// --- Core battle round logic ---

export function getBattleRelativeDiff(aValue, bValue) {
  const aNumber = safeNumber(aValue);
  const bNumber = safeNumber(bValue);
  if (aNumber === null || bNumber === null) return null;
  const denominator = Math.max(Math.abs(aNumber), Math.abs(bNumber));
  return denominator === 0 ? 0 : Math.abs(aNumber - bNumber) / denominator;
}

export function getBattleStrengthShare(aValue, bValue, lowerIsBetter = false) {
  let aNumber = safeNumber(aValue);
  let bNumber = safeNumber(bValue);
  if (aNumber === null || bNumber === null) return 50;

  if (lowerIsBetter) {
    aNumber = aNumber > 0 ? 1 / aNumber : 0;
    bNumber = bNumber > 0 ? 1 / bNumber : 0;
  } else {
    const minimum = Math.min(aNumber, bNumber);
    if (minimum < 0) {
      const spread = Math.abs(aNumber - bNumber);
      const offset = Math.abs(minimum) + Math.max(spread * 0.08, 0.000001);
      aNumber += offset;
      bNumber += offset;
    }
  }

  aNumber = Math.max(0, aNumber);
  bNumber = Math.max(0, bNumber);
  const total = aNumber + bNumber;
  if (!total) return 50;
  return Math.max(6, Math.min(94, (aNumber / total) * 100));
}

export function buildBattleRound({
  key,
  label,
  metricKey = key,
  aValue,
  bValue,
  aLabel,
  bLabel,
  aColor,
  bColor,
  deltaType,
  lowerIsBetter = false,
  mode = "historical",
  formatter,
}) {
  const aNumber = safeNumber(aValue);
  const bNumber = safeNumber(bValue);
  const hasBoth = aNumber !== null && bNumber !== null;

  if (!hasBoth) {
    return {
      key,
      label,
      metricKey,
      available: false,
      message: getBattleUnavailableMessage(metricKey, mode),
    };
  }

  const relativeDiff = getBattleRelativeDiff(aNumber, bNumber);
  const technicalDraw = lowerIsBetter
    ? aNumber === bNumber
    : relativeDiff !== null && relativeDiff < BATTLE_TECHNICAL_DRAW_THRESHOLD;
  const aWins = !technicalDraw && (lowerIsBetter ? aNumber < bNumber : aNumber > bNumber);
  const winnerLabel = technicalDraw ? "Empate técnico" : aWins ? aLabel : bLabel;
  const gapValue = Math.abs(aNumber - bNumber);
  const metric = { key: metricKey, deltaType };
  const valueFormatter = formatter || ((value) => formatBattleMetricValue(value, metricKey));
  const roundDetail = technicalDraw
    ? "Empate técnico: diferencia inferior al 2%."
    : metricKey === "monetization_gap"
      ? "Gana quien monetiza mejor su peso de tráfico. Si ambos están en negativo, más cerca de 0 indica menor infra-monetización."
      : `${winnerLabel} tiene ventaja de ${formatBattleGapValue(metric, gapValue)}.`;

  return {
    key,
    label,
    metricKey,
    available: true,
    aValue,
    bValue,
    aValueLabel: valueFormatter(aNumber),
    bValueLabel: valueFormatter(bNumber),
    winner: technicalDraw ? "draw" : aWins ? "a" : "b",
    winnerLabel,
    gapLabel: technicalDraw ? "Empate técnico" : `+${formatBattleGapValue(metric, gapValue)}`,
    detail: roundDetail,
    share: getBattleStrengthShare(aNumber, bNumber, lowerIsBetter),
    aColor,
    bColor,
  };
}

export function buildHistoricalBattleRounds(aRow, bRow, aLabel, bLabel) {
  return BATTLE_METRICS.map((metric) =>
    buildBattleRound({
      key: metric.key,
      label: metric.label,
      metricKey: metric.key,
      aValue: aRow?.[metric.key],
      bValue: bRow?.[metric.key],
      aLabel,
      bLabel,
      aColor: aRow?.company_color,
      bColor: bRow?.company_color,
      deltaType: metric.deltaType,
      mode: "historical",
      formatter: (value) => formatBattleMetricValue(value, metric.key),
    }),
  );
}

export function getBattleScore(rounds = []) {
  return rounds.reduce(
    (score, round) => {
      if (!round.available) return score;
      if (round.winner === "draw") {
        score.draw += 1;
        return score;
      }
      if (round.winner === "a") score.a += 1;
      if (round.winner === "b") score.b += 1;
      return score;
    },
    { a: 0, b: 0, draw: 0 },
  );
}

export function getRoundWinner(rounds = [], key = "") {
  return rounds.find((round) => round.key === key && round.available) ?? null;
}

export function buildHistoricalBattleInsight(rounds = [], aLabel = "Player A", bLabel = "Player B") {
  const revenue = getRoundWinner(rounds, "revenue");
  const visits = getRoundWinner(rounds, "visits");
  const revenueShare = getRoundWinner(rounds, "market_share_revenue");
  const visitShare = getRoundWinner(rounds, "market_share_visits");
  const visitGrowth = getRoundWinner(rounds, "visits_yoy_growth");
  const efficiency = getRoundWinner(rounds, "revenue_per_visit");
  const gap = getRoundWinner(rounds, "monetization_gap");
  const winnerMap = new Map();
  [revenue, revenueShare, efficiency, gap].forEach((round) => {
    if (!round?.winner || round.winner === "draw") return;
    const metrics = winnerMap.get(round.winnerLabel) || [];
    metrics.push(round.key);
    winnerMap.set(round.winnerLabel, metrics);
  });
  const dominant = Array.from(winnerMap.entries()).sort((a, b) => b[1].length - a[1].length)[0];
  const trafficDraw = rounds.some((round) =>
    ["visits", "market_share_visits"].includes(round.key) && round.winner === "draw",
  );

  if (dominant || trafficDraw || visitGrowth?.winner) {
    const dominantLabel = dominant?.[0];
    const dominantCopy = dominantLabel
      ? `${dominantLabel} domina en ${[
          revenue?.winnerLabel === dominantLabel ? "facturación" : "",
          revenueShare?.winnerLabel === dominantLabel ? "cuota de facturación" : "",
          efficiency?.winnerLabel === dominantLabel ? "eficiencia por visita" : "",
          gap?.winnerLabel === dominantLabel ? "monetización relativa" : "",
        ].filter(Boolean).join(", ")}.`
      : "";
    const trafficCopy = trafficDraw
      ? `${aLabel} y ${bLabel} mantienen empate técnico en tráfico.`
      : "";
    const growthCopy =
      visitGrowth?.winner && visitGrowth.winner !== "draw"
        ? `${visitGrowth.winnerLabel} gana en crecimiento de visitas.`
        : "";

    return [dominantCopy, trafficCopy, growthCopy].filter(Boolean).join(" ");
  }
  const parts = [];

  if (revenue?.winner && revenue.winner !== "draw") {
    parts.push(`${revenue.winnerLabel} gana por facturación`);
  }

  if (revenueShare?.winner && revenueShare.winner !== "draw") {
    parts.push(`cuota de facturación`);
  }

  if (visits?.winner === "draw" || visitShare?.winner === "draw") {
    parts.push(`${aLabel} y ${bLabel} están prácticamente empatados en tráfico`);
  } else if (visits?.winner && visits.winner !== "draw") {
    parts.push(`${visits.winnerLabel} mantiene ventaja en tráfico`);
  }

  if (visitGrowth?.winner && visitGrowth.winner !== "draw") {
    parts.push(`${visitGrowth.winnerLabel} gana en crecimiento de visitas`);
  }

  if (efficiency?.winner && efficiency.winner !== "draw") {
    const sameMonetizationWinner = gap?.winner === efficiency.winner;
    parts.push(
      sameMonetizationWinner
        ? `${efficiency.winnerLabel} muestra mayor eficiencia por visita y mejor monetización relativa`
        : `${efficiency.winnerLabel} supera en eficiencia por visita`,
    );
  }

  if (!parts.length) {
    return `La comparativa entre ${aLabel} y ${bLabel} no tiene suficientes datos para una lectura ejecutiva robusta.`;
  }

  return `${parts.slice(0, 3).join(", ")}.`;
}

// --- Hero KPI helpers ---

export function getBattleHeroGrowthDefinitions(timeMode = "") {
  const normalizedTimeMode = normalizeTimeMode(timeMode);
  if (normalizedTimeMode === "annual") {
    return [
      { key: "visits_yoy_growth", label: "Crecimiento visitas YoY", requiresRevenue: false },
      { key: "revenue_yoy_growth", label: "Crecimiento facturación YoY", requiresRevenue: true },
    ];
  }
  if (normalizedTimeMode === "month") {
    return [
      { key: "visits_mom_growth", label: "Crecimiento visitas MoM", requiresRevenue: false },
      { key: "revenue_mom_growth", label: "Crecimiento facturación MoM", requiresRevenue: true },
    ];
  }
  return [];
}

export function getBattleHeroKpiDefinitions({ timeMode = "", includeRevenue = false } = {}) {
  return [
    { key: "visits", label: "Visitas", requiresRevenue: false },
    { key: "revenue", label: "Facturación", requiresRevenue: true },
    ...getBattleHeroGrowthDefinitions(timeMode),
  ].filter((definition) => !definition.requiresRevenue || includeRevenue);
}

export function getHeroKpisForPlayer(row, definitions = []) {
  return definitions
    .map((definition) => {
      const value = safeNumber(row?.[definition.key]);
      if (value === null) return null;
      return {
        key: definition.key,
        label: definition.label,
        value: formatBattleMetricValue(value, definition.key),
      };
    })
    .filter(Boolean);
}
