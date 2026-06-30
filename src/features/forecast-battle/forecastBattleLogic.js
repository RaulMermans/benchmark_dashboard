import { benchmarkConfig } from "../../config/benchmarkConfig.js";
import { getForecastScenarioLabel } from "../../viewModels/forecastViewModel.js";
import { isComparableRow, isForecastRow } from "../../lib/data.js";
import {
  formatMetric,
  formatPercent,
  safeNumber,
} from "../../lib/formatters.js";
import {
  buildBattleRound,
  formatBattleCurrency,
  formatBattleMetricValue,
  getBattleRelativeDiff,
  getCompanyLabel,
  getRoundWinner,
} from "../battle/battleLogic.js";

const BATTLE_TECHNICAL_DRAW_THRESHOLD = benchmarkConfig.thresholds.battleTechnicalDraw;

function normalizeCompanyId(companyId) {
  return String(companyId ?? "")
    .trim()
    .toLowerCase();
}

function sameCompany(a, b) {
  return normalizeCompanyId(a) === normalizeCompanyId(b);
}

function hasMetricValue(row, metricKey) {
  return safeNumber(row?.[metricKey]) !== null;
}

function formatSignedMetricDelta(value, metricKey = "visits") {
  const number = safeNumber(value);
  if (number === null) return "N/A";
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  if (metricKey === "revenue") return `${sign}${formatBattleCurrency(Math.abs(number))}`;
  return `${sign}${formatMetric(Math.abs(number), metricKey)}`;
}

function getFilteredForecastRowsAfterObserved({
  forecastRows = [],
  observedRows = [],
  companyId = "",
  metricKey = "",
  getLatestCompanyMetricRow,
  getProfileRowSortValue,
}) {
  const lastObserved = getLatestCompanyMetricRow(observedRows, companyId, metricKey);
  const lastObservedSort = lastObserved ? getProfileRowSortValue(lastObserved) : -Infinity;

  return forecastRows
    .filter((row) => sameCompany(row.company_id, companyId))
    .filter((row) => hasMetricValue(row, metricKey))
    .filter((row) => getProfileRowSortValue(row) > lastObservedSort);
}

function getForecastBattleMetricPair({
  scenarioRows = [],
  observedRows = [],
  playerAId = "",
  playerBId = "",
  metricKey = "visits",
  getForecastPeriodKey,
  getLatestCompanyMetricRow,
  getProfileRowLabel,
  getProfileRowSortValue,
}) {
  const sharedOptions = {
    forecastRows: scenarioRows,
    observedRows,
    metricKey,
    getLatestCompanyMetricRow,
    getProfileRowSortValue,
  };
  const aRows = getFilteredForecastRowsAfterObserved({ ...sharedOptions, companyId: playerAId });
  const bRows = getFilteredForecastRowsAfterObserved({ ...sharedOptions, companyId: playerBId });
  const aByPeriod = new Map(aRows.map((row) => [getForecastPeriodKey(row), row]));

  for (const bRow of bRows.slice().reverse()) {
    const aRow = aByPeriod.get(getForecastPeriodKey(bRow));
    if (aRow) return { aRow, bRow, periodLabel: getProfileRowLabel(bRow) };
  }

  const aRow = aRows.at(-1) ?? null;
  const bRow = bRows.at(-1) ?? null;
  return {
    aRow,
    bRow,
    periodLabel: getProfileRowLabel(aRow || bRow, ""),
  };
}

function getForecastShareMetric(metricKey = "") {
  return metricKey === "revenue" ? "market_share_revenue" : "market_share_visits";
}

function sameForecastPeriod(a = {}, b = {}, getForecastPeriodKey) {
  return getForecastPeriodKey(a) === getForecastPeriodKey(b);
}

