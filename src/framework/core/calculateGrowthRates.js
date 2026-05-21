import { getSortValue, getYearMonth, groupRows, roundMetric, safeNumber, shouldWriteDerived } from "./benchmarkUtils.js";

function getCompanyMetricKey(row) {
  return [row.company_id || "", row.market || "", row.period_type || "", row.is_forecast ? row.forecast_scenario || "" : ""].join("||");
}

function findPriorRow(rows, index, monthsBack) {
  const current = rows[index];
  const currentPeriod = getYearMonth(current);
  if (!currentPeriod.year || !currentPeriod.month) return null;

  const targetDate = new Date(Date.UTC(currentPeriod.year, currentPeriod.month - 1 - monthsBack, 1));
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth() + 1;

  return (
    rows.find((row, rowIndex) => {
      if (rowIndex >= index) return false;
      const period = getYearMonth(row);
      return period.year === targetYear && period.month === targetMonth;
    }) ?? null
  );
}

function calculateGrowth(currentValue, priorValue) {
  if (currentValue === null || priorValue === null || priorValue === 0) return null;
  return roundMetric((currentValue - priorValue) / priorValue);
}

export function calculateGrowthRates(rows = [], options = {}) {
  const preserveExisting = options.preserveExisting ?? true;
  const metrics = options.metrics ?? ["revenue", "visits"];
  const nextRows = rows.map((row) => ({ ...row }));
  const groups = groupRows(nextRows, getCompanyMetricKey);

  groups.forEach((companyRows) => {
    const sortedRows = companyRows.slice().sort((a, b) => getSortValue(a) - getSortValue(b));

    sortedRows.forEach((row, index) => {
      const priorMonth = findPriorRow(sortedRows, index, 1);
      const priorYear = findPriorRow(sortedRows, index, 12);

      metrics.forEach((metric) => {
        const currentValue = safeNumber(row?.[metric]);
        const momField = `${metric}_mom_growth`;
        const yoyField = `${metric}_yoy_growth`;

        if (shouldWriteDerived(row, momField, preserveExisting)) {
          row[momField] = calculateGrowth(currentValue, safeNumber(priorMonth?.[metric]));
        }

        if (shouldWriteDerived(row, yoyField, preserveExisting)) {
          row[yoyField] = calculateGrowth(currentValue, safeNumber(priorYear?.[metric]));
        }
      });
    });
  });

  return nextRows;
}
