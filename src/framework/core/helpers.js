export function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeDate(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})-(\d{1,2})/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-01`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-01`;
}

export function isBenchmarkRow(row = {}, config = {}) {
  const benchmarkId = config.benchmarkCompanyId || "market_average";
  const id = String(row.company_id || "").toLowerCase();
  const type = String(row.type || "").toLowerCase();
  return id === benchmarkId || id === "market_average" || type === "benchmark" || type === "market_average";
}

export function isForecastRow(row = {}) {
  const dataType = String(row.data_type || "").toLowerCase();
  const type = String(row.type || "").toLowerCase();
  return dataType.includes("forecast") || type.includes("forecast") || Boolean(row.forecast_scenario);
}

export function groupBy(rows, getKey) {
  return rows.reduce((groups, row) => {
    const key = getKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
    return groups;
  }, new Map());
}
