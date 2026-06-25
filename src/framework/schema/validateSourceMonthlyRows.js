function normalizeDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{1,2})/);
  if (match) return `${match[1]}-${String(match[2]).padStart(2, "0")}-01`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-01`;
}

export function validateSourceMonthlyRows(rows) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(rows)) {
    errors.push("source_monthly must be an array.");
    return { ok: false, errors, warnings, summary: null };
  }

  rows.forEach((row, index) => {
    if (!row?.date || !normalizeDate(row.date)) {
      errors.push(`Row ${index}: date is missing or unparseable.`);
    }
    if (!row?.company_id || String(row.company_id ?? "").trim() === "") {
      errors.push(`Row ${index}: company_id is missing or empty.`);
    }
    if (row?.revenue === undefined || row?.revenue === null || typeof row.revenue !== "number" || row.revenue < 0) {
      errors.push(`Row ${index}: revenue must be a non-negative number.`);
    }
    if (row?.visits === undefined || row?.visits === null || typeof row.visits !== "number" || row.visits < 0) {
      errors.push(`Row ${index}: visits must be a non-negative number.`);
    }
    if (!row?.display_name) warnings.push(`Row ${index}: display_name missing; company_id will be used.`);
    if (!row?.type) warnings.push(`Row ${index}: type missing; "competitor" will be assumed.`);
    if (!row?.market) warnings.push(`Row ${index}: market missing; "default" will be assumed.`);
  });

  const companies = new Set(rows.map((r) => r?.company_id).filter(Boolean));
  const markets = [...new Set(rows.map((r) => r?.market).filter(Boolean))];
  const dates = rows.map((r) => normalizeDate(r?.date)).filter(Boolean).sort();

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      rowCount: rows.length,
      companyCount: companies.size,
      companies: [...companies].sort(),
      markets,
      dateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
    },
  };
}
