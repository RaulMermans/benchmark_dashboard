export {
  buildExecutiveSummaryViewModel,
  buildRankingViewModel,
  buildMarketShareViewModel,
  buildGrowthViewModel,
} from "../framework/index.js";

export function getDashboardPeriodTypes(sourcePeriodTypes = [], orderedPeriods = []) {
  const periodTypeSet = new Set(sourcePeriodTypes);
  return Array.from(periodTypeSet).sort((a, b) => {
    const aIndex = orderedPeriods.indexOf(a);
    const bIndex = orderedPeriods.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }
    return a.localeCompare(b);
  });
}

export function getSourcePeriodType(periodType, sourcePeriodTypes = []) {
  if (sourcePeriodTypes.includes(periodType)) return periodType;
  return sourcePeriodTypes[0] || "";
}

const DATA_SOURCE_LABELS = {
  "local-snapshot": "Sample data",
  "live-api": "Live API",
  "snapshot-fallback": "Snapshot fallback",
};

export function getDataSourceStatus(dataSourceMetadata = {}) {
  const type = DATA_SOURCE_LABELS[dataSourceMetadata?.type]
    ? dataSourceMetadata.type
    : "local-snapshot";

  return {
    type,
    label: dataSourceMetadata?.label || DATA_SOURCE_LABELS[type],
  };
}
