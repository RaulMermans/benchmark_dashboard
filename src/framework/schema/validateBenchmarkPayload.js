import {
  REQUIRED_INTERFACE_FIELDS,
  hasText,
  isForecastRow,
  normalizeDate,
  safeNumber,
} from "../core/benchmarkUtils.js";

function pushIssue(issues, code, message, path = "") {
  issues.push({ code, message, path });
}

function summarizeRows(rows = [], events = []) {
  const companyIds = new Set();
  const markets = new Set();
  const dates = [];

  rows.forEach((row) => {
    if (hasText(row?.company_id)) companyIds.add(String(row.company_id).trim());
    if (hasText(row?.market)) markets.add(String(row.market).trim());
    const date = normalizeDate(row?.date);
    if (date) dates.push(date);
  });

  dates.sort();

  return {
    rowCount: rows.length,
    companyCount: companyIds.size,
    markets: Array.from(markets).sort((a, b) => a.localeCompare(b)),
    dateRange: {
      start: dates[0] ?? null,
      end: dates[dates.length - 1] ?? null,
    },
    hasForecasts: rows.some(isForecastRow),
    hasEvents: events.length > 0 || rows.some((row) => hasText(row?.event_summary) || hasText(row?.event_names)),
  };
}

function validateRequiredFields(row, index, errors) {
  REQUIRED_INTERFACE_FIELDS.forEach((field) => {
    if (!(field in row)) {
      pushIssue(errors, "missing_required_field", `Row ${index} is missing required field "${field}".`, `data.interface[${index}].${field}`);
      return;
    }

    if (!["revenue", "visits"].includes(field) && !hasText(row[field])) {
      pushIssue(errors, "empty_required_field", `Row ${index} has an empty required field "${field}".`, `data.interface[${index}].${field}`);
    }
  });
}

function validateNumericField(row, index, field, warnings) {
  if (!(field in row)) return;
  if (row[field] === null || row[field] === "") return;
  if (safeNumber(row[field]) === null) {
    pushIssue(warnings, "non_numeric_metric", `Row ${index} has a non-numeric "${field}" value.`, `data.interface[${index}].${field}`);
  }
}

export function validateBenchmarkPayload(payload) {
  const errors = [];
  const warnings = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    pushIssue(errors, "invalid_payload", "Payload must be an object.");
    return {
      valid: false,
      errors,
      warnings,
      summary: summarizeRows(),
    };
  }

  if (typeof payload.ok !== "boolean") {
    pushIssue(errors, "invalid_ok", "Payload field \"ok\" must be a boolean.", "ok");
  }

  if (!payload.meta || typeof payload.meta !== "object" || Array.isArray(payload.meta)) {
    pushIssue(warnings, "missing_meta", "Payload should include a meta object.", "meta");
  }

  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    pushIssue(errors, "invalid_data", "Payload must include a data object.", "data");
  }

  const rows = payload.data?.interface;
  const events = payload.data?.events ?? [];
  const dictionary = payload.data?.dictionary ?? [];

  if (!Array.isArray(rows)) {
    pushIssue(errors, "invalid_interface", "Payload data.interface must be an array.", "data.interface");
  }

  if (events !== undefined && !Array.isArray(events)) {
    pushIssue(errors, "invalid_events", "Payload data.events must be an array when present.", "data.events");
  }

  if (dictionary !== undefined && !Array.isArray(dictionary)) {
    pushIssue(errors, "invalid_dictionary", "Payload data.dictionary must be an array when present.", "data.dictionary");
  }

  const interfaceRows = Array.isArray(rows) ? rows : [];

  interfaceRows.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      pushIssue(errors, "invalid_row", `Row ${index} must be an object.`, `data.interface[${index}]`);
      return;
    }

    validateRequiredFields(row, index, errors);
    ["revenue", "visits", "market_share_revenue", "market_share_visits", "revenue_yoy_growth", "visits_yoy_growth", "revenue_mom_growth", "visits_mom_growth", "rank_revenue", "rank_visits", "revenue_per_visit"].forEach((field) =>
      validateNumericField(row, index, field, warnings),
    );

    const normalizedDate = normalizeDate(row.date);
    if (!normalizedDate || Number.isNaN(Date.parse(normalizedDate))) {
      pushIssue(errors, "invalid_date", `Row ${index} has an invalid date.`, `data.interface[${index}].date`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: summarizeRows(interfaceRows, Array.isArray(events) ? events : []),
  };
}
