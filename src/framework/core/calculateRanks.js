import { getPeriodKey, groupRows, isBenchmarkRow, safeNumber, shouldWriteDerived } from "./benchmarkUtils.js";

export function calculateRanks(rows = [], metric = "revenue", options = {}) {
  const rankField = options.rankField || `rank_${metric.replace(/^market_share_/, "share_")}`;
  const preserveExisting = options.preserveExisting ?? true;
  const includeBenchmark = options.includeBenchmark ?? false;
  const direction = options.direction || "desc";
  const nextRows = rows.map((row) => ({ ...row }));
  const groups = groupRows(nextRows, getPeriodKey);

  groups.forEach((groupRowsForPeriod) => {
    const rankedRows = groupRowsForPeriod
      .filter((row) => includeBenchmark || !isBenchmarkRow(row))
      .filter((row) => safeNumber(row?.[metric]) !== null)
      .sort((a, b) => {
        const diff = (safeNumber(a?.[metric]) ?? 0) - (safeNumber(b?.[metric]) ?? 0);
        return direction === "asc" ? diff : -diff;
      });

    rankedRows.forEach((row, index) => {
      if (shouldWriteDerived(row, rankField, preserveExisting)) row[rankField] = index + 1;
    });
  });

  return nextRows;
}
