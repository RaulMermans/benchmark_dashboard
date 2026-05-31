function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{1,2})/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-01`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-01`;
}

const REQUIRED_ROW_FIELDS = [
  "date",
  "period_type",
  "company_id",
  "display_name",
  "type",
  "market",
  "revenue",
  "visits",
  "data_type",
];

export function validateBenchmarkPayload(payload = {}) {
  const errors = [];
  const warnings = [];

  if (payload?.ok !== true) errors.push("Payload must include ok: true.");
  if (!payload?.data || typeof payload.data !== "object") errors.push("Payload must include a data object.");

  const rows = Array.isArray(payload?.data?.interface) ? payload.data.interface : [];
  const events = Array.isArray(payload?.data?.events) ? payload.data.events : [];
  const dictionary = Array.isArray(payload?.data?.dictionary) ? payload.data.dictionary : [];

  if (!Array.isArray(payload?.data?.interface)) errors.push("data.interface must be an array.");
  if (!Array.isArray(payload?.data?.events)) warnings.push("data.events should be an array; empty array assumed.");
  if (!Array.isArray(payload?.data?.dictionary)) warnings.push("data.dictionary should be an array; empty array assumed.");

  rows.forEach((row, index) => {
    REQUIRED_ROW_FIELDS.forEach((field) => {
      if (row?.[field] === undefined || row?.[field] === null || row?.[field] === "") {
        errors.push(`Row ${index} is missing required field: ${field}.`);
      }
    });
    if (!normalizeDate(row?.date)) errors.push(`Row ${index} has an invalid date.`);
  });

  const companies = new Set(rows.map((row) => row.company_id).filter(Boolean));
  const markets = [...new Set(rows.map((row) => row.market).filter(Boolean))];
  const dates = rows.map((row) => normalizeDate(row.date)).filter(Boolean).sort();

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      rowCount: rows.length,
      eventCount: events.length,
      dictionaryCount: dictionary.length,
      companyCount: companies.size,
      companies: [...companies].sort(),
      markets,
      dateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
      hasForecasts: rows.some((row) => String(row.data_type || "").toLowerCase().includes("forecast")),
      hasEvents: events.length > 0 || rows.some((row) => row.has_event || row.event_names),
    },
  };
}

export { REQUIRED_ROW_FIELDS };
