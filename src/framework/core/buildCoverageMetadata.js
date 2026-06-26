import { isBenchmarkRow, isForecastRow } from "./helpers.js";

function getMonthKey(row) {
  return String(row.date || "").slice(0, 7);
}

function allMonthsBetween(minKey, maxKey) {
  const months = [];
  let [year, month] = minKey.split("-").map(Number);
  const [endYear, endMonth] = maxKey.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

export function buildCoverageMetadata(rows = []) {
  const actualRows = rows.filter((r) => !isForecastRow(r) && !isBenchmarkRow(r));
  if (!actualRows.length) {
    return {
      min_date: null,
      max_date: null,
      month_count: 0,
      company_count: 0,
      market_count: 0,
      has_missing_months: false,
      missing_months: [],
    };
  }

  const monthKeys = [...new Set(actualRows.map(getMonthKey).filter(Boolean))].sort();
  const companies = [...new Set(actualRows.map((r) => r.company_id).filter(Boolean))];
  const markets = [...new Set(actualRows.map((r) => r.market).filter(Boolean))];

  const minKey = monthKeys[0];
  const maxKey = monthKeys.at(-1);

  // Build set of all present month+company combinations
  const present = new Set(
    actualRows.map((r) => `${getMonthKey(r)}|${r.company_id}`).filter((k) => k.includes("|")),
  );

  // Find missing combinations: expected = all months × all companies
  const expectedMonths = allMonthsBetween(minKey, maxKey);
  const missing_months = [];
  for (const mk of expectedMonths) {
    for (const cid of companies) {
      if (!present.has(`${mk}|${cid}`)) {
        missing_months.push({ month: `${mk}-01`, company_id: cid });
      }
    }
  }

  return {
    min_date: `${minKey}-01`,
    max_date: `${maxKey}-01`,
    month_count: monthKeys.length,
    company_count: companies.length,
    market_count: markets.length,
    has_missing_months: missing_months.length > 0,
    missing_months,
  };
}