function sumForecastMetric(rows = [], metricKey = "") {
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

function getProjectedRankingRows(rows = [], metricKey = "", finalRow = null, getForecastPeriodKey) {
  if (!finalRow) return [];

  return rows
    .filter((row) => sameForecastPeriod(row, finalRow, getForecastPeriodKey))
    .filter((row) => isForecastRow(row) && isComparableRow(row, { includeForecasts: true, includeBenchmark: false }))
    .filter((row) => hasMetricValue(row, metricKey))
    .slice()
    .sort((a, b) => {
      const bValue = safeNumber(b?.[metricKey]) ?? -Infinity;
      const aValue = safeNumber(a?.[metricKey]) ?? -Infinity;
      return bValue === aValue
        ? getCompanyLabel(a).localeCompare(getCompanyLabel(b))
        : bValue - aValue;
    });
}

function getProjectedRank(rows = [], selectedCompanyId = "") {
  const index = rows.findIndex((row) => sameCompany(row.company_id, selectedCompanyId));
  return index >= 0 ? index + 1 : null;
}

function getForecastProjectedShare(finalRow = null, scenarioRows = [], metricKey = "", getForecastPeriodKey) {
  const shareMetric = getForecastShareMetric(metricKey);
  const explicitShare = safeNumber(finalRow?.[shareMetric]);
  if (explicitShare !== null) return { value: explicitShare, detail: "Forecast share" };

  const playerValue = safeNumber(finalRow?.[metricKey]);
  const total = sumForecastMetric(
    scenarioRows
      .filter((row) => finalRow && sameForecastPeriod(row, finalRow, getForecastPeriodKey))
      .filter((row) => isComparableRow(row, { includeForecasts: true, includeBenchmark: false })),
    metricKey,
  );

  if (playerValue === null || !total) return null;
  return { value: playerValue / total, detail: "Calculated forecast share" };
}

export function buildForecastBattle({
  scenarioRows = [],
  observedRows = [],
  playerAId = "",
  playerBId = "",
  metricKey = "visits",
  aLabel = "Player A",
  bLabel = "Player B",
  getForecastPeriodKey,
  getLatestCompanyMetricRow,
  getProfileRowLabel,
  getProfileRowSortValue,
}) {
  const pairDependencies = {
    scenarioRows,
    observedRows,
    playerAId,
    playerBId,
    getForecastPeriodKey,
    getLatestCompanyMetricRow,
    getProfileRowLabel,
    getProfileRowSortValue,
  };
  const visitsPair = getForecastBattleMetricPair({ ...pairDependencies, metricKey: "visits" });
  const revenuePair = getForecastBattleMetricPair({ ...pairDependencies, metricKey: "revenue" });
  const primaryPair = metricKey === "revenue" ? revenuePair : visitsPair;
  const aPrimary = safeNumber(primaryPair.aRow?.[metricKey]);
  const bPrimary = safeNumber(primaryPair.bRow?.[metricKey]);
  const aObserved = safeNumber(getLatestCompanyMetricRow(observedRows, playerAId, metricKey)?.[metricKey]);
  const bObserved = safeNumber(getLatestCompanyMetricRow(observedRows, playerBId, metricKey)?.[metricKey]);
  const aDelta = aPrimary !== null && aObserved !== null ? aPrimary - aObserved : null;
  const bDelta = bPrimary !== null && bObserved !== null ? bPrimary - bObserved : null;
  const rankingReferenceRow = primaryPair.aRow || primaryPair.bRow;
  const rankingRows = getProjectedRankingRows(
    scenarioRows,
    metricKey,
    rankingReferenceRow,
    getForecastPeriodKey,
  );
  const aRank = getProjectedRank(rankingRows, playerAId);
  const bRank = getProjectedRank(rankingRows, playerBId);
  const shareMetric = getForecastShareMetric(metricKey);
  const aShare =
    getForecastProjectedShare(primaryPair.aRow, scenarioRows, metricKey, getForecastPeriodKey)?.value ?? null;
  const bShare =
    getForecastProjectedShare(primaryPair.bRow, scenarioRows, metricKey, getForecastPeriodKey)?.value ?? null;
  const rounds = [
    buildBattleRound({
      key: "forecast_visits",
      label: "Final forecast visits",
      metricKey: "visits",
      aValue: visitsPair.aRow?.visits,
      bValue: visitsPair.bRow?.visits,
      aLabel,
      bLabel,
      mode: "forecast",
      formatter: (value) => formatBattleMetricValue(value, "visits"),
    }),
    buildBattleRound({
      key: "forecast_revenue",
      label: "Final forecast revenue",
      metricKey: "revenue",
      aValue: revenuePair.aRow?.revenue,
      bValue: revenuePair.bRow?.revenue,
      aLabel,
      bLabel,
      mode: "forecast",
      formatter: (value) => formatBattleMetricValue(value, "revenue"),
    }),
    buildBattleRound({
      key: "forecast_delta",
      label: `Delta vs last observed (${metricKey === "revenue" ? "revenue" : "visits"})`,
      metricKey,
      aValue: aDelta,
      bValue: bDelta,
      aLabel,
      bLabel,
      mode: "forecast",
      formatter: (value) => formatSignedMetricDelta(value, metricKey),
    }),
    buildBattleRound({
      key: "rank_projected",
      label: "Projected ranking",
      metricKey: "rank_projected",
      aValue: aRank,
      bValue: bRank,
      aLabel,
      bLabel,
      mode: "forecast",
      lowerIsBetter: true,
      formatter: (value) => formatBattleMetricValue(value, "rank_projected"),
    }),
    buildBattleRound({
      key: "projected_share",
      label: "Projected share",
      metricKey: shareMetric,
      aValue: aShare,
      bValue: bShare,
      aLabel,
      bLabel,
      mode: "forecast",
      deltaType: "sharePoints",
      formatter: (value) => formatPercent(value),
    }),
  ];
  const projectedGap =
    aPrimary !== null && bPrimary !== null
      ? {
          value: Math.abs(aPrimary - bPrimary),
          winnerLabel:
            getBattleRelativeDiff(aPrimary, bPrimary) < BATTLE_TECHNICAL_DRAW_THRESHOLD
              ? "Technical draw"
              : aPrimary > bPrimary
                ? aLabel
                : bLabel,
          metricKey,
          periodLabel: primaryPair.periodLabel,
        }
      : null;

  return {
    rounds,
    projectedGap,
    periodLabel: primaryPair.periodLabel || visitsPair.periodLabel || revenuePair.periodLabel,
    rankingRows,
    primaryPair,
  };
}

export function buildForecastBattleInsight({
  scenario,
  metricKey,
  projectedGap,
  rounds = [],
  aLabel = "Player A",
  bLabel = "Player B",
}) {
  const scenarioLabel = getForecastScenarioLabel(scenario).toLowerCase();
  const metricLabel = metricKey === "revenue" ? "revenue" : "visits";
  const finalRound = getRoundWinner(rounds, metricKey === "revenue" ? "forecast_revenue" : "forecast_visits");
  const rankRound = getRoundWinner(rounds, "rank_projected");

  if (finalRound?.winner && finalRound.winner !== "draw") {
    return `In the ${scenarioLabel} scenario, ${finalRound.winnerLabel} would widen the projected ${metricLabel} lead against ${finalRound.winner === "a" ? bLabel : aLabel}.`;
  }

  if (rankRound?.winner && rankRound.winner !== "draw") {
    return `In the ${scenarioLabel} scenario, ${rankRound.winnerLabel} would have the stronger projected ranking, with ${metricLabel} still close.`;
  }

  if (projectedGap) {
    return `In the ${scenarioLabel} scenario, the projected ${metricLabel} gap is ${formatBattleMetricValue(projectedGap.value, metricKey)}.`;
  }

  return "There is not enough forecast data to build an executive read without mixing scenarios.";
}
