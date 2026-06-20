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
